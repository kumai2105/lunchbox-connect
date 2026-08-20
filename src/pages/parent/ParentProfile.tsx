import { useEffect, useState } from 'react';
import { useParentData } from './context';
import { getInstitution, listClasses, type ClassWithMeta } from '../../lib/api';
import type { Institution } from '../../lib/types';
import { Avatar, Banner, Btn, Card } from '../../components/ui';
import { Icon } from '../../components/icons';
import { initials } from '../../lib/format';
import { useAuth } from '../../lib/auth';

/**
 * Parent Profile (blueprint Parts 80-81). Read-only child context. Allergy and
 * dietary information is authoritative safety data owned by the nursery — a
 * parent cannot overwrite it from here, and no parent-submitted change
 * workflow exists because none has been approved.
 */
export default function ParentProfile() {
  const { child, photoUrl } = useParentData();
  const { profile, signOut } = useAuth();
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [klass, setKlass] = useState<ClassWithMeta | null>(null);

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
          <div className="allergy-list">
            {notes.map((n) => (
              <div className="allergy-item" key={n.id}>
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
            change anything, contact your nursery — for safety, it can only be changed by them.
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
          </tbody>
        </table>
        <div style={{ padding: 18 }}>
          <Btn variant="ghost" onClick={() => void signOut()} style={{ width: '100%' }}>
            Sign out
          </Btn>
        </div>
      </Card>
    </div>
  );
}
