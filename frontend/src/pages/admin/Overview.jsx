import { Async, Meter, PageHeader } from '../../components/ui';
import { StatTile } from '../../components/admin';
import { get } from '../../lib/api';
import { pct } from '../../lib/format';
import { useAsync, useDocumentTitle } from '../../lib/hooks';

export default function Overview() {
  useDocumentTitle('Admin overview');
  const state = useAsync(() => get('/api/admin/stats'), []);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Platform overview">A snapshot of students, tests and the question bank.</PageHeader>
      <Async state={state}>
        {(s) => {
          const maxSubject = Math.max(1, ...Object.values(s.questions.approvedBySubject));
          return (
            <div className="space-y-10">
              <section aria-label="Totals" className="grid grid-cols-2 gap-6 border-y border-ink-700 py-5 sm:grid-cols-4">
                <StatTile label="Students" value={s.users.students} note={`${s.users.newLast7Days} joined in the last 7 days`} />
                <StatTile label="Tests submitted" value={s.attempts.submitted} note={`${s.attempts.last7Days} in the last 7 days`} />
                <StatTile label="Average score" value={s.attempts.averageScore === null ? '-' : pct(s.attempts.averageScore)} />
                <StatTile label="Active roadmaps" value={s.activeRoadmaps} />
              </section>

              <section aria-labelledby="qb-h">
                <h2 id="qb-h" className="text-2xl font-bold">Question bank</h2>
                <div className="mt-3 grid grid-cols-2 gap-6 sm:grid-cols-4">
                  <StatTile label="Approved" value={s.questions.byStatus.approved} />
                  <StatTile label="Waiting for review" value={s.questions.byStatus.pending} />
                  <StatTile label="Rejected or retired" value={s.questions.byStatus.rejected} />
                  <StatTile label="Flagged" value={s.questions.flagged} />
                </div>
                <h3 className="mt-8 text-lg font-bold">Approved questions by subject</h3>
                <ul className="mt-3 space-y-3">
                  {Object.entries(s.questions.approvedBySubject).sort().map(([subject, n]) => (
                    <li key={subject} className="grid grid-cols-[4rem_1fr_3rem] items-center gap-3 text-sm">
                      <span className="font-semibold">{subject}</span>
                      <Meter value={n / maxSubject} label={`${subject} approved questions`} height={8} />
                      <span className="text-right text-mute">{n}</span>
                    </li>
                  ))}
                </ul>
                <h3 className="mt-8 text-lg font-bold">By difficulty</h3>
                <p className="mt-2 text-sm text-bone-dim">
                  {['easy', 'medium', 'hard'].map((d) => `${d}: ${s.questions.approvedByDifficulty[d] || 0}`).join('   ')}
                </p>
              </section>

              <section className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                <StatTile label="Active LeetCode problems" value={s.activeProblems} />
                <StatTile label="Active study items" value={s.activeStudyItems} />
                <StatTile label="Company profiles" value={s.activeCompanies} />
                <StatTile label="Admins" value={s.users.admins} />
                <StatTile label="All accounts" value={s.users.total} />
              </section>
            </div>
          );
        }}
      </Async>
    </div>
  );
}
