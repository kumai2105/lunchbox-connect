import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { isSupabaseConfigured } from '../lib/supabase';
import { Btn } from '../components/ui';

// The nine approved role domains (docs/02) — the role comes from the account.
const KNOWN_ROLES = [
  'SUPER_ADMIN',
  'SCHOOL_ADMIN',
  'OPERATIONS_MANAGER',
  'FINANCE_OWNER',
  'VIEWER',
  'PARENT',
  'CLASSROOM_STAFF',
  'KITCHEN',
  'DRIVER',
];

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
          <div className="logo">
            <div className="logo-mark">LC</div>
            <div>
              <b>LunchBox Connect</b>
              <span className="sub">Child nutrition platform</span>
            </div>
          </div>
          <h1>Waiting for the backend</h1>
          <p className="tagline">
            The app is built and ready — it just needs your Supabase project keys (runbook step 3):
            copy `.env.example` to `.env` and fill in <b>VITE_SUPABASE_URL</b> and{' '}
            <b>VITE_SUPABASE_ANON_KEY</b>, then restart the dev server.
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
        <div className="logo">
          <div className="logo-mark">LC</div>
          <div>
            <b>LunchBox Connect</b>
            <span className="sub">Child nutrition platform</span>
          </div>
        </div>
        <h1>Sign in to your institution</h1>
        <p className="tagline">Accounts are created by your school's administrator.</p>

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
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <Btn
            variant="brand"
            type="submit"
            disabled={busy}
            style={{ width: '100%', padding: 12, fontSize: 15 }}
          >
            {busy ? 'Signing in…' : 'Enter the platform →'}
          </Btn>
        </form>

        <div style={{ marginTop: 18, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 8, fontWeight: 700 }}>
            ROLES IN THE SYSTEM
          </div>
          <div className="chip-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {KNOWN_ROLES.map((r) => (
              <span key={r} className="chip" style={{ background: 'var(--slate-soft)' }}>
                {r}
              </span>
            ))}
          </div>
          <div
            style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 10, textAlign: 'center' }}
          >
            Nine approved role domains (docs/02) — some scopes are still NOT_YET_DEFINED in the
            spec.
          </div>
        </div>
      </div>
    </div>
  );
}
