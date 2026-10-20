import { kvs, Sort, WhereConditions, Filter, FilterConditions } from '@forge/kvs';
import { ENTITY } from '../lib/constants.js';

export async function listDeletions({ fromIso, toIso, issueKey, projectId, deletedById, limit, cursor }) {
  let query = kvs.entity(ENTITY).query();

  if (issueKey) query = query.index('by-issue-key', { partition: [issueKey] });
  else if (projectId) query = query.index('by-project', { partition: [projectId] });
  else if (deletedById) query = query.index('by-actor', { partition: [deletedById] });
  else query = query.index('by-deleted-at');

  query = query.where(WhereConditions.between(fromIso, toIso)).sort(Sort.DESC).limit(limit);

  // Project and actor together: use the project index and filter on the actor.
  // Filters run after the page is read, so a page can be shorter than limit while nextCursor is set.
  if (!issueKey && projectId && deletedById) {
    query = query.filters(new Filter().and('deletedById', FilterConditions.equalTo(deletedById)));
  }
  if (cursor) query = query.cursor(cursor);

  const { results, nextCursor } = await query.getMany();
  return {
    records: results.map(({ key, value }) => ({ id: key, ...value })),
    nextCursor: nextCursor ?? null,
  };
}

export async function deleteRecord(issueId) {
  await kvs.entity(ENTITY).delete(issueId);
  return { deleted: issueId };
}
