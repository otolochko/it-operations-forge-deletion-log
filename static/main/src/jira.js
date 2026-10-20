import { requestJira } from '@forge/bridge';

const MAX_RETRIES = 4;
const BATCH_SIZE = 50;
const VALID_ID = /^[A-Za-z0-9:_-]{1,128}$/;

const userCache = new Map();

export function clearUserCache() {
  userCache.clear();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function requestWithRetry(path, init, attempt = 0) {
  const res = await requestJira(path, init);
  if (res.status !== 429 || attempt >= MAX_RETRIES) return res;
  const header = res.headers && typeof res.headers.get === 'function' ? res.headers.get('Retry-After') : null;
  const seconds = Number(header);
  const delay = header && Number.isFinite(seconds) && seconds > 0
    ? seconds * 1000
    : Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 250;
  await sleep(delay);
  return requestWithRetry(path, init, attempt + 1);
}

export async function resolveUsers(accountIds) {
  const ids = [...new Set((accountIds || []).filter((id) => typeof id === 'string' && VALID_ID.test(id)))]
    .filter((id) => !userCache.has(id));
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const query = batch.map((id) => `accountId=${encodeURIComponent(id)}`).join('&');
    let found = new Map();
    try {
      const res = await requestWithRetry(`/rest/api/3/user/bulk?maxResults=${BATCH_SIZE}&${query}`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const body = await res.json();
        found = new Map((body.values || []).map((u) => [u.accountId, u]));
      }
    } catch {
      // Leave the batch unresolved; labels fall back to short account IDs.
    }
    for (const id of batch) {
      const u = found.get(id);
      userCache.set(id, u ? { displayName: u.displayName, active: u.active !== false } : null);
    }
  }
  return userCache;
}

export function userLabel(accountId) {
  if (!accountId) return '';
  const u = userCache.get(accountId);
  if (u && u.active && u.displayName) return u.displayName;
  return `${String(accountId).slice(0, 8)}…`;
}

export async function loadProjects() {
  const projects = [];
  let startAt = 0;
  for (;;) {
    const res = await requestWithRetry(`/rest/api/3/project/search?startAt=${startAt}&maxResults=50`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Could not load projects (${res.status})`);
    const body = await res.json();
    const values = body.values || [];
    for (const p of values) projects.push({ id: String(p.id), key: p.key, name: p.name });
    if (body.isLast !== false || values.length === 0) break;
    startAt += values.length;
  }
  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

export async function searchUsers(query) {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  const res = await requestWithRetry(`/rest/api/3/user/search?query=${encodeURIComponent(q)}&maxResults=10`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`User search failed (${res.status})`);
  const users = await res.json();
  return users
    .filter((u) => u.active && u.accountType === 'atlassian')
    .map((u) => ({ accountId: u.accountId, displayName: u.displayName }));
}
