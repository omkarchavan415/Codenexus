import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import { Field, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../lib/hooks';

function passwordProblem(pw) {
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(pw)) return 'Include at least one letter.';
  if (!/[0-9]/.test(pw)) return 'Include at least one number.';
  return '';
}

export default function Register() {
  useDocumentTitle('Create account');
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pwError = touched ? passwordProblem(form.password) : '';

  async function submit(e) {
    e.preventDefault();
    setTouched(true);
    if (passwordProblem(form.password)) return;
    setError('');
    setBusy(true);
    try {
      await register(form.name.trim(), form.email, form.password);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setError(err.status === 409 ? 'An account with that email already exists. Try signing in.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="It takes a minute. You will set your target next."
      footer={<>Already have an account? <Link className="link" to="/login">Sign in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="name">
          <input id="name" autoComplete="name" required minLength={2} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Email" htmlFor="email">
          <input id="email" type="email" autoComplete="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password" htmlFor="password" error={pwError} hint="At least 8 characters with a letter and a number.">
          <input id="password" type="password" autoComplete="new-password" required className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} onBlur={() => setTouched(true)} />
        </Field>
        {error && <p role="alert" className="rounded-tab border border-coral/50 bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={busy || form.name.trim().length < 2 || !form.email}>
          {busy ? <Spinner label="Creating account" /> : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
}
