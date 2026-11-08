import { useState } from 'react';
import { DifficultySelect, Pager, SubjectSelect, TopicSelect } from '../../components/admin';
import { Async, Badge, ConfirmButton, Dialog, Field, PageHeader, Spinner, useToast } from '../../components/ui';
import { del, get, post, put } from '../../lib/api';
import { useAsync, useDocumentTitle } from '../../lib/hooks';
import { query, useTaxonomy } from '../../lib/taxonomy';

const LIMIT = 25;
const DIFF_TONE = { easy: 'good', medium: 'warn', hard: 'bad' };

function ProblemForm({ taxonomy, initial, onSaved, onCancel }) {
  const toast = useToast();
  const [p, setP] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = { title: p.title, url: p.url, subject: p.subject, subtopic: p.subtopic, difficulty: p.difficulty, active: p.active !== false };
    try {
      if (p._id) await put(`/api/admin/problems/${p._id}`, body); else await post('/api/admin/problems', body);
      toast('Problem saved');
      onSaved();
    } catch (err) {
      setError(err.details && err.details.length ? err.details.map((d) => `${d.path}: ${d.message}`).join('; ') : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Title" htmlFor="p-title"><input id="p-title" className="input" required value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} /></Field>
      <Field label="LeetCode link" htmlFor="p-url" hint="Must look like https://leetcode.com/problems/two-sum/"><input id="p-url" className="input" required value={p.url} onChange={(e) => setP({ ...p, url: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Subject" htmlFor="p-sub"><SubjectSelect id="p-sub" taxonomy={taxonomy} value={p.subject} any={null} onChange={(v) => setP({ ...p, subject: v, subtopic: taxonomy.find((s) => s.key === v).subtopics[0].key })} /></Field>
        <Field label="Topic" htmlFor="p-top"><TopicSelect id="p-top" taxonomy={taxonomy} subject={p.subject} value={p.subtopic} any={null} onChange={(v) => setP({ ...p, subtopic: v })} /></Field>
        <Field label="Difficulty" htmlFor="p-dif"><DifficultySelect id="p-dif" value={p.difficulty} any={null} onChange={(v) => setP({ ...p, difficulty: v })} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-marigold" checked={p.active !== false} onChange={(e) => setP({ ...p, active: e.target.checked })} />Include in new roadmaps</label>
      {error && <p role="alert" className="rounded-tab border border-coral/50 bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}
      <div className="flex gap-2"><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner label="Saving" /> : 'Save problem'}</button><button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

export default function Problems() {
  useDocumentTitle('Problems');
  const toast = useToast();
  const tax = useTaxonomy();
  const [f, setF] = useState({ subject: '', subtopic: '', difficulty: '', active: '', q: '' });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const state = useAsync(() => get(`/api/admin/problems${query({ ...f, page, limit: LIMIT })}`), [f.subject, f.subtopic, f.difficulty, f.active, f.q, page]);
  const update = (patch) => { setF((c) => ({ ...c, ...patch })); setPage(1); };

  async function remove(p) {
    try {
      const res = await del(`/api/admin/problems/${p.id}`);
      toast(res.archived ? 'Problem retired (students have solved it)' : 'Problem deleted');
      state.reload();
    } catch (err) { toast(err.message, 'bad'); }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Practice problems" actions={<button type="button" className="btn btn-primary" disabled={!tax.data} onClick={() => setEditing({ title: '', url: 'https://leetcode.com/problems/', subject: 'DSA', subtopic: 'arrays', difficulty: 'easy', active: true })}>Add problem</button>}>
        LeetCode problems that roadmaps pick from, matched to a topic and difficulty.
      </PageHeader>
      <Async state={tax}>
        {(taxonomy) => (
          <>
            <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div><label htmlFor="pf-q" className="sr-only">Search title</label><input id="pf-q" className="input" placeholder="Search title" value={f.q} onChange={(e) => update({ q: e.target.value })} /></div>
              <div><label htmlFor="pf-sub" className="sr-only">Subject</label><SubjectSelect id="pf-sub" taxonomy={taxonomy} value={f.subject} onChange={(v) => update({ subject: v, subtopic: '' })} /></div>
              <div><label htmlFor="pf-top" className="sr-only">Topic</label><TopicSelect id="pf-top" taxonomy={taxonomy} subject={f.subject} value={f.subtopic} onChange={(v) => update({ subtopic: v })} /></div>
              <div><label htmlFor="pf-dif" className="sr-only">Difficulty</label><DifficultySelect id="pf-dif" value={f.difficulty} onChange={(v) => update({ difficulty: v })} /></div>
              <div><label htmlFor="pf-act" className="sr-only">Active</label><select id="pf-act" className="input" value={f.active} onChange={(e) => update({ active: e.target.value })}><option value="">Active and retired</option><option value="true">Active only</option><option value="false">Retired only</option></select></div>
            </div>
            <Async state={state}>
              {(d) => (
                <>
                  {d.problems.length === 0 ? <p className="panel p-6 text-center text-sm text-mute">No problems match these filters.</p> : (
                    <ul>
                      {d.problems.map((p) => (
                        <li key={p.id} className="row-rule flex flex-wrap items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-marigold">{p.title}<span className="sr-only"> (opens LeetCode in a new tab)</span></a>
                            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mute"><Badge>{p.subject}</Badge><Badge>{p.subtopic}</Badge><Badge tone={DIFF_TONE[p.difficulty]}>{p.difficulty}</Badge>{!p.active && <Badge tone="warn">Retired</Badge>}</p>
                          </div>
                          <div className="flex gap-2"><button type="button" className="btn btn-quiet px-3 py-1.5" onClick={() => setEditing({ ...p })}>Edit</button><ConfirmButton message="Delete?" onConfirm={() => remove(p)}>Delete</ConfirmButton></div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Pager page={page} limit={LIMIT} total={d.total} onPage={setPage} />
                </>
              )}
            </Async>
            <Dialog open={Boolean(editing)} title={editing && editing._id ? 'Edit problem' : 'Add problem'} onClose={() => setEditing(null)}>
              {editing && <ProblemForm taxonomy={taxonomy} initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); state.reload(); }} />}
            </Dialog>
          </>
        )}
      </Async>
    </div>
  );
}
