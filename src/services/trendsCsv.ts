// src/services/trendsCsv.ts
// Parses a Google Trends "Interest over time" CSV export.
// Google Trends CSVs have 2 header lines, then data rows. Values of "<1" are treated as 0.
// Handles UTF-8 BOM, weekly and monthly date rows, and different date formats.

import type { ParsedTrendsSeries } from '../storage/seasonality';

export interface TrendsCsvParseError {
  ok: false;
  error: string;
}

export interface TrendsCsvParseSuccess {
  ok: true;
  series: ParsedTrendsSeries;
}

export type TrendsCsvParseResult = TrendsCsvParseError | TrendsCsvParseSuccess;

/**
 * Removes the UTF-8 BOM character if present at the start of a string.
 */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Parses a "<1" or numeric string to a number. "<1" becomes 0.
 */
function parseInterestValue(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '<1' || trimmed === '' || trimmed.toLowerCase() === 'n/a') return 0;
  const n = Number(trimmed);
  return isNaN(n) ? 0 : Math.round(Math.min(100, Math.max(0, n)));
}

/**
 * Normalises a date string from Google Trends (e.g. "2024-01-07 – 2024-01-13" or "Jan 2024").
 * Returns a short ISO-like representation for the first date in the range.
 */
function normalizeDateString(raw: string): string {
  const trimmed = raw.trim();

  // Weekly format: "2024-01-07 – 2024-01-13" or "2024-01-07 - 2024-01-13"
  const weeklyMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s*[–-]\s*\d{4}-\d{2}-\d{2}$/);
  if (weeklyMatch && weeklyMatch[1]) return weeklyMatch[1];

  // ISO date already: "2024-01-01"
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // Monthly: "Jan 2024", "January 2024", "2024-01"
  const monthYearMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const months: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      january: '01', february: '02', march: '03', april: '04', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
    };
    const monthKey = (monthYearMatch[1] || '').toLowerCase();
    const mm = months[monthKey];
    if (mm) return `${monthYearMatch[2]}-${mm}-01`;
  }

  // "YYYY-MM"
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;

  return trimmed; // return as-is; validation will catch non-parseable dates
}

/**
 * Parses a Google Trends "Interest over time" CSV text into a ParsedTrendsSeries.
 *
 * Google Trends CSV format:
 * Line 0: empty or info line (e.g. "Category: All categories")
 * Line 1: column headers row: "Week","<keyword>: (Worldwide)"  OR  "Month","..."
 * Lines 2+: data rows: "2024-01-07 – 2024-01-13","45"
 */
export function parseTrendsCsv(rawText: string, keyword: string, geo: string): TrendsCsvParseResult {
  const text = stripBom(rawText);
  const lines = text.split(/\r?\n/);

  if (lines.length < 4) {
    return { ok: false, error: 'File is too short to be a valid Google Trends CSV (need at least 4 lines).' };
  }

  // ── Find the data header row ──
  // It typically contains "Week" or "Month" as the first column.
  let headerLineIdx = -1;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const lower = (lines[i] || '').toLowerCase();
    if (lower.startsWith('"week"') || lower.startsWith('week') ||
        lower.startsWith('"month"') || lower.startsWith('month')) {
      headerLineIdx = i;
      break;
    }
  }

  if (headerLineIdx === -1) {
    return {
      ok: false,
      error: 'Could not find a data header row starting with "Week" or "Month". Make sure you downloaded the "Interest over time" CSV from Google Trends (the download icon ↓ next to the chart).',
    };
  }

  const dataLines = lines.slice(headerLineIdx + 1).filter((l) => l.trim().length > 0);
  if (dataLines.length < 4) {
    return { ok: false, error: 'Not enough data rows. Please use a CSV with at least 4 data points.' };
  }

  const dates: string[] = [];
  const values: number[] = [];

  for (const line of dataLines) {
    // Split CSV line – simple split on comma, but cells may be quoted.
    const parts = line.split(',').map((p) => p.replace(/^"|"$/g, '').trim());
    if (parts.length < 2) continue;

    const rawDate = parts[0] || '';
    const rawValue = parts[1] || '';

    if (!rawDate) continue;

    const date = normalizeDateString(rawDate);
    const value = parseInterestValue(rawValue);

    dates.push(date);
    values.push(value);
  }

  if (dates.length < 4) {
    return { ok: false, error: 'Could not parse enough valid date/value rows. Please check the file is the Interest over time export.' };
  }

  // Validate dates are parseable
  const firstDate = dates[0] || '';
  const lastDate = dates[dates.length - 1] || '';

  const startTs = Date.parse(firstDate);
  const endTs = Date.parse(lastDate);
  if (isNaN(startTs) || isNaN(endTs)) {
    return { ok: false, error: `Could not parse date values: "${firstDate}" / "${lastDate}". Unexpected date format.` };
  }

  const yearsOfData = Math.round(((endTs - startTs) / (365.25 * 24 * 3600 * 1000)) * 10) / 10;

  return {
    ok: true,
    series: {
      keyword: keyword.trim().toLowerCase(),
      geo: (geo || 'US').toUpperCase(),
      dates,
      values,
      startDate: firstDate,
      endDate: lastDate,
      yearsOfData,
      storedAt: Date.now(),
    },
  };
}

/**
 * Aggregates a ParsedTrendsSeries into average monthly interest (index 0=Jan ... 11=Dec).
 * Returns a 12-element array of values 0-100.
 */
export function aggregateMonthlyAverages(series: ParsedTrendsSeries): number[] {
  const monthTotals = new Array(12).fill(0) as number[];
  const monthCounts = new Array(12).fill(0) as number[];

  for (let i = 0; i < series.dates.length; i++) {
    const dateStr = series.dates[i] || '';
    const value = series.values[i] ?? 0;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) continue;
    const month = d.getMonth(); // 0-11
    monthTotals[month] = (monthTotals[month] ?? 0) + value;
    monthCounts[month] = (monthCounts[month] ?? 0) + 1;
  }

  return monthTotals.map((total, idx) => {
    const count = monthCounts[idx] ?? 0;
    return count > 0 ? Math.round(total / count) : 0;
  });
}

/**
 * Splits a ParsedTrendsSeries into per-year monthly averages for the YoY chart.
 * Returns at most the last 5 years.
 */
export function splitByYear(series: ParsedTrendsSeries): Record<number, number[]> {
  const byYear: Record<number, number[]> = {};

  for (let i = 0; i < series.dates.length; i++) {
    const dateStr = series.dates[i] || '';
    const value = series.values[i] ?? 0;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) continue;
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-11
    if (!byYear[year]) byYear[year] = new Array(12).fill(0) as number[];
    byYear[year]![month] = Math.max(byYear[year]![month]!, value);
  }

  // Return only the last 5 years
  const years = Object.keys(byYear).map(Number).sort();
  const lastFive = years.slice(-5);
  const result: Record<number, number[]> = {};
  for (const yr of lastFive) {
    result[yr] = byYear[yr]!;
  }
  return result;
}
