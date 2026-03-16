# 🕌 MUIS Data (Unofficial)

Structured, machine-readable JSON datasets from [MUIS](https://www.muis.gov.sg/) (Majlis Ugama Islam Singapura), auto-synced daily via GitHub Actions.

| Dataset | Records | Source |
|---------|---------|--------|
| [Mosque Directory](#mosque-directory) | ~70 mosques | [MUIS](https://www.muis.gov.sg/community/mosque/mosque-directory/) |
| [ARS Directory](#ars-directory) | ~5,200 asatizah | [MUIS](https://www.muis.gov.sg/education/asatizah-development/asatizah-recognition-scheme/ars-directory/) |
| [IECP Directory](#iecp-directory) | ~480 centres | [MUIS](https://www.muis.gov.sg/education/asatizah-development/asatizah-recognition-scheme/iecp-directory/) |

## Usage

Fetch any dataset directly via `raw.githubusercontent.com`:

```js
// Mosque directory
const mosques = await fetch(
  'https://raw.githubusercontent.com/YOUR_USERNAME/muis-data-unofficial/main/mosque-directory/data.json'
).then(r => r.json());

// ARS directory
const ars = await fetch(
  'https://raw.githubusercontent.com/YOUR_USERNAME/muis-data-unofficial/main/ars-directory/data.json'
).then(r => r.json());

// IECP directory
const iecp = await fetch(
  'https://raw.githubusercontent.com/YOUR_USERNAME/muis-data-unofficial/main/iecp-directory/data.json'
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

---

## Setup

```bash
npm install

# Full scrape (first time)
npm run scrape:all

# Enrich mosque coordinates via OneMap
npm run enrich:mosques
```

## How the daily sync works

The `.github/workflows/sync.yml` action runs daily at 6am SGT:

1. For each directory, fetches the MUIS page and compares the "Last updated" timestamp
2. Only re-extracts data if the page is newer than what's stored
3. For mosques, also checks if individual detail pages have changed
4. Preserves community-enriched fields (coordinates, logos) on unchanged entries
5. Auto-commits only when data actually changed

Each scraper exits with code `2` if nothing changed — the Action skips the commit.

### Cost

Entirely free:
- **GitHub Actions**: ~1 min/day (free tier: 2,000 min/month)
- **OneMap API**: Free, no key required
- **MUIS**: ~73 polite requests/day max (70 mosque detail pages + 1 directory + 1 ARS + 1 IECP)

## Repo structure

```
muis-data-unofficial/
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
├── utils.mjs                  # Shared utilities
├── .github/workflows/
│   └── sync.yml               # Daily sync action
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

Mosque, ARS, and IECP data sourced from MUIS (Singapore Government). This dataset is provided for community use. Please attribute MUIS as the original data source.
