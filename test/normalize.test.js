import { describe, it, expect } from 'vitest';
import {
  normalizeDeletedIssueEvent,
  epochMsToIso,
  jiraDateToIso,
  firstAssociatedAccountId,
  SCHEMA_VERSION,
} from '../src/lib/normalize.js';

// Shaped like the real Phase 0 payload (values are fake).
const REAL_SHAPE_EVENT = {
  eventType: 'avi:jira:deleted:issue',
  selfGenerated: false,
  timestamp: '1760000000000',
  atlassianId: 'acc-deleter',
  associatedUsers: [{ accountId: 'acc-assoc' }],
  issue: {
    id: '10042',
    key: 'FAKE-7',
    fields: {
      summary: '  Fake summary  ',
      issuetype: { id: '3', name: 'Task', subtask: false },
      creator: { accountId: 'acc-creator' },
      created: '2026-10-01T10:00:00.000+0200',
      project: { id: '10001', key: 'FAKE', name: 'Fake project' },
      reporter: { accountId: 'acc-reporter' },
      assignee: { accountId: 'acc-assignee' },
      fixVersions: [],
      updated: '2026-10-02T11:30:00.000+02:00',
      status: { id: '1', name: 'In Progress' },
    },
  },
};

describe('normalizeDeletedIssueEvent', () => {
  it('maps a full payload', () => {
    const { key, value } = normalizeDeletedIssueEvent(REAL_SHAPE_EVENT);
    expect(key).toBe('10042');
    expect(value).toEqual({
      issueId: '10042',
      issueKey: 'FAKE-7',
      projectId: '10001',
      projectKey: 'FAKE',
      projectName: 'Fake project',
      summary: 'Fake summary',
      issueTypeName: 'Task',
      statusName: 'In Progress',
      reporterId: 'acc-reporter',
      assigneeId: 'acc-assignee',
      creatorId: 'acc-creator',
      deletedById: 'acc-deleter',
      createdAt: '2026-10-01T08:00:00.000Z',
      updatedAt: '2026-10-02T09:30:00.000Z',
      deletedAt: '2025-10-09T08:53:20.000Z',
      schemaVersion: SCHEMA_VERSION,
    });
  });

  it('omits missing optional fields (no assignee, no parent)', () => {
    const event = structuredClone(REAL_SHAPE_EVENT);
    delete event.issue.fields.assignee;
    const { value } = normalizeDeletedIssueEvent(event);
    expect(value).not.toHaveProperty('assigneeId');
    expect(value).not.toHaveProperty('parentKey');
  });

  it('keeps parentKey for sub-tasks', () => {
    const event = structuredClone(REAL_SHAPE_EVENT);
    event.issue.fields.parent = { id: '10040', key: 'FAKE-5' };
    expect(normalizeDeletedIssueEvent(event).value.parentKey).toBe('FAKE-5');
  });

  it('accepts numeric ids', () => {
    const event = structuredClone(REAL_SHAPE_EVENT);
    event.issue.id = 10042;
    event.issue.fields.project.id = 10001;
    const { key, value } = normalizeDeletedIssueEvent(event);
    expect(key).toBe('10042');
    expect(value.projectId).toBe('10001');
  });

  it('drops empty and whitespace-only strings', () => {
    const event = structuredClone(REAL_SHAPE_EVENT);
    event.issue.fields.summary = '   ';
    event.issue.key = '';
    const { value } = normalizeDeletedIssueEvent(event);
    expect(value).not.toHaveProperty('summary');
    expect(value).not.toHaveProperty('issueKey');
  });

  it('falls back to now for a missing or invalid timestamp', () => {
    const now = Date.parse('2026-10-16T09:41:07.123Z');
    for (const timestamp of [undefined, 'abc', '0', '-5']) {
      const event = { ...structuredClone(REAL_SHAPE_EVENT), timestamp };
      expect(normalizeDeletedIssueEvent(event, now).value.deletedAt).toBe('2026-10-16T09:41:07.123Z');
    }
  });

  it('uses associatedUsers when atlassianId is missing (array and object shapes)', () => {
    const base = structuredClone(REAL_SHAPE_EVENT);
    delete base.atlassianId;
    expect(normalizeDeletedIssueEvent(base).value.deletedById).toBe('acc-assoc');
    base.associatedUsers = { users: [{ accountId: 'acc-obj' }] };
    expect(normalizeDeletedIssueEvent(base).value.deletedById).toBe('acc-obj');
    delete base.associatedUsers;
    expect(normalizeDeletedIssueEvent(base).value).not.toHaveProperty('deletedById');
  });

  it('returns null without a usable issue id', () => {
    expect(normalizeDeletedIssueEvent(undefined)).toBeNull();
    expect(normalizeDeletedIssueEvent({})).toBeNull();
    expect(normalizeDeletedIssueEvent({ issue: { id: 'abc' } })).toBeNull();
    expect(normalizeDeletedIssueEvent({ issue: { id: '' } })).toBeNull();
  });

  it('caps very long text', () => {
    const event = structuredClone(REAL_SHAPE_EVENT);
    event.issue.fields.summary = 'x'.repeat(5000);
    expect(normalizeDeletedIssueEvent(event).value.summary).toHaveLength(1000);
  });
});

describe('date helpers', () => {
  it('converts epoch ms', () => {
    expect(epochMsToIso('1760000000000')).toBe('2025-10-09T08:53:20.000Z');
    expect(epochMsToIso(NaN)).toBeUndefined();
  });

  it('handles +0200 and +02:00 offsets and rejects garbage', () => {
    expect(jiraDateToIso('2026-10-01T10:00:00.000+0200')).toBe('2026-10-01T08:00:00.000Z');
    expect(jiraDateToIso('2026-10-01T10:00:00.000+02:00')).toBe('2026-10-01T08:00:00.000Z');
    expect(jiraDateToIso('nope')).toBeUndefined();
    expect(jiraDateToIso(undefined)).toBeUndefined();
  });

  it('firstAssociatedAccountId skips invalid entries', () => {
    expect(firstAssociatedAccountId([{}, { accountId: ' ' }, { accountId: 'a1' }])).toBe('a1');
    expect(firstAssociatedAccountId(null)).toBeUndefined();
  });
});
