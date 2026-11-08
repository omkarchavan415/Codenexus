import { get } from './api';
import { useAsync } from './hooks';

let cache = null;

/** Subjects and their topics, loaded once and shared by every admin screen. */
export function useTaxonomy() {
  return useAsync(async () => {
    if (!cache) cache = (await get('/api/subjects')).subjects;
    return cache;
  }, []);
}

export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export const WEIGHTS = ['high', 'medium', 'low'];

export function topicsOf(taxonomy, subject) {
  const s = taxonomy.find((x) => x.key === subject);
  return s ? s.subtopics : [];
}

export function query(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== '' && v !== undefined && v !== null) q.set(k, v); });
  const s = q.toString();
  return s ? `?${s}` : '';
}
