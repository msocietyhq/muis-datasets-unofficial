#!/usr/bin/env node

/**
 * Mosque Logo Scraper
 *
 * Fetches logos from mosque websites by checking (in priority order):
 *   1. apple-touch-icon link tag (most reliably the logo, 180-192px)
 *   2. largest icon link tag
 *   3. og:image as last resort (often a photo, not a logo)
 *
 * Downloads images to mosque-directory/logos/{slug}.png
 * Updates logo_url in data.json
 *
 * Usage:
 *   node mosque-directory/scrape-logos.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import * as cheerio from 'cheerio';
import { resolve as urlResolve } from 'url';
import { join } from 'path';

const JSON_PATH = 'mosque-directory/data.json';
const LOGOS_DIR = 'mosque-directory/logos';
const DELAY_MS = 500;
const TIMEOUT_MS = 10000;
const USER_AGENT = 'muis-data-unofficial/1.0 (community project)';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch HTML from a URL with timeout and redirect handling.
 */
async function fetchHTML(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return { html: await res.text(), finalUrl: res.url };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Download an image from a URL and return the buffer.
 */
async function downloadImage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 100) return null; // skip tiny/empty files

    return buffer;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Extract the best logo URL from page HTML.
 * Priority: apple-touch-icon > largest icon > og:image (last resort)
 * apple-touch-icon and favicon are most reliably the actual logo,
 * while og:image is often a banner photo.
 */
function findLogoUrl(html, baseUrl) {
  const $ = cheerio.load(html);

  // 1. apple-touch-icon (largest first) — most reliably the logo
  const touchIcons = [];
  $('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const sizes = $(el).attr('sizes') || '0x0';
    const size = parseInt(sizes.split('x')[0], 10) || 0;
    touchIcons.push({ href, size });
  });
  if (touchIcons.length) {
    touchIcons.sort((a, b) => b.size - a.size);
    return new URL(touchIcons[0].href, baseUrl).href;
  }

  // 2. icon links (largest first)
  const icons = [];
  $('link[rel="icon"], link[rel="shortcut icon"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const sizes = $(el).attr('sizes') || '0x0';
    const size = parseInt(sizes.split('x')[0], 10) || 0;
    icons.push({ href, size });
  });
  if (icons.length) {
    icons.sort((a, b) => b.size - a.size);
    return new URL(icons[0].href, baseUrl).href;
  }

  // 3. og:image as last resort (often a photo, not a logo)
  const ogImage =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="og:image"]').attr('content');
  if (ogImage) return new URL(ogImage, baseUrl).href;

  return null;
}

async function main() {
  const data = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));

  if (!existsSync(LOGOS_DIR)) {
    mkdirSync(LOGOS_DIR, { recursive: true });
  }

  const withWebsite = data.mosques.filter((m) => m.website);
  console.log(`🖼️  Scraping logos for ${withWebsite.length} mosques with websites...\n`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < withWebsite.length; i++) {
    const mosque = withWebsite[i];
    const logoPath = join(LOGOS_DIR, `${mosque.slug}.png`);
    const progress = `[${i + 1}/${withWebsite.length}]`;

    // Skip if already downloaded
    if (existsSync(logoPath)) {
      console.log(`${progress} ${mosque.name} — already has logo, skipping`);
      mosque.logo_url = logoPath;
      skipped++;
      continue;
    }

    console.log(`${progress} ${mosque.name} (${mosque.website})...`);

    // Fetch the website HTML
    const result = await fetchHTML(mosque.website);
    if (!result) {
      console.log(`   ❌ Could not fetch website`);
      failed++;
      if (i < withWebsite.length - 1) await sleep(DELAY_MS);
      continue;
    }

    // Find logo URL
    const logoUrl = findLogoUrl(result.html, result.finalUrl);
    if (!logoUrl) {
      console.log(`   ❌ No logo found on page`);
      failed++;
      if (i < withWebsite.length - 1) await sleep(DELAY_MS);
      continue;
    }

    console.log(`   📎 ${logoUrl.substring(0, 80)}...`);

    // Download the image (handle data URIs and regular URLs)
    let imageBuffer;
    if (logoUrl.startsWith('data:')) {
      const match = logoUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
      imageBuffer = match ? Buffer.from(match[1], 'base64') : null;
    } else {
      imageBuffer = await downloadImage(logoUrl);
    }
    if (!imageBuffer) {
      console.log(`   ❌ Could not download image`);
      failed++;
      if (i < withWebsite.length - 1) await sleep(DELAY_MS);
      continue;
    }

    // Save to file
    await writeFile(logoPath, imageBuffer);
    mosque.logo_url = logoPath;
    downloaded++;
    console.log(`   ✅ Saved (${Math.round(imageBuffer.length / 1024)}KB)`);

    if (i < withWebsite.length - 1) await sleep(DELAY_MS);
  }

  // Write updated data back
  writeFileSync(JSON_PATH, JSON.stringify(data, null, 2) + '\n');

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ ${downloaded} downloaded`);
  console.log(`   ⏭️  ${skipped} already had logos`);
  console.log(`   ❌ ${failed} failed`);
  console.log(`   📁 ${data.mosques.filter((m) => m.logo_url).length}/${data.mosques.length} mosques have logos`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
