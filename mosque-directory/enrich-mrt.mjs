#!/usr/bin/env node

/**
 * Enrich data.json with nearby MRT stations (community-curated).
 *
 * Line codes: NS (red), EW (green), DT (blue), CC (orange), NE (purple), TE (brown).
 * Some mosques are walkable from more than one station, so each entry is an
 * array of { station, lines, note? } objects.
 *
 * Note: Masjid Temenggong Daeng Ibrahim (HarbourFront) is not in the MUIS
 * directory, so it's intentionally absent from this mapping.
 *
 * Usage:
 *   node mosque-directory/enrich-mrt.mjs
 */

import { readFileSync, writeFileSync } from 'fs';

const JSON_PATH = 'mosque-directory/data.json';

const MRT_BY_SLUG = {
  'al-muttaqin':                 [{ station: 'Ang Mo Kio', lines: ['NS'] }],
  'al-ansar':                    [{ station: 'Bedok', lines: ['EW'] }],
  'bencoolen':                   [{ station: 'Bencoolen', lines: ['DT'] }],
  'an-nahdhah':                  [{ station: 'Bishan', lines: ['NS', 'CC'] }],
  'maarof':                      [{ station: 'Boon Lay', lines: ['EW'] }],
  'sultan':                      [{ station: 'Bugis', lines: ['EW', 'DT'] }],
  'ar-raudhah':                  [{ station: 'Bukit Batok', lines: ['NS'] }],
  'al-mawaddah':                 [{ station: 'Buangkok', lines: ['NE'] }],
  'al-khair':                    [{ station: 'Choa Chu Kang', lines: ['NS'], note: '±2 bus stops' }],
  'omar-kampong-melaka':         [{ station: 'Clarke Quay', lines: ['NE'] }],
  'mujahidin':                   [{ station: 'Commonwealth', lines: ['EW'] }],
  'darul-aman':                  [{ station: 'Eunos', lines: ['EW'] }],
  'angullia':                    [{ station: 'Farrer Park', lines: ['NE'] }],
  'abdul-gafoor':                [
                                   { station: 'Jalan Besar', lines: ['DT'] },
                                   { station: 'Rochor', lines: ['DT'] },
                                 ],
  'kassim':                      [{ station: 'Kembangan', lines: ['EW'] }],
  'assyakirin':                  [{ station: 'Lakeside', lines: ['EW'] }],
  'khadijah':                    [{ station: 'Lavender', lines: ['EW'] }],
  'malabar':                     [{ station: 'Lavender', lines: ['EW'] }],
  'sallim-mattar':               [{ station: 'Mattar', lines: ['DT'] }],
  'jamae-chulia':                [{ station: 'Maxwell', lines: ['TE'] }],
  'abdul-hamid-kampung-pasiran': [{ station: 'Novena', lines: ['NS'] }],
  'al-falah':                    [
                                   { station: 'Orchard', lines: ['NS', 'TE'] },
                                   { station: 'Somerset', lines: ['NS'] },
                                 ],
  'wak-tanjong':                 [{ station: 'Paya Lebar', lines: ['EW', 'CC'] }],
  'alkaff-upper-serangoon':      [{ station: 'Potong Pasir', lines: ['NE'] }],
  'al-islah':                    [{ station: 'Punggol', lines: ['NE'] }],
  'moulana-mohd-ali':            [{ station: 'Raffles Place', lines: ['NS', 'EW'] }],
  'jamiyah-ar-rabitah':          [{ station: 'Redhill', lines: ['EW'] }],
  'haji-muhammad-salleh--p':     [{ station: 'Shenton Way', lines: ['TE'] }],
  'kampung-siglap':              [{ station: 'Siglap', lines: ['TE'] }],
  'ba-alwie':                    [{ station: 'Stevens', lines: ['TE', 'DT'] }],
  'darul-ghufran':               [{ station: 'Tampines', lines: ['EW', 'DT'] }],
  'al-abrar':                    [{ station: 'Telok Ayer', lines: ['TE'] }],
  'yusof-ishak':                 [{ station: 'Woodlands South', lines: ['TE'] }],
};

const data = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
const slugs = new Set(data.mosques.map((m) => m.slug));

const orphanSlugs = Object.keys(MRT_BY_SLUG).filter((s) => !slugs.has(s));
if (orphanSlugs.length) {
  console.warn(`⚠️  Mapping references slugs not in data.json: ${orphanSlugs.join(', ')}`);
}

let updated = 0;
for (const mosque of data.mosques) {
  const mapping = MRT_BY_SLUG[mosque.slug];
  if (!mapping) continue;
  if (JSON.stringify(mosque.nearest_mrt) === JSON.stringify(mapping)) continue;
  mosque.nearest_mrt = mapping;
  updated++;
}

if (updated === 0) {
  console.log('💤 nearest_mrt already up to date.');
  process.exit(0);
}

writeFileSync(JSON_PATH, JSON.stringify(data, null, 2) + '\n');
console.log(`🚇 Updated nearest_mrt on ${updated} mosque(s).`);
