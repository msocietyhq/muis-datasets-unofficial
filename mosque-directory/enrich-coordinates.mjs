#!/usr/bin/env node

/**
 * Enrich mosques.json with coordinates using OneMap API (Singapore's official geocoding).
 * 
 * OneMap is free, no API key needed, and authoritative for Singapore addresses.
 * https://www.onemap.gov.sg/apidocs/
 * 
 * Usage:
 *   node enrich-coordinates.mjs
 * 
 * This reads mosques.json, geocodes each mosque by postal code via OneMap,
 * and writes the enriched result back to mosques.json.
 */

import { readFileSync, writeFileSync } from 'fs';

const DELAY_MS = 300;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocodePostalCode(postalCode) {
  if (!postalCode) return null;

  try {
    const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${postalCode}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
    const res = await fetch(url);
    if (!res.ok) return null;
    
    const data = await res.json();
    if (data.found > 0) {
      const result = data.results[0];
      return {
        lat: parseFloat(result.LATITUDE),
        lng: parseFloat(result.LONGITUDE),
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  const data = JSON.parse(readFileSync('mosque-directory/data.json', 'utf-8'));

  // Only enrich mosques missing coordinates. The mosque scraper resets
  // coordinates to null when an address changes, so this naturally gates
  // enrichment to address changes (and first-time runs).
  const needsEnrichment = data.mosques.filter(
    (m) => !(m.coordinates?.lat && m.coordinates?.lng)
  );

  if (needsEnrichment.length === 0) {
    console.log('💤 All mosques already have coordinates — nothing to enrich.');
    return;
  }

  console.log(`🗺️  Enriching ${needsEnrichment.length} mosque(s) missing coordinates via OneMap...\n`);

  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < needsEnrichment.length; i++) {
    const mosque = needsEnrichment[i];

    console.log(`[${i + 1}/${needsEnrichment.length}] ${mosque.name} (${mosque.postal_code})...`);
    const coords = await geocodePostalCode(mosque.postal_code);

    if (coords) {
      mosque.coordinates = coords;
      enriched++;
      console.log(`   ✅ ${coords.lat}, ${coords.lng}`);
    } else {
      failed++;
      console.log(`   ❌ Could not geocode`);
    }

    if (i < needsEnrichment.length - 1) await sleep(DELAY_MS);
  }

  if (enriched === 0) {
    console.log(`\n💤 No mosques were geocoded (${failed} failed). Leaving data.json untouched.`);
    return;
  }

  data.meta.last_enriched_coordinates = new Date().toISOString().split('T')[0];
  writeFileSync('mosque-directory/data.json', JSON.stringify(data, null, 2) + '\n');

  console.log(`\n✅ Done! ${enriched} geocoded, ${failed} failed.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
