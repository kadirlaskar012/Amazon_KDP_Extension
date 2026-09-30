// src/services/trends.ts
// URL builder for Google Trends search and multi-keyword comparison

import { DEFAULT_TRENDS_CONFIG } from '../config/defaults';

/**
 * Builds a Google Trends exploration URL for a single keyword
 * Example: https://trends.google.com/trends/explore?geo=US&q=toddler+coloring+book
 */
export function buildTrendsUrl(
  keyword: string,
  geo: string = DEFAULT_TRENDS_CONFIG.geo,
  baseUrl: string = DEFAULT_TRENDS_CONFIG.baseUrl
): string {
  if (!keyword || !keyword.trim()) {
    return baseUrl;
  }

  const cleanKeyword = keyword.trim();
  const params = new URLSearchParams();

  // If geo is worldwide or empty, omit or set empty
  const cleanGeo = geo.trim().toUpperCase();
  if (cleanGeo && cleanGeo !== 'WORLDWIDE' && cleanGeo !== 'GLOBAL') {
    params.set('geo', cleanGeo === 'UK' ? 'GB' : cleanGeo);
  }

  params.set('q', cleanKeyword);
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Builds a Google Trends comparison URL for up to 5 keywords
 * Example: https://trends.google.com/trends/explore?geo=US&q=keyword1,keyword2,keyword3
 */
export function buildCompareUrl(
  keywords: string[],
  geo: string = DEFAULT_TRENDS_CONFIG.geo,
  baseUrl: string = DEFAULT_TRENDS_CONFIG.baseUrl
): string {
  const validKeywords = keywords
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
    .slice(0, 5); // Google Trends comparison maximum is 5 terms

  if (validKeywords.length === 0) {
    return baseUrl;
  }

  const cleanGeo = geo.trim().toUpperCase();
  const geoParam =
    cleanGeo && cleanGeo !== 'WORLDWIDE' && cleanGeo !== 'GLOBAL'
      ? `geo=${cleanGeo === 'UK' ? 'GB' : cleanGeo}&`
      : '';

  // Google Trends accepts comma-separated terms in the q param
  const encodedQuery = validKeywords.map((k) => encodeURIComponent(k)).join(',');

  return `${baseUrl}?${geoParam}q=${encodedQuery}`;
}
