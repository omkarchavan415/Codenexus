import { useState } from 'react';
import { Pager, SubjectSelect, TopicSelect } from '../../components/admin';
import { Async, Badge, ConfirmButton, Dialog, Field, PageHeader, Spinner, useToast } from '../../components/ui';
import { del, get, post, put } from '../../lib/api';
import { useAsync, useDocumentTitle } from '../../lib/hooks';
import { query, useTaxonomy } from '../../lib/taxonomy';

const LIMIT = 25;
const blank = { type: 'resource', title: '', description: '', url: 'https://', minutes: 20, subject: 'DBMS', subtopic: 'normalization', active: true };

function ItemForm({ taxonomy, initial, onSaved, onCancel }) {
  const toast = useToast();
  const [it, setIt] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      type: it.type,
      title: it.title,
      description: it.description || '',
      url: it.type === 'resource' || (it.url && it.url !== 'https://') ? it.url : '',
      minutes: Number(it.minutes),
      subject: it.subject,
      subtopic: it.subtopic,
      active: it.active !== false,
    };
    try {
      if (it._id) await put(`/api/admin/study-items/${it._id}`, body); else await post('/api/admin/study-items', body);
      toast('Study item saved');
      onSaved();
    } catch (err) {
      setError(err.details && err.details.length ? err.details.map((d) => `${d.path}: ${d.message}`).join('; ') : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kind" htmlFor="s-type">
          <select id="s-type" className="input" value={it.type} onChange={(e) => setIt({ ...it, type: e.target.value })}>
            <option value="resource">Resource: something to read or watch</option>
            <option value="practical">Practical: a hands-on exercise</option>
          </select>
        </Field>
        <Field label="Minutes" htmlFor="s-min"><input id="s-min" type="number" min="5" max="240" required className="input" value={it.minutes} onChange={(e) => setIt({ ...it, minutes: e.target.value })} /></Field>
      </div>
      <Field label="Title" htmlFor="s-title"><input id="s-title" className="input" required maxLength={160} value={it.title} onChange={(e) => setIt({ ...it, title: e.target.value })} /></Field>
      <Field
        label={it.type === 'resource' ? 'Link' : 'Link (optional)'}
        htmlFor="s-url"
        hint={it.type === 'resource' ? 'A page, video or course. Must start with http:// or https://' : 'For example a tool or reference the exercise uses'}
      >
        <input id="s-url" className="input" required={it.type === 'resource'} value={it.url} onChange={(e) => setIt({ ...it, url: e.target.value })} />
      </Field>
      <Field label={it.type === 'practical' ? 'Instructions' : 'Description (optional)'} htmlFor="s-desc" hint={it.type === 'practical' ? 'What the student should do and what to write down at the end' : undefined}>
        <textarea id="s-desc" rows={5} maxLength={1500} required={it.type === 'practical'} className="input" value={it.description} onChange={(e) => setIt({ ...it, description: e.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Subject" htmlFor="s-sub"><SubjectSelect id="s-sub" taxonomy={taxonomy} value={it.subject} any={null} onChange={(v) => setIt({ ...it, subject: v, subtopic: taxonomy.find((s) => s.key === v).subtopics[0].key })} /></Field>
        <Field label="Topic" htmlFor="s-top"><TopicSelect id="s-top" taxonomy={taxonomy} subject={it.subject} value={it.subtopic} any={null} onChange={(v) => setIt({ ...it, subtopic: v })} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-marigold" checked={it.active !== false} onChange={(e) => setIt({ ...it, active: e.target.checked })} />Include in new roadmaps</label>
      {error && <p role="alert" className="rounded-tab border border-coral/50 bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}
      <div className="flex gap-2"><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner label="Saving" /> : 'Save item'}</button><button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

export default function StudyItems() {
  useDocumentTitle('Study items');
  const toast = useToast();
  const tax = useTaxonomy();
  const [f, setF] = useState({ type: '', subject: '', subtopic: '', active: '', q: '' });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const state = useAsync(() => get(`/api/admin/study-items${query({ ...f, page, limit: LIMIT })}`), [f.type, f.subject, f.subtopic, f.active, f.q, page]);
  const update = (patch) => { setF((c) => ({ ...c, ...patch })); setPage(1); };

  async function remove(it) {
    try {
      const res = await del(`/api/admin/study-items/${it.id}`);
      toast(res.archived ? 'Item retired (students have finished it)' : 'Item deleted');
      state.reload();
    } catch (err) { toast(err.message, 'bad'); }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Study items" actions={<button type="button" className="btn btn-primary" disabled={!tax.data} onClick={() => setEditing({ ...blank })}>Add item</button>}>
        Readings, videos and hands-on exercises that roadmaps schedule for each topic. Subjects with no LeetCode problems, like Operating Systems, rely on these. Replace the default video searches with specific lectures you trust.
      </PageHeader>
      <Async state={tax}>
        {(taxonomy) => (
          <>
            <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div><label htmlFor="sf-q" className="sr-only">Search title</label><input id="sf-q" className="input" placeholder="Search title" value={f.q} onChange={(e) => update({ q: e.target.value })} /></div>
              <div><label htmlFor="sf-type" className="sr-only">Kind</label><select id="sf-type" className="input" value={f.type} onChange={(e) => update({ type: e.target.value })}><option value="">All kinds</option><option value="resource">Resources</option><option value="practical">Practicals</option></select></div>
              <div><label htmlFor="sf-sub" className="sr-only">Subject</label><SubjectSelect id="sf-sub" taxonomy={taxonomy} value={f.subject} onChange={(v) => update({ subject: v, subtopic: '' })} /></div>
              <div><label htmlFor="sf-top" className="sr-only">Topic</label><TopicSelect id="sf-top" taxonomy={taxonomy} subject={f.subject} value={f.subtopic} onChange={(v) => update({ subtopic: v })} /></div>
              <div><label htmlFor="sf-act" className="sr-only">Active</label><select id="sf-act" className="input" value={f.active} onChange={(e) => update({ active: e.target.value })}><option value="">Active and retired</option><option value="true">Active only</option><option value="false">Retired only</option></select></div>
            </div>
            <Async state={state}>
              {(d) => (
                <>
                  {d.items.length === 0 ? <p className="panel p-6 text-center text-sm text-mute">No study items match these filters.</p> : (
                    <ul>
                      {d.items.map((it) => (
                        <li key={it.id} className="row-rule flex flex-wrap items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            {it.url ? <a href={it.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-marigold">{it.title}<span className="sr-only"> (opens in a new tab)</span></a> : <span className="font-semibold">{it.title}</span>}
                            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mute">
                              <Badge tone={it.type === 'practical' ? 'info' : 'neutral'}>{it.type}</Badge><Badge>{it.subject}</Badge><Badge>{it.subtopic}</Badge><span>{it.minutes} min</span>{!it.active && <Badge tone="warn">Retired</Badge>}
                            </p>
                          </div>
                          <div className="flex gap-2"><button type="button" className="btn btn-quiet px-3 py-1.5" onClick={() => setEditing({ ...it })}>Edit</button><ConfirmButton message="Delete?" onConfirm={() => remove(it)}>Delete</ConfirmButton></div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Pager page={page} limit={LIMIT} total={d.total} onPage={setPage} />
                </>
              )}
            </Async>
            <Dialog open={Boolean(editing)} title={editing && editing._id ? 'Edit study item' : 'Add study item'} onClose={() => setEditing(null)}>
              {editing && <ItemForm taxonomy={taxonomy} initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); state.reload(); }} />}
            </Dialog>
          </>
        )}
      </Async>
    </div>
  );
}
