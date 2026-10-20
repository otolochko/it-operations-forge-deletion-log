import { describe, it, expect } from 'vitest';
import { toIsoStart, toIsoEnd, presetRange, formatLocal } from '../static/main/src/dates.js';

describe('day boundaries', () => {
  it('toIsoStart is local midnight', () => {
    expect(toIsoStart('2026-03-15')).toBe(new Date(2026, 2, 15, 0, 0, 0, 0).toISOString());
  });
  it('toIsoEnd is local 23:59:59.999', () => {
    expect(toIsoEnd('2026-03-15')).toBe(new Date(2026, 2, 15, 23, 59, 59, 999).toISOString());
  });
  it('returns ISO UTC with milliseconds', () => {
    expect(toIsoStart('2026-01-01')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

describe('presetRange', () => {
  const now = new Date(2026, 9, 19, 15, 30);
  it('covers the last N days including today', () => {
    expect(presetRange(7, now)).toEqual({ from: '2026-10-13', to: '2026-10-19' });
    expect(presetRange(30, now)).toEqual({ from: '2026-09-20', to: '2026-10-19' });
  });
  it('crosses year boundaries', () => {
    expect(presetRange(90, now).from).toBe('2026-07-22');
    expect(presetRange(365, now)).toEqual({ from: '2025-10-20', to: '2026-10-19' });
  });
  it('defaults to 30 days', () => {
    expect(presetRange(undefined, now)).toEqual(presetRange(30, now));
    expect(presetRange(5, now)).toEqual(presetRange(30, now));
  });
});

describe('formatLocal', () => {
  it('formats local time', () => {
    const d = new Date(2026, 0, 2, 3, 4, 5);
    expect(formatLocal(d.toISOString())).toBe('2026-01-02 03:04:05');
  });
  it('handles empty input', () => {
    expect(formatLocal(undefined)).toBe('');
  });
});
