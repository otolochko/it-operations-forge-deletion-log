import { describe, it, expect } from 'vitest';
import { parseListPayload, parseIssueId, InvalidInputError } from '../src/lib/filters.js';

const NOW = Date.parse('2026-10-16T09:41:07.123Z');
const DAY = 86_400_000;

describe('parseListPayload', () => {
  it('applies defaults: last 30 days, limit 50', () => {
    const p = parseListPayload({}, NOW);
    expect(p.toIso).toBe('2026-10-16T09:41:07.123Z');
    expect(p.fromIso).toBe(new Date(NOW - 30 * DAY).toISOString());
    expect(p.limit).toBe(50);
    expect(p.cursor).toBeUndefined();
  });

  it('handles undefined and null payloads', () => {
    expect(parseListPayload(undefined, NOW).limit).toBe(50);
    expect(parseListPayload(null, NOW).limit).toBe(50);
  });

  it('clamps limit', () => {
    expect(parseListPayload({ limit: 1000 }, NOW).limit).toBe(100);
    expect(parseListPayload({ limit: -4 }, NOW).limit).toBe(1);
    expect(parseListPayload({ limit: 'abc' }, NOW).limit).toBe(50);
    expect(parseListPayload({ limit: '7' }, NOW).limit).toBe(7);
  });

  it('uppercases and validates issue keys', () => {
    expect(parseListPayload({ issueKey: 'ni-12' }, NOW).issueKey).toBe('NI-12');
    for (const bad of ['NI-0', 'NI', '12-NI', 'NI-12 OR 1=1', 5]) {
      expect(() => parseListPayload({ issueKey: bad }, NOW)).toThrow(InvalidInputError);
    }
  });

  it('validates project ids', () => {
    expect(parseListPayload({ projectId: '10401' }, NOW).projectId).toBe('10401');
    expect(() => parseListPayload({ projectId: 'abc' }, NOW)).toThrow(InvalidInputError);
  });

  it('validates account ids', () => {
    expect(parseListPayload({ deletedById: '557058:6ab99bd3-cf3f' }, NOW).deletedById).toBe('557058:6ab99bd3-cf3f');
    expect(() => parseListPayload({ deletedById: 'a b' }, NOW)).toThrow(InvalidInputError);
    expect(() => parseListPayload({ deletedById: 'x'.repeat(129) }, NOW)).toThrow(InvalidInputError);
  });

  it('treats empty strings as not set', () => {
    const p = parseListPayload({ issueKey: '', projectId: '', deletedById: null }, NOW);
    expect(p.issueKey).toBeUndefined();
    expect(p.projectId).toBeUndefined();
    expect(p.deletedById).toBeUndefined();
  });

  it('validates ISO timestamps', () => {
    expect(() => parseListPayload({ fromIso: '2026-10-01' }, NOW)).toThrow(InvalidInputError);
    expect(() => parseListPayload({ toIso: 'yesterday' }, NOW)).toThrow(InvalidInputError);
    expect(() => parseListPayload({ fromIso: '2026-13-45T00:00:00.000Z' }, NOW)).toThrow(InvalidInputError);
  });

  it('rejects from after to', () => {
    expect(() =>
      parseListPayload({ fromIso: '2026-10-10T00:00:00.000Z', toIso: '2026-10-09T00:00:00.000Z' }, NOW),
    ).toThrow(/must not be after/);
  });

  it('limits cursor length', () => {
    expect(parseListPayload({ cursor: 'abc' }, NOW).cursor).toBe('abc');
    expect(parseListPayload({ cursor: 'x'.repeat(4001) }, NOW).cursor).toBeUndefined();
    expect(parseListPayload({ cursor: '' }, NOW).cursor).toBeUndefined();
  });
});

describe('parseIssueId', () => {
  it('accepts numeric strings', () => {
    expect(parseIssueId('10042')).toBe('10042');
  });
  it('rejects missing or invalid ids', () => {
    for (const bad of [undefined, '', 'abc', '12 34', 42]) {
      expect(() => parseIssueId(bad)).toThrow(InvalidInputError);
    }
  });
});
