import { useState } from 'react';
import { GoalForm } from './Onboarding';
import { Async, Field, PageHeader, Spinner, useToast } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { get, patch, post, setTokens } from '../lib/api';
import { useAsync, useDocumentTitle } from '../lib/hooks';

function Details() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [timezone, setTimezone] = useState(user.timezone);
  const [settings, setSettings] = useState({ autoReschedule: user.settings.autoReschedule, timerDefault: user.settings.timerDefault });
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await patch('/api/me', { name: name.trim(), timezone, settings });
      setUser(data.user);
      toast('Profile saved');
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Name" htmlFor="p-name"><input id="p-name" className="input" value={name} minLength={2} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Email" htmlFor="p-email" hint="Your email is your sign-in and cannot be changed here."><input id="p-email" className="input" value={user.email} disabled /></Field>
      <Field label="Time zone" htmlFor="p-tz" hint="Decides when a new study day starts for your plan and streak."><input id="p-tz" className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Asia/Kolkata" /></Field>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-marigold" checked={settings.autoReschedule} onChange={(e) => setSettings({ ...settings, autoReschedule: e.target.checked })} />
        <span><span className="font-semibold">Update my roadmap after every test</span><span className="block text-mute">A new roadmap version is saved each time you finish a test.</span></span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-marigold" checked={settings.timerDefault} onChange={(e) => setSettings({ ...settings, timerDefault: e.target.checked })} />
        <span><span className="font-semibold">Turn the timer on by default</span><span className="block text-mute">You can still switch it off for a single test.</span></span>
      </label>
      <button type="submit" className="btn btn-primary" disabled={busy || name.trim().length < 2}>{busy ? <Spinner label="Saving" /> : 'Save changes'}</button>
    </form>
  );
}

function Password() {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const weak = form.newPassword.length < 8 || !/[A-Za-z]/.test(form.newPassword) || !/[0-9]/.test(form.newPassword);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await post('/api/me/password', form);
      setTokens({ accessToken: data.accessToken });
      setForm({ currentPassword: '', newPassword: '' });
      toast('Password changed. Other devices were signed out.');
    } catch (err) {
      setError(err.status === 401 ? 'Your current password is not correct.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Current password" htmlFor="pw-old"><input id="pw-old" type="password" autoComplete="current-password" className="input" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></Field>
      <Field label="New password" htmlFor="pw-new" hint="At least 8 characters with a letter and a number."><input id="pw-new" type="password" autoComplete="new-password" className="input" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></Field>
      {error && <p role="alert" className="text-sm text-coral">{error}</p>}
      <button type="submit" className="btn btn-quiet" disabled={busy || !form.currentPassword || weak}>{busy ? <Spinner label="Changing" /> : 'Change password'}</button>
    </form>
  );
}

function Goal() {
  const { user, reloadUser } = useAuth();
  const toast = useToast();
  const companies = useAsync(() => get('/api/companies'), []);
  const daysLeft = user.goal ? Math.max(1, Math.round((Date.parse(`${user.goal.deadline}T00:00:00Z`) - Date.now()) / 86400000) + 1) : 60;
  const current = user.goal && companies.data ? companies.data.companies.find((c) => c.id === user.goal.company) : null;

  return (
    <Async state={companies}>
      {(d) => (
        <>
          <p className="mb-5 text-sm text-mute">After changing your goal, open the roadmap and reschedule so the plan uses your new deadline.</p>
          <GoalForm companies={d.companies} initial={{ slug: current ? current.slug : undefined, days: daysLeft, hours: user.goal ? user.goal.hoursPerDay : 2 }} submitLabel="Update goal" onSaved={() => { reloadUser(); toast('Goal updated. Reschedule your roadmap to apply it.'); }} />
        </>
      )}
    </Async>
  );
}

export default function Profile() {
  useDocumentTitle('Profile');
  const { logout } = useAuth();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile and settings" />
      <div className="space-y-10">
        <section aria-labelledby="s-details"><h2 id="s-details" className="mb-4 text-2xl font-bold">Your details</h2><Details /></section>
        <section className="row-rule pt-8" aria-labelledby="s-goal"><h2 id="s-goal" className="mb-2 text-2xl font-bold">Your goal</h2><Goal /></section>
        <section className="row-rule pt-8" aria-labelledby="s-pw"><h2 id="s-pw" className="mb-4 text-2xl font-bold">Password</h2><Password /></section>
        <section className="row-rule pt-8"><button type="button" className="btn btn-danger" onClick={logout}>Sign out</button></section>
      </div>
    </div>
  );
}
