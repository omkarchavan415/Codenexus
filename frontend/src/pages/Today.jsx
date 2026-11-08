import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TaskRow } from '../components/Tasks';
import { Async, EmptyState, PageHeader, Spinner, useToast } from '../components/ui';
import { get, post } from '../lib/api';
import { minutesLabel, shortDate } from '../lib/format';
import { useAsync, useDocumentTitle } from '../lib/hooks';
import { trackId } from '../lib/tasks';

export default function Today() {
  useDocumentTitle('Today');
  const toast = useToast();
  const state = useAsync(() => get('/api/roadmap/today').then((d) => d.plan).catch((err) => (err.status === 404 ? { none: true } : Promise.reject(err))), []);
  const [done, setDone] = useState({});
  const [busy, setBusy] = useState(false);
  const onToggle = (id, v) => setDone((m) => ({ ...m, [id]: v }));

  async function reschedule() {
    setBusy(true);
    try {
      const { roadmap } = await post('/api/roadmap/reschedule');
      toast(`Rescheduled as version ${roadmap.version}`);
      setDone({});
      state.reload();
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Async state={state}>
        {(plan) => {
          if (plan.none) {
            return (
              <>
                <PageHeader title="Today" />
                <EmptyState title="You do not have a plan yet" action={<Link to="/roadmap" className="btn btn-primary">Set up my roadmap</Link>}>Once you have a roadmap, today&rsquo;s tasks show up here.</EmptyState>
              </>
            );
          }
          const isDone = (t) => {
            const id = trackId(t);
            if (!id) return false;
            return done[id] !== undefined ? done[id] : Boolean(t.solved);
          };
          const todayTasks = plan.today ? plan.today.tasks : [];
          const minutes = todayTasks.reduce((s, t) => s + t.minutes, 0);
          const tracked = todayTasks.filter((t) => trackId(t));
          const doneCount = tracked.filter(isDone).length;
          const overdue = plan.overdue.map((d) => ({ ...d, tasks: d.tasks.filter((t) => !isDone(t)) })).filter((d) => d.tasks.length);

          return (
            <>
              <PageHeader title="Today">
                {plan.status === 'active' ? `Day ${plan.dayNumber} of ${plan.totalDays}${plan.today ? ` • ${plan.today.label}` : ''}` : plan.status === 'upcoming' ? 'Your plan starts soon.' : plan.status === 'finished' ? 'Your plan has finished.' : ''}
              </PageHeader>

              {plan.rescheduleRecommended && (
                <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-marigold/60 bg-marigold/10 px-4 py-3 text-sm">
                  <span>{plan.status === 'finished' ? 'Your plan is over, but your deadline may not be.' : `You are ${plan.behindDays} days behind.`} Reschedule to spread what is left across the days you have.</span>
                  <button type="button" className="btn btn-primary" onClick={reschedule} disabled={busy}>{busy ? <Spinner label="Rescheduling" /> : 'Reschedule'}</button>
                </div>
              )}

              {plan.today ? (
                <section aria-labelledby="today-h">
                  <h2 id="today-h" className="text-2xl font-bold">{plan.today.label}</h2>
                  <p className="mt-1 text-sm text-mute">{shortDate(plan.today.date)} &middot; about {minutesLabel(minutes)} planned &middot; {doneCount} of {tracked.length} tasks done</p>
                  <ul className="mt-3 divide-y divide-ink-700 border-y border-ink-700">
                    {todayTasks.map((t) => <TaskRow key={t.id} task={t} done={isDone(t)} onToggle={onToggle} />)}
                  </ul>
                  {tracked.length > 0 && doneCount === tracked.length && <p className="mt-4 text-sm font-semibold text-mint">Everything planned for today is done. Nice work.</p>}
                </section>
              ) : (
                <EmptyState title={plan.status === 'upcoming' ? 'Nothing scheduled yet' : 'Nothing scheduled for today'}>
                  {plan.status === 'finished' ? 'Take a test, then reschedule to keep going.' : 'Check the full roadmap for what is coming.'}
                </EmptyState>
              )}

              {overdue.length > 0 && (
                <section className="mt-10" aria-labelledby="overdue-h">
                  <h2 id="overdue-h" className="text-2xl font-bold">Still to catch up on</h2>
                  <p className="mt-1 text-sm text-mute">Tasks from earlier days that are not marked done.</p>
                  {overdue.map((d) => (
                    <div key={d.dayNumber} className="mt-4">
                      <p className="text-sm font-semibold">Day {d.dayNumber} &middot; {d.label} <span className="font-normal text-mute">{shortDate(d.date)}</span></p>
                      <ul className="mt-1">{d.tasks.map((t) => <TaskRow key={t.id} task={t} done={false} onToggle={onToggle} />)}</ul>
                    </div>
                  ))}
                </section>
              )}
              <p className="mt-10 text-sm"><Link to="/roadmap" className="link">See the full roadmap</Link></p>
            </>
          );
        }}
      </Async>
    </div>
  );
}
