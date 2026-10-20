import { useEffect, useRef, useState } from 'react';
import { presetRange } from '../dates.js';
import { loadProjects, searchUsers } from '../jira.js';

const PRESETS = [7, 30, 90, 365];

function defaultFilters() {
  const { from, to } = presetRange(30);
  return { from, to, projectId: '', user: null, issueKey: '' };
}

function UserPicker({ user, onChange, disabled }) {
  const [text, setText] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    const q = text.trim();
    const id = ++seq.current;
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return undefined;
    }
    const t = setTimeout(async () => {
      try {
        const found = await searchUsers(q);
        if (id === seq.current) {
          setResults(found);
          setError('');
        }
      } catch {
        if (id === seq.current) setError('User search failed.');
      }
    }, 300);
    return () => clearTimeout(t);
  }, [text]);

  if (user) {
    return (
      <div className="chip">
        <span>{user.displayName}</span>
        <button type="button" className="chip-clear" onClick={() => onChange(null)} disabled={disabled} aria-label={`Clear deleted by filter (${user.displayName})`}>
          &times;
        </button>
      </div>
    );
  }
  return (
    <div className="picker">
      <input
        id="f-user"
        type="text"
        value={text}
        disabled={disabled}
        placeholder="Type at least 2 characters"
        autoComplete="off"
        onChange={(e) => setText(e.target.value)}
      />
      {error && <span className="field-error">{error}</span>}
      {results.length > 0 && !disabled && (
        <ul className="picker-list" aria-label="Matching users">
          {results.map((u) => (
            <li key={u.accountId}>
              <button
                type="button"
                onClick={() => {
                  onChange(u);
                  setText('');
                  setResults([]);
                }}
              >
                {u.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function FilterBar({ onApply, rowFilter, onRowFilter }) {
  const [draft, setDraft] = useState(defaultFilters);
  const [projects, setProjects] = useState([]);
  const [projectsError, setProjectsError] = useState('');

  useEffect(() => {
    let live = true;
    loadProjects()
      .then((p) => live && setProjects(p))
      .catch(() => live && setProjectsError('Could not load projects.'));
    return () => {
      live = false;
    };
  }, []);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const keySet = draft.issueKey.trim() !== '';
  const rangeInvalid = !draft.from || !draft.to || draft.from > draft.to;

  const apply = (e) => {
    e.preventDefault();
    if (!rangeInvalid) onApply({ ...draft, issueKey: draft.issueKey.trim().toUpperCase() });
  };
  const reset = () => {
    const d = defaultFilters();
    setDraft(d);
    onApply(d);
  };

  return (
    <section className="filters" aria-label="Filters">
      <form onSubmit={apply}>
        <div className="filter-row">
          <fieldset className="field">
            <legend>Date range</legend>
            <div className="presets">
              {PRESETS.map((n) => (
                <button key={n} type="button" className="btn btn-small" onClick={() => set(presetRange(n))}>
                  Last {n} days
                </button>
              ))}
            </div>
            <div className="dates">
              <label>
                From
                <input type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => set({ from: e.target.value })} />
              </label>
              <label>
                To
                <input type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => set({ to: e.target.value })} />
              </label>
            </div>
            {rangeInvalid && <span className="field-error">Choose a valid date range.</span>}
          </fieldset>

          <div className="field">
            <label htmlFor="f-project">Project</label>
            <select id="f-project" value={draft.projectId} disabled={keySet} onChange={(e) => set({ projectId: e.target.value })}>
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.key})
                </option>
              ))}
            </select>
            {projectsError && <span className="field-error">{projectsError}</span>}
          </div>

          <div className="field">
            <label htmlFor="f-user">Deleted by</label>
            <UserPicker user={draft.user} disabled={keySet} onChange={(user) => set({ user })} />
          </div>

          <div className="field">
            <label htmlFor="f-key">Work item key (exact)</label>
            <input id="f-key" type="text" value={draft.issueKey} placeholder="e.g. ABC-123" onChange={(e) => set({ issueKey: e.target.value })} />
            {keySet && <span className="hint">Project and user filters are ignored while a key is set.</span>}
          </div>
        </div>

        <div className="filter-actions">
          <button type="submit" className="btn btn-primary" disabled={rangeInvalid}>
            Apply
          </button>
          <button type="button" className="btn" onClick={reset}>
            Reset
          </button>
        </div>
      </form>

      <div className="field row-filter">
        <label htmlFor="f-rows">Filter loaded rows</label>
        <input id="f-rows" type="search" value={rowFilter} onChange={(e) => onRowFilter(e.target.value)} placeholder="Key or summary" />
        <span className="hint">Only filters rows already loaded below by key or summary. It does not search the server.</span>
      </div>
    </section>
  );
}
