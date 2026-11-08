import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export function Spinner({ label = 'Loading' }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-mute">
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="text-sm">{label}</span>
    </span>
  );
}

export function PageLoading({ label = 'Loading' }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" aria-busy="true">
      <Spinner label={label} />
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  const message = (error && error.message) || 'Please try again.';
  return (
    <div role="alert" className="panel mx-auto my-8 max-w-lg p-6 text-center">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-2 text-sm text-mute">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-quiet mt-4" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="panel mx-auto my-8 max-w-lg p-8 text-center">
      <h2 className="text-lg font-bold">{title}</h2>
      {children && <p className="mt-2 text-sm text-mute">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

/** Shows loading and error states, then renders children(data). */
export function Async({ state, children, loadingLabel }) {
  if (state.loading && !state.data) return <PageLoading label={loadingLabel} />;
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} />;
  if (!state.data) return null;
  return children(state.data);
}

export function Field({ label, error, hint, children, htmlFor }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-bone-dim">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-mute">{hint}</p>}
      {error && <p className="text-xs text-coral" role="alert">{error}</p>}
    </div>
  );
}

export function PageHeader({ title, children, actions }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {children && <p className="mt-1.5 max-w-prose text-sm text-mute">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Meter({ value, color = '#F0B03A', label, height = 6 }) {
  const w = Math.min(100, Math.max(0, Math.round(value * 100)));
  return (
    <div
      role="progressbar"
      aria-valuenow={w}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="w-full overflow-hidden rounded-full bg-ink-700"
      style={{ height }}
    >
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-ink-700 text-bone-dim',
    good: 'bg-mint/15 text-mint',
    warn: 'bg-marigold/15 text-marigold',
    bad: 'bg-coral/15 text-coral',
    info: 'bg-sky/15 text-sky',
  };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

/* ------------------------------ toasts ------------------------------ */

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const nextId = useRef(1);
  const push = useCallback((message, tone = 'good') => {
    const id = nextId.current;
    nextId.current += 1;
    setItems((list) => [...list, { id, message, tone }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-20 right-4 z-50 flex w-[min(92vw,22rem)] flex-col gap-2 md:bottom-6" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-tab border px-4 py-3 text-sm shadow-lg ${
              t.tone === 'bad' ? 'border-coral/60 bg-ink-800 text-coral' : 'border-mint/40 bg-ink-800 text-bone'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ------------------------------ dialog ------------------------------ */

export function Dialog({ open, title, onClose, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const first = ref.current && ref.current.querySelector('input, select, textarea, button');
    if (first) first.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous && previous.focus) previous.focus();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink-950/80 p-3 sm:items-center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`panel max-h-[90vh] w-full overflow-y-auto bg-ink-800 p-5 ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" className="btn btn-quiet px-2.5 py-1" onClick={onClose} aria-label="Close dialog">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmButton({ children, onConfirm, message = 'Are you sure?', className = 'btn btn-danger' }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button type="button" className={className} onClick={() => setAsking(true)}>{children}</button>;
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="text-mute">{message}</span>
      <button type="button" className="btn btn-danger px-3 py-1.5" onClick={() => { setAsking(false); onConfirm(); }}>Yes</button>
      <button type="button" className="btn btn-quiet px-3 py-1.5" onClick={() => setAsking(false)}>No</button>
    </span>
  );
}
