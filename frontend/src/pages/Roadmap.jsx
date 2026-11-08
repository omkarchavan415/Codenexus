import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TaskRow } from '../components/Tasks';
import { Async, Badge, EmptyState, ErrorState, Meter, PageHeader, PageLoading, Spinner, useToast } from '../components/ui';
import { get, post } from '../lib/api';
import { SEVERITY_LABEL, WEIGHT_LABEL, dateTime, levelColor, pct, shortDate } from '../lib/format';
import { useAsync, useDocumentTitle } from '../lib/hooks';
import { trackId, trackedTasks } from '../lib/tasks';

const SEVERITY_TONE = { high: 'bad', medium: 'warn', low: 'info', mastered: 'good' };
const SEGMENT_COLORS = ['#F0B03A', '#79B8D9', '#EF6F5A', '#6ED3A3', '#C3D0C9', '#C98E1F'];

function GapTable({ gaps }) {
  return (
    <section aria-labelledby="gap-h">
      <h2 id="gap-h" className="text-2xl font-bold">Gap analysis</h2>
      <p className="mt-1 max-w-prose text-sm text-mute">Priority is how much your target company expects (high 3, medium 2, low 1) multiplied by how far you are from full marks. Bigger priority means more of your days.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="text-mute">
            <tr><th className="py-2 pr-3 font-medium">Subject</th><th className="py-2 pr-3 font-medium">Company expects</th><th className="py-2 pr-3 font-medium">Your level</th><th className="py-2 pr-3 font-medium">Priority</th><th className="py-2 font-medium">Gap</th></tr>
          </thead>
          <tbody>
            {gaps.map((g) => (
              <tr key={g.subject} className="row-rule">
                <th scope="row" className="py-3 pr-3 font-semibold">{g.subject}</th>
                <td className="py-3 pr-3">{WEIGHT_LABEL[g.weight]}</td>
                <td className="py-3 pr-3"><div className="flex items-center gap-2"><div className="w-24"><Meter value={g.score} color={levelColor(g.score)} label={`${g.subject} level`} /></div><span>{pct(g.score)}</span></div></td>
                <td className="py-3 pr-3">{g.priority.toFixed(2)}</td>
                <td className="py-3"><Badge tone={SEVERITY_TONE[g.severity]}>{SEVERITY_LABEL[g.severity]}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Strip({ allocations, totalDays, currentDay }) {
  return (
    <div>
      <div className="flex h-9 overflow-hidden rounded-tab" role="img" aria-label={`Plan split across ${allocations.length} topics over ${totalDays} days`}>
        {allocations.map((a, i) => (
          <div key={`${a.subject}-${a.subtopic}`} style={{ flexGrow: a.days, background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} className="min-w-[3px] border-r border-ink-900 last:border-r-0" title={`${a.label}: ${a.days} day${a.days === 1 ? '' : 's'}`} />
        ))}
      </div>
      {currentDay >= 1 && currentDay <= totalDays && (
        <div className="relative mt-1 h-5" aria-hidden="true">
          <span className="absolute -translate-x-1/2 text-xs font-semibold text-marigold" style={{ left: `${((currentDay - 0.5) / totalDays) * 100}%` }}>&#9650; today</span>
        </div>
      )}
    </div>
  );
}

function Timeline({ roadmap, doneSet, onToggle, todayDay, readOnly }) {
  const byDay = new Map(roadmap.schedule.map((d) => [d.dayNumber, d]));
  return (
    <section aria-labelledby="timeline-h">
      <h2 id="timeline-h" className="text-2xl font-bold">Your timeline</h2>
      <div className="mt-4"><Strip allocations={roadmap.allocations} totalDays={roadmap.schedule.length} currentDay={todayDay} /></div>

      <ol className="mt-4 space-y-8">
        {roadmap.allocations.map((a, i) => (
          <li key={`${a.subject}-${a.subtopic}`}>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="h-3 w-3 rounded-full" style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} aria-hidden="true" />
              <h3 className="text-xl font-bold">{a.label}</h3>
              <span className="text-sm text-mute">{a.subject} &middot; days {a.startDay === a.endDay ? a.startDay : `${a.startDay} to ${a.endDay}`} &middot; level {pct(a.level)}</span>
            </div>
            <ul className="mt-3 border-l border-ink-700 pl-4">
              {Array.from({ length: a.days }, (_, k) => byDay.get(a.startDay + k)).filter(Boolean).map((day) => {
                const isToday = day.dayNumber === todayDay;
                const past = todayDay > 0 && day.dayNumber < todayDay;
                return (
                  <li key={day.dayNumber} className={`relative mb-3 rounded-tab px-3 py-2 ${isToday ? 'border border-marigold bg-marigold/10' : ''} ${past ? 'opacity-80' : ''}`}>
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      Day {day.dayNumber} <span className="font-normal text-mute">{shortDate(day.date)}</span>
                      {isToday && <Badge tone="warn">Today</Badge>}
                    </p>
                    <ul className="mt-1">
                      {day.tasks.map((t) => (
                        <TaskRow key={t.id} task={t} done={doneSet.has(trackId(t))} onToggle={onToggle} readOnly={readOnly} />
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>

      {roadmap.skipped.length > 0 && (
        <p className="mt-6 max-w-prose text-sm text-mute">
          <span className="font-semibold text-bone-dim">Skipped because you have mastered them: </span>
          {roadmap.skipped.map((s) => s.label).join(', ')}.
        </p>
      )}
    </section>
  );
}

function Versions({ versions, current, onPick }) {
  return (
    <section aria-labelledby="versions-h">
      <h2 id="versions-h" className="text-2xl font-bold">Version history</h2>
      <p className="mt-1 text-sm text-mute">Every reschedule keeps the old plan so you can look back.</p>
      <ul className="mt-3">
        {versions.map((v) => (
          <li key={v.id} className="row-rule flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
            <span>
              <span className="font-semibold">Version {v.version}</span>{' '}
              <span className="text-mute">{dateTime(v.createdAt)} &middot; {v.reason === 'initial' ? 'first plan' : v.reason === 'retest' ? 'after a retest' : v.reason === 'goal_change' ? 'goal changed' : 'rescheduled'}</span>
              {v.isActive && <span className="ml-2"><Badge tone="good">Active</Badge></span>}
            </span>
            {current !== v.version ? <button type="button" className="link" onClick={() => onPick(v.version)}>View</button> : <span className="text-mute">Viewing</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RoadmapView({ initial, reloadAll }) {
  const toast = useToast();
  const [viewVersion, setViewVersion] = useState(null);
  const [busy, setBusy] = useState(false);
  const [localDone, setLocalDone] = useState({});
  const versions = useAsync(() => get('/api/roadmap/versions'), [initial.version]);
  const viewing = useAsync(() => (viewVersion && viewVersion !== initial.version ? get(`/api/roadmap/versions/${viewVersion}`).then((d) => d.roadmap) : Promise.resolve(initial)), [viewVersion, initial]);
  const today = useAsync(() => get('/api/roadmap/today').then((d) => d.plan), [initial.version]);

  async function reschedule() {
    setBusy(true);
    try {
      const { roadmap } = await post('/api/roadmap/reschedule');
      toast(`Roadmap rescheduled as version ${roadmap.version}`);
      setViewVersion(null);
      reloadAll();
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  const roadmap = viewing.data || initial;
  const isActive = roadmap.version === initial.version;
  const doneSet = useMemo(() => {
    const s = new Set(roadmap.doneIds || []);
    Object.entries(localDone).forEach(([id, v]) => (v ? s.add(id) : s.delete(id)));
    return s;
  }, [roadmap, localDone]);
  const onToggle = (id, v) => setLocalDone((m) => ({ ...m, [id]: v }));
  const planned = trackedTasks(roadmap.schedule);
  const progress = planned.length ? planned.filter((t) => doneSet.has(trackId(t))).length / planned.length : 0;
  const todayDay = isActive && today.data && today.data.status === 'active' ? today.data.dayNumber : 0;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Your roadmap"
        actions={<button type="button" className="btn btn-primary" onClick={reschedule} disabled={busy}>{busy ? <Spinner label="Rescheduling" /> : 'Reschedule from my latest scores'}</button>}
      >
        {roadmap.company.name} ({roadmap.company.role}) &middot; {roadmap.goal.daysRemaining} days at {roadmap.goal.hoursPerDay} h a day &middot; version {roadmap.version}
      </PageHeader>

      {!isActive && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-sky/50 bg-sky/10 px-4 py-3 text-sm">
          <span>You are viewing an older version (read only).</span>
          <button type="button" className="link" onClick={() => setViewVersion(null)}>Back to the active plan</button>
        </div>
      )}

      {isActive && today.data && today.data.rescheduleRecommended && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-marigold/60 bg-marigold/10 px-4 py-3 text-sm">
          <span>{today.data.status === 'finished' ? 'This plan has run its course.' : `You are ${today.data.behindDays} days behind.`} Rescheduling fits the remaining days to your latest scores.</span>
          <button type="button" className="btn btn-primary" onClick={reschedule} disabled={busy}>Reschedule now</button>
        </div>
      )}

      <div>
        <div className="flex items-baseline justify-between text-sm"><span className="font-semibold">Tasks done</span><span className="text-mute">{Math.round(progress * 100)}%</span></div>
        <div className="mt-2"><Meter value={progress} label="Tasks done in this plan" height={8} /></div>
      </div>

      {viewing.loading && !viewing.data ? <PageLoading /> : viewing.error ? <ErrorState error={viewing.error} onRetry={viewing.reload} /> : (
        <>
          <GapTable gaps={roadmap.gaps} />
          {roadmap.mastered ? (
            <EmptyState title="You have mastered everything in this profile">Nothing is left to schedule. Retest to keep your levels fresh or pick a harder target company.</EmptyState>
          ) : (
            <Timeline roadmap={roadmap} doneSet={doneSet} onToggle={onToggle} todayDay={todayDay} readOnly={!isActive} />
          )}
        </>
      )}

      <Async state={versions}>{(d) => <Versions versions={d.versions} current={roadmap.version} onPick={setViewVersion} />}</Async>
    </div>
  );
}

export default function Roadmap() {
  useDocumentTitle('Roadmap');
  const toast = useToast();
  const state = useAsync(() => get('/api/roadmap').then((d) => d.roadmap).catch((err) => (err.status === 404 ? { none: true } : Promise.reject(err))), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setBusy(true);
    setError('');
    try {
      await post('/api/roadmap/generate');
      toast('Roadmap created');
      state.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Async state={state}>
        {(data) =>
          data.none ? (
            <>
              <PageHeader title="Your roadmap" />
              <EmptyState
                title="No roadmap yet"
                action={<div className="flex flex-wrap justify-center gap-2"><button type="button" className="btn btn-primary" onClick={generate} disabled={busy}>{busy ? <Spinner label="Building" /> : 'Build my roadmap'}</button><Link to="/test" className="btn btn-quiet">Take a test first</Link></div>}
              >
                A roadmap needs at least one finished test, so it can start from your real skill levels.
              </EmptyState>
              {error && <p role="alert" className="mx-auto max-w-lg rounded-tab border border-coral/50 bg-coral/10 px-3 py-2 text-center text-sm text-coral">{error}</p>}
            </>
          ) : (
            <RoadmapView initial={data} reloadAll={state.reload} />
          )
        }
      </Async>
    </div>
  );
}
