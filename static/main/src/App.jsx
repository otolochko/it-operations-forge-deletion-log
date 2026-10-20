import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAppInfo, listDeletions } from './api.js';
import { presetRange, toIsoEnd, toIsoStart } from './dates.js';
import { resolveUsers } from './jira.js';
import FilterBar from './components/FilterBar.jsx';
import DeletionsTable from './components/DeletionsTable.jsx';
import ExportButton from './components/ExportButton.jsx';
import { Empty, ErrorState, Loading } from './components/States.jsx';

const APP_NAME = 'Deletion Log';
const PAGE_LIMIT = 50;
const MAX_EMPTY_PAGES = 20;

function toPayload(f) {
  const payload = { fromIso: toIsoStart(f.from), toIso: toIsoEnd(f.to) };
  if (f.issueKey) payload.issueKey = f.issueKey;
  else {
    if (f.projectId) payload.projectId = f.projectId;
    if (f.user) payload.deletedById = f.user.accountId;
  }
  return payload;
}

function initialFilters() {
  const { from, to } = presetRange(30);
  return { from, to, projectId: '', user: null, issueKey: '' };
}

export default function App() {
  const [info, setInfo] = useState(null);
  const [fatal, setFatal] = useState(null);
  const [applied, setApplied] = useState(initialFilters);
  const [records, setRecords] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rowFilter, setRowFilter] = useState('');
  const [, setNamesVersion] = useState(0);
  const reqId = useRef(0);

  const load = useCallback(async (filters, startCursor) => {
    const id = ++reqId.current;
    setLoading(true);
    setError('');
    if (!startCursor) {
      setRecords([]);
      setCursor(null);
    }
    try {
      let next = startCursor || undefined;
      let collected = [];
      // Server-side filters can yield short or empty pages; keep following the cursor.
      for (let i = 0; i < MAX_EMPTY_PAGES; i += 1) {
        const data = await listDeletions({ ...toPayload(filters), limit: PAGE_LIMIT, ...(next ? { cursor: next } : {}) });
        if (id !== reqId.current) return;
        collected = data.records;
        next = data.nextCursor || null;
        if (collected.length > 0 || !next) break;
      }
      setRecords((prev) => (startCursor ? [...prev, ...collected] : collected));
      setCursor(next);
      setLoading(false);
      const ids = collected.flatMap((r) => [r.reporterId, r.assigneeId, r.deletedById]);
      resolveUsers(ids).then(() => {
        if (id === reqId.current) setNamesVersion((v) => v + 1);
      });
    } catch (e) {
      if (id !== reqId.current) return;
      if (e.code === 'FORBIDDEN') setFatal('FORBIDDEN');
      else setError(e.message || 'Could not load deletions.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getAppInfo()
      .then((data) => {
        setInfo(data);
        load(initialFilters());
      })
      .catch((e) => setFatal(e.code === 'FORBIDDEN' ? 'FORBIDDEN' : e.message || 'Could not start the app.'));
  }, [load]);

  const apply = (filters) => {
    setApplied(filters);
    load(filters);
  };

  const removed = (issueId) => setRecords((prev) => prev.filter((r) => r.issueId !== issueId));

  const visible = useMemo(() => {
    const q = rowFilter.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => (r.issueKey || '').toLowerCase().includes(q) || (r.summary || '').toLowerCase().includes(q));
  }, [records, rowFilter]);

  if (fatal === 'FORBIDDEN') {
    return <main className="app"><p className="state">Only Jira administrators can view the deletion log.</p></main>;
  }
  if (fatal) {
    return <main className="app"><ErrorState message={fatal} onRetry={() => window.location.reload()} /></main>;
  }
  if (!info) {
    return <main className="app"><Loading /></main>;
  }

  return (
    <main className="app">
      <header>
        <h1>{APP_NAME}</h1>
        <p className="subtitle">Work items deleted on this site since the app was installed.</p>
      </header>

      <FilterBar onApply={apply} rowFilter={rowFilter} onRowFilter={setRowFilter} />

      <div className="toolbar">
        <ExportButton payload={toPayload(applied)} />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={() => load(applied, records.length ? cursor : null)} />
      ) : loading && records.length === 0 ? (
        <Loading />
      ) : records.length === 0 ? (
        <Empty />
      ) : (
        <>
          {visible.length === 0 ? <Empty text="No loaded rows match the row filter." /> : <DeletionsTable records={visible} onRemoved={removed} />}
          <p className="hint" aria-live="polite">
            {records.length} loaded{visible.length !== records.length ? `, ${visible.length} shown` : ''}.
          </p>
        </>
      )}

      {cursor && !error && (
        <div className="more">
          <button type="button" className="btn" disabled={loading} onClick={() => load(applied, cursor)}>
            {loading ? 'Loading...' : 'Load more'}
          </button>
          <span className="hint">Pages can be short or even empty when filters are applied. This is normal; use Load more to continue.</span>
        </div>
      )}

      <footer className="footer">
        Records are kept for {info.retentionDays} days. Deletions before the app was installed are not recorded.
      </footer>
    </main>
  );
}
