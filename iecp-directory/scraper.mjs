#!/usr/bin/env node

/**
 * IECP (Islamic Education Centres and Providers) Directory Scraper
 *
 * Modes:
 *   node scraper.mjs              Full scrape
 *   node scraper.mjs --update     Only update if MUIS page timestamp is newer
 *
 * Same approach as ARS — data is embedded in the Isomer RSC payload.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fetchPage, extractLastUpdated } from '../utils.mjs';

const URL = 'https://www.muis.gov.sg/education/asatizah-development/asatizah-recognition-scheme/iecp-directory/';
const JSON_PATH = 'iecp-directory/data.json';
const isUpdateMode = process.argv.includes('--update');

// ── Parse IECP data from page ────────────────────────────────────────────────

function parseIecpData(html) {
  const lastUpdated = extractLastUpdated(html);
  const items = [];

  // IECP rows have 2 columns: [number, name]
  // Pattern: {"row":[1,"ABDUL ALEEM SIDDIQUE MOSQUE"],"key":"..."}
  // In RSC payloads these are escaped

  // Escaped pattern (RSC)
  const escapedRegex = /\{\\"row\\":\[(\d+),\\"([^\\]*?)\\"\],\\"key\\":\\"[^\\]*?\\"\}/g;
  let match;
  while ((match = escapedRegex.exec(html)) !== null) {
    items.push({
      number: parseInt(match[1], 10),
      name: match[2].trim(),
    });
  }

  // Fallback: unescaped pattern
  if (items.length === 0) {
    const unescapedRegex = /\{"row":\[(\d+),"([^"]*?)"\],"key":"[^"]*?"\}/g;
    while ((match = unescapedRegex.exec(html)) !== null) {
      items.push({
        number: parseInt(match[1], 10),
        name: match[2].trim(),
      });
    }
  }

  return { items, lastUpdated };
}

// ── Build the JSON ───────────────────────────────────────────────────────────

function buildOutput(items, lastUpdated) {
  // Categorise by type
  const mosques = items.filter((i) => i.name.includes('MOSQUE'));
  const madrasahs = items.filter((i) => i.name.includes('MADRASAH'));
  const others = items.filter((i) => !i.name.includes('MOSQUE') && !i.name.includes('MADRASAH'));

  return {
    meta: {
      source: 'MUIS IECP Directory',
      source_url: URL,
      last_scraped: new Date().toISOString().split('T')[0],
      muis_last_updated: lastUpdated,
      total_count: items.length,
      breakdown: {
        mosques: mosques.length,
        madrasahs: madrasahs.length,
        other_centres: others.length,
      },
    },
    iecps: items,
  };
}

// ── Full scrape ──────────────────────────────────────────────────────────────

async function fullScrape() {
  console.log('📋 Fetching IECP directory...');
  const html = await fetchPage(URL);
  const { items, lastUpdated } = parseIecpData(html);

  if (items.length === 0) {
    console.error('❌ No IECP entries found. The page structure may have changed.');
    process.exit(1);
  }

  console.log(`   Found ${items.length} IECPs (MUIS last updated: ${lastUpdated})`);

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

  console.log('📋 Fetching IECP directory...');
  const html = await fetchPage(URL);
  const pageDate = extractLastUpdated(html);

  console.log(`   MUIS page: ${pageDate} | Stored: ${storedDate}`);

  if (storedDate && pageDate && new Date(pageDate) <= new Date(storedDate)) {
    console.log('💤 No changes detected.');
    process.exit(2);
  }

  console.log('🔄 Page is newer — re-extracting data...');
  const { items, lastUpdated } = parseIecpData(html);

  if (items.length === 0) {
    console.error('❌ No IECP entries found. The page structure may have changed.');
    process.exit(1);
  }

  const countDiff = items.length - (existing.meta?.total_count || 0);
  console.log(`   Found ${items.length} IECPs (${countDiff >= 0 ? '+' : ''}${countDiff} from last sync)`);

  const output = buildOutput(items, lastUpdated);
  output.meta.last_checked = new Date().toISOString();
  writeFileSync(JSON_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log(`✅ Updated ${JSON_PATH}`);
}

// ── Entry point ──────────────────────────────────────────────────────────────

if (isUpdateMode) {
  console.log('🔄 IECP: UPDATE mode\n');
  updateScrape().catch((err) => { console.error('Fatal:', err); process.exit(1); });
} else {
  console.log('🚀 IECP: FULL scrape\n');
  fullScrape().catch((err) => { console.error('Fatal:', err); process.exit(1); });
}
