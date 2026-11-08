import { Link } from 'react-router-dom';
import SkillRing from '../components/SkillRing';
import { Async, Meter, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { get } from '../lib/api';
import { levelColor, levelWord, pct } from '../lib/format';
import { useAsync, useDocumentTitle } from '../lib/hooks';

function NextStep({ data }) {
  const anyTested = data.subjects.some((s) => s.tested);
  let content;
  if (!anyTested) {
    content = { text: 'Take your first test. It shows where you stand and unlocks your plan.', to: '/test', label: 'Take a test' };
  } else if (!data.roadmap) {
    content = { text: 'You have test results. Build your day-by-day roadmap from them.', to: '/roadmap', label: 'Build my roadmap' };
  } else {
    content = { text: 'Your plan is ready. See what is on for today.', to: '/today', label: 'Open today’s plan' };
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-marigold/50 bg-marigold/10 px-5 py-4">
      <p className="max-w-xl text-sm text-bone">{content.text}</p>
      <Link to={content.to} className="btn btn-primary">{content.label}</Link>
    </div>
  );
}

function Figure({ value, unit, label }) {
  return (
    <div className="px-4 py-3 first:pl-0 sm:px-6">
      <p className="font-display text-4xl font-extrabold leading-none sm:text-5xl">
        {value}
        {unit && <span className="ml-1 text-lg font-semibold text-mute">{unit}</span>}
      </p>
      <p className="mt-1.5 text-sm text-mute">{label}</p>
    </div>
  );
}

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const state = useAsync(() => get('/api/me/dashboard'), []);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={`Hi ${user.name.split(' ')[0]}`}>
        {state.data && state.data.company ? `Preparing for ${state.data.company.name} (${state.data.company.role}).` : 'Here is where you stand.'}
      </PageHeader>
      <Async state={state}>
        {(d) => (
          <div className="space-y-8">
            <NextStep data={d} />

            <section aria-label="Key numbers" className="flex flex-wrap divide-x divide-ink-700 border-y border-ink-700 py-4">
              <Figure value={d.daysLeft ?? '-'} unit={d.daysLeft === 1 ? 'day' : 'days'} label="until your deadline" />
              <Figure value={d.streak.current} unit={d.streak.current === 1 ? 'day' : 'days'} label={`study streak, best ${d.streak.longest}`} />
              <Figure value={d.roadmap ? `${d.roadmap.progressPercent}%` : '-'} label={d.roadmap ? `of plan tasks done (plan v${d.roadmap.version})` : 'no plan yet'} />
            </section>
            {d.roadmap && <Meter value={d.roadmap.progressPercent / 100} label="Roadmap progress" height={8} />}

            <section aria-labelledby="skills-h">
              <h2 id="skills-h" className="text-2xl font-bold">Your skills</h2>
              <p className="mt-1 text-sm text-mute">Each ring is your current level in a subject. It moves a little after every test.</p>
              <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
                {d.subjects.map((s) => (
                  <li key={s.subject} className="flex flex-col items-center">
                    <SkillRing value={s.score} tested={s.tested} label={s.label} sublabel={s.tested ? levelWord(s.score) : 'Not tested yet'} />
                    <Link to={`/test?subject=${s.subject}`} className="link mt-2 text-sm">{s.tested ? 'Retest' : 'Take test'}</Link>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="topics-h">
              <h2 id="topics-h" className="text-2xl font-bold">By topic</h2>
              <div className="mt-3">
                {d.subjects.map((s) => (
                  <details key={s.subject} className="row-rule group py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                      <span className="font-semibold">{s.label}</span>
                      <span className="text-sm text-mute">{s.tested ? pct(s.score) : 'Not tested'}</span>
                    </summary>
                    <ul className="mt-3 space-y-3">
                      {s.subtopics.map((t) => (
                        <li key={t.key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[14rem_1fr_3rem]">
                          <span className="text-bone-dim">{t.label}</span>
                          <span className="order-3 col-span-2 sm:order-none sm:col-span-1">
                            <Meter value={t.level ?? 0} color={levelColor(t.level)} label={`${t.label} level`} />
                          </span>
                          <span className="text-right text-mute">{t.level === null ? '-' : pct(t.level)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </section>
          </div>
        )}
      </Async>
    </div>
  );
}
