import { kvs } from '@forge/kvs';
import { InvocationError, InvocationErrorCode } from '@forge/events';
import { normalizeDeletedIssueEvent } from '../lib/normalize.js';
import { ENTITY } from '../lib/constants.js';

// Forge allows at most 4 retries per event and a retryAfter of at most 900 seconds.
export const MAX_RETRIES = 4;
const BASE_DELAY_SECONDS = 30;
const MAX_DELAY_SECONDS = 900;

export function retryDelaySeconds(retryCount) {
  return Math.min(BASE_DELAY_SECONDS * 2 ** retryCount, MAX_DELAY_SECONDS);
}

export async function onIssueDeleted(event) {
  const normalized = normalizeDeletedIssueEvent(event);
  if (!normalized) {
    console.warn('Deletion event without a usable issue id was skipped');
    return;
  }
  try {
    // Same key on redelivery overwrites the same record, so the handler is idempotent.
    await kvs.entity(ENTITY).set(normalized.key, normalized.value);
  } catch (err) {
    const retryCount = event?.retryContext?.retryCount ?? 0;
    if (retryCount >= MAX_RETRIES) {
      console.error(`Deletion record write failed after ${retryCount} retries:`, err?.message);
      throw err;
    }
    console.warn(`Deletion record write failed (retry ${retryCount + 1} of ${MAX_RETRIES}):`, err?.message);
    // Return, do not throw: Forge only retries when the function returns an InvocationError.
    return new InvocationError({
      retryAfter: retryDelaySeconds(retryCount),
      retryReason: InvocationErrorCode.FUNCTION_RETRY_REQUEST,
    });
  }
}
