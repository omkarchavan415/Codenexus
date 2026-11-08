import { useState } from 'react';
import { DifficultySelect, Pager, SubjectSelect, TopicSelect } from '../../components/admin';
import { Async, Badge, ConfirmButton, Dialog, Field, PageHeader, Spinner, useToast } from '../../components/ui';
import { del, get, post, put } from '../../lib/api';
import { pct } from '../../lib/format';
import { useAsync, useDocumentTitle } from '../../lib/hooks';
import { query, useTaxonomy } from '../../lib/taxonomy';

const LIMIT = 20;
const STATUS_TONE = { approved: 'good', pending: 'warn', rejected: 'bad' };
const blank = { subject: 'DSA', subtopic: 'arrays', difficulty: 'easy', text: '', options: ['', '', '', ''], correctIndex: 0, explanation: '', status: 'approved' };

function QuestionForm({ taxonomy, initial, onSaved, onCancel }) {
  const toast = useToast();
  const [q, setQ] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (patch) => setQ((cur) => ({ ...cur, ...patch }));
  const setOption = (i, v) => set({ options: q.options.map((o, j) => (j === i ? v : o)) });

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = { subject: q.subject, subtopic: q.subtopic, difficulty: q.difficulty, text: q.text, options: q.options, correctIndex: Number(q.correctIndex), explanation: q.explanation, status: q.status };
    try {
      if (q._id) await put(`/api/admin/questions/${q._id}`, body);
      else await post('/api/admin/questions', body);
      toast(q._id ? 'Question updated' : 'Question added');
      onSaved();
    } catch (err) {
      setError(err.details && err.details.length ? err.details.map((d) => `${d.path}: ${d.message}`).join('; ') : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Subject" htmlFor="q-subject"><SubjectSelect id="q-subject" taxonomy={taxonomy} value={q.subject} any={null} onChange={(v) => set({ subject: v, subtopic: taxonomy.find((s) => s.key === v).subtopics[0].key })} /></Field>
        <Field label="Topic" htmlFor="q-topic"><TopicSelect id="q-topic" taxonomy={taxonomy} subject={q.subject} value={q.subtopic} any={null} onChange={(v) => set({ subtopic: v })} /></Field>
        <Field label="Difficulty" htmlFor="q-diff"><DifficultySelect id="q-diff" value={q.difficulty} any={null} onChange={(v) => set({ difficulty: v })} /></Field>
      </div>
      <Field label="Question" htmlFor="q-text"><textarea id="q-text" className="input min-h-[5rem]" value={q.text} onChange={(e) => set({ text: e.target.value })} required /></Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-bone-dim">Options (mark the correct one)</legend>
        <div className="space-y-2">
          {q.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="correct" className="h-4 w-4 accent-marigold" checked={Number(q.correctIndex) === i} onChange={() => set({ correctIndex: i })} aria-label={`Option ${'ABCD'[i]} is correct`} />
              <span className="w-5 text-sm font-bold text-mute" aria-hidden="true">{'ABCD'[i]}</span>
              <input className="input" value={o} onChange={(e) => setOption(i, e.target.value)} aria-label={`Option ${'ABCD'[i]}`} required />
            </div>
          ))}
        </div>
      </fieldset>
      <Field label="Explanation shown after the test" htmlFor="q-exp"><textarea id="q-exp" className="input min-h-[4rem]" value={q.explanation} onChange={(e) => set({ explanation: e.target.value })} required /></Field>
      <Field label="Status" htmlFor="q-status">
        <select id="q-status" className="input" value={q.status} onChange={(e) => set({ status: e.target.value })}>
          <option value="approved">Approved (students can see it)</option><option value="pending">Pending review</option><option value="rejected">Rejected</option>
        </select>
      </Field>
      {error && <p role="alert" className="rounded-tab border border-coral/50 bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}
      <div className="flex gap-2"><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner label="Saving" /> : 'Save question'}</button><button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

function ImportDialog({ open, onClose, onDone }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('approved');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const content = await file.text();
      const format = /\.csv$/i.test(file.name) ? 'csv' : 'json';
      const res = await post('/api/admin/questions/import', { format, content, status });
      setResult(res);
      toast(`Imported ${res.created} question${res.created === 1 ? '' : 's'}`);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} title="Import questions" onClose={onClose} wide>
      <p className="text-sm text-mute">Upload a .csv or .json file (up to 500 questions). Duplicates are skipped and every bad row is listed so you can fix it.</p>
      <details className="mt-3 text-sm">
        <summary className="link cursor-pointer">File format</summary>
        <p className="mt-2 text-mute">CSV columns: <code>subject,subtopic,difficulty,text,optionA,optionB,optionC,optionD,correct,explanation</code> where <code>correct</code> is A, B, C or D.</p>
        <p className="mt-2 text-mute">JSON: an array of <code>{'{ subject, subtopic, difficulty, text, options: [4], correctIndex: 0-3, explanation }'}</code>.</p>
      </details>
      <div className="mt-4 space-y-3">
        <Field label="File" htmlFor="imp-file"><input id="imp-file" type="file" accept=".csv,.json,application/json,text/csv" className="input" onChange={(e) => { setFile(e.target.files[0] || null); setResult(null); }} /></Field>
        <Field label="Import as" htmlFor="imp-status"><select id="imp-status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="approved">Approved</option><option value="pending">Pending review</option></select></Field>
        {error && <p role="alert" className="text-sm text-coral">{error}</p>}
        <button type="button" className="btn btn-primary" disabled={!file || busy} onClick={run}>{busy ? <Spinner label="Importing" /> : 'Import'}</button>
      </div>
      {result && (
        <div className="mt-5 text-sm" role="status">
          <p><span className="font-semibold text-mint">{result.created} added</span>, {result.duplicates} duplicate{result.duplicates === 1 ? '' : 's'} skipped, {result.invalid.length} with problems.</p>
          {result.invalid.length > 0 && (
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-tab border border-ink-700 p-3">
              {result.invalid.map((r) => <li key={r.row}><span className="font-semibold">Row {r.row}:</span> <span className="text-coral">{r.errors.join('; ')}</span></li>)}
            </ul>
          )}
        </div>
      )}
    </Dialog>
  );
}

