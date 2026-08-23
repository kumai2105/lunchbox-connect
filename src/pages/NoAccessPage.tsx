import { useAuth } from '../lib/auth';
import { Btn } from '../components/ui';
import logoUrl from '../assets/lunchbox-connect-logo.png';

/**
 * A valid sign-in that carries no usable account.
 *
 * Two real states land here, and one screen is honest about both:
 *
 *   * The account has been DEACTIVATED. Every identity helper the RLS policies
 *     are built on resolves to NULL for an inactive account (migration 0044),
 *     so this person's own app_users row is not visible to them and nothing in
 *     the platform will answer. Deactivation also bans the Supabase Auth user,
 *     so ordinarily they never get this far — but a session issued a moment
 *     before the change is still cryptographically valid until it expires, and
 *     this is what it now sees.
 *
 *   * The auth account exists but was never provisioned with a profile.
 *
 * Before this screen existed, both fell through to the Parent portal with no
 * role and no data: an empty product that looked broken rather than closed.
 * The distinction between the two cases is not something this page can safely
 * tell apart from the browser — asking the database would require the very
 * read the account is refused — so it says what is true of both and points at
 * the person who can fix either.
 */
export default function NoAccessPage() {
  const { signOut } = useAuth();
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <img className="brand-logo" src={logoUrl} alt="LunchBox Connect" />
        </div>
        <h1>This account is not active</h1>
        <p className="tagline">
          Your sign-in worked, but this account cannot currently use the platform. That happens when
          an administrator has deactivated it, or when it was never finished being set up.
        </p>
        <p className="tagline">
          Ask your administrator to reactivate it. Nothing has been deleted — your account and
          everything recorded under it are still here.
        </p>
        <Btn
          variant="brand"
          onClick={() => void signOut()}
          style={{ width: '100%', padding: 12, fontSize: 15 }}
        >
          Sign out
        </Btn>
      </div>
    </div>
  );
}
