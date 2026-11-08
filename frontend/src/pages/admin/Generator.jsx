import { useState } from 'react';
import { DifficultySelect, SubjectSelect, TopicSelect } from '../../components/admin';
import { Async, Badge, EmptyState, Field, PageHeader, Spinner, useToast } from '../../components/ui';
import { get, post } from '../../lib/api';
import { useAsync, useDocumentTitle } from '../../lib/hooks';
import { useTaxonomy } from '../../lib/taxonomy';

const SKIP_TEXT = {
  gemini_not_configured: 'Gemini is not configured. Set GEMINI_API_KEY and GEMINI_MODEL on the server to turn the generator on.',
  gemini_unavailable: 'Gemini did not answer in time or returned an error. Try again in a moment.',
  invalid_response: 'Gemini replied in a format the platform could not read. Try again.',
};

function Pending({ onChange }) {
  const toast = useToast();
  const state = useAsync(() => get('/api/admin/questions?status=pending&limit=100'), []);
  const [picked, setPicked] = useState(new Set());

  async function review(ids, action) {
    try {
      await post('/api/admin/questions/bulk-review', { ids, action });
      toast(action === 'approve' ? `Approved ${ids.length}` : `Rejected ${ids.length}`);
      setPicked(new Set());
      state.reload();
      onChange();
    } catch (err) {
      toast(err.message, 'bad');
    }
  }

  return (
    <Async state={state}>
      {(d) => {
        if (!d.questions.length) return <EmptyState title="Nothing waiting for review">Generated questions appear here until you approve or reject them.</EmptyState>;
        const toggle = (id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
        const ids = [...picked];
        return (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-quiet px-3 py-1.5" onClick={() => setPicked(picked.size === d.questions.length ? new Set() : new Set(d.questions.map((q) => q.id)))}>{picked.size === d.questions.length ? 'Clear selection' : 'Select all'}</button>
              <button type="button" className="btn btn-primary px-3 py-1.5" disabled={!ids.length} onClick={() => review(ids, 'approve')}>Approve selected ({ids.length})</button>
              <button type="button" className="btn btn-danger px-3 py-1.5" disabled={!ids.length} onClick={() => review(ids, 'reject')}>Reject selected</button>
            </div>
            <ul>
              {d.questions.map((q) => (
                <li key={q.id} className="row-rule flex gap-3 py-4">
                  <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-marigold" checked={picked.has(q.id)} onChange={() => toggle(q.id)} aria-label={`Select: ${q.text.slice(0, 60)}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2"><Badge>{q.subject}</Badge><Badge>{q.subtopic}</Badge><Badge>{q.difficulty}</Badge>{q.verified && <Badge tone="good">Answer double-checked</Badge>}{q.source !== 'gemini' && <Badge>{q.source}</Badge>}</div>
                    <p className="mt-2 whitespace-pre-wrap text-sm font-semibold">{q.text}</p>
                    <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">{q.options.map((o, i) => <li key={i} className={i === q.correctIndex ? 'text-mint' : 'text-bone-dim'}>{'ABCD'[i]}. {o}</li>)}</ol>
                    <p className="mt-2 text-sm text-mute"><span className="font-semibold text-bone-dim">Explanation: </span>{q.explanation}</p>
                    <div className="mt-3 flex gap-2"><button type="button" className="btn btn-quiet px-3 py-1.5" onClick={() => review([q.id], 'approve')}>Approve</button><button type="button" className="btn btn-quiet px-3 py-1.5" onClick={() => review([q.id], 'reject')}>Reject</button></div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        );
      }}
    </Async>
  );
}

export default function Generator() {
  useDocumentTitle('Generator');
  const toast = useToast();
  const tax = useTaxonomy();
  const [form, setForm] = useState({ subject: 'DSA', subtopic: 'arrays', difficulty: 'easy', count: 5 });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  async function generate(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const res = await post('/api/admin/generate', { ...form, count: Number(form.count) });
      setResult(res);
      if (res.created.length) { toast(`${res.created.length} question${res.created.length === 1 ? '' : 's'} ready for review`); setVersion((v) => v + 1); }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Gemini generator">Ask Gemini for new questions. Each one is format-checked, compared with the bank for duplicates and re-answered by a second call. Survivors wait here until you approve them.</PageHeader>
      <Async state={tax}>
        {(taxonomy) => (
          <form onSubmit={generate} className="panel grid gap-4 p-5 sm:grid-cols-5">
            <Field label="Subject" htmlFor="g-sub"><SubjectSelect id="g-sub" taxonomy={taxonomy} value={form.subject} any={null} onChange={(v) => setForm({ ...form, subject: v, subtopic: taxonomy.find((s) => s.key === v).subtopics[0].key })} /></Field>
            <Field label="Topic" htmlFor="g-top"><TopicSelect id="g-top" taxonomy={taxonomy} subject={form.subject} value={form.subtopic} any={null} onChange={(v) => setForm({ ...form, subtopic: v })} /></Field>
            <Field label="Difficulty" htmlFor="g-dif"><DifficultySelect id="g-dif" value={form.difficulty} any={null} onChange={(v) => setForm({ ...form, difficulty: v })} /></Field>
            <Field label="How many (1 to 10)" htmlFor="g-n"><input id="g-n" type="number" min="1" max="10" className="input" value={form.count} onChange={(e) => setForm({ ...form, count: e.target.value })} /></Field>
            <div className="flex items-end"><button type="submit" className="btn btn-primary w-full" disabled={busy || !(Number(form.count) >= 1 && Number(form.count) <= 10)}>{busy ? <Spinner label="Generating" /> : 'Generate'}</button></div>
          </form>
        )}
      </Async>

      {error && <p role="alert" className="mt-4 rounded-tab border border-coral/50 bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}
      {result && (
        <div className="mt-4 rounded-panel border border-ink-700 p-4 text-sm" role="status">
          {result.skipped ? <p className="text-marigold">{SKIP_TEXT[result.skipped] || 'Nothing was generated.'}</p> : (
            <p>Requested {result.requested}. <span className="font-semibold text-mint">{result.created.length} saved for review</span>. Dropped: {result.rejected.invalidFormat} badly formatted, {result.rejected.duplicate} duplicates, {result.rejected.verificationFailed} that failed the second-answer check.</p>
          )}
        </div>
      )}

      <section className="mt-10" aria-labelledby="pending-h">
        <h2 id="pending-h" className="text-2xl font-bold">Waiting for review</h2>
        <Pending key={version} onChange={() => {}} />
      </section>
    </div>
  );
}
