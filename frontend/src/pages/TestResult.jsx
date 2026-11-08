import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import SkillRing from '../components/SkillRing';
import { Async, Badge, Meter } from '../components/ui';
import { get } from '../lib/api';
import { levelColor, pct } from '../lib/format';
import { useAsync, useDocumentTitle } from '../lib/hooks';

function Result({ result }) {
  const wrong = result.review.filter((r) => !r.correct);
  return (
    <div className="mx-auto max-w-3xl">
      <header className="flex flex-wrap items-center gap-6">
        <SkillRing value={result.score} label={result.focusSubtopic ? `${result.subject} quiz` : `${result.subject} test`} sublabel={`${result.correctCount} of ${result.total} correct`} size={140} />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-extrabold sm:text-4xl">{result.score >= 0.7 ? 'Strong result' : result.score >= 0.4 ? 'Good start' : 'Plenty of room to grow'}</h1>
          <p className="mt-1.5 text-sm text-mute">
            {wrong.length ? `Read the ${wrong.length} explanation${wrong.length === 1 ? '' : 's'} below for the questions you missed.` : 'You answered everything correctly.'}
            {result.timedOut && ' The timer ran out before you submitted.'}
          </p>
          {result.focusSubtopic && (
            <p className="mt-3 rounded-tab border border-mint/40 bg-mint/10 px-3 py-2 text-sm">
              This quiz is ticked off in your plan, and your skill level for {result.subtopics[0] ? result.subtopics[0].label : 'this topic'} was updated. <Link to="/today" className="link">Back to today&rsquo;s plan</Link>
            </p>
          )}
          {!result.focusSubtopic && result.roadmapVersion && (
            <p className="mt-3 rounded-tab border border-mint/40 bg-mint/10 px-3 py-2 text-sm">
              Your roadmap was updated to version {result.roadmapVersion} using these results. <Link to="/roadmap" className="link">View roadmap</Link>
            </p>
          )}
          {!result.focusSubtopic && !result.roadmapVersion && (
            <p className="mt-3 text-sm"><Link to="/roadmap" className="link">Build or refresh your roadmap</Link> from these results.</p>
          )}
        </div>
      </header>

      <section className="mt-10" aria-labelledby="topics-h">
        <h2 id="topics-h" className="text-2xl font-bold">How each topic went</h2>
        <ul className="mt-3">
          {result.subtopics.map((s) => (
            <li key={s.subtopic} className="row-rule grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-3 text-sm sm:grid-cols-[14rem_1fr_9rem]">
              <span className="font-medium">{s.label}</span>
              <span className="order-3 col-span-2 sm:order-none sm:col-span-1"><Meter value={s.score} color={levelColor(s.score)} label={`${s.label} score`} /></span>
              <span className="text-right text-mute">{s.correct}/{s.total} correct</span>
              {s.levelBefore !== undefined && (
                <span className="col-span-2 text-xs text-mute sm:col-start-2">Skill level {pct(s.levelBefore)} to {pct(s.levelAfter)}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="review-h">
        <h2 id="review-h" className="text-2xl font-bold">Question review</h2>
        <ol className="mt-3">
          {result.review.map((r, i) => (
            <li key={r.questionId} className="row-rule py-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={r.correct ? 'good' : 'bad'}>{r.correct ? 'Correct' : r.selectedIndex === null ? 'Skipped' : 'Incorrect'}</Badge>
                <Badge>{r.subtopic.replace(/-/g, ' ')}</Badge><Badge>{r.difficulty}</Badge>
                <span className="text-xs text-mute">Question {i + 1}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap font-semibold">{r.text}</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {r.options.map((o, oi) => {
                  const isRight = oi === r.correctIndex;
                  const isPicked = oi === r.selectedIndex;
                  return (
                    <li key={oi} className={`rounded-tab border px-3 py-2 ${isRight ? 'border-mint/60 bg-mint/10' : isPicked ? 'border-coral/60 bg-coral/10' : 'border-ink-700 text-bone-dim'}`}>
                      <span className="mr-2 font-bold">{'ABCD'[oi]}.</span>{o}
                      {isRight && <span className="ml-2 text-xs font-semibold text-mint">Correct answer</span>}
                      {isPicked && !isRight && <span className="ml-2 text-xs font-semibold text-coral">Your answer</span>}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-bone-dim"><span className="font-semibold text-bone">Why: </span>{r.explanation}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        {result.focusSubtopic ? <Link to="/today" className="btn btn-primary">Back to today&rsquo;s plan</Link> : <Link to="/test" className="btn btn-primary">Take another test</Link>}
        <Link to="/" className="btn btn-quiet">Back to dashboard</Link>
      </div>
    </div>
  );
}

export default function TestResult() {
  useDocumentTitle('Test result');
  const { id } = useParams();
  const location = useLocation();
  const fromSubmit = location.state && location.state.result;
  const state = useAsync(() => (fromSubmit ? Promise.resolve({ test: fromSubmit }) : get(`/api/tests/${id}`)), [id]);
  return (
    <Async state={state} loadingLabel="Loading your result">
      {({ test }) => (test.status === 'in_progress' ? <Navigate to={`/test/${id}`} replace /> : <Result result={test} />)}
    </Async>
  );
}
