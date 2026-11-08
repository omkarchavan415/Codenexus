import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Async, EmptyState, PageHeader, Spinner, Badge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { get, post } from '../lib/api';
import { dateTime, pct } from '../lib/format';
import { useAsync, useDocumentTitle } from '../lib/hooks';

const COUNTS = [10, 15, 20];

export default function TestSetup() {
  useDocumentTitle('Take a test');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const subjects = useAsync(() => get('/api/subjects'), []);
  const history = useAsync(() => get('/api/tests'), []);
  const [subject, setSubject] = useState(params.get('subject') || '');
  const [count, setCount] = useState(10);
  const [timed, setTimed] = useState(Boolean(user.settings && user.settings.timerDefault));
  const [minutes, setMinutes] = useState(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function start() {
    setBusy(true);
    setError('');
    try {
      const body = { subject, count };
      if (timed) body.timeLimitMinutes = Number(minutes);
      const { test } = await post('/api/tests/start', body);
      navigate(`/test/${test.id}`);
    } catch (err) {
      setError(err.code === 'no_questions' ? 'There are no approved questions for this subject yet. Ask an admin to add some.' : err.message);
      setBusy(false);
    }
  }

  const open = history.data && history.data.tests.filter((t) => t.status === 'in_progress');

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Take a test">
        Tests are about one subject at a time and spread across its topics. Questions you have already seen come last, so retests feel fresh.
      </PageHeader>

      {open && open.length > 0 && (
        <div className="mb-6 rounded-panel border border-sky/50 bg-sky/10 p-4 text-sm">
          <p className="font-semibold">You have a test in progress</p>
          <ul className="mt-2 space-y-1">
            {open.map((t) => (
              <li key={t.id}><Link className="link" to={`/test/${t.id}`}>Continue {t.subject} {t.focusSubtopic ? `quiz (${t.focusSubtopic.replace(/-/g, ' ')})` : 'test'}</Link> <span className="text-mute">started {dateTime(t.startedAt)}</span></li>
            ))}
          </ul>
        </div>
      )}

      <Async state={subjects}>
        {(d) => (
          <div className="space-y-8">
            <fieldset>
              <legend className="text-lg font-bold">Subject</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {d.subjects.map((s) => (
                  <label key={s.key} className={`cursor-pointer rounded-tab border p-3 transition-colors ${subject === s.key ? 'border-marigold bg-ink-700' : 'border-ink-600 hover:bg-ink-800'}`}>
                    <input type="radio" name="subject" value={s.key} checked={subject === s.key} onChange={() => setSubject(s.key)} className="sr-only" />
                    <span className="block font-semibold">{s.label}</span>
                    <span className="block text-xs text-mute">{s.subtopics.length} topics</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-lg font-bold">Number of questions</legend>
              <div className="mt-3 flex gap-2">
                {COUNTS.map((c) => (
                  <button key={c} type="button" aria-pressed={count === c} onClick={() => setCount(c)} className={`btn ${count === c ? 'btn-primary' : 'btn-quiet'}`}>{c}</button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-lg font-bold">Timer</legend>
              <label className="mt-3 flex items-center gap-3 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-marigold" checked={timed} onChange={(e) => setTimed(e.target.checked)} />
                Limit the time for this test
              </label>
              {timed && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <label htmlFor="minutes" className="text-mute">Minutes</label>
                  <input id="minutes" type="number" min="1" max="180" className="input w-24" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
                </div>
              )}
            </fieldset>

            {error && <p role="alert" className="rounded-tab border border-coral/50 bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}
            <button type="button" className="btn btn-primary" disabled={!subject || busy || (timed && !(Number(minutes) >= 1))} onClick={start}>
              {busy ? <Spinner label="Preparing questions" /> : 'Start test'}
            </button>
          </div>
        )}
      </Async>

      <section className="mt-12" aria-labelledby="past-h">
        <h2 id="past-h" className="text-2xl font-bold">Past tests</h2>
        <Async state={history}>
          {(d) => {
            const done = d.tests.filter((t) => t.status === 'submitted');
            if (!done.length) return <EmptyState title="No finished tests yet">Your results will show up here after your first test.</EmptyState>;
            return (
              <ul className="mt-3">
                {done.slice(0, 15).map((t) => (
                  <li key={t.id} className="row-rule flex flex-wrap items-center justify-between gap-2 py-3">
                    <Link className="font-semibold hover:text-marigold" to={`/test/${t.id}/result`}>{t.subject} {t.focusSubtopic ? `quiz: ${t.focusSubtopic.replace(/-/g, ' ')}` : 'test'}</Link>
                    <span className="flex items-center gap-3 text-sm text-mute">{dateTime(t.submittedAt)} <Badge tone={t.score >= 0.7 ? 'good' : t.score >= 0.4 ? 'warn' : 'bad'}>{pct(t.score)}</Badge></span>
                  </li>
                ))}
              </ul>
            );
          }}
        </Async>
      </section>
    </div>
  );
}
