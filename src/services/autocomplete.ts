import type { KeywordItem } from '../types';

/**
 * Autocomplete service using Amazon's completion endpoint (Module E)
 * Endpoint: https://completion.amazon.com/api/2017/suggestions?prefix=...&alias=stripbooks
 */
export async function fetchAmazonAutocomplete(seed: string): Promise<string[]> {
  if (!seed.trim()) return [];
  try {
    const url = `https://completion.amazon.com/api/2017/suggestions?prefix=${encodeURIComponent(
      seed
    )}&alias=stripbooks&mid=ATVPDKIKX0DER`;
    const res = await fetch(url);
    const data = await res.json();
    return (data.suggestions || []).map((s: { value: string }) => s.value);
  } catch (err) {
    console.warn('[KDP Autocomplete] Fetch error:', err);
    return [];
  }
}
