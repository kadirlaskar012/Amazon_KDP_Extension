// tests/fetchHint.test.ts
// Tests that formatFetchHint never prints raw timestamps and handles valid ASINs correctly.

import { describe, it, expect } from 'vitest';
import { formatFetchHint } from '../src/components/SearchProgress';

describe('formatFetchHint (fetch status display)', () => {
  it('returns empty string for undefined', () => {
    expect(formatFetchHint(undefined)).toBe('');
  });

  it('formats a valid ASIN as "(B0XXXXXXXXX)"', () => {
    expect(formatFetchHint('B0AB1234XY')).toBe(' (B0AB1234XY)');
  });

  it('never prints a raw epoch timestamp (pure numeric string)', () => {
    // This was the original bug: currentAsin was sometimes set to a timestamp
    expect(formatFetchHint('1577156145')).toBe('');
    expect(formatFetchHint('1700000000')).toBe('');
    expect(formatFetchHint('9999999999')).toBe('');
  });

  it('never prints an 8-digit pure numeric string', () => {
    expect(formatFetchHint('20260101')).toBe('');
  });

  it('truncates long ASIN to 10 chars', () => {
    expect(formatFetchHint('B0VERYLONGASIN')).toBe(' (B0VERYLONG)');
  });

  it('uppercases the ASIN', () => {
    expect(formatFetchHint('b0abc12345')).toBe(' (B0ABC12345)');
  });
});
