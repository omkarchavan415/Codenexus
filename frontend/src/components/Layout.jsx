import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const studentLinks = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/test', label: 'Take a test' },
  { to: '/today', label: 'Today' },
  { to: '/roadmap', label: 'Roadmap' },
  { to: '/progress', label: 'Progress' },
  { to: '/profile', label: 'Profile' },
];

const adminLinks = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/questions', label: 'Questions' },
  { to: '/admin/generator', label: 'Generator' },
  { to: '/admin/quality', label: 'Quality' },
  { to: '/admin/companies', label: 'Companies' },
  { to: '/admin/problems', label: 'Problems' },
  { to: '/admin/study-items', label: 'Study items' },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#F0B03A" />
        <path d="M10.5 22V10l11 12V10" fill="none" stroke="#091416" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-display text-xl font-extrabold">CodeNexus</span>
    </div>
  );
}

const linkClass = ({ isActive }) =>
  `block rounded-tab px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-ink-700 text-marigold' : 'text-bone-dim hover:bg-ink-800 hover:text-bone'
  }`;

export default function Layout({ admin = false }) {
  const { user, logout } = useAuth();
  const links = admin ? adminLinks : studentLinks;

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-tab focus:bg-marigold focus:px-3 focus:py-2 focus:text-ink-950">
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-ink-700 px-4 py-6 md:flex">
        <Logo />
        {admin && <p className="mt-6 px-3 text-sm font-semibold text-marigold">Admin</p>}
        <nav aria-label="Main" className={`${admin ? 'mt-2' : 'mt-8'} flex flex-col gap-1`}>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>{l.label}</NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3 border-t border-ink-700 pt-4">
          {user && user.role === 'admin' && (
            <NavLink to={admin ? '/' : '/admin'} className="link block px-3 text-sm">
              {admin ? 'Back to student view' : 'Open admin panel'}
            </NavLink>
          )}
          <div className="px-3">
            <p className="truncate text-sm font-semibold">{user && user.name}</p>
            <p className="truncate text-xs text-mute">{user && user.email}</p>
          </div>
          <button type="button" className="btn btn-quiet w-full" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-ink-700 px-4 py-3 md:hidden">
          <Logo />
          <button type="button" className="btn btn-quiet px-3 py-1.5" onClick={logout}>Sign out</button>
        </div>
        <main id="main" className="flex-1 px-4 pb-28 pt-6 sm:px-8 md:pb-12 md:pt-10">
          <Outlet />
        </main>
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-ink-700 bg-ink-900/95 px-1 py-1 backdrop-blur md:hidden">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `min-w-[4.6rem] flex-1 rounded-tab px-2 py-2.5 text-center text-xs font-medium ${isActive ? 'bg-ink-700 text-marigold' : 'text-mute'}`
              }
            >
              {l.label}
            </NavLink>
          ))}
          {user && user.role === 'admin' && (
            <NavLink to={admin ? '/' : '/admin'} className="min-w-[4.6rem] flex-1 rounded-tab px-2 py-2.5 text-center text-xs font-medium text-sky">
              {admin ? 'Student' : 'Admin'}
            </NavLink>
          )}
        </nav>
      </div>
    </div>
  );
}
