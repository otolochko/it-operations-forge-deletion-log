import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@forge/bridge', () => ({ requestJira: vi.fn() }));

import { requestJira } from '@forge/bridge';
import { resolveUsers, requestWithRetry, clearUserCache, userLabel } from '../static/main/src/jira.js';

const ok = (body) => ({ ok: true, status: 200, headers: new Headers(), json: async () => body });
const make429 = (retryAfter) => ({
  ok: false,
  status: 429,
  headers: new Headers(retryAfter ? { 'Retry-After': retryAfter } : {}),
  json: async () => ({}),
});

beforeEach(() => {
  requestJira.mockReset();
  clearUserCache();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('resolveUsers', () => {
  it('batches 120 ids into 3 sequential requests', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `acc${i}`);
    let inFlight = 0;
    let maxInFlight = 0;
    requestJira.mockImplementation(async (path) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      const found = [...path.matchAll(/accountId=([^&]+)/g)].map((m) => ({
        accountId: decodeURIComponent(m[1]),
        displayName: `User ${m[1]}`,
        active: true,
      }));
      return ok({ values: found });
    });
    const cache = await resolveUsers(ids);
    expect(requestJira).toHaveBeenCalledTimes(3);
    expect(maxInFlight).toBe(1);
    expect(requestJira.mock.calls[0][0]).toContain('/rest/api/3/user/bulk?maxResults=50&accountId=acc0&');
    expect(cache.get('acc119')).toEqual({ displayName: 'User acc119', active: true });
    expect(userLabel('acc5')).toBe('User acc5');
  });

  it('uses the cache on a second call', async () => {
    requestJira.mockResolvedValue(ok({ values: [{ accountId: 'a1', displayName: 'A', active: true }] }));
    await resolveUsers(['a1']);
    await resolveUsers(['a1', 'a1']);
    expect(requestJira).toHaveBeenCalledTimes(1);
  });

  it('skips invalid account IDs and caches unknown ones as null', async () => {
    requestJira.mockResolvedValue(ok({ values: [] }));
    const cache = await resolveUsers(['bad id', 'x&accountId=y', '', null, 'good:1']);
    expect(requestJira).toHaveBeenCalledTimes(1);
    expect(requestJira.mock.calls[0][0]).toContain('accountId=good%3A1');
    expect(requestJira.mock.calls[0][0]).not.toContain('bad');
    expect(cache.get('good:1')).toBeNull();
    expect(cache.has('bad id')).toBe(false);
  });

  it('makes no request when nothing is valid', async () => {
    await resolveUsers(['!!', '']);
    expect(requestJira).not.toHaveBeenCalled();
  });

  it('labels inactive or unknown users with a short id', async () => {
    requestJira.mockResolvedValue(ok({ values: [{ accountId: '1234567890abc', displayName: 'Gone', active: false }] }));
    await resolveUsers(['1234567890abc']);
    expect(userLabel('1234567890abc')).toBe('12345678…');
    expect(userLabel('unknownunknown')).toBe('unknownu…');
  });
});

describe('requestWithRetry', () => {
  it('honours a numeric Retry-After header', async () => {
    vi.useFakeTimers();
    requestJira.mockResolvedValueOnce(make429('3')).mockResolvedValueOnce(ok({}));
    const p = requestWithRetry('/x', {});
    await vi.advanceTimersByTimeAsync(2999);
    expect(requestJira).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    const res = await p;
    expect(requestJira).toHaveBeenCalledTimes(2);
    expect(res.ok).toBe(true);
  });

  it('uses exponential backoff with jitter without Retry-After', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    requestJira.mockResolvedValueOnce(make429()).mockResolvedValueOnce(make429()).mockResolvedValueOnce(ok({}));
    const p = requestWithRetry('/x', {});
    await vi.advanceTimersByTimeAsync(999);
    expect(requestJira).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(requestJira).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    await p;
    expect(requestJira).toHaveBeenCalledTimes(3);
    vi.restoreAllMocks();
  });

  it('gives up after MAX_RETRIES and returns the 429', async () => {
    vi.useFakeTimers();
    requestJira.mockResolvedValue(make429('1'));
    const p = requestWithRetry('/x', {});
    await vi.advanceTimersByTimeAsync(10000);
    const res = await p;
    expect(res.status).toBe(429);
    expect(requestJira).toHaveBeenCalledTimes(5);
  });
});
