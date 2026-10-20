import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const set = vi.fn();
vi.mock('@forge/kvs', () => ({ kvs: { entity: () => ({ set }) } }));

const { onIssueDeleted, retryDelaySeconds, MAX_RETRIES } = await import('../src/events/issueDeleted.js');
const { InvocationErrorCode } = await import('@forge/events');

const EVENT = {
  timestamp: '1760000000000',
  atlassianId: 'acc-deleter',
  issue: { id: '10042', key: 'FAKE-7', fields: { summary: 'Fake', project: { id: '1', key: 'FAKE', name: 'Fake' } } },
};

describe('onIssueDeleted', () => {
  beforeEach(() => {
    set.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('stores the normalized record under the issue id', async () => {
    set.mockResolvedValue(undefined);
    await expect(onIssueDeleted(EVENT)).resolves.toBeUndefined();
    expect(set).toHaveBeenCalledWith('10042', expect.objectContaining({ issueId: '10042', issueKey: 'FAKE-7' }));
  });

  it('skips events without a usable issue id and does not retry', async () => {
    await expect(onIssueDeleted({ issue: {} })).resolves.toBeUndefined();
    expect(set).not.toHaveBeenCalled();
  });

  it('returns an InvocationError retry request when the write fails', async () => {
    set.mockRejectedValue(new Error('storage unavailable'));
    const result = await onIssueDeleted(EVENT);
    // The InvocationError constructor returns a plain { _retry, retryOptions } object, which is what Forge reads.
    expect(result).toEqual({
      _retry: true,
      retryOptions: { retryAfter: 30, retryReason: InvocationErrorCode.FUNCTION_RETRY_REQUEST },
    });
  });

  it('backs off on later retries using retryContext.retryCount', async () => {
    set.mockRejectedValue(new Error('storage unavailable'));
    const result = await onIssueDeleted({ ...EVENT, retryContext: { retryCount: 2 } });
    expect(result.retryOptions.retryAfter).toBe(120);
  });

  it('throws after the last allowed retry instead of retrying forever', async () => {
    set.mockRejectedValue(new Error('storage unavailable'));
    await expect(onIssueDeleted({ ...EVENT, retryContext: { retryCount: MAX_RETRIES } })).rejects.toThrow(
      'storage unavailable',
    );
  });

  it('never logs record values', async () => {
    set.mockRejectedValue(new Error('storage unavailable'));
    await onIssueDeleted(EVENT);
    const logged = JSON.stringify([...console.warn.mock.calls, ...console.error.mock.calls]);
    for (const secret of ['acc-deleter', 'FAKE-7', '10042']) expect(logged).not.toContain(secret);
  });
});

describe('retryDelaySeconds', () => {
  it('doubles from 30 seconds and stays within the Forge limit of 900', () => {
    expect([0, 1, 2, 3, 4, 10].map(retryDelaySeconds)).toEqual([30, 60, 120, 240, 480, 900]);
  });
});
