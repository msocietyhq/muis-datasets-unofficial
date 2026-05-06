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
  'al-muttaqin':                 [{ station: 'Ang Mo Kio', lines: ['NS'], note: '15 min walk (1.0 km)' }],
  'al-ansar':                    [{ station: 'Bedok', lines: ['EW'], note: '9 min walk (600 m)' }],
  'bencoolen':                   [{ station: 'Bencoolen', lines: ['DT'], note: '1 min walk (59 m)' }],
  'an-nahdhah':                  [{ station: 'Bishan', lines: ['NS', 'CC'], note: '6 min walk (400 m)' }],
  'maarof':                      [{ station: 'Boon Lay', lines: ['EW'], note: '32 min walk (2.3 km)' }],
  'sultan':                      [{ station: 'Bugis', lines: ['EW', 'DT'], note: '5 min walk (350 m)' }],
  'ar-raudhah':                  [{ station: 'Bukit Batok', lines: ['NS'], note: '15 min walk (1.1 km)' }],
  'al-mawaddah':                 [{ station: 'Buangkok', lines: ['NE'], note: '7 min walk (550 m)' }],
  'al-khair':                    [{ station: 'Choa Chu Kang', lines: ['NS'], note: '11 min walk (800 m)' }],
  'omar-kampong-melaka':         [{ station: 'Clarke Quay', lines: ['NE'], note: '6 min walk (450 m)' }],
  'mujahidin':                   [{ station: 'Commonwealth', lines: ['EW'], note: '9 min walk (650 m)' }],
  'darul-aman':                  [{ station: 'Eunos', lines: ['EW'], note: '6 min walk (400 m)' }],
  'angullia':                    [{ station: 'Farrer Park', lines: ['NE'], note: '4 min walk (300 m)' }],
  'abdul-gafoor':                [
                                   { station: 'Jalan Besar', lines: ['DT'], note: '4 min walk (270 m)' },
                                   { station: 'Rochor', lines: ['DT'], note: '5 min walk (350 m)' },
                                 ],
  'kassim':                      [{ station: 'Kembangan', lines: ['EW'], note: '4 min walk (270 m)' }],
  'assyakirin':                  [{ station: 'Lakeside', lines: ['EW'], note: '17 min walk (1.3 km)' }],
  'khadijah':                    [{ station: 'Lavender', lines: ['EW'], note: '39 min walk (2.8 km)' }],
  'malabar':                     [{ station: 'Lavender', lines: ['EW'], note: '6 min walk (450 m)' }],
  'sallim-mattar':               [{ station: 'Mattar', lines: ['DT'], note: '8 min walk (600 m)' }],
  'jamae-chulia':                [{ station: 'Maxwell', lines: ['TE'], note: '4 min walk (350 m)' }],
  'abdul-hamid-kampung-pasiran': [{ station: 'Novena', lines: ['NS'], note: '7 min walk (450 m)' }],
  'al-falah':                    [
                                   { station: 'Orchard', lines: ['NS', 'TE'], note: '8 min walk (600 m)' },
                                   { station: 'Somerset', lines: ['NS'], note: '8 min walk (550 m)' },
                                 ],
  'wak-tanjong':                 [{ station: 'Paya Lebar', lines: ['EW', 'CC'], note: '1 min walk (58 m)' }],
  'alkaff-upper-serangoon':      [{ station: 'Potong Pasir', lines: ['NE'], note: '5 min walk (350 m)' }],
  'al-islah':                    [{ station: 'Punggol', lines: ['NE'], note: '8 min walk (600 m)' }],
  'moulana-mohd-ali':            [{ station: 'Raffles Place', lines: ['NS', 'EW'], note: '6 min walk (450 m)' }],
  'jamiyah-ar-rabitah':          [{ station: 'Redhill', lines: ['EW'], note: '5 min walk (400 m)' }],
  'haji-muhammad-salleh--p':     [{ station: 'Shenton Way', lines: ['TE'], note: '11 min walk (800 m)' }],
  'kampung-siglap':              [{ station: 'Siglap', lines: ['TE'], note: '3 min walk (240 m)' }],
  'ba-alwie':                    [{ station: 'Stevens', lines: ['TE', 'DT'], note: '6 min walk (350 m)' }],
  'darul-ghufran':               [{ station: 'Tampines', lines: ['EW', 'DT'], note: '6 min walk (450 m)' }],
  'al-abrar':                    [{ station: 'Telok Ayer', lines: ['TE'], note: '4 min walk (270 m)' }],
  'yusof-ishak':                 [{ station: 'Woodlands South', lines: ['TE'], note: '6 min walk (450 m)' }],
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
