// Named import on purpose: the default export of this CommonJS package is not a constructor in an ESM bundle.
import { makeResolver } from '@forge/resolver';
import { assertJiraAdmin, ForbiddenError } from '../services/permissions.js';
import { listDeletions, deleteRecord } from '../services/deletionStore.js';
import { parseListPayload, parseIssueId } from '../lib/filters.js';
import { getRetentionDays } from '../services/retention.js';

function guarded(fn) {
  return async (req) => {
    try {
      await assertJiraAdmin();
      return { ok: true, data: await fn(req) };
    } catch (err) {
      if (err instanceof ForbiddenError) return { ok: false, error: 'FORBIDDEN' };
      if (err?.code === 'INVALID_INPUT') return { ok: false, error: 'INVALID_INPUT', message: err.message };
      console.error('Resolver failed:', err?.message);
      return { ok: false, error: 'INTERNAL' };
    }
  };
}

export const handler = makeResolver({
  getAppInfo: guarded(async () => ({ retentionDays: getRetentionDays() })),
  listDeletions: guarded(async ({ payload }) => listDeletions(parseListPayload(payload))),
  deleteRecord: guarded(async ({ payload }) => deleteRecord(parseIssueId(payload?.issueId))),
});
