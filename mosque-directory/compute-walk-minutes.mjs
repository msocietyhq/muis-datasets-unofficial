#!/usr/bin/env node

/**
 * One-shot helper: compute walking minutes from each curated MRT station
 * to its mosque, using OneMap geocoding + OSM-DE foot router.
 *
 * Run once from the repo root:
 *   node mosque-directory/compute-walk-minutes.mjs > /tmp/walk.json
 *
 * The result is pasted back into enrich-mrt.mjs as note text. This file
 * is kept around for reproducibility / future updates.
 */

import { readFileSync } from 'fs';

const DELAY_MS = 350;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MRT_BY_SLUG = {
  'al-muttaqin':                 [{ station: 'Ang Mo Kio' }],
  'al-ansar':                    [{ station: 'Bedok' }],
  'bencoolen':                   [{ station: 'Bencoolen' }],
  'an-nahdhah':                  [{ station: 'Bishan' }],
  'maarof':                      [{ station: 'Boon Lay' }],
  'sultan':                      [{ station: 'Bugis' }],
  'ar-raudhah':                  [{ station: 'Bukit Batok' }],
  'al-mawaddah':                 [{ station: 'Buangkok' }],
  'omar-kampong-melaka':         [{ station: 'Clarke Quay' }],
  'mujahidin':                   [{ station: 'Commonwealth' }],
  'darul-aman':                  [{ station: 'Eunos' }],
  'angullia':                    [{ station: 'Farrer Park' }],
  'abdul-gafoor':                [{ station: 'Jalan Besar' }, { station: 'Rochor' }],
  'kassim':                      [{ station: 'Kembangan' }],
  'assyakirin':                  [{ station: 'Lakeside' }],
  'khadijah':                    [{ station: 'Lavender' }],
  'malabar':                     [{ station: 'Lavender' }],
  'sallim-mattar':               [{ station: 'Mattar' }],
  'jamae-chulia':                [{ station: 'Maxwell' }],
  'abdul-hamid-kampung-pasiran': [{ station: 'Novena' }],
  'al-falah':                    [{ station: 'Orchard' }, { station: 'Somerset' }],
  'wak-tanjong':                 [{ station: 'Paya Lebar' }],
  'alkaff-upper-serangoon':      [{ station: 'Potong Pasir' }],
  'al-islah':                    [{ station: 'Punggol' }],
  'moulana-mohd-ali':            [{ station: 'Raffles Place' }],
  'jamiyah-ar-rabitah':          [{ station: 'Redhill' }],
  'haji-muhammad-salleh--p':     [{ station: 'Shenton Way' }],
  'kampung-siglap':              [{ station: 'Siglap' }],
  'ba-alwie':                    [{ station: 'Stevens' }],
  'darul-ghufran':               [{ station: 'Tampines' }],
  'al-abrar':                    [{ station: 'Telok Ayer' }],
  'yusof-ishak':                 [{ station: 'Woodlands South' }],
};

async function geocodeStation(name) {
  const q = encodeURIComponent(`${name} MRT Station`);
  const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${q}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`  geocode HTTP ${res.status} for "${name}"`);
    return null;
  }
  const data = await res.json();
  if (!data.found) {
    console.error(`  geocode no results for "${name}"`);
    return null;
  }
  const match =
    data.results.find((r) => /MRT STATION/i.test(r.BUILDING || '')) ||
    data.results.find((r) => /MRT/i.test(r.BUILDING || '') || /MRT/i.test(r.SEARCHVAL || '')) ||
    data.results[0];
  return {
    lat: parseFloat(match.LATITUDE),
    lng: parseFloat(match.LONGITUDE),
    label: match.SEARCHVAL,
  };
}

async function walkRoute(from, to) {
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'muis-datasets-unofficial/1.0 (community project)' },
  });
  if (!res.ok) {
    console.error(`  route HTTP ${res.status}`);
    return null;
  }
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.[0]) {
    console.error(`  route bad payload: ${data.code}`);
    return null;
  }
  return {
    meters: Math.round(data.routes[0].distance),
    minutes: Math.round(data.routes[0].duration / 60),
  };
}

const mosques = JSON.parse(readFileSync('mosque-directory/data.json', 'utf-8')).mosques;
const bySlug = new Map(mosques.map((m) => [m.slug, m]));

const out = {};

for (const [slug, stations] of Object.entries(MRT_BY_SLUG)) {
  const mosque = bySlug.get(slug);
  if (!mosque?.coordinates) {
    console.error(`skip ${slug}: no coords`);
    continue;
  }
  for (const { station } of stations) {
    console.error(`${slug} ← ${station}`);
    const stationCoords = await geocodeStation(station);
    await sleep(DELAY_MS);
    if (!stationCoords) continue;
    const route = await walkRoute(stationCoords, mosque.coordinates);
    await sleep(DELAY_MS);
    if (!route) continue;
    const key = `${slug}__${station}`;
    out[key] = { ...route, station_label: stationCoords.label };
    console.error(`  → ${route.minutes} min (${route.meters} m)`);
  }
}

console.log(JSON.stringify(out, null, 2));
