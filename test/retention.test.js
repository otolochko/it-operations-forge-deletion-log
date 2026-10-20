import { describe, it, expect } from 'vitest';
import { getRetentionDays, cutoffIso } from '../src/services/retention.js';

describe('getRetentionDays', () => {
  it('defaults to 365', () => {
    expect(getRetentionDays(undefined)).toBe(365);
  });
  it('falls back to the default for non-numeric input', () => {
    expect(getRetentionDays('abc')).toBe(365);
    expect(getRetentionDays('')).toBe(365);
  });
  it('clamps to 30..1825', () => {
    expect(getRetentionDays('1')).toBe(30);
    expect(getRetentionDays('99999')).toBe(1825);
    expect(getRetentionDays('90')).toBe(90);
  });
});

describe('cutoffIso', () => {
  it('subtracts whole days from a fixed now', () => {
    const now = Date.parse('2026-10-16T09:41:07.123Z');
    expect(cutoffIso(30, now)).toBe('2026-09-16T09:41:07.123Z');
  });
});
