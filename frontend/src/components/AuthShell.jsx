export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden lg:block">
        <div className="flex items-center gap-2.5">
          <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="9" fill="#F0B03A" />
            <path d="M10.5 22V10l11 12V10" fill="none" stroke="#091416" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-display text-2xl font-extrabold">CodeNexus</span>
        </div>
        <h2 className="mt-10 max-w-md text-5xl font-extrabold leading-[1.05]">
          Know exactly what to study before placements start.
        </h2>
        <p className="mt-5 max-w-md text-bone-dim">
          Take a short test, see how your skills compare with what your target company asks for, and get a day-by-day plan with real LeetCode problems. Retest any time and the plan adjusts.
        </p>
        <ul className="mt-8 space-y-3 text-sm text-bone-dim">
          <li className="flex gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-coral" />Tests cover DSA, OOP, DBMS, SQL, OS and Networks.</li>
          <li className="flex gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-marigold" />Your plan fits your deadline and your daily study hours.</li>
          <li className="flex gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-mint" />Topics you have mastered are skipped automatically.</li>
        </ul>
      </section>
      <section className="panel mx-auto w-full max-w-md p-6 sm:p-8">
        <h1 className="text-3xl font-extrabold">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-mute">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && <p className="mt-6 text-center text-sm text-mute">{footer}</p>}
      </section>
    </div>
  );
}
