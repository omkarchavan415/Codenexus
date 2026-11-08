import { useState } from 'react';
import { Async, Badge, ConfirmButton, Dialog, Field, PageHeader, Spinner, useToast } from '../../components/ui';
import { del, get, post, put } from '../../lib/api';
import { useAsync, useDocumentTitle } from '../../lib/hooks';
import { WEIGHTS, useTaxonomy } from '../../lib/taxonomy';

const WEIGHT_TONE = { high: 'warn', medium: 'info', low: 'neutral' };

function Editor({ taxonomy, initial, onSaved, onCancel }) {
  const toast = useToast();
  const [c, setC] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const weightOf = (subject) => (c.skills.find((s) => s.subject === subject) || {}).weight || 'none';
  const setWeight = (subject, w) => setC((cur) => ({
    ...cur,
    skills: w === 'none' ? cur.skills.filter((s) => s.subject !== subject) : [...cur.skills.filter((s) => s.subject !== subject), { subject, weight: w }],
  }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = { name: c.name, role: c.role, description: c.description, skills: taxonomy.map((s) => s.key).filter((k) => weightOf(k) !== 'none').map((k) => ({ subject: k, weight: weightOf(k) })), active: c.active !== false };
    if (c.slug) body.slug = c.slug;
    try {
      if (c.id) await put(`/api/admin/companies/${c.id}`, body); else await post('/api/admin/companies', body);
      toast('Company saved');
      onSaved();
    } catch (err) {
      setError(err.details && err.details.length ? err.details.map((d) => d.message).join('; ') : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Company name" htmlFor="c-name"><input id="c-name" className="input" required minLength={2} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
        <Field label="Role" htmlFor="c-role"><input id="c-role" className="input" required value={c.role} onChange={(e) => setC({ ...c, role: e.target.value })} /></Field>
      </div>
      <Field label="Short description" htmlFor="c-desc"><textarea id="c-desc" className="input min-h-[4rem]" value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} /></Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-bone-dim">How much does this company expect in each subject?</legend>
        <div className="space-y-2">
          {taxonomy.map((s) => (
            <div key={s.key} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
              <label htmlFor={`w-${s.key}`}>{s.label}</label>
              <select id={`w-${s.key}`} className="input w-40" value={weightOf(s.key)} onChange={(e) => setWeight(s.key, e.target.value)}>
                <option value="none">Not required</option>{WEIGHTS.map((w) => <option key={w} value={w}>{w[0].toUpperCase() + w.slice(1)}</option>)}
              </select>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-mute">High counts 3, medium 2 and low 1 when gaps are ranked. Subjects marked not required are left out of the roadmap.</p>
      </fieldset>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-marigold" checked={c.active !== false} onChange={(e) => setC({ ...c, active: e.target.checked })} />Show this company to students</label>
      {error && <p role="alert" className="rounded-tab border border-coral/50 bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}
      <div className="flex gap-2"><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner label="Saving" /> : 'Save company'}</button><button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

export default function Companies() {
  useDocumentTitle('Companies');
  const toast = useToast();
  const tax = useTaxonomy();
  const state = useAsync(() => get('/api/admin/companies'), []);
  const [editing, setEditing] = useState(null);

  async function remove(c) {
    try {
      const res = await del(`/api/admin/companies/${c.id}`);
      toast(res.archived ? `Hidden from students (${res.students} use it)` : 'Company deleted');
      state.reload();
    } catch (err) { toast(err.message, 'bad'); }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Company profiles" actions={<button type="button" className="btn btn-primary" disabled={!tax.data} onClick={() => setEditing({ name: '', role: 'Software Engineer', description: '', skills: [], active: true })}>Add company</button>}>
        Each profile says how much a company expects in every subject. Roadmaps compare students against these weights.
      </PageHeader>
      <Async state={tax}>
        {(taxonomy) => (
          <>
            <Async state={state}>
              {(d) => (
                <ul>
                  {d.companies.map((c) => (
                    <li key={c.id} className="row-rule py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div><p className="font-semibold">{c.name} <span className="font-normal text-mute">{c.role}</span> {!c.active && <Badge tone="warn">Hidden</Badge>}</p></div>
                        <div className="flex gap-2"><button type="button" className="btn btn-quiet px-3 py-1.5" onClick={() => setEditing({ ...c, skills: c.skills.map((s) => ({ ...s })) })}>Edit</button><ConfirmButton message="Delete this company?" onConfirm={() => remove(c)}>Delete</ConfirmButton></div>
                      </div>
                      <p className="mt-2 flex flex-wrap gap-2">{c.skills.map((s) => <Badge key={s.subject} tone={WEIGHT_TONE[s.weight]}>{s.subject}: {s.weight}</Badge>)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Async>
            <Dialog open={Boolean(editing)} title={editing && editing.id ? `Edit ${editing.name}` : 'Add company'} onClose={() => setEditing(null)}>
              {editing && <Editor taxonomy={taxonomy} initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); state.reload(); }} />}
            </Dialog>
          </>
        )}
      </Async>
    </div>
  );
}
