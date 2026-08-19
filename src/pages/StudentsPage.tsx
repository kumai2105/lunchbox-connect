import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useRole } from '../lib/auth';
import { can } from '../lib/rbac';
import {
  createStudent,
  listClasses,
  listInstitutions,
  listStudents,
  studentPhotoUrl,
  updateStudent,
  uploadStudentPhoto,
} from '../lib/api';
import type { ClassRow, Institution, Student } from '../lib/types';
import {
  Avatar,
  Banner,
  Btn,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHead,
  Pill,
  Spinner,
  StatusDot,
} from '../components/ui';
import { Icon } from '../components/icons';
import { statusLabel, statusPillClass } from '../lib/status';
import { initials } from '../lib/format';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);

  // Drill-downs land here pre-filtered (Institution Detail -> Students). The
  // URL stays the source of truth for the institution filter so the link is
  // shareable and Back returns to the same filtered view.
  const [params, setParams] = useSearchParams();
  const institutionFilter = params.get('institution') ?? '';
  const setInstitutionFilter = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('institution', value);
    else next.delete('institution');
    setParams(next, { replace: true });
  };

  const [term, setTerm] = useState('');
  const [classFilter, setClassFilter] = useState('');

  const role = useRole();
  const canCreate = can(role, 'students', 'create');
  // §5: photo edit and class assignment are mutations — admins only. Classroom
  // staff reach this roster read-only (RLS enforces the same server-side).
  const canUpdate = can(role, 'students', 'update');
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    student_no: '',
    given_name: '',
    family_name: '',
    institution_id: '',
    class_id: '',
    grade: '',
  });

  useEffect(() => {
    let active = true;
    void (async () => {
      const [s, i, c] = await Promise.all([listStudents(), listInstitutions(), listClasses()]);
      if (!active) return;
      if (s.error || i.error || c.error) setError(s.error ?? i.error ?? c.error);
      setStudents(s.data ?? []);
      setInstitutions(i.data ?? []);
      setClasses(c.data ?? []);

      const urls: Record<string, string | null> = {};
      await Promise.all(
        (s.data ?? []).map(async (st) => {
          urls[st.id] = await studentPhotoUrl(st.photo_path);
        }),
      );
      if (active) setPhotoUrls(urls);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function onPhotoChange(student: Student, file: File | undefined) {
    if (!file) return;
    const res = await uploadStudentPhoto(student.id, file);
    if (res.error) {
      setError(res.error);
      return;
    }
    setStudents((prev) =>
      (prev ?? []).map((s) => (s.id === student.id ? { ...s, photo_path: res.data } : s)),
    );
    const url = await studentPhotoUrl(res.data);
    setPhotoUrls((prev) => ({ ...prev, [student.id]: url }));
  }

  const filtered = useMemo(() => {
    if (!students) return [];
    const t = term.trim().toLowerCase();
    return students.filter((s) => {
      if (institutionFilter && s.institution_id !== institutionFilter) return false;
      if (classFilter && s.class_id !== classFilter) return false;
      if (!t) return true;
      return (
        s.given_name.toLowerCase().includes(t) ||
        s.family_name.toLowerCase().includes(t) ||
        (s.student_no ?? '').toLowerCase().includes(t)
      );
    });
  }, [students, term, institutionFilter, classFilter]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createStudent({
      student_no: form.student_no.trim(),
      institution_id: form.institution_id,
      given_name: form.given_name.trim(),
      family_name: form.family_name.trim(),
      class_id: form.class_id || null,
      grade: form.grade || null,
      medical_notes: [],
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setStudents((prev) => [...(prev ?? []), res.data!]);
    setShowCreate(false);
    setForm({
      student_no: '',
      given_name: '',
      family_name: '',
      institution_id: '',
      class_id: '',
      grade: '',
    });
  }

  async function assignClass(student: Student, classId: string) {
    const res = await updateStudent(student.id, { class_id: classId || null });
    if (res.error) {
      setError(res.error);
      return;
    }
    setStudents((prev) =>
      (prev ?? []).map((s) => (s.id === student.id ? (res.data as Student) : s)),
    );
  }

  if (error && !students) return <EmptyState text={`Could not load students: ${error}`} />;

  return (
    <div>
      <PageHead
        title="Students"
        hint="roster — RLS-scoped to your institution"
        actions={
          canCreate ? (
            <Btn
              variant="brand"
              onClick={() => {
                setError(null);
                setShowCreate(true);
              }}
            >
              + Add student
            </Btn>
          ) : undefined
        }
      />

      {error && <Banner kind="err">{error}</Banner>}

      <Card bodyClassName="filters">
        <div className="search-box">
          <Icon name="search" size={15} />
          <input
            placeholder="Search name / ID..."
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
        <select value={institutionFilter} onChange={(e) => setInstitutionFilter(e.target.value)}>
          <option value="">All institutions</option>
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Card>

      {!students ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState text="No students match the current filters." />
      ) : (
        <Card>
          <table>
            <thead>
              <tr>
                <th>Photo</th>
                <th>Student</th>
                <th>ID</th>
                <th>Institution</th>
                <th>Class</th>
                <th>Operational status</th>
                <th>Medical note</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                return (
                  <tr key={s.id}>
                    <td>
                      {canUpdate ? (
                        <label
                          style={{ cursor: 'pointer', display: 'inline-block' }}
                          title="Upload photo"
                        >
                          <Avatar
                            photoUrl={photoUrls[s.id]}
                            initials={initials(`${s.given_name} ${s.family_name}`)}
                            size="sm"
                          />
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => void onPhotoChange(s, e.target.files?.[0])}
                          />
                        </label>
                      ) : (
                        <Avatar
                          photoUrl={photoUrls[s.id]}
                          initials={initials(`${s.given_name} ${s.family_name}`)}
                          size="sm"
                        />
                      )}
                    </td>
                    <td className="cell-name">
                      <Link to={`/students/${s.id}`}>
                        {s.given_name} {s.family_name}
                      </Link>
                    </td>
                    <td className="mono cell-sub">{s.student_no}</td>
                    <td>{institutions.find((i) => i.id === s.institution_id)?.name ?? '—'}</td>
                    <td>
                      {canUpdate ? (
                        <select
                          value={s.class_id ?? ''}
                          onChange={(e) => void assignClass(s, e.target.value)}
                          title="assign class"
                        >
                          <option value="">Unassigned</option>
                          {classes
                            .filter((c) => c.institution_id === s.institution_id)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      ) : (
                        (classes.find((c) => c.id === s.class_id)?.name ?? 'Unassigned')
                      )}
                    </td>
                    <td>
                      <Pill variant={statusPillClass(s.operational_status)}>
                        {statusLabel(s.operational_status)}
                      </Pill>
                    </td>
                    <td>
                      {Array.isArray(s.medical_notes) && s.medical_notes.length > 0 ? (
                        // Amber, not green. A green dot reads as "fine" and this
                        // is allergy/dietary safety data that staff must notice.
                        <span>
                          <StatusDot color="amber" />
                          {s.medical_notes.map((m) => m.text).join(' · ')}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          s.enrollment_status === 'enrolled'
                            ? 'pill free'
                            : s.enrollment_status === 'pending'
                              ? 'pill reduced'
                              : 'pill na'
                        }
                      >
                        {s.enrollment_status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {showCreate && (
        <Modal
          title="Add student"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Btn>
              <Btn
                variant="brand"
                onClick={(e) => void onSubmit(e as unknown as FormEvent)}
                disabled={busy || !form.given_name || !form.family_name || !form.institution_id}
              >
                {busy ? 'Saving…' : 'Add student'}
              </Btn>
            </>
          }
        >
          <form onSubmit={(e) => void onSubmit(e)}>
            {error && <Banner kind="err">{error}</Banner>}
            <div className="form-row">
              <Field label="Given name">
                <input
                  value={form.given_name}
                  onChange={(e) => setForm({ ...form, given_name: e.target.value })}
                  autoFocus
                />
              </Field>
              <Field label="Family name">
                <input
                  value={form.family_name}
                  onChange={(e) => setForm({ ...form, family_name: e.target.value })}
                />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Student no.">
                <input
                  value={form.student_no}
                  onChange={(e) => setForm({ ...form, student_no: e.target.value })}
                  placeholder="e.g. LBS-1023"
                />
              </Field>
              <Field label="Grade">
                <input
                  value={form.grade}
                  onChange={(e) => setForm({ ...form, grade: e.target.value })}
                  placeholder="e.g. 1"
                />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Institution">
                <select
                  value={form.institution_id}
                  onChange={(e) => setForm({ ...form, institution_id: e.target.value })}
                >
                  <option value="">Select…</option>
                  {institutions.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Class">
                <select
                  value={form.class_id}
                  onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {classes
                    .filter((c) => c.institution_id === form.institution_id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
