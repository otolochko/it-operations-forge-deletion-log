export const ISSUE_KEY_RE = /^[A-Z][A-Z0-9_]{0,254}-[1-9]\d{0,9}$/;
export const PROJECT_ID_RE = /^\d{1,18}$/;
export const ISSUE_ID_RE = /^\d{1,18}$/;
export const ACCOUNT_ID_RE = /^[A-Za-z0-9:_-]{1,128}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DAY_MS = 86_400_000;

export class InvalidInputError extends Error {
  constructor(message) {
    super(message);
    this.code = 'INVALID_INPUT';
  }
}

function iso(value, name) {
  if (typeof value !== 'string' || !ISO_RE.test(value) || Number.isNaN(Date.parse(value))) {
    throw new InvalidInputError(`${name} must be an ISO 8601 UTC timestamp`);
  }
  return value;
}

function optional(value, re, name, transform = (v) => v) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new InvalidInputError(`${name} is invalid`);
  const v = transform(value.trim());
  if (!re.test(v)) throw new InvalidInputError(`${name} is invalid`);
  return v;
}

export function parseListPayload(payload = {}, now = Date.now()) {
  const input = payload ?? {};
  const toIso = iso(input.toIso ?? new Date(now).toISOString(), 'toIso');
  const fromIso = iso(input.fromIso ?? new Date(now - 30 * DAY_MS).toISOString(), 'fromIso');
  if (fromIso > toIso) throw new InvalidInputError('fromIso must not be after toIso');

  const limit = Math.min(Math.max(Number.parseInt(input.limit, 10) || 50, 1), 100);
  const cursor =
    typeof input.cursor === 'string' && input.cursor.length > 0 && input.cursor.length <= 4000
      ? input.cursor
      : undefined;

  return {
    fromIso,
    toIso,
    limit,
    cursor,
    issueKey: optional(input.issueKey, ISSUE_KEY_RE, 'issueKey', (v) => v.toUpperCase()),
    projectId: optional(input.projectId, PROJECT_ID_RE, 'projectId'),
    deletedById: optional(input.deletedById, ACCOUNT_ID_RE, 'deletedById'),
  };
}

export function parseIssueId(value) {
  const v = optional(value, ISSUE_ID_RE, 'issueId');
  if (!v) throw new InvalidInputError('issueId is required');
  return v;
}
