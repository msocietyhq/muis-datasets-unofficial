#!/usr/bin/env node

/**
 * ARS (Asatizah Recognition Scheme) Directory Scraper
 *
 * Modes:
 *   node scraper.mjs              Full scrape
 *   node scraper.mjs --update     Only update if MUIS page timestamp is newer
 *
 * The ARS directory is an Isomer "database" page that embeds all ~5,200
 * asatizah records in the page's React Server Component payload.
 * No pagination or headless browser needed — one fetch gets everything.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fetchPage, extractLastUpdated, extractRscTableData } from '../utils.mjs';

const URL = 'https://www.muis.gov.sg/education/asatizah-development/asatizah-recognition-scheme/ars-directory/';
const JSON_PATH = 'ars-directory/data.json';
const isUpdateMode = process.argv.includes('--update');

// ── Parse ARS data from page ─────────────────────────────────────────────────

function parseArsData(html) {
  const lastUpdated = extractLastUpdated(html);

  // The RSC payload contains rows like:
  // {\"row\":[\"Ustazah\",\"Aathirah Binti Khamsani\",\"Tier 1 (Asatizah)\"],\"key\":\"...\"}
  // We need to handle both escaped and unescaped JSON depending on how the payload is encoded
  const items = [];

  // Pattern for escaped JSON in RSC payloads
  const escapedRegex = /\{\\"row\\":\[\\"([^\\]*?)\\",\\"([^\\]*?)\\",\\"([^\\]*?)\\"\],\\"key\\":\\"[^\\]*?\\"\}/g;
  let match;
  while ((match = escapedRegex.exec(html)) !== null) {
    items.push({
      title: match[1].trim(),
      name: match[2].trim(),
      category: match[3].trim(),
    });
  }

  // If escaped pattern didn't work, try unescaped pattern
  if (items.length === 0) {
    const unescapedRegex = /\{"row":\["([^"]*?)","([^"]*?)","([^"]*?)"\],"key":"[^"]*?"\}/g;
    while ((match = unescapedRegex.exec(html)) !== null) {
      items.push({
        title: match[1].trim(),
        name: match[2].trim(),
        category: match[3].trim(),
      });
    }
  }

  return { items, lastUpdated };
}

// ── Build the JSON ───────────────────────────────────────────────────────────

function buildOutput(items, lastUpdated) {
  // Derive tier counts
  const tierCounts = {};
  items.forEach((item) => {
    tierCounts[item.category] = (tierCounts[item.category] || 0) + 1;
  });

  return {
    meta: {
      source: 'MUIS ARS Directory',
      source_url: URL,
      last_scraped: new Date().toISOString().split('T')[0],
      muis_last_updated: lastUpdated,
      total_count: items.length,
      tier_counts: tierCounts,
    },
    asatizah: items,
  };
}

// ── Full scrape ──────────────────────────────────────────────────────────────

async function fullScrape() {
  console.log('📋 Fetching ARS directory...');
  const html = await fetchPage(URL);
  const { items, lastUpdated } = parseArsData(html);

  if (items.length === 0) {
    console.error('❌ No ARS entries found. The page structure may have changed.');
    process.exit(1);
  }

  console.log(`   Found ${items.length} asatizah (MUIS last updated: ${lastUpdated})`);

  const output = buildOutput(items, lastUpdated);
  writeFileSync(JSON_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log(`✅ Written to ${JSON_PATH}`);
}

// ── Update mode ──────────────────────────────────────────────────────────────

async function updateScrape() {
  if (!existsSync(JSON_PATH)) {
    console.log('⚠️  No existing data.json found. Running full scrape.\n');
    return fullScrape();
  }

  const existing = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
  const storedDate = existing.meta?.muis_last_updated;

  console.log('📋 Fetching ARS directory...');
  const html = await fetchPage(URL);
  const pageDate = extractLastUpdated(html);

  console.log(`   MUIS page: ${pageDate} | Stored: ${storedDate}`);

  if (storedDate && pageDate && new Date(pageDate) <= new Date(storedDate)) {
    console.log('💤 No changes detected.');
    process.exit(2);
  }

  console.log('🔄 Page is newer — re-extracting data...');
  const { items, lastUpdated } = parseArsData(html);

  if (items.length === 0) {
    console.error('❌ No ARS entries found. The page structure may have changed.');
    process.exit(1);
  }

  const countDiff = items.length - (existing.meta?.total_count || 0);
  console.log(`   Found ${items.length} asatizah (${countDiff >= 0 ? '+' : ''}${countDiff} from last sync)`);

  const output = buildOutput(items, lastUpdated);
  output.meta.last_checked = new Date().toISOString();
  writeFileSync(JSON_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log(`✅ Updated ${JSON_PATH}`);
}

// ── Entry point ──────────────────────────────────────────────────────────────

if (isUpdateMode) {
  console.log('🔄 ARS: UPDATE mode\n');
  updateScrape().catch((err) => { console.error('Fatal:', err); process.exit(1); });
} else {
  console.log('🚀 ARS: FULL scrape\n');
  fullScrape().catch((err) => { console.error('Fatal:', err); process.exit(1); });
}
