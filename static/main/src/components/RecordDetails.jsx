import { useRef, useState } from 'react';
import { deleteRecord } from '../api.js';
import { formatLocal } from '../dates.js';
import { userLabel } from '../jira.js';

export default function RecordDetails({ record, onRemoved }) {
  const dialogRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const user = (id) => (id ? `${userLabel(id)} (${id})` : '');
  const fields = [
    ['Issue ID', record.issueId],
    ['Key', record.issueKey],
    ['Parent key', record.parentKey],
    ['Summary', record.summary],
    ['Project', [record.projectName, record.projectKey && `(${record.projectKey})`].filter(Boolean).join(' ')],
    ['Project ID', record.projectId],
    ['Type', record.issueTypeName],
    ['Status', record.statusName],
    ['Reporter', user(record.reporterId)],
    ['Assignee', user(record.assigneeId)],
    ['Creator', user(record.creatorId)],
    ['Deleted by', user(record.deletedById)],
    ['Created', formatLocal(record.createdAt)],
    ['Updated', formatLocal(record.updatedAt)],
    ['Deleted at', formatLocal(record.deletedAt)],
    ['Schema version', record.schemaVersion],
  ];

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await deleteRecord(record.issueId);
      dialogRef.current?.close();
      onRemoved(record.issueId);
    } catch (e) {
      setError(e.message || 'Could not remove the record.');
      setBusy(false);
    }
  };

  return (
    <div className="details">
      <dl>
        {fields.map(([label, value]) => (
          <div key={label} className="details-item">
            <dt>{label}</dt>
            <dd>{value === undefined || value === null || value === '' ? '-' : String(value)}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="btn btn-danger" onClick={() => { setError(''); dialogRef.current?.showModal(); }}>
        Remove record
      </button>
      <dialog ref={dialogRef} className="dialog" aria-labelledby={`dlg-title-${record.id}`}>
        <h2 id={`dlg-title-${record.id}`}>Remove record?</h2>
        <p>
          This removes the log entry for {record.issueKey || record.issueId} from the Deletion Log. It does not affect Jira. This cannot be undone.
        </p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn" autoFocus disabled={busy} onClick={() => dialogRef.current?.close()}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" disabled={busy} onClick={remove}>
            {busy ? 'Removing...' : 'Remove record'}
          </button>
        </div>
      </dialog>
    </div>
  );
}
