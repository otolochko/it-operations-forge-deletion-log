import { describe, it, expect } from 'vitest';
import * as entry from '../src/index.js';

// Handler names in manifest.yml must match these exports.
describe('src/index.js', () => {
  it('exports every handler the manifest references', () => {
    expect(Object.keys(entry).sort()).toEqual(['handler', 'onIssueDeleted', 'onRetentionTick']);
    expect(typeof entry.onIssueDeleted).toBe('function');
    expect(typeof entry.onRetentionTick).toBe('function');
  });
});
