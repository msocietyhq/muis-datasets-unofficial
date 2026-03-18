import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generatePostalPrefixes,
  expandPostalPrefix,
  normaliseEstablishment,
  buildOutput,
  hasDatasetChanged,
} from './helpers.mjs';

test('generatePostalPrefixes returns 000 through 999', () => {
  const prefixes = generatePostalPrefixes();

  assert.equal(prefixes.length, 1000);
  assert.equal(prefixes[0], '000');
  assert.equal(prefixes.at(-1), '999');
});

test('expandPostalPrefix appends digits 0 through 9', () => {
  assert.deepEqual(expandPostalPrefix('238'), [
    '2380',
    '2381',
    '2382',
    '2383',
    '2384',
    '2385',
    '2386',
    '2387',
    '2388',
    '2389',
  ]);
});

test('normaliseEstablishment maps API fields to repo dataset shape', () => {
  const record = normaliseEstablishment({
    id: 'abc',
    name: 'Test Cafe',
    number: 'EERT123',
    scheme: 100,
    subScheme: 106,
    address: '1 TEST ROAD SINGAPORE 123456',
    postal: '123456',
    logo: 'logo-id',
    type: 0,
    schemeText: 'Eating Establishment',
    subSchemeText: 'Restaurant',
    typeText: 'Default',
  });

  assert.deepEqual(record, {
    id: 'abc',
    certificate_number: 'EERT123',
    name: 'Test Cafe',
    address: '1 TEST ROAD SINGAPORE 123456',
    postal_code: '123456',
    coordinates: null,
    scheme: { id: 100, name: 'Eating Establishment' },
    sub_scheme: { id: 106, name: 'Restaurant' },
    type: { id: 0, name: 'Default' },
    logo_url: 'https://halal.muis.gov.sg/api/halal/icon/logo-id',
  });
});

test('buildOutput sorts records and adds metadata', () => {
  const output = buildOutput([
    { certificate_number: 'B', name: 'Beta', postal_code: '222222' },
    { certificate_number: 'A', name: 'Alpha', postal_code: '111111' },
  ]);

  assert.equal(output.meta.source, 'MUIS Halal Certified Establishments');
  assert.equal(output.meta.total_count, 2);
  assert.deepEqual(
    output.establishments.map((item) => item.certificate_number),
    ['A', 'B']
  );
});

test('hasDatasetChanged ignores last_scraped when records are unchanged', () => {
  const existing = {
    meta: {
      source: 'MUIS Halal Certified Establishments',
      source_url: 'https://halal.muis.gov.sg/halal/establishments',
      last_scraped: '2026-03-17',
      total_count: 1,
    },
    establishments: [
      {
        certificate_number: 'A',
        name: 'Alpha',
      },
    ],
  };

  const next = {
    meta: {
      source: 'MUIS Halal Certified Establishments',
      source_url: 'https://halal.muis.gov.sg/halal/establishments',
      last_scraped: '2026-03-24',
      total_count: 1,
    },
    establishments: [
      {
        certificate_number: 'A',
        name: 'Alpha',
      },
    ],
  };

  assert.equal(hasDatasetChanged(existing, next), false);
});
