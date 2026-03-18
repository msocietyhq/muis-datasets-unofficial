#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { USER_AGENT, sleep } from '../utils.mjs';
import {
  HALAL_SOURCE_URL,
  buildOutput,
  expandPostalPrefix,
  generatePostalPrefixes,
  hasDatasetChanged,
  normaliseEstablishment,
} from './helpers.mjs';

const BASE_URL = 'https://halal.muis.gov.sg';
const API_URL = `${BASE_URL}/api/halal/establishments`;
const PAGE_URL = `${BASE_URL}/halal/establishments`;
const GEODATA_URL = `${BASE_URL}/assets/geodata.js`;
const JSON_PATH = 'halal-directory/data.json';
const RESULT_CAP = 200;
const DEFAULT_DELAY_MS = 300;

function extractCsrfToken(html) {
  return html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/)?.[1] ?? null;
}

function extractCookieHeader(headers) {
  if (typeof headers.getSetCookie === 'function') {
    const values = headers.getSetCookie();
    if (values.length > 0) {
      return values.map((value) => value.split(';')[0]).join('; ');
    }
  }

  const single = headers.get('set-cookie');
  if (!single) return '';
  return single
    .split(/,(?=[^;]+?=)/)
    .map((value) => value.split(';')[0].trim())
    .join('; ');
}

export async function createClient({ fetchImpl = fetch } = {}) {
  const pageResponse = await fetchImpl(PAGE_URL, {
    headers: {
      'user-agent': USER_AGENT,
    },
  });

  if (!pageResponse.ok) {
    throw new Error(`HTTP ${pageResponse.status} fetching ${PAGE_URL}`);
  }

  const html = await pageResponse.text();
  const csrfToken = extractCsrfToken(html);
  const cookieHeader = extractCookieHeader(pageResponse.headers);

  if (!csrfToken) {
    throw new Error('Unable to extract halal CSRF token');
  }

  if (!cookieHeader) {
    throw new Error('Unable to extract halal session cookie');
  }

  return {
    async search(text) {
      const response = await fetchImpl(API_URL, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          cookie: cookieHeader,
          'user-agent': USER_AGENT,
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${API_URL} for ${text}`);
      }

      return response.json();
    },
  };
}

export async function loadGeodata({ fetchImpl = fetch } = {}) {
  const response = await fetchImpl(GEODATA_URL, {
    headers: {
      'user-agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${GEODATA_URL}`);
  }

  const text = await response.text();
  const match = text.match(/^const geodata=(.*?);?\s*$/s);

  if (!match) {
    throw new Error('Unable to parse halal geodata asset');
  }

  return Function(`return (${match[1]})`)();
}

export async function scrapeDirectory({
  client,
  prefixes = generatePostalPrefixes(),
  geodataByPostalCode = {},
  sleepMs = DEFAULT_DELAY_MS,
} = {}) {
  const queue = [...prefixes];
  const byCertificateNumber = new Map();

  while (queue.length > 0) {
    const prefix = queue.shift();
    const result = await client.search(prefix);

    for (const item of result.data ?? []) {
      const normalised = normaliseEstablishment({
        ...item,
        coordinates: geodataByPostalCode[item.postal] ?? null,
      });
      byCertificateNumber.set(normalised.certificate_number, normalised);
    }

    if ((result.totalRecords ?? 0) >= RESULT_CAP && prefix.length < 6) {
      queue.unshift(...expandPostalPrefix(prefix));
    }

    if (sleepMs > 0 && queue.length > 0) {
      await sleep(sleepMs);
    }
  }

  return [...byCertificateNumber.values()].sort((left, right) =>
    left.certificate_number.localeCompare(right.certificate_number)
  );
}

async function run() {
  const isUpdateMode = process.argv.includes('--update');

  console.log(`📋 Fetching halal establishments from ${HALAL_SOURCE_URL}...`);
  const client = await createClient();
  const geodataByPostalCode = await loadGeodata();
  const establishments = await scrapeDirectory({ client, geodataByPostalCode });
  const output = buildOutput(establishments);
  const nextJson = `${JSON.stringify(output, null, 2)}\n`;

  if (isUpdateMode && existsSync(JSON_PATH)) {
    const existing = JSON.parse(readFileSync(JSON_PATH, 'utf-8'));
    if (!hasDatasetChanged(existing, output)) {
      console.log('💤 No changes detected.');
      process.exit(2);
    }
  }

  writeFileSync(JSON_PATH, nextJson);
  console.log(`✅ Written ${establishments.length} establishments to ${JSON_PATH}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error('Fatal:', error);
    process.exit(1);
  });
}
