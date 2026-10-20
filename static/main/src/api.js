import { invoke } from '@forge/bridge';

export class ApiError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'ApiError';
    this.code = code;
  }
}

async function call(name, payload) {
  let res;
  try {
    res = await invoke(name, payload);
  } catch (e) {
    throw new ApiError('INTERNAL', e && e.message ? e.message : 'Request failed');
  }
  if (!res || res.ok !== true) {
    throw new ApiError((res && res.error) || 'INTERNAL', res && res.message);
  }
  return res.data;
}

export const getAppInfo = () => call('getAppInfo');
export const listDeletions = (payload) => call('listDeletions', payload);
export const deleteRecord = (issueId) => call('deleteRecord', { issueId });
