import test from 'node:test';
import assert from 'node:assert/strict';

import { createClient, loadGeodata, scrapeDirectory } from './scraper.mjs';

test('createClient extracts csrf token and session cookie from page response', async () => {
  const calls = [];

  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });

    if (url === 'https://halal.muis.gov.sg/halal/establishments') {
      return new Response(
        '<input name="__RequestVerificationToken" value="token-123" />',
        {
          status: 200,
          headers: new Headers({
            'set-cookie': 'session=abc123; Path=/; HttpOnly',
          }),
        }
      );
    }

    return new Response(JSON.stringify({ totalRecords: 0, data: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const client = await createClient({ fetchImpl });
  await client.search('238');

  const request = calls.at(-1);
  assert.equal(request.options.headers['x-csrf-token'], 'token-123');
  assert.match(request.options.headers.cookie, /session=abc123/);
});

test('scrapeDirectory expands capped prefixes and deduplicates results', async () => {
  const responses = new Map([
    [
      '000',
      {
        totalRecords: 1,
        data: [
          {
            id: '1',
            number: 'A',
            name: 'Alpha',
            address: 'Addr',
            postal: '000111',
            scheme: 1,
            subScheme: 2,
            type: 3,
            schemeText: 'Scheme',
            subSchemeText: 'Sub',
            typeText: 'Type',
            logo: '00000000-0000-0000-0000-000000000000',
          },
        ],
      },
    ],
    [
      '001',
      {
        totalRecords: 200,
        data: [
          {
            id: '2',
            number: 'B',
            name: 'Beta',
            address: 'Addr',
            postal: '001111',
            scheme: 1,
            subScheme: 2,
            type: 3,
            schemeText: 'Scheme',
            subSchemeText: 'Sub',
            typeText: 'Type',
            logo: '00000000-0000-0000-0000-000000000000',
          },
        ],
      },
    ],
    [
      '0010',
      {
        totalRecords: 1,
        data: [
          {
            id: '2',
            number: 'B',
            name: 'Beta',
            address: 'Addr',
            postal: '001111',
            scheme: 1,
            subScheme: 2,
            type: 3,
            schemeText: 'Scheme',
            subSchemeText: 'Sub',
            typeText: 'Type',
            logo: '00000000-0000-0000-0000-000000000000',
          },
        ],
      },
    ],
    [
      '0011',
      {
        totalRecords: 1,
        data: [
          {
            id: '3',
            number: 'C',
            name: 'Gamma',
            address: 'Addr',
            postal: '001222',
            scheme: 1,
            subScheme: 2,
            type: 3,
            schemeText: 'Scheme',
            subSchemeText: 'Sub',
            typeText: 'Type',
            logo: '00000000-0000-0000-0000-000000000000',
          },
        ],
      },
    ],
  ]);

  const searched = [];
  const client = {
    async search(prefix) {
      searched.push(prefix);
      return responses.get(prefix) ?? { totalRecords: 0, data: [] };
    },
  };

  const result = await scrapeDirectory({
    client,
    prefixes: ['000', '001'],
    geodataByPostalCode: {
      '000111': { lat: 1.1, lng: 103.1 },
      '001222': { lat: 1.2, lng: 103.2 },
    },
    sleepMs: 0,
  });

  assert.deepEqual(searched, [
    '000',
    '001',
    '0010',
    '0011',
    '0012',
    '0013',
    '0014',
    '0015',
    '0016',
    '0017',
    '0018',
    '0019',
  ]);
  assert.deepEqual(
    result.map((item) => item.certificate_number),
    ['A', 'B', 'C']
  );
  assert.deepEqual(result[0].coordinates, { lat: 1.1, lng: 103.1 });
  assert.equal(result[1].coordinates, null);
  assert.deepEqual(result[2].coordinates, { lat: 1.2, lng: 103.2 });
});

test('loadGeodata parses postal-code coordinates from MUIS asset', async () => {
  const fetchImpl = async () =>
    new Response(
      'const geodata={"123456":{lat:1.3,lng:103.8},"654321":{lat:1.4,lng:103.9}};',
      {
        status: 200,
        headers: { 'content-type': 'application/javascript' },
      }
    );

  const geodata = await loadGeodata({ fetchImpl });

  assert.deepEqual(geodata['123456'], { lat: 1.3, lng: 103.8 });
  assert.deepEqual(geodata['654321'], { lat: 1.4, lng: 103.9 });
});
