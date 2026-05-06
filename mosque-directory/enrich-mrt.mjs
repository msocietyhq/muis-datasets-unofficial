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
  'al-muttaqin':                 [{ station: 'Ang Mo Kio', lines: ['NS'], note: '10 min walk' }],
  'al-ansar':                    [{ station: 'Bedok', lines: ['EW'], note: '9 min walk' }],
  'bencoolen':                   [{ station: 'Bencoolen', lines: ['DT'], note: '1 min walk' }],
  'an-nahdhah':                  [{ station: 'Bishan', lines: ['NS', 'CC'], note: '7 min walk' }],
  'maarof':                      [{ station: 'Boon Lay', lines: ['EW'], note: '29 min walk' }],
  'sultan':                      [{ station: 'Bugis', lines: ['EW', 'DT'], note: '7 min walk' }],
  'ar-raudhah':                  [{ station: 'Bukit Batok', lines: ['NS'], note: '13 min walk' }],
  'al-mawaddah':                 [{ station: 'Buangkok', lines: ['NE'], note: '8 min walk' }],
  'al-khair':                    [{ station: 'Choa Chu Kang', lines: ['NS'], note: '±2 bus stops' }],
  'omar-kampong-melaka':         [{ station: 'Clarke Quay', lines: ['NE'], note: '5 min walk' }],
  'mujahidin':                   [{ station: 'Commonwealth', lines: ['EW'], note: '9 min walk' }],
  'darul-aman':                  [{ station: 'Eunos', lines: ['EW'], note: '5 min walk' }],
  'angullia':                    [{ station: 'Farrer Park', lines: ['NE'], note: '5 min walk' }],
  'abdul-gafoor':                [
                                   { station: 'Jalan Besar', lines: ['DT'], note: '3 min walk' },
                                   { station: 'Rochor', lines: ['DT'], note: '5 min walk' },
                                 ],
  'kassim':                      [{ station: 'Kembangan', lines: ['EW'], note: '4 min walk' }],
  'assyakirin':                  [{ station: 'Lakeside', lines: ['EW'], note: '22 min walk' }],
  'khadijah':                    [{ station: 'Lavender', lines: ['EW'], note: '38 min walk' }],
  'malabar':                     [{ station: 'Lavender', lines: ['EW'], note: '9 min walk' }],
  'sallim-mattar':               [{ station: 'Mattar', lines: ['DT'], note: '9 min walk' }],
  'jamae-chulia':                [{ station: 'Maxwell', lines: ['TE'], note: '6 min walk' }],
  'abdul-hamid-kampung-pasiran': [{ station: 'Novena', lines: ['NS'], note: '7 min walk' }],
  'al-falah':                    [
                                   { station: 'Orchard', lines: ['NS', 'TE'], note: '23 min walk' },
                                   { station: 'Somerset', lines: ['NS'], note: '8 min walk' },
                                 ],
  'wak-tanjong':                 [{ station: 'Paya Lebar', lines: ['EW', 'CC'], note: '3 min walk' }],
  'alkaff-upper-serangoon':      [{ station: 'Potong Pasir', lines: ['NE'], note: '4 min walk' }],
  'al-islah':                    [{ station: 'Punggol', lines: ['NE'], note: '32 min walk' }],
  'moulana-mohd-ali':            [{ station: 'Raffles Place', lines: ['NS', 'EW'], note: '10 min walk' }],
  'jamiyah-ar-rabitah':          [{ station: 'Redhill', lines: ['EW'], note: '6 min walk' }],
  'haji-muhammad-salleh--p':     [{ station: 'Shenton Way', lines: ['TE'], note: '12 min walk' }],
  'kampung-siglap':              [{ station: 'Siglap', lines: ['TE'], note: '18 min walk' }],
  'ba-alwie':                    [{ station: 'Stevens', lines: ['TE', 'DT'], note: '6 min walk' }],
  'darul-ghufran':               [{ station: 'Tampines', lines: ['EW', 'DT'], note: '27 min walk' }],
  'al-abrar':                    [{ station: 'Telok Ayer', lines: ['TE'], note: '4 min walk' }],
  'yusof-ishak':                 [{ station: 'Woodlands South', lines: ['TE'], note: '6 min walk' }],
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
