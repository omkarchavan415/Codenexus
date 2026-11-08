import { useState } from 'react';
import { Link } from 'react-router-dom';
import ScoreChart from '../components/ScoreChart';
import { Async, Badge, EmptyState, PageHeader } from '../components/ui';
import { get } from '../lib/api';
import { dateTime, pct } from '../lib/format';
import { useAsync, useDocumentTitle } from '../lib/hooks';

function Change({ value }) {
  if (!Number.isFinite(value)) return null;
  const points = Math.round(value * 100);
  if (points === 0) return <Badge>No change</Badge>;
  return <Badge tone={points > 0 ? 'good' : 'bad'}>{points > 0 ? '+' : ''}{points} points since first test</Badge>;
}

function SubjectBlock({ name, data }) {
  const [table, setTable] = useState(false);
  const [topic, setTopic] = useState('');
  const chosen = data.subtopics.find((s) => s.subtopic === topic);
  const single = data.history.length < 2;

  return (
    <section className="row-rule py-8" aria-labelledby={`h-${name}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id={`h-${name}`} className="text-2xl font-bold">{name}</h2>
          <p className="mt-1 text-sm text-mute">{data.tests} test{data.tests === 1 ? '' : 's'} &middot; first {pct(data.firstScore)} &middot; latest {pct(data.latestScore)}</p>
        </div>
        {data.tests > 1 ? <Change value={data.improvement} /> : <Badge tone="info">Retest to see change</Badge>}
      </div>

      <div className="mt-4">
        {table ? (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{name} test scores</caption>
            <thead className="text-mute"><tr><th className="py-1.5 font-medium">Date</th><th className="py-1.5 font-medium">Score</th></tr></thead>
            <tbody>{data.history.map((h) => <tr key={h.attemptId} className="row-rule"><td className="py-2">{dateTime(h.date)}</td><td className="py-2">{pct(h.score)}</td></tr>)}</tbody>
          </table>
        ) : (
          <ScoreChart history={data.history} label={`${name} overall`} />
        )}
        <button type="button" className="link mt-2 text-sm" onClick={() => setTable(!table)}>{table ? 'Show chart' : 'Show as table'}</button>
        {single && !table && <p className="mt-1 text-xs text-mute">With one test there is only one point. Retest to draw the line.</p>}
      </div>

      <h3 className="mt-6 text-lg font-bold">Topics in {name}</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[30rem] text-left text-sm">
          <thead className="text-mute"><tr><th className="py-1.5 pr-3 font-medium">Topic</th><th className="py-1.5 pr-3 font-medium">First</th><th className="py-1.5 pr-3 font-medium">Latest</th><th className="py-1.5 pr-3 font-medium">Change</th><th className="py-1.5 font-medium"><span className="sr-only">Chart</span></th></tr></thead>
          <tbody>
            {data.subtopics.map((s) => {
              const pts = Math.round(s.improvement * 100);
              return (
                <tr key={s.subtopic} className="row-rule">
                  <th scope="row" className="py-2.5 pr-3 font-medium">{s.label}</th>
                  <td className="py-2.5 pr-3">{pct(s.firstScore)}</td>
                  <td className="py-2.5 pr-3">{pct(s.latestScore)}</td>
                  <td className={`py-2.5 pr-3 ${pts > 0 ? 'text-mint' : pts < 0 ? 'text-coral' : 'text-mute'}`}>{s.history.length > 1 ? `${pts > 0 ? '+' : ''}${pts}` : '-'}</td>
                  <td className="py-2.5"><button type="button" className="link" aria-pressed={topic === s.subtopic} onClick={() => setTopic(topic === s.subtopic ? '' : s.subtopic)}>{topic === s.subtopic ? 'Hide' : 'Chart'}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {chosen && (
        <div className="mt-4">
          <p className="mb-1 text-sm font-semibold">{chosen.label}</p>
          <ScoreChart history={chosen.history} label={chosen.label} height={170} />
        </div>
      )}
    </section>
  );
}

export default function Progress() {
  useDocumentTitle('Progress');
  const state = useAsync(() => get('/api/progress'), []);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Progress">Scores from each test you finish, and how far you have come since your first one in every subject.</PageHeader>
      <Async state={state}>
        {(d) => {
          const names = Object.keys(d.subjects);
          if (!names.length) return <EmptyState title="No test results yet" action={<Link className="btn btn-primary" to="/test">Take a test</Link>}>Finish a test and your history appears here.</EmptyState>;
          return <div>{names.map((n) => <SubjectBlock key={n} name={n} data={d.subjects[n]} />)}</div>;
        }}
      </Async>
    </div>
  );
}
