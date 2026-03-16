/**
 * Shared utilities for MUIS scrapers
 */

export const USER_AGENT = 'muis-datasets-unofficial/1.0 (community project)';

export async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract "Last updated DD Month YYYY" from an Isomer page.
 * Returns ISO date string (YYYY-MM-DD) or null.
 */
export function extractLastUpdated(html) {
  const match = html.match(/Last updated\s+(\d{1,2}\s+\w+\s+\d{4})/i);
  if (!match) return null;
  const parsed = new Date(match[1]);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
}

/**
 * Extract items from Isomer's RSC payload (self.__next_f.push blocks).
 * 
 * Isomer "database" pages embed all table data in React Server Component
 * script tags. This function extracts the items array from those payloads.
 * 
 * @param {string} html - Full page HTML
 * @param {string} marker - A unique string to identify the correct script block (e.g. a known name)
 * @param {RegExp} rowRegex - Regex to extract row data. Must have named or positional capture groups.
 * @param {function} rowMapper - Function that takes regex match and returns an object
 * @returns {Array} Parsed items
 */
export function extractRscTableData(html, marker, rowRegex, rowMapper) {
  // Find the script block containing the marker
  const scriptRegex = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g;
  let scriptMatch;
  let targetPayload = null;

  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    if (scriptMatch[1].includes(marker)) {
      targetPayload = scriptMatch[1];
      break;
    }
  }

  // If not found via clean extraction, search the raw HTML more broadly
  if (!targetPayload) {
    const broadRegex = new RegExp(`self\\.__next_f\\.push\\(\\[1,[\\s\\S]*?${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?\\]\\)`, 'g');
    const broadMatch = broadRegex.exec(html);
    if (broadMatch) {
      targetPayload = broadMatch[0];
    }
  }

  if (!targetPayload) {
    console.error(`   ⚠️  Could not find RSC payload containing marker: "${marker}"`);
    return [];
  }

  const items = [];
  let match;
  while ((match = rowRegex.exec(targetPayload)) !== null) {
    items.push(rowMapper(match));
  }

  return items;
}
