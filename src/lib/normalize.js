export const SCHEMA_VERSION = 1;
const MAX_TEXT = 1000;

function toIdString(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  return undefined;
}

function put(record, key, value) {
  if (typeof value !== 'string') return;
  const trimmed = value.trim().slice(0, MAX_TEXT);
  if (trimmed) record[key] = trimmed;
}

export function epochMsToIso(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return undefined;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

// Jira returns offsets like +0200; make them ISO compliant before parsing.
export function jiraDateToIso(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const fixed = value.trim().replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const date = new Date(fixed);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function firstAssociatedAccountId(associatedUsers) {
  const list = Array.isArray(associatedUsers)
    ? associatedUsers
    : Array.isArray(associatedUsers?.users)
      ? associatedUsers.users
      : [];
  const user = list.find((u) => typeof u?.accountId === 'string' && u.accountId.trim());
  return user?.accountId.trim();
}

export function normalizeDeletedIssueEvent(event, now = Date.now()) {
  const issue = event?.issue;
  const issueId = toIdString(issue?.id);
  if (!issueId || !/^\d{1,18}$/.test(issueId)) return null;

  const f = issue.fields ?? {};
  const value = {
    issueId,
    deletedAt: epochMsToIso(event.timestamp) ?? new Date(now).toISOString(),
    schemaVersion: SCHEMA_VERSION,
  };

  put(value, 'issueKey', issue.key);
  put(value, 'projectId', toIdString(f.project?.id));
  put(value, 'projectKey', f.project?.key);
  put(value, 'projectName', f.project?.name);
  put(value, 'summary', f.summary);
  put(value, 'issueTypeName', f.issuetype?.name);
  put(value, 'statusName', f.status?.name);
  put(value, 'reporterId', f.reporter?.accountId);
  put(value, 'assigneeId', f.assignee?.accountId);
  put(value, 'creatorId', f.creator?.accountId);
  put(value, 'deletedById', event.atlassianId ?? firstAssociatedAccountId(event.associatedUsers));
  put(value, 'parentKey', f.parent?.key);
  put(value, 'createdAt', jiraDateToIso(f.created));
  put(value, 'updatedAt', jiraDateToIso(f.updated));

  return { key: issueId, value };
}
