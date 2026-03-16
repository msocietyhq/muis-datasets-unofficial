# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Automated scrapers that maintain structured JSON datasets from Singapore's MUIS (Majlis Ugama Islam Singapura) website. Runs daily via GitHub Actions, commits only when data changes.

Three datasets: **mosque directory** (~70 mosques with detail pages), **ARS directory** (~5,200 certified asatizah), and **IECP directory** (~480 Islamic education centres).

## Commands

```bash
# Full scrapes
npm run scrape:mosques        # Full mosque scrape (fetches ~70 detail pages)
npm run scrape:ars            # Full ARS scrape
npm run scrape:iecp           # Full IECP scrape
npm run scrape:all            # All three

# Diff-aware updates (used by CI)
npm run update:mosques        # Only re-fetches mosques with newer "Last updated" dates
npm run update:ars            # Only re-scrapes if MUIS page date is newer
npm run update:iecp           # Same as ARS
npm run update:all            # All three

# Coordinate enrichment (free OneMap geocoding API, no key needed)
npm run enrich:mosques
```

## Architecture

- **Mosque scraper** (`mosque-directory/scraper.mjs`): Fetches the MUIS directory page, then each mosque's detail page individually. In `--update` mode, compares per-mosque "Last updated" timestamps and only overwrites MUIS-sourced fields if newer. Preserves community-enriched fields (`coordinates`, `logo_url`). Exits with code 2 if nothing changed (signals CI to skip commit).

- **ARS/IECP scrapers** (`ars-directory/scraper.mjs`, `iecp-directory/scraper.mjs`): Single-page scrapes. MUIS embeds all records in React Server Component (RSC) payloads (`self.__next_f.push` script blocks). The shared `extractRscTableData()` utility parses these. Update mode compares the page-level "Last updated" date only.

- **Shared utilities** (`utils.mjs`): `fetchPage`, `sleep`, `extractLastUpdated`, `extractRscTableData` — imported by ARS and IECP scrapers.

- **Coordinate enricher** (`mosque-directory/enrich-coordinates.mjs`): Geocodes mosques by postal code via OneMap API. Skips mosques that already have coordinates.

- **CI workflow** (`sync.yml`): Daily at 6am SGT. Runs all three updaters, enriches coordinates if mosque data changed, then commits only if any `data.json` files changed.

## Key Conventions

- Only dependency is `cheerio` for HTML parsing. Node.js built-in `fetch` is used for HTTP.
- All scrapers use polite delays (300-500ms) between requests and identify via User-Agent.
- Exit code 2 means "no changes detected" — not an error, used by CI to decide whether to commit.
- Output files are `{directory}/data.json` with a `meta` block and a data array.
- The mosque scraper has the most complex diff logic (per-entry timestamps); ARS/IECP use page-level timestamp comparison only.
