import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Async, Badge, Meter, Spinner } from '../components/ui';
import { get, post } from '../lib/api';
import { clock } from '../lib/format';
import { useAsync, useDocumentTitle } from '../lib/hooks';

const storeKey = (id) => `cn_answers_${id}`;
function loadAnswers(id) {
  try { return JSON.parse(window.sessionStorage.getItem(storeKey(id))) || {}; } catch { return {}; }
}
function saveAnswers(id, answers) {
  try { window.sessionStorage.setItem(storeKey(id), JSON.stringify(answers)); } catch { /* storage unavailable */ }
}

function Runner({ test }) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(() => loadAnswers(test.id));
  const [now, setNow] = useState(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const submitted = useRef(false);

  const questions = test.questions;
  const q = questions[index];
  const answered = questions.filter((x) => answers[x.id] !== undefined).length;
  const limit = test.timeLimitSeconds;
  const remaining = limit ? limit - (now - new Date(test.startedAt).getTime()) / 1000 : null;

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    setError('');
    try {
      const payload = Object.entries(answers).map(([questionId, selectedIndex]) => ({ questionId, selectedIndex }));
      const { result } = await post(`/api/tests/${test.id}/submit`, { answers: payload });
      try { window.sessionStorage.removeItem(storeKey(test.id)); } catch { /* ignore */ }
      navigate(`/test/${test.id}/result`, { replace: true, state: { result } });
    } catch (err) {
      submitted.current = false;
      setSubmitting(false);
      setConfirming(false);
      if (err.code === 'already_submitted') navigate(`/test/${test.id}/result`, { replace: true });
      else setError(err.message);
    }
  }, [answers, navigate, test.id]);

  useEffect(() => {
    if (!limit) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [limit]);

  useEffect(() => { if (limit && remaining <= 0) submit(); }, [limit, remaining, submit]);

  function choose(optionIndex) {
    const next = { ...answers, [q.id]: optionIndex };
    setAnswers(next);
    saveAnswers(test.id, next);
  }

  useEffect(() => {
    function onKey(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) && e.target.type !== 'radio') return;
      if (e.key >= '1' && e.key <= '4' && q && Number(e.key) <= q.options.length) choose(Number(e.key) - 1);
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(questions.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const low = remaining !== null && remaining <= 60;
  const last = index === questions.length - 1;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="sticky top-0 z-20 -mx-4 border-b border-ink-700 bg-ink-900/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="font-semibold">{test.focusSubtopic ? `${test.subject} quiz: ${test.focusSubtopic.replace(/-/g, ' ')}` : `${test.subject} test`}</span>
          <span className="text-mute">Question {index + 1} of {questions.length} &middot; {answered} answered</span>
          {remaining !== null && (
            <span role="timer" aria-live={low ? 'polite' : 'off'} className={`rounded-full px-3 py-1 font-semibold ${low ? 'bg-coral/20 text-coral' : 'bg-ink-700 text-bone'}`}>
              {clock(remaining)}
            </span>
          )}
        </div>
        <div className="mt-2"><Meter value={(index + 1) / questions.length} label="Position in test" height={4} /></div>
      </div>

      <article className="mt-8" aria-labelledby="q-text">
        <div className="mb-3 flex items-center gap-2"><Badge tone="info">{q.subtopic.replace(/-/g, ' ')}</Badge><Badge>{q.difficulty}</Badge></div>
        <h1 id="q-text" className="whitespace-pre-wrap text-xl font-bold leading-snug sm:text-2xl">{q.text}</h1>
        <div role="radiogroup" aria-labelledby="q-text" className="mt-6 space-y-3">
          {q.options.map((opt, i) => {
            const picked = answers[q.id] === i;
            return (
              <label key={i} className={`flex cursor-pointer items-start gap-3 rounded-tab border p-4 transition-colors ${picked ? 'border-marigold bg-ink-700' : 'border-ink-600 hover:bg-ink-800'}`}>
                <input type="radio" name={`q-${q.id}`} className="sr-only" checked={picked} onChange={() => choose(i)} />
                <span aria-hidden="true" className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${picked ? 'border-marigold bg-marigold text-ink-950' : 'border-ink-600 text-mute'}`}>{'ABCD'[i]}</span>
                <span className="whitespace-pre-wrap text-sm leading-relaxed sm:text-base">{opt}</span>
              </label>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-mute">Tip: press 1 to 4 to choose an answer and the arrow keys to move between questions.</p>
      </article>

      <nav aria-label="Question navigator" className="mt-8 flex flex-wrap gap-1.5">
        {questions.map((x, i) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Question ${i + 1}${answers[x.id] !== undefined ? ', answered' : ', not answered'}`}
            aria-current={i === index ? 'step' : undefined}
            className={`h-9 w-9 rounded-tab border text-xs font-semibold ${i === index ? 'border-marigold text-marigold' : answers[x.id] !== undefined ? 'border-mint/50 bg-mint/10 text-mint' : 'border-ink-600 text-mute'}`}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      {error && <p role="alert" className="mt-4 rounded-tab border border-coral/50 bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="btn btn-quiet" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</button>
        {!last && <button type="button" className="btn btn-primary" onClick={() => setIndex(index + 1)}>Next question</button>}
        {last && !confirming && <button type="button" className="btn btn-primary" onClick={() => setConfirming(true)}>Review and submit</button>}
      </div>

      {confirming && (
        <div className="panel mt-6 p-5" role="alertdialog" aria-label="Confirm submission">
          <p className="font-semibold">Submit your test?</p>
          <p className="mt-1 text-sm text-mute">
            {answered === questions.length ? 'You answered every question.' : `${questions.length - answered} question${questions.length - answered === 1 ? ' is' : 's are'} unanswered and will count as wrong.`} You cannot change answers after submitting.
          </p>
          <div className="mt-4 flex gap-2">
            <button type="button" className="btn btn-primary" onClick={submit} disabled={submitting}>{submitting ? <Spinner label="Submitting" /> : 'Submit test'}</button>
            <button type="button" className="btn btn-quiet" onClick={() => setConfirming(false)} disabled={submitting}>Keep working</button>
          </div>
        </div>
      )}
      {submitting && !confirming && <p className="mt-4"><Spinner label="Submitting your answers" /></p>}
    </div>
  );
}

export default function TestRunner() {
  useDocumentTitle('Test');
  const { id } = useParams();
  const state = useAsync(() => get(`/api/tests/${id}`), [id]);
  return (
    <Async state={state} loadingLabel="Loading your test">
      {({ test }) => (test.status === 'submitted' ? <Navigate to={`/test/${id}/result`} replace /> : <Runner test={test} />)}
    </Async>
  );
}
