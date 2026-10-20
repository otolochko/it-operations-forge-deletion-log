import { describe, it, expect } from 'vitest';
import { csvCell, buildCsv } from '../static/main/src/csv.js';

describe('csvCell', () => {
  it('leaves plain text alone and maps null/undefined to empty', () => {
    expect(csvCell('abc')).toBe('abc');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(42)).toBe('42');
  });
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('a\nb')).toBe('"a\nb"');
    expect(csvCell('a\r\nb')).toBe('"a\r\nb"');
  });
  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx'])('neutralises formula prefix %j', (v) => {
    const out = csvCell(v);
    expect(out.replace(/^"/, '').startsWith("'")).toBe(true);
  });
  it('does not prefix text with a formula char in the middle', () => {
    expect(csvCell('a=b')).toBe('a=b');
  });
});

describe('buildCsv', () => {
  it('starts with a single BOM and joins rows with CRLF', () => {
    const csv = buildCsv(['a', 'b'], [['1', '2'], ['x,y', '=z']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.charCodeAt(1)).not.toBe(0xfeff);
    expect(csv.slice(1)).toBe("a,b\r\n1,2\r\n\"x,y\",'=z");
  });
});
