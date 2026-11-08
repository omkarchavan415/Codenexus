import { useCallback, useEffect, useRef, useState } from 'react';

/** Runs an async loader and tracks loading and error state. `reload()` runs it again. */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const tick = useRef(0);

  const run = useCallback(() => {
    const id = (tick.current += 1);
    setState((s) => ({ ...s, loading: true, error: null }));
    loaderRef.current()
      .then((data) => { if (id === tick.current) setState({ data, error: null, loading: false }); })
      .catch((error) => { if (id === tick.current) setState({ data: null, error, loading: false }); });
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); return () => { tick.current += 1; }; }, deps);
  return { ...state, reload: run };
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | CodeNexus` : 'CodeNexus';
  }, [title]);
}
