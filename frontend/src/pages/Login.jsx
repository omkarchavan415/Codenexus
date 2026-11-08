import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell';
import { Field, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../lib/hooks';

export default function Login() {
  useDocumentTitle('Sign in');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(form.email, form.password);
      navigate((location.state && location.state.from) || '/', { replace: true });
    } catch (err) {
      setError(err.status === 401 ? 'That email and password do not match. Check both and try again.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Pick up where your plan left off."
      footer={<>New to CodeNexus? <Link className="link" to="/register">Create an account</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email">
          <input id="email" type="email" autoComplete="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Password" htmlFor="password">
          <input id="password" type="password" autoComplete="current-password" required className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        {error && <p role="alert" className="rounded-tab border border-coral/50 bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={busy || !form.email || !form.password}>
          {busy ? <Spinner label="Signing in" /> : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
}
