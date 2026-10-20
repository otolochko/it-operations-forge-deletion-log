export function Loading({ text = 'Loading...' }) {
  return (
    <p className="state" role="status">
      <span className="spinner" aria-hidden="true" /> {text}
    </p>
  );
}

export function Empty({ text = 'No deletions recorded for these filters.' }) {
  return <p className="state state-empty">{text}</p>;
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state state-error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
