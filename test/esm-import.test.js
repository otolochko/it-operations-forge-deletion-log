import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Vitest smooths over CommonJS default-import interop, plain Node ESM (like the Forge bundle) does not.
// This catches imports such as `import Resolver from '@forge/resolver'` that fail at runtime.
describe('plain Node ESM import of src/index.js', () => {
  it('loads and exports every handler', () => {
    const entry = fileURLToPath(new URL('../src/index.js', import.meta.url));
    const out = execFileSync(
      process.execPath,
      ['--input-type=module', '-e', `const m = await import(process.argv[1]); console.log(Object.keys(m).sort().join(','));`, entry],
      { encoding: 'utf8' },
    );
    expect(out.trim()).toBe('handler,onIssueDeleted,onRetentionTick');
  });
});
