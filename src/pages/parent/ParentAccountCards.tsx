import { useEffect, useState } from 'react';
import { changeMyPassword, updateUserProfile } from '../../lib/api';
import { Banner, Btn, Card, Field, PasswordInput } from '../../components/ui';
import { useAuth } from '../../lib/auth';

/**
 * A Parent's OWN account: name, phone, password, and the way out.
 *
 * Lives in its own component because it is needed in two places, and the
 * second one is the reason it exists. A Parent with no child linked to them —
 * an account created before the link is made, or one whose link has just been
 * revoked — used to see nothing but "no children are linked to this account",
 * with no navigation and no way to reach their profile. That meant they could
 * not change their password and **could not even sign out**: the sign-out
 * control lived on a screen the shell would not render for them.
 *
 * Nothing here depends on a child, so nothing here should disappear when there
 * is not one.
 */
export default function ParentAccountCards({ settingName }: { settingName?: string | null }) {
  const { profile, signOut } = useAuth();
  const who = settingName ?? "your child's nursery or school";

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailMsg, setDetailMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [pw, setPw] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile?.full_name, profile?.phone]);

  async function saveDetails() {
    if (!profile) return;
    setSavingDetails(true);
    setDetailMsg(null);
    const res = await updateUserProfile(profile.user_id, fullName, phone || null);
    setSavingDetails(false);
    setDetailMsg(res.error ? { kind: 'err', text: res.error } : { kind: 'ok', text: 'Saved.' });
  }

  async function savePassword() {
    setPwMsg(null);
    if (pw.length < 8) {
      setPwMsg({ kind: 'err', text: 'Choose a password of at least 8 characters.' });
      return;
    }
    if (pw !== pwConfirm) {
      setPwMsg({ kind: 'err', text: 'The two passwords do not match.' });
      return;
    }
    setSavingPw(true);
    const res = await changeMyPassword(pw);
    setSavingPw(false);
    if (res.error) {
      setPwMsg({ kind: 'err', text: res.error });
      return;
    }
    setPw('');
    setPwConfirm('');
    setPwMsg({ kind: 'ok', text: 'Your password has been changed.' });
  }

  return (
    <>
      <Card title="Your account">
        <table>
          <tbody>
            <tr>
              <td className="cell-sub">Name</td>
              <td className="cell-name">{profile?.full_name ?? '—'}</td>
            </tr>
            <tr>
              <td className="cell-sub">Email</td>
              <td>{profile?.email ?? '—'}</td>
            </tr>
            <tr>
              <td className="cell-sub">Phone</td>
              <td>{profile?.phone ?? '—'}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ padding: 18 }}>
          <Btn variant="ghost" onClick={() => setEditing((v) => !v)} style={{ width: '100%' }}>
            {editing ? 'Cancel' : 'Edit your name or phone'}
          </Btn>
          {editing && (
            <div style={{ marginTop: 14 }}>
              {detailMsg && (
                <Banner kind={detailMsg.kind === 'ok' ? 'ok' : 'err'}>{detailMsg.text}</Banner>
              )}
              <Field label="Full name">
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </Field>
              <div style={{ height: 12 }} />
              <Field label="Phone (optional)">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <div style={{ height: 14 }} />
              <Btn
                variant="brand"
                onClick={() => void saveDetails()}
                disabled={savingDetails || !fullName.trim()}
                style={{ width: '100%' }}
              >
                {savingDetails ? 'Saving…' : 'Save'}
              </Btn>
            </div>
          )}
          <div style={{ marginTop: 10 }}>
            <Banner kind="info">
              Your email address is how you sign in, so it cannot be changed here. Ask {who} if it
              needs to change.
            </Banner>
          </div>
        </div>
      </Card>

      <Card title="Change your password">
        <div style={{ padding: 18 }}>
          {pwMsg && <Banner kind={pwMsg.kind === 'ok' ? 'ok' : 'err'}>{pwMsg.text}</Banner>}
          <Banner kind="info">
            You are already signed in, so you do not need your old password. If you have forgotten
            it and cannot sign in, {who} can issue you a new one.
          </Banner>
          <Field label="New password (min 8)">
            <PasswordInput value={pw} onChange={setPw} autoComplete="new-password" />
          </Field>
          <div style={{ height: 12 }} />
          <Field label="Repeat it">
            <PasswordInput value={pwConfirm} onChange={setPwConfirm} autoComplete="new-password" />
          </Field>
          <div style={{ height: 14 }} />
          <Btn
            variant="brand"
            onClick={() => void savePassword()}
            disabled={savingPw || pw.length < 8 || pw !== pwConfirm}
            style={{ width: '100%' }}
          >
            {savingPw ? 'Changing…' : 'Change password'}
          </Btn>
        </div>
      </Card>

      <Card title="Signing out">
        <div style={{ padding: 18 }}>
          <Btn variant="ghost" onClick={() => void signOut()} style={{ width: '100%' }}>
            Sign out
          </Btn>
        </div>
      </Card>
    </>
  );
}
