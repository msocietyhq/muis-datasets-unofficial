#!/usr/bin/env node

/**
 * Singapore Mosque Directory Scraper (Diff-Aware)
 *
 * Modes:
 *   node scraper.mjs              Full scrape — fetches directory + all detail pages
 *   node scraper.mjs --update     Update mode — only updates entries whose MUIS
 *                                 "Last updated" timestamp is newer than stored.
 *                                 Used by the daily GitHub Action.
 *
 * In --update mode the script:
 *   1. Reads the existing mosques.json
 *   2. Fetches the MUIS directory page
 *   3. Detects added / removed mosques
 *   4. For each mosque, fetches the detail page and compares "Last updated" date
 *   5. Only overwrites MUIS-sourced fields if the page is newer
 *   6. Preserves community-enriched fields (coordinates, logo_url)
 *   7. Exits with code 0 if changes found (Action commits)
 *      or code 2 if nothing changed (Action skips commit)
 *
 * Dependencies:  npm install cheerio
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://www.muis.gov.sg';
const DIRECTORY_URL = `${BASE_URL}/community/mosque/mosque-directory/`;
const DELAY_MS = 500;
const USER_AGENT = 'muis-datasets-unofficial/1.0 (community project)';
const JSON_PATH = 'mosque-directory/data.json';

const isUpdateMode = process.argv.includes('--update');

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

function extractPostalCode(address) {
  // Match "Singapore XXXXXX" pattern first, fall back to last 6-digit number
  const sgMatch = address.match(/Singapore\s+(\d{6})/i);
  if (sgMatch) return sgMatch[1];
  const matches = address.match(/\d{6}/g);
  return matches ? matches[matches.length - 1] : null;
}


/**
 * Parse "Last updated 17 July 2025" from an Isomer page.
 * Returns ISO date string (YYYY-MM-DD) or null.
 */
function extractLastUpdated(html) {
  const $ = cheerio.load(html);
  const text = $('body').text();
  const match = text.match(/Last updated\s+(\d{1,2}\s+\w+\s+\d{4})/i);
  if (!match) return null;
  const parsed = new Date(match[1]);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
}

function isNewer(incoming, existing) {
  if (!existing) return true;
  if (!incoming) return false;
  return new Date(incoming) > new Date(existing);
}

// ── Parse directory page ─────────────────────────────────────────────────────

async function parseDirectory() {
  console.log('📋 Fetching mosque directory...');
  const html = await fetchPage(DIRECTORY_URL);
  const $ = cheerio.load(html);

  const dirLastUpdated = extractLastUpdated(html);
  if (dirLastUpdated) {
    console.log(`   Directory last updated: ${dirLastUpdated}`);
  }

  const mosques = [];

  $('table tbody tr, table tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 3) return;

    const nameCell = $(cells[0]);
    const addressCell = $(cells[1]);
    const contactCell = $(cells[2]);

    const link = nameCell.find('a');
    const name = link.text().trim() || nameCell.text().trim();
    const href = link.attr('href') || '';

    const slugMatch = href.match(/mosque-directory\/([^/]+)/);
    const slug = slugMatch ? slugMatch[1] : name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Replace <br> and block elements with spaces so multi-line addresses don't merge
    addressCell.find('br').replaceWith(' ');
    addressCell.find('p, div').each((_, el) => { $(el).prepend(' '); });
    const address = addressCell.text().replace(/\s+/g, ' ').trim();
    const contactText = contactCell.text().trim();
    const phoneMatch = contactText.match(/(\d{8})/);
    const phone = phoneMatch ? phoneMatch[1] : null;

    const emailLink = contactCell.find('a[href^="mailto:"]');
    const email = emailLink.length ? emailLink.attr('href').replace('mailto:', '') : null;

    mosques.push({ name, slug, address, phone, email, detailUrl: href });
  });

  console.log(`   Found ${mosques.length} mosques in directory`);
  return mosques;
}

// ── Fetch detail page ────────────────────────────────────────────────────────

