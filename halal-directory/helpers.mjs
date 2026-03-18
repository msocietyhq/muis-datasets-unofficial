const HALAL_ICON_BASE_URL = 'https://halal.muis.gov.sg/api/halal/icon';
const HALAL_SOURCE_URL = 'https://halal.muis.gov.sg/halal/establishments';

export function generatePostalPrefixes() {
  return Array.from({ length: 1000 }, (_, index) =>
    String(index).padStart(3, '0')
  );
}

export function expandPostalPrefix(prefix) {
  return Array.from({ length: 10 }, (_, index) => `${prefix}${index}`);
}

export function normaliseEstablishment(item) {
  return {
    id: item.id,
    certificate_number: item.number,
    name: item.name,
    address: item.address,
    postal_code: item.postal,
    coordinates: item.coordinates ?? null,
    scheme: {
      id: item.scheme,
      name: item.schemeText,
    },
    sub_scheme: {
      id: item.subScheme,
      name: item.subSchemeText,
    },
    type: {
      id: item.type,
      name: item.typeText,
    },
    logo_url:
      item.logo && item.logo !== '00000000-0000-0000-0000-000000000000'
        ? `${HALAL_ICON_BASE_URL}/${item.logo}`
        : null,
  };
}

export function buildOutput(establishments) {
  const sorted = [...establishments].sort((left, right) =>
    left.certificate_number.localeCompare(right.certificate_number)
  );

  return {
    meta: {
      source: 'MUIS Halal Certified Establishments',
      source_url: HALAL_SOURCE_URL,
      last_scraped: new Date().toISOString().split('T')[0],
      total_count: sorted.length,
    },
    establishments: sorted,
  };
}

export function hasDatasetChanged(existing, next) {
  return JSON.stringify(existing.establishments ?? []) !== JSON.stringify(next.establishments ?? []);
}

export { HALAL_SOURCE_URL };
