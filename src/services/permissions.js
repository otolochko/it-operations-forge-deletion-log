import { asUser, route } from '@forge/api';

export class ForbiddenError extends Error {
  constructor() {
    super('Only Jira administrators can use this page');
    this.code = 'FORBIDDEN';
  }
}

export async function assertJiraAdmin() {
  const res = await asUser().requestJira(route`/rest/api/3/mypermissions?permissions=ADMINISTER`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Permission check failed with HTTP ${res.status}`);
  const body = await res.json();
  if (body?.permissions?.ADMINISTER?.havePermission !== true) throw new ForbiddenError();
}