async function fetchDetail(mosque) {
  const url = mosque.detailUrl.startsWith('http')
    ? mosque.detailUrl
    : `${BASE_URL}${mosque.detailUrl}`;

  try {
    const html = await fetchPage(url);
    const $ = cheerio.load(html);

    const lastUpdated = extractLastUpdated(html);
    const mainContent = $('main').first();

    // Description — first <p> before the 📍 location line, skipping the subtitle
    let description = null;
    mainContent.find('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.startsWith('📍')) return false; // stop at location
      if (text.startsWith('Contact and information about')) return; // skip subtitle
      if (text.length > 20) {
        description = text;
        return false; // take only the first substantial paragraph
      }
    });

    // Website — link inside the 🌐 paragraph only
    let website = null;
    mainContent.find('p').each((_, el) => {
      const text = $(el).text();
      if (text.includes('🌐')) {
        const link = $(el).find('a');
        if (link.length) website = link.attr('href') || null;
        return false;
      }
    });

    // Features — <p> after the "Additional services/features" heading, split by <br>
    const features = [];
    mainContent.find('h2').each((_, el) => {
      if ($(el).text().includes('Additional services/features')) {
        const featureEl = $(el).next('p');
        if (featureEl.length) {
          // Replace <br> with a delimiter before extracting text
          featureEl.find('br').replaceWith('|||');
          featureEl.text().split('|||').forEach((item) => {
            // Strip leading emoji and whitespace
            const cleaned = item.replace(/^[\p{Emoji_Presentation}\p{Emoji}\uFE0F\u200D\s]+/u, '').trim();
            if (cleaned.length > 2) features.push(cleaned);
          });
        }
        return false;
      }
    });

    return { description, website, features, lastUpdated };
  } catch (err) {
    console.error(`   ⚠️  Failed to fetch ${mosque.name}: ${err.message}`);
    return { description: null, website: null, features: [], lastUpdated: null };
  }
}

// ── Full scrape ──────────────────────────────────────────────────────────────

async function fullScrape() {
  const directoryMosques = await parseDirectory();

  console.log(
    `\n🔍 Fetching ${directoryMosques.length} detail pages (~${Math.ceil(
      (directoryMosques.length * DELAY_MS) / 1000
    )}s)...\n`
  );

  const mosques = [];

  for (let i = 0; i < directoryMosques.length; i++) {
    const m = directoryMosques[i];
    console.log(`[${i + 1}/${directoryMosques.length}] ${m.name}...`);
    const detail = await fetchDetail(m);
    if (i < directoryMosques.length - 1) await sleep(DELAY_MS);

    mosques.push({
      slug: m.slug,
      name: m.name,
      address: m.address,
      postal_code: extractPostalCode(m.address),
      phone: m.phone,
      email: m.email,
      website: detail.website,
      description: detail.description,
      features: detail.features,

      coordinates: null,
      logo_url: null,
      muis_url: `${DIRECTORY_URL}${m.slug}/`,
    });
  }

  const output = {
    meta: {
      source: 'MUIS Mosque Directory',
      source_url: DIRECTORY_URL,
      last_scraped: new Date().toISOString().split('T')[0],
      total_count: mosques.length,
    },
    mosques,
  };

  writeFileSync(JSON_PATH, JSON.stringify(output, null, 2) + '\n');
  printSummary(mosques);
}

// ── Update mode (diff-aware) ─────────────────────────────────────────────────

