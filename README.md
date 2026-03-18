# 🕌 MUIS Datasets (Unofficial)

Structured, machine-readable JSON datasets from [MUIS](https://www.muis.gov.sg/) (Majlis Ugama Islam Singapura), auto-synced via GitHub Actions.

| Dataset | Records | Source |
|---------|---------|--------|
| [Mosque Directory](#mosque-directory) | ~70 mosques | [MUIS](https://www.muis.gov.sg/community/mosque/mosque-directory/) |
| [ARS Directory](#ars-directory) | ~5,200 asatizah | [MUIS](https://www.muis.gov.sg/education/asatizah-development/asatizah-recognition-scheme/ars-directory/) |
| [IECP Directory](#iecp-directory) | ~480 centres | [MUIS](https://www.muis.gov.sg/education/asatizah-development/asatizah-recognition-scheme/iecp-directory/) |
| [Halal Directory](#halal-directory) | ~4,600 establishments | [MUIS Halal SG](https://halal.muis.gov.sg/halal/establishments) |

## Usage

Fetch any dataset directly via `raw.githubusercontent.com`:

```js
// Mosque directory
const mosques = await fetch(
  'https://raw.githubusercontent.com/msocietyhq/muis-datasets-unofficial/main/mosque-directory/data.json'
).then(r => r.json());

// ARS directory
const ars = await fetch(
  'https://raw.githubusercontent.com/msocietyhq/muis-datasets-unofficial/main/ars-directory/data.json'
).then(r => r.json());

// IECP directory
const iecp = await fetch(
  'https://raw.githubusercontent.com/msocietyhq/muis-datasets-unofficial/main/iecp-directory/data.json'
).then(r => r.json());

// Halal directory
const halal = await fetch(
  'https://raw.githubusercontent.com/msocietyhq/muis-datasets-unofficial/main/halal-directory/data.json'
).then(r => r.json());
```

---

## Mosque Directory

All mosques in Singapore with contact details, descriptions, features, and coordinates.

```jsonc
{
  "meta": {
    "source": "MUIS Mosque Directory",
    "last_scraped": "2026-03-16",
    "total_count": 70
  },
  "mosques": [
    {
      "slug": "wak-tanjong",
      "name": "Wak Tanjong",
      "address": "25 Paya Lebar Road Singapore 409004",
      "postal_code": "409004",
      "phone": "67472743",
      "email": "info@waktanjong.mosque.org.sg",
      "website": null,
      "description": "A whitewashed structure...",
      "features": [],
      "coordinates": { "lat": 1.3187, "lng": 103.8925 },
      "logo_url": "mosque-directory/logos/wak-tanjong.png",
      "muis_url": "https://www.muis.gov.sg/community/mosque/mosque-directory/wak-tanjong/"
    }
  ]
}
```

## ARS Directory

All ARS-certified asatizah (Islamic religious teachers) in Singapore.

```jsonc
{
  "meta": {
    "source": "MUIS ARS Directory",
    "last_scraped": "2026-03-16",
    "muis_last_updated": "2026-02-26",
    "total_count": 5220,
    "tier_counts": {
      "Tier 1 (Asatizah)": 4100,
      "Tier 2 (Quranic)": 1120
    }
  },
  "asatizah": [
    {
      "title": "Ustazah",
      "name": "Aathirah Binti Khamsani",
      "category": "Tier 1 (Asatizah)"
    }
  ]
}
```

## IECP Directory

All registered Islamic Education Centres and Providers.

```jsonc
{
  "meta": {
    "source": "MUIS IECP Directory",
    "last_scraped": "2026-03-16",
    "total_count": 484,
    "breakdown": {
      "mosques": 70,
      "madrasahs": 6,
      "other_centres": 408
    }
  },
  "iecps": [
    {
      "number": 1,
      "name": "ABDUL ALEEM SIDDIQUE MOSQUE"
    }
  ]
}
```

## Halal Directory

MUIS halal-certified establishments, normalized from the public halal search API and rebuilt weekly.

```jsonc
{
  "meta": {
    "source": "MUIS Halal Certified Establishments",
    "last_scraped": "2026-03-18",
    "total_count": 4628
  },
  "establishments": [
    {
      "id": "d54efa73-ca47-4771-ad30-b27fc4dae026",
      "certificate_number": "EEBN19110010548",
      "name": "DOUGH CULTURE PTE LTD",
      "address": "930 YISHUN AVENUE 2 #B1-10 NORTHPOINT 769098",
      "postal_code": "769098",
      "coordinates": { "lat": 1.4296, "lng": 103.836 },
      "scheme": { "id": 100, "name": "Eating Establishment" },
      "sub_scheme": { "id": 108, "name": "Snack Bar / Bakery" },
      "type": { "id": 0, "name": "Default" },
      "logo_url": null
    }
  ]
}
```

---

## Setup

```bash
npm install

# Full scrape (first time)
npm run scrape:all

# Just the halal directory
npm run scrape:halal

# Enrich mosque coordinates via OneMap
npm run enrich:mosques
```

## How the sync works

The repo uses two GitHub Actions:

- `.github/workflows/sync.yml` runs daily at 6am SGT for mosques, ARS, and IECP
- `.github/workflows/halal-sync.yml` runs weekly at 6am SGT on Monday for halal establishments

The daily workflow:

1. For each directory, fetches the MUIS page and compares the "Last updated" timestamp
2. Only re-extracts data if the page is newer than what's stored
3. For mosques, also checks if individual detail pages have changed
4. Preserves community-enriched fields (coordinates, logos) on unchanged entries
5. Auto-commits only when data actually changed

Each scraper exits with code `2` if nothing changed — the Action skips the commit.

The weekly halal workflow:

1. Fetches a CSRF token and session cookie from the public halal directory page
2. Queries the halal establishments API by postal-code prefixes
3. Expands only prefixes that hit the API result cap
4. Deduplicates by certificate number and rewrites `halal-directory/data.json`
5. Auto-commits only when the JSON output actually changed

### Cost

Entirely free:
- **GitHub Actions**: ~1 min/day + one weekly halal sync (free tier: 2,000 min/month)
- **OneMap API**: Free, no key required
- **MUIS**: ~73 polite requests/day max (70 mosque detail pages + 1 directory + 1 ARS + 1 IECP)

## Repo structure

```
muis-datasets-unofficial/
├── mosque-directory/
│   ├── data.json              # Mosque dataset
│   ├── logos/                 # Mosque logo images
│   ├── scraper.mjs            # Diff-aware mosque scraper
│   ├── scrape-logos.mjs       # Logo scraper from mosque websites
│   └── enrich-coordinates.mjs # OneMap geocoding
├── ars-directory/
│   ├── data.json              # ARS asatizah dataset
│   └── scraper.mjs            # ARS scraper
├── iecp-directory/
│   ├── data.json              # IECP dataset
│   └── scraper.mjs            # IECP scraper
├── halal-directory/
│   ├── data.json              # Halal establishments dataset
│   ├── helpers.mjs            # Shared halal normalization/query helpers
│   ├── helpers.test.mjs       # Helper tests
│   ├── scraper.mjs            # Halal API scraper
│   └── scraper.test.mjs       # Scraper tests
├── utils.mjs                  # Shared utilities
├── .github/workflows/
│   ├── sync.yml               # Daily sync action
│   └── halal-sync.yml         # Weekly halal sync action
├── package.json
└── README.md
```

## Contributing

PRs welcome for:
- Corrections to any data
- Additional metadata (prayer times endpoints, social media links, etc.)
- New datasets from MUIS or related sources

### Missing mosque logos

We're still missing logos for these mosques. If you have or can find an official logo, add it to `mosque-directory/logos/{slug}.png` and submit a PR!

- Al-Abrar (`al-abrar`)
- Ba'alwie (`ba-alwie`)
- Burhani (`burhani`)
- Haji Mohd Salleh (G) (`haji-mohd-salleh--g`)
- Khadijah (`khadijah`)
- Malabar (`malabar`)
- Pulau Bukom (`pulau-bukom`)
- Tasek Utara (`tasek-utara`)

## License

Mosque, ARS, IECP, and halal establishment data sourced from MUIS (Singapore Government). This dataset is provided for community use. Please attribute MUIS as the original data source.
