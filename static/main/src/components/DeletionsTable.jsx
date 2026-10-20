import { Fragment, useState } from 'react';
import { formatLocal } from '../dates.js';
import { userLabel } from '../jira.js';
import RecordDetails from './RecordDetails.jsx';

function User({ id, unknownText = '' }) {
  if (!id) return unknownText;
  return <span title={id}>{userLabel(id)}</span>;
}

export default function DeletionsTable({ records, onRemoved }) {
  const [openId, setOpenId] = useState(null);
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Deletions table">
      <table>
        <thead>
          <tr>
            <th scope="col"><span className="visually-hidden">Details</span></th>
            <th scope="col">Deleted at</th>
            <th scope="col">Key</th>
            <th scope="col">Summary</th>
            <th scope="col">Project</th>
            <th scope="col">Type</th>
            <th scope="col">Status</th>
            <th scope="col">Reporter</th>
            <th scope="col">Assignee</th>
            <th scope="col">Deleted by</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const open = openId === r.id;
            return (
              <Fragment key={r.id}>
                <tr>
                  <td>
                    <button
                      type="button"
                      className="expand"
                      aria-expanded={open}
                      aria-controls={`details-${r.id}`}
                      aria-label={`${open ? 'Hide' : 'Show'} details for ${r.issueKey || r.issueId}`}
                      onClick={() => setOpenId(open ? null : r.id)}
                    >
                      {open ? '▾' : '▸'}
                    </button>
                  </td>
                  <td className="nowrap">{formatLocal(r.deletedAt)}</td>
                  <td className="nowrap">{r.issueKey || ''}</td>
                  <td className="summary">{r.summary || ''}</td>
                  <td>{r.projectName || r.projectKey || ''}</td>
                  <td>{r.issueTypeName || ''}</td>
                  <td>{r.statusName || ''}</td>
                  <td><User id={r.reporterId} /></td>
                  <td><User id={r.assigneeId} /></td>
                  <td>{r.deletedById ? <User id={r.deletedById} /> : 'Unknown'}</td>
                </tr>
                {open && (
                  <tr className="details-row">
                    <td colSpan={10} id={`details-${r.id}`}>
                      <RecordDetails record={r} onRemoved={onRemoved} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
