import { useEffect, useState } from 'react';
import { useParentData } from './context';
import {
  changeMyPassword,
  getInstitution,
  listClasses,
  updateUserProfile,
  type ClassWithMeta,
} from '../../lib/api';
import type { Institution } from '../../lib/types';
import { Avatar, Banner, Btn, Card, Field, PasswordInput } from '../../components/ui';
import { Icon } from '../../components/icons';
import { initials } from '../../lib/format';
import { useAuth } from '../../lib/auth';

/**
 * Parent Profile (blueprint Parts 80-81). Read-only child context.
 *
 * What this screen shows are INTERIM free-text safety notes owned by the
 * nursery. The structured child Allergy / Dietary model (§42) is
 * BLOCKED_BY_SPEC, so the profile must never be presented as holding an
 * authoritative allergy record. A parent cannot change any of it from here, and
 * no parent-submitted change workflow exists because none has been approved.
 */
export default function ParentProfile() {
  const { child, photoUrl } = useParentData();
  const { profile, signOut } = useAuth();
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [klass, setKlass] = useState<ClassWithMeta | null>(null);

  // A Parent can change their OWN name, phone and password. Everything about
  // the CHILD stays read-only — that is the nursery's record, not the app's.
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

  useEffect(() => {
    let active = true;
    void (async () => {
      const [inst, classes] = await Promise.all([
        getInstitution(child.institution_id),
        listClasses(),
      ]);
      if (!active) return;
      setInstitution(inst.data);
      setKlass((classes.data ?? []).find((c) => c.id === child.class_id) ?? null);
    })();
    return () => {
      active = false;
    };
  }, [child.institution_id, child.class_id]);

  const notes = child.medical_notes ?? [];

  return (
    <div>
      <h2 className="parent-title">Profile</h2>

      <Card>
        <div className="parent-profile-head">
          <Avatar
            photoUrl={photoUrl}
            initials={initials(`${child.given_name} ${child.family_name}`)}
            size="lg"
          />
          <div>
            <h3 className="profile-name">
              {child.given_name} {child.family_name}
            </h3>
            <div className="cell-sub">{child.student_no}</div>
            {/* The legacy enrollment_status is not shown to families — it is not
                the authoritative operational truth and could contradict it. */}
          </div>
        </div>
        <table>
          <tbody>
            <tr>
              <td className="cell-sub">Nursery / school</td>
              <td className="cell-name">{institution?.name ?? '—'}</td>
            </tr>
            <tr>
              <td className="cell-sub">Class</td>
              <td>{klass?.name ?? 'Not assigned'}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card title="Safety notes (interim)">
        {notes.length === 0 ? (
          <div className="center-box">
            No interim safety notes are recorded for {child.given_name}.
          </div>
        ) : (
          <div className="safety-note-list">
            {notes.map((n) => (
              <div className="safety-note-item" key={n.id}>
                <Icon name="alertTriangle" size={16} />
                <span>{n.text}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ padding: '0 18px 18px' }}>
          <Banner kind="info">
            These are general, interim safety notes — <b>not</b> a complete or authoritative
            allergy/dietary record (a structured allergy model is not yet available). To add or
            change anything, contact {institution?.name ?? "your child's nursery or school"} — for
            safety, it can only be changed by them.
          </Banner>
        </div>
      </Card>

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
              Your email address is how you sign in, so it cannot be changed here. Ask{' '}
              {institution?.name ?? "your child's nursery or school"} if it needs to change.
            </Banner>
          </div>
        </div>
      </Card>

      <Card title="Change your password">
        <div style={{ padding: 18 }}>
          {pwMsg && <Banner kind={pwMsg.kind === 'ok' ? 'ok' : 'err'}>{pwMsg.text}</Banner>}
          <Banner kind="info">
            You are already signed in, so you do not need your old password. If you have forgotten
            it and cannot sign in, {institution?.name ?? "your child's nursery or school"} can issue
            you a new one.
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
    </div>
  );
}
