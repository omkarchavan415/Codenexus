import { DIFFICULTIES } from '../lib/taxonomy';

export function Pager({ page, limit, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <span className="text-mute">{total} result{total === 1 ? '' : 's'}</span>
      <span className="flex items-center gap-2">
        <button type="button" className="btn btn-quiet px-3 py-1.5" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span>Page {page} of {pages}</span>
        <button type="button" className="btn btn-quiet px-3 py-1.5" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </span>
    </nav>
  );
}

export function SubjectSelect({ taxonomy, value, onChange, id, any = 'All subjects' }) {
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {any !== null && <option value="">{any}</option>}
      {taxonomy.map((s) => <option key={s.key} value={s.key}>{s.key} - {s.label}</option>)}
    </select>
  );
}

export function TopicSelect({ taxonomy, subject, value, onChange, id, any = 'All topics' }) {
  const topics = subject ? (taxonomy.find((s) => s.key === subject) || { subtopics: [] }).subtopics : [];
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} disabled={!subject}>
      {any !== null && <option value="">{any}</option>}
      {topics.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
    </select>
  );
}

export function DifficultySelect({ value, onChange, id, any = 'Any difficulty' }) {
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {any !== null && <option value="">{any}</option>}
      {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
    </select>
  );
}

export function StatTile({ label, value, note }) {
  return (
    <div className="px-1 py-2">
      <p className="font-display text-4xl font-extrabold leading-none">{value}</p>
      <p className="mt-1.5 text-sm text-bone-dim">{label}</p>
      {note && <p className="text-xs text-mute">{note}</p>}
    </div>
  );
}
