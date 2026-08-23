import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { changeMyPassword, listInstitutions, listKitchens, updateUserProfile } from '../lib/api';
import { roleLabel } from '../lib/roleLabel';
import type { Kitchen } from '../lib/types';
import { Banner, Btn, Card, Field, PageHead, PasswordInput, Pill } from '../components/ui';

/**
 * Your own account — the one screen every role has.
 *
 * WHAT CAN BE CHANGED HERE, AND WHY THE REST CANNOT
 *
 *   Password — yes. This is a SIGNED-IN CHANGE, not a "forgot password" reset:
 *     you prove who you are by already holding a session, and Supabase Auth
 *     accepts the new value on that session with no privileged key involved.
 *     Every role gets it, including Parents, because the alternative was that
 *     nobody could ever change the password an administrator first typed for
 *     them.
 *
 *   Name and phone — yes. Plain corrections. update_user_profile() lets an
 *     active person write their own row and nobody else's.
 *
 *   Email — NO, and the screen says so rather than hiding the field. Email is
 *     the authentication identity: Supabase Auth holds one copy and app_users
 *     holds another, and a change is only correct if both move together with
 *     confirmation of the new address. That workflow does not exist yet, so
 *     offering an edit here would produce accounts that sign in as one address
 *     and are displayed as another.
 *
 *   Role, institution and kitchen — NO. These decide what an existing token is
 *     allowed to read. Changing your own would be privilege escalation, and
 *     the database refuses it (app_users_update, migration 0027) whatever this
 *     screen does.
 */
export default function AccountPage() {
  const { profile, session } = useAuth();
  const [scopeName, setScopeName] = useState<string | null>(null);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [pw, setPw] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile?.full_name, profile?.phone]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (profile?.institution_id) {
        const res = await listInstitutions();
        if (!active) return;
        setScopeName((res.data ?? []).find((i) => i.id === profile.institution_id)?.name ?? null);
      } else if (profile?.kitchen_id) {
        const res = await listKitchens();
        if (!active) return;
        const k = (res.data ?? []).find((x: Kitchen) => x.id === profile.kitchen_id);
        setScopeName(k ? `${k.name} (Kitchen)` : null);
      } else {
        setScopeName(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [profile?.institution_id, profile?.kitchen_id]);

  if (!profile) return null;

  async function saveProfile() {
    if (!profile) return;
    setSavingProfile(true);
    setProfileMsg(null);
    const res = await updateUserProfile(profile.user_id, fullName, phone || null);
    setSavingProfile(false);
    if (res.error) {
      setProfileMsg({ kind: 'err', text: res.error });
      return;
    }
    // The name in the sidebar comes from the auth context, which reloads its
    // profile when the session identity changes — not when a field on it does.
    // Rather than invent a refresh channel, say plainly that the change is
    // saved and where it will show.
    setProfileMsg({
      kind: 'ok',
      text: 'Saved. Your name and phone number are updated everywhere they appear.',
    });
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
    setPwMsg({
      kind: 'ok',
      text: 'Your password has been changed. Use the new one the next time you sign in.',
    });
  }

  const profileDirty =
    fullName.trim() !== (profile.full_name ?? '') || (phone.trim() || '') !== (profile.phone ?? '');

  return (
    <div>
      <PageHead title="Your account" hint="the details and password for this sign-in" />

      <Card title="Who you are on the platform">
        <table>
          <tbody>
            <tr>
              <td className="cell-sub">Email (sign-in)</td>
              <td className="cell-name">{profile.email}</td>
            </tr>
            <tr>
              <td className="cell-sub">Role</td>
              <td>
                <Pill variant={profile.role === 'super_admin' ? 'brand' : 'slate'}>
                  {roleLabel(profile.role)}
                </Pill>
              </td>
            </tr>
            <tr>
              <td className="cell-sub">Scope</td>
              <td>{scopeName ?? 'Whole platform'}</td>
            </tr>
          </tbody>
        </table>
        <div style={{ padding: '0 18px 18px' }}>
          <Banner kind="info">
            Your email address is how you sign in, so it cannot be edited here — changing it has to
            move your sign-in and your profile together. Ask an administrator if it needs to change.
            Your role and scope are set by an administrator too.
          </Banner>
        </div>
      </Card>

      <Card title="Your details">
        {profileMsg && (
          <div style={{ padding: '0 18px' }}>
            <Banner kind={profileMsg.kind === 'ok' ? 'ok' : 'err'}>{profileMsg.text}</Banner>
          </div>
        )}
        <div style={{ padding: 18 }}>
          <div className="form-row">
            <Field label="Full name">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Field label="Phone (optional)">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>
          <Btn
            variant="brand"
            onClick={() => void saveProfile()}
            disabled={savingProfile || !fullName.trim() || !profileDirty}
          >
            {savingProfile ? 'Saving…' : 'Save details'}
          </Btn>
        </div>
      </Card>

      <Card title="Change your password">
        {pwMsg && (
          <div style={{ padding: '0 18px' }}>
            <Banner kind={pwMsg.kind === 'ok' ? 'ok' : 'err'}>{pwMsg.text}</Banner>
          </div>
        )}
        <div style={{ padding: 18 }}>
          <Banner kind="info">
            You are already signed in, so you do not need your old password to set a new one. If you
            have forgotten it and cannot sign in, an administrator has to issue you a new one —
            there is no email reset.
          </Banner>
          <div className="form-row">
            <Field label="New password (min 8)">
              <PasswordInput value={pw} onChange={setPw} autoComplete="new-password" />
            </Field>
            <Field label="Repeat it">
              <PasswordInput
                value={pwConfirm}
                onChange={setPwConfirm}
                autoComplete="new-password"
              />
            </Field>
          </div>
          <Btn
            variant="brand"
            onClick={() => void savePassword()}
            disabled={savingPw || pw.length < 8 || pw !== pwConfirm || !session}
          >
            {savingPw ? 'Changing…' : 'Change password'}
          </Btn>
        </div>
      </Card>
    </div>
  );
}