async function updateScrape() {
  if (!existsSync(JSON_PATH)) {
    console.log('⚠️  No existing mosques.json found. Running full scrape instead.\n');
    return fullScrape();
  }

  const existing = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
  const existingBySlug = new Map(existing.mosques.map((m) => [m.slug, m]));

  const directoryMosques = await parseDirectory();
  const incomingSlugs = new Set(directoryMosques.map((m) => m.slug));

  // Detect additions and removals
  const added = directoryMosques.filter((m) => !existingBySlug.has(m.slug));
  const removed = existing.mosques.filter((m) => !incomingSlugs.has(m.slug));

  if (added.length) console.log(`\n🆕 New mosques: ${added.map((m) => m.name).join(', ')}`);
  if (removed.length) console.log(`\n🗑️  Removed: ${removed.map((m) => m.name).join(', ')}`);

  console.log(
    `\n🔍 Checking ${directoryMosques.length} detail pages for updates...\n`
  );

  let updatedCount = 0;
  let skippedCount = 0;
  const finalMosques = [];

  for (let i = 0; i < directoryMosques.length; i++) {
    const m = directoryMosques[i];
    const progress = `[${i + 1}/${directoryMosques.length}]`;
    const existingMosque = existingBySlug.get(m.slug);

    const detail = await fetchDetail(m);
    if (i < directoryMosques.length - 1) await sleep(DELAY_MS);

    const pageUpdated = detail.lastUpdated;
    const lastScraped = existing.meta.last_scraped || null;
    const pageIsNewer = isNewer(pageUpdated, lastScraped);

    // Check if directory-level fields changed
    const directoryChanged =
      existingMosque &&
      (existingMosque.address !== m.address ||
        existingMosque.phone !== m.phone ||
        existingMosque.email !== m.email ||
        existingMosque.name !== m.name);

    if (!existingMosque || pageIsNewer || directoryChanged) {
      const reason = !existingMosque
        ? 'NEW'
        : directoryChanged
        ? 'directory fields changed'
        : `page updated ${pageUpdated} (last scraped ${lastScraped})`;

      console.log(`${progress} ✏️  ${m.name} — updating (${reason})`);
      updatedCount++;

      finalMosques.push({
        slug: m.slug,
        name: m.name,
        address: m.address,
        postal_code: extractPostalCode(m.address),
        phone: m.phone,
        email: m.email,
        website: detail.website,
        description: detail.description,
        features: detail.features,
  
        // Preserve coordinates unless address changed (re-geocode needed)
        coordinates: (existingMosque && existingMosque.address === m.address)
          ? existingMosque.coordinates
          : null,
        logo_url: existingMosque?.logo_url ?? null,
        muis_url: `${DIRECTORY_URL}${m.slug}/`,
      });
    } else {
      console.log(`${progress} ✅ ${m.name} — unchanged`);
      skippedCount++;
      finalMosques.push(existingMosque);
    }
  }

  const hasChanges = updatedCount > 0 || added.length > 0 || removed.length > 0;

  const output = {
    meta: {
      source: 'MUIS Mosque Directory',
      source_url: DIRECTORY_URL,
      last_scraped: hasChanges
        ? new Date().toISOString().split('T')[0]
        : existing.meta.last_scraped,
      last_checked: new Date().toISOString(),
      total_count: finalMosques.length,
    },
    mosques: finalMosques,
  };

  writeFileSync(JSON_PATH, JSON.stringify(output, null, 2) + '\n');

  console.log(`\n📊 Summary:`);
  console.log(`   ✏️  ${updatedCount} updated`);
  console.log(`   ✅ ${skippedCount} unchanged`);
  console.log(`   🆕 ${added.length} added`);
  console.log(`   🗑️  ${removed.length} removed`);

  if (!hasChanges) {
    console.log(`\n💤 No changes detected.`);
    process.exit(2); // Signal to GitHub Action: skip commit
  } else {
    console.log(`\n🔄 Changes detected! mosques.json updated.`);
    printSummary(finalMosques);
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────

function printSummary(mosques) {
  console.log(`\n✅ mosques.json — ${mosques.length} mosques`);
  console.log(`   📝 ${mosques.filter((m) => m.description).length} descriptions`);

  console.log(`   ⭐ ${mosques.filter((m) => m.features?.length > 0).length} features`);
  console.log(`   🌐 ${mosques.filter((m) => m.website).length} websites`);
  console.log(`   🗺️  ${mosques.filter((m) => m.coordinates?.lat).length} coordinates`);
}

// ── Entry point ──────────────────────────────────────────────────────────────

if (isUpdateMode) {
  console.log('🔄 Running in UPDATE mode (diff-aware)\n');
  updateScrape().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
} else {
  console.log('🚀 Running FULL scrape\n');
  fullScrape().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
