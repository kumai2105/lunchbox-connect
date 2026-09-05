import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { isSupabaseConfigured } from '../lib/supabase';
import { Btn, PasswordInput } from '../components/ui';
import logoUrl from '../assets/lunchbox-connect-logo.png';

// The sign-in screen is public. It shows what a person needs in order to sign
// in and nothing else — not the platform's internal role vocabulary, and not
// which parts of the product are unfinished.

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isSupabaseConfigured()) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-brand">
            <img className="brand-logo" src={logoUrl} alt="LunchBox Connect" />
          </div>
          <h1>Waiting for the backend</h1>
          <p className="tagline">
            This deployment is missing its database connection settings, so nobody can sign in yet.
            Whoever set up this environment needs to supply <b>VITE_SUPABASE_URL</b> and{' '}
            <b>VITE_SUPABASE_ANON_KEY</b>.
          </p>
        </div>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const signInError = await signIn(email.trim(), password);
    setBusy(false);
    if (signInError) {
      setError(signInError);
      return;
    }
    navigate('/');
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <img className="brand-logo" src={logoUrl} alt="LunchBox Connect" />
        </div>
        <h1>Sign in</h1>
        <p className="tagline">
          Accounts are created for you by an administrator. Once you are signed in you can change
          your own password from your profile.
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={(e) => void onSubmit(e)}>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 18 }}>
            <label htmlFor="signin-password">Password</label>
            <PasswordInput
              id="signin-password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
          </div>
          <Btn
            variant="brand"
            type="submit"
            // The password box is a component now, so the browser's own
            // `required` no longer sits on it. Gate the button on both fields
            // instead of losing the check.
            disabled={busy || !email.trim() || password.length === 0}
            style={{ width: '100%', padding: 12, fontSize: 15 }}
          >
            {busy ? 'Signing in…' : 'Enter the platform →'}
          </Btn>
        </form>
      </div>
    </div>
  );
}