export default function Questions() {
  useDocumentTitle('Questions');
  const toast = useToast();
  const tax = useTaxonomy();
  const [f, setF] = useState({ subject: '', subtopic: '', difficulty: '', status: '', q: '', flagged: '' });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const state = useAsync(() => get(`/api/admin/questions${query({ ...f, page, limit: LIMIT })}`), [f.subject, f.subtopic, f.difficulty, f.status, f.q, f.flagged, page]);
  const update = (patch) => { setF((cur) => ({ ...cur, ...patch })); setPage(1); };

  async function act(fn, ok) {
    try { await fn(); toast(ok); state.reload(); } catch (err) { toast(err.message, 'bad'); }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Questions" actions={<><button type="button" className="btn btn-quiet" onClick={() => setImporting(true)}>Import CSV or JSON</button><button type="button" className="btn btn-primary" onClick={() => setEditing(blank)} disabled={!tax.data}>Add question</button></>}>
        Everything students can be asked, with the answer key. Only approved questions appear in tests.
      </PageHeader>

      <Async state={tax}>
        {(taxonomy) => (
          <>
            <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="sm:col-span-3 lg:col-span-2"><label htmlFor="f-q" className="sr-only">Search question text</label><input id="f-q" className="input" placeholder="Search text" value={f.q} onChange={(e) => update({ q: e.target.value })} /></div>
              <div><label htmlFor="f-sub" className="sr-only">Subject</label><SubjectSelect id="f-sub" taxonomy={taxonomy} value={f.subject} onChange={(v) => update({ subject: v, subtopic: '' })} /></div>
              <div><label htmlFor="f-top" className="sr-only">Topic</label><TopicSelect id="f-top" taxonomy={taxonomy} subject={f.subject} value={f.subtopic} onChange={(v) => update({ subtopic: v })} /></div>
              <div><label htmlFor="f-dif" className="sr-only">Difficulty</label><DifficultySelect id="f-dif" value={f.difficulty} onChange={(v) => update({ difficulty: v })} /></div>
              <div>
                <label htmlFor="f-st" className="sr-only">Status</label>
                <select id="f-st" className="input" value={f.status} onChange={(e) => update({ status: e.target.value })}><option value="">Any status</option><option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option></select>
              </div>
            </div>

            <Async state={state}>
              {(d) => (
                <>
                  {d.questions.length === 0 ? (
                    <p className="panel p-6 text-center text-sm text-mute">No questions match these filters.</p>
                  ) : (
                    <ul>
                      {d.questions.map((q) => (
                        <li key={q.id} className="row-rule py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={STATUS_TONE[q.status]}>{q.status}</Badge><Badge>{q.subject}</Badge><Badge>{q.subtopic}</Badge><Badge>{q.difficulty}</Badge>
                            {q.source === 'gemini' && <Badge tone="info">Gemini</Badge>}
                            {q.flagged && <Badge tone="bad">Flagged</Badge>}
                            {q.timesAsked > 0 && <span className="text-xs text-mute">asked {q.timesAsked}x, {pct(q.timesCorrect / q.timesAsked)} correct</span>}
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold">{q.text}</p>
                          <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                            {q.options.map((o, i) => <li key={i} className={i === q.correctIndex ? 'text-mint' : 'text-bone-dim'}>{'ABCD'[i]}. {o}</li>)}
                          </ol>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button type="button" className="btn btn-quiet px-3 py-1.5" onClick={() => setEditing({ ...q, options: [...q.options] })}>Edit</button>
                            {q.status !== 'approved' && <button type="button" className="btn btn-quiet px-3 py-1.5" onClick={() => act(() => post(`/api/admin/questions/${q.id}/review`, { action: 'approve' }), 'Approved')}>Approve</button>}
                            {q.status !== 'rejected' && <button type="button" className="btn btn-quiet px-3 py-1.5" onClick={() => act(() => post(`/api/admin/questions/${q.id}/review`, { action: 'reject' }), 'Rejected')}>Reject</button>}
                            <ConfirmButton message={q.timesAsked > 0 ? 'Students have answered this, so it will be retired instead.' : 'Delete for good?'} onConfirm={() => act(() => del(`/api/admin/questions/${q.id}`), q.timesAsked > 0 ? 'Question retired' : 'Question deleted')}>Delete</ConfirmButton>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Pager page={page} limit={LIMIT} total={d.total} onPage={setPage} />
                </>
              )}
            </Async>

            <Dialog open={Boolean(editing)} title={editing && editing._id ? 'Edit question' : 'Add question'} onClose={() => setEditing(null)} wide>
              {editing && <QuestionForm taxonomy={taxonomy} initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); state.reload(); }} />}
            </Dialog>
            <ImportDialog open={importing} onClose={() => setImporting(false)} onDone={state.reload} />
          </>
        )}
      </Async>
    </div>
  );
}
