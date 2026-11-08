import { useState } from 'react';
import { SubjectSelect } from '../../components/admin';
import { Async, Badge, EmptyState, Meter, PageHeader, useToast } from '../../components/ui';
import { get, patch, post } from '../../lib/api';
import { levelColor, pct } from '../../lib/format';
import { useAsync, useDocumentTitle } from '../../lib/hooks';
import { query, useTaxonomy } from '../../lib/taxonomy';

const FLAGS = {
  possible_wrong_key: { tone: 'bad', text: 'Almost nobody gets this right. Check the answer key.' },
  too_easy: { tone: 'warn', text: 'Nearly everyone gets this right, so it tells you little.' },
  harder_than_labelled: { tone: 'warn', text: 'Labelled easy, but most students miss it.' },
  easier_than_labelled: { tone: 'warn', text: 'Labelled hard, but most students get it right.' },
};

export default function Quality() {
  useDocumentTitle('Question quality');
  const toast = useToast();
  const tax = useTaxonomy();
  const [subject, setSubject] = useState('');
  const [minAsked, setMinAsked] = useState(10);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const state = useAsync(() => get(`/api/admin/quality${query({ subject, minAsked, flaggedOnly: flaggedOnly ? 'true' : 'false' })}`), [subject, minAsked, flaggedOnly]);

  async function review(id, action) {
    try { await post(`/api/admin/questions/${id}/review`, { action }); toast(action === 'reject' ? 'Question rejected' : 'Question approved'); state.reload(); } catch (err) { toast(err.message, 'bad'); }
  }
  async function toggleFlag(q) {
    try { await patch(`/api/admin/questions/${q.id}/flag`, { flagged: !q.flaggedByAdmin }); state.reload(); } catch (err) { toast(err.message, 'bad'); }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Question quality">How students actually answered each question. Needs enough attempts before a question can be judged.</PageHeader>
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div className="w-56"><label htmlFor="ql-sub" className="mb-1 block text-sm text-bone-dim">Subject</label>{tax.data && <SubjectSelect id="ql-sub" taxonomy={tax.data} value={subject} onChange={setSubject} />}</div>
        <div className="w-40"><label htmlFor="ql-min" className="mb-1 block text-sm text-bone-dim">Minimum attempts</label><input id="ql-min" type="number" min="1" className="input" value={minAsked} onChange={(e) => setMinAsked(Math.max(1, Number(e.target.value) || 1))} /></div>
        <label className="flex items-center gap-2 pb-2.5 text-sm"><input type="checkbox" className="h-4 w-4 accent-marigold" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />Only flagged questions</label>
      </div>
      <Async state={state}>
        {(d) => d.questions.length === 0 ? (
          <EmptyState title={flaggedOnly ? 'No flagged questions' : 'No answered questions yet'}>{flaggedOnly ? 'Nothing looks wrong with the questions that have enough attempts.' : 'Quality figures appear once students have taken tests.'}</EmptyState>
        ) : (
          <ul>
            {d.questions.map((q) => (
              <li key={q.id} className="row-rule py-4">
                <div className="flex flex-wrap items-center gap-2">
                  {q.flag && <Badge tone={FLAGS[q.flag].tone}>{q.flag.replace(/_/g, ' ')}</Badge>}
                  {q.flaggedByAdmin && <Badge tone="bad">Flagged by admin</Badge>}
                  <Badge>{q.subject}</Badge><Badge>{q.subtopic}</Badge><Badge>{q.difficulty}</Badge>{q.status !== 'approved' && <Badge tone="warn">{q.status}</Badge>}
                </div>
                <p className="mt-2 text-sm font-semibold">{q.text}</p>
                <div className="mt-2 grid max-w-md grid-cols-[1fr_auto] items-center gap-3 text-sm">
                  <Meter value={q.accuracy ?? 0} color={levelColor(q.accuracy ?? 0)} label="Share of students who got it right" />
                  <span className="text-mute">{q.accuracy === null ? '-' : pct(q.accuracy)} of {q.asked}{!q.enoughData && ' (too few to judge)'}</span>
                </div>
                {q.flag && <p className="mt-1 text-sm text-marigold">{FLAGS[q.flag].text}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-quiet px-3 py-1.5" onClick={() => toggleFlag(q)}>{q.flaggedByAdmin ? 'Clear flag' : 'Flag for review'}</button>
                  {q.status === 'approved' && <button type="button" className="btn btn-danger px-3 py-1.5" onClick={() => review(q.id, 'reject')}>Pull from tests</button>}
                  {q.status === 'rejected' && <button type="button" className="btn btn-quiet px-3 py-1.5" onClick={() => review(q.id, 'approve')}>Put back in tests</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </div>
  );
}
