import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Async, Field, Spinner, useToast } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { get, put } from '../lib/api';
import { useAsync, useDocumentTitle } from '../lib/hooks';

const PRESETS = [30, 60, 90, 120];

export function GoalForm({ companies, initial, submitLabel, onSaved }) {
  const toast = useToast();
  const { setUser } = useAuth();
  const [slug, setSlug] = useState(initial.slug || 'general-placement');
  const [days, setDays] = useState(initial.days || 60);
  const [hours, setHours] = useState(initial.hours || 2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = companies.find((c) => c.slug === slug);
  const daysOk = Number.isInteger(Number(days)) && Number(days) >= 1 && Number(days) <= 365;

  async function submit(e) {
    e.preventDefault();
    if (!daysOk) { setError('Enter a whole number of days between 1 and 365.'); return; }
    setBusy(true);
    setError('');
    try {
      const data = await put('/api/me/goal', { companySlug: slug, deadlineDays: Number(days), hoursPerDay: Number(hours) });
      setUser(data.user);
      toast('Goal saved');
      onSaved(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const weightTone = { high: 'text-marigold', medium: 'text-bone-dim', low: 'text-mute' };

  return (
    <form onSubmit={submit} className="space-y-8">
      <fieldset>
        <legend className="text-lg font-bold">Where do you want to get placed?</legend>
        <p className="mt-1 text-sm text-mute">Each company has a profile of how much it expects in each subject. Pick General Placement if you are not sure yet.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {companies.map((c) => (
            <label key={c.slug} className={`cursor-pointer rounded-tab border p-3 transition-colors ${slug === c.slug ? 'border-marigold bg-ink-700' : 'border-ink-600 hover:bg-ink-800'}`}>
              <input type="radio" name="company" value={c.slug} checked={slug === c.slug} onChange={() => setSlug(c.slug)} className="sr-only" />
              <span className="block font-semibold">{c.name}</span>
              <span className="block text-xs text-mute">{c.role}</span>
            </label>
          ))}
        </div>
        {selected && (
          <div className="mt-4 rounded-tab border border-ink-700 p-3 text-sm">
            <p className="text-bone-dim">{selected.description.split('Curated')[0].trim()}</p>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {selected.skills.map((s) => (
                <span key={s.subject} className={weightTone[s.weight]}>{s.subject}: {s.weight}</span>
              ))}
            </p>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="text-lg font-bold">How many days do you have?</legend>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button key={p} type="button" aria-pressed={Number(days) === p} onClick={() => setDays(p)} className={`btn ${Number(days) === p ? 'btn-primary' : 'btn-quiet'}`}>{p} days</button>
          ))}
          <div className="w-32">
            <label htmlFor="days" className="sr-only">Days until your deadline</label>
            <input id="days" type="number" min="1" max="365" className="input" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
        </div>
      </fieldset>

      <Field label={`Study time per day: ${hours} ${Number(hours) === 1 ? 'hour' : 'hours'}`} htmlFor="hours" hint="Be honest. A plan you can keep beats a plan you will skip.">
        <input id="hours" type="range" min="0.5" max="8" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} className="w-full accent-marigold" />
      </Field>

      {error && <p role="alert" className="rounded-tab border border-coral/50 bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <Spinner label="Saving" /> : submitLabel}</button>
    </form>
  );
}

export default function Onboarding() {
  useDocumentTitle('Set your goal');
  const navigate = useNavigate();
  const { user } = useAuth();
  const state = useAsync(() => get('/api/companies'), []);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-4xl font-extrabold">Set your target, {user && user.name.split(' ')[0]}.</h1>
      <p className="mt-2 max-w-prose text-mute">Three answers are enough to build your first plan. You can change them any time from your profile.</p>
      <div className="panel mt-8 p-5 sm:p-7">
        <Async state={state}>
          {(data) => <GoalForm companies={data.companies} initial={{}} submitLabel="Save and continue" onSaved={() => navigate('/test')} />}
        </Async>
      </div>
    </div>
  );
}
