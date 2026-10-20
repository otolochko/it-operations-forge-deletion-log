import { useRef, useState } from 'react';
import { listDeletions } from '../api.js';
import { buildCsv, downloadCsv } from '../csv.js';
import { formatDateInput, formatLocal } from '../dates.js';
import { resolveUsers, userLabel } from '../jira.js';

const ROW_CAP = 10000;

const HEADERS = [
  'Deleted at', 'Key', 'Summary', 'Project', 'Type', 'Status', 'Reporter', 'Assignee', 'Deleted by',
  'deletedAt (UTC)', 'createdAt (UTC)', 'updatedAt (UTC)',
  'reporterId', 'assigneeId', 'creatorId', 'deletedById', 'Issue ID', 'Project key', 'Parent key',
];

function name(id) {
  return id ? userLabel(id) : '';
}

function toRow(r) {
  return [
    formatLocal(r.deletedAt), r.issueKey, r.summary, r.projectName || r.projectKey, r.issueTypeName, r.statusName,
    name(r.reporterId), name(r.assigneeId), r.deletedById ? name(r.deletedById) : 'Unknown',
    r.deletedAt, r.createdAt, r.updatedAt,
    r.reporterId, r.assigneeId, r.creatorId, r.deletedById, r.issueId, r.projectKey, r.parentKey,
  ];
}

export default function ExportButton({ payload }) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const cancelRef = useRef(false);

  const start = async () => {
    cancelRef.current = false;
    setRunning(true);
    const rows = [];
    let cursor;
    let capped = false;
    let cancelled = false;
    try {
      setMessage('Exporting... 0 rows collected');
      do {
        if (cancelRef.current) {
          cancelled = true;
          break;
        }
        const data = await listDeletions({ ...payload, limit: 100, ...(cursor ? { cursor } : {}) });
        rows.push(...data.records);
        cursor = data.nextCursor || null;
        if (rows.length >= ROW_CAP) {
          rows.length = Math.min(rows.length, ROW_CAP);
          capped = !!cursor;
          break;
        }
        setMessage(`Exporting... ${rows.length} rows collected`);
      } while (cursor);

      if (cancelled) {
        setMessage('Export cancelled.');
        return;
      }
      setMessage(`Resolving user names for ${rows.length} rows...`);
      await resolveUsers(rows.flatMap((r) => [r.reporterId, r.assigneeId, r.deletedById]));
      const csv = buildCsv(HEADERS, rows.map(toRow));
      downloadCsv(csv, `deletion-log-${formatDateInput(new Date())}.csv`);
      setMessage(
        capped
          ? `Export capped at ${ROW_CAP} rows. Downloaded the first ${rows.length} rows; narrow the filters to export the rest.`
          : `Export complete: ${rows.length} rows.`,
      );
    } catch (e) {
      setMessage(`Export failed: ${e.message || 'unknown error'}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="export">
      <button type="button" className="btn" onClick={start} disabled={running}>
        Export CSV
      </button>
      {running && (
        <button type="button" className="btn" onClick={() => { cancelRef.current = true; }}>
          Cancel
        </button>
      )}
      <span className="export-status" aria-live="polite">{message}</span>
    </div>
  );
}
