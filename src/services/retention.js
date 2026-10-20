import { kvs, WhereConditions } from '@forge/kvs';
import { ENTITY } from '../lib/constants.js';

const DAY_MS = 86_400_000;
const PAGE_SIZE = 100;
const BATCH_SIZE = 25;
const MAX_PAGES_PER_RUN = 20;

export function getRetentionDays(raw = process.env.RETENTION_DAYS) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 365;
  return Math.min(Math.max(n, 30), 1825);
}

export function cutoffIso(days, now = Date.now()) {
  return new Date(now - days * DAY_MS).toISOString();
}

export async function onRetentionTick() {
  const cutoff = cutoffIso(getRetentionDays());
  let removed = 0;

  // Re-query the first page each round instead of following a cursor while deleting.
  for (let page = 0; page < MAX_PAGES_PER_RUN; page += 1) {
    const { results } = await kvs
      .entity(ENTITY)
      .query()
      .index('by-deleted-at')
      .where(WhereConditions.lessThan(cutoff))
      .limit(PAGE_SIZE)
      .getMany();

    if (results.length === 0) break;

    let removedThisPage = 0;
    for (let i = 0; i < results.length; i += BATCH_SIZE) {
      const batch = results.slice(i, i + BATCH_SIZE).map(({ key }) => ({ entityName: ENTITY, key }));
      const { successfulKeys = [], failedKeys = [] } = await kvs.batchDelete(batch);
      removedThisPage += successfulKeys.length;
      if (failedKeys.length > 0) console.warn(`Retention cleanup failed to delete ${failedKeys.length} records`);
    }
    removed += removedThisPage;
    // Nothing could be deleted: stop instead of re-reading the same page.
    if (removedThisPage === 0) break;
  }
  console.log(`Retention cleanup removed ${removed} records`);
}
