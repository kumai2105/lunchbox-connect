import { useEffect, useState } from 'react';
import { useParentData } from './context';
import { getInstitution, listClasses, type ClassWithMeta } from '../../lib/api';
import type { Institution } from '../../lib/types';
import { Avatar, Banner, Card } from '../../components/ui';
import ParentAccountCards from './ParentAccountCards';
import { Icon } from '../../components/icons';
import { initials } from '../../lib/format';

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
      <div className="parent-head parent-head-profile">
        <Avatar
          photoUrl={photoUrl}
          initials={initials(`${child.given_name} ${child.family_name}`)}
          size="lg"
        />
        <div>
          <h2>
            {child.given_name} {child.family_name}
          </h2>
          <p>{child.student_no}</p>
          {/* The legacy enrollment_status is not shown to families — it is not
              the authoritative operational truth and could contradict it. */}
        </div>
      </div>

      <Card>
        <ul className="profile-rows">
          <li>
            <span className="profile-row-ico">
              <Icon name="building" size={17} />
            </span>
            <div>
              <span>Nursery / school</span>
              <b>{institution?.name ?? '—'}</b>
            </div>
          </li>
          <li>
            <span className="profile-row-ico">
              <Icon name="folder" size={17} />
            </span>
            <div>
              <span>Class</span>
              <b>{klass?.name ?? 'Not assigned'}</b>
            </div>
          </li>
        </ul>
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

      <ParentAccountCards settingName={institution?.name ?? null} />
    </div>
  );
}
