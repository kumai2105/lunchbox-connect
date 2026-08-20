import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  listMeals,
  saveMeal,
  setMealActive,
  uploadMealImage,
  mealImageUrl,
} from '../lib/api';
import type { MealLibraryItem } from '../lib/types';
import { Banner, Btn, Card, EmptyState, Field, Modal, PageHead, Pill, Spinner } from '../components/ui';
import { Icon } from '../components/icons';

// The Meal Library (§4). Admin creates a Meal once here and it is reusable
// everywhere (Menu, Kitchen, Classroom, Parent, Analytics). Editing appends a
// new immutable revision; archiving is a soft toggle — history is never
// destroyed.
type Draft = {
  id: string | null;
  name: string;
  ingredients: string; // comma-separated in the form
  allergens: string;
  portion: string;
  nutrition: string; // "kcal: 420, protein: 12" free-form key:value lines
  image_path: string | null;
};

const EMPTY: Draft = {
  id: null,
  name: '',
  ingredients: '',
  allergens: '',
  portion: '',
  nutrition: '',
  image_path: null,
};

function toList(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseNutrition(s: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const line of s.split(/[\n,]/)) {
    const [k, ...rest] = line.split(':');
    const key = k.trim();
    const val = rest.join(':').trim();
    if (key && val) out[key] = Number.isNaN(Number(val)) ? val : Number(val);
  }
  return out;
}

function nutritionToText(n: Record<string, unknown>): string {
  return Object.entries(n)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

export default function MealLibraryPage() {
  const [rows, setRows] = useState<MealLibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  async function reload() {
    const res = await listMeals({ includeArchived: true });
    if (res.error) setError(res.error);
    setRows(res.data ?? []);
    // resolve signed thumbnails for meals that have an image
    const t: Record<string, string> = {};
    await Promise.all(
      (res.data ?? [])
        .filter((m) => m.image_path)
        .map(async (m) => {
          const u = await mealImageUrl(m.image_path);
          if (u) t[m.id] = u;
        }),
    );
    setThumbs(t);
  }

  useEffect(() => {
    // reload() also resolves signed thumbnail URLs, so existing meal images
    // render on the FIRST load, not only after a later save/reload.
    void reload();
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? [])
      .filter((m) => (showArchived ? true : m.active))
      .filter((m) => (q ? m.name.toLowerCase().includes(q) : true));
  }, [rows, search, showArchived]);

  function openCreate() {
    setImgFile(null);
    setDraft({ ...EMPTY });
  }
  function openEdit(m: MealLibraryItem) {
    setImgFile(null);
    setDraft({
      id: m.id,
      name: m.name,
      ingredients: m.ingredients.join(', '),
      allergens: m.allergens.join(', '),
      portion: m.portion ?? '',
      nutrition: nutritionToText(m.nutrition),
      image_path: m.image_path,
    });
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError(null);

    // Upload the image FIRST (if a new one was chosen) so the whole edit is a
    // SINGLE saveMeal call = one logical revision. The upload no longer needs a
    // meal id, so there is no create-then-append double revision.
    let imagePath = draft.image_path;
    if (imgFile) {
      const up = await uploadMealImage(imgFile);
      if (up.error) {
        setBusy(false);
        setError(`Image upload failed: ${up.error}`);
        return;
      }
      imagePath = up.data;
    }

    const res = await saveMeal({
      id: draft.id,
      name: draft.name.trim(),
      ingredients: toList(draft.ingredients),
      allergens: toList(draft.allergens),
      nutrition: parseNutrition(draft.nutrition),
      portion: draft.portion.trim() || null,
      image_path: imagePath,
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDraft(null);
    setImgFile(null);
    await reload();
  }

  async function toggleArchive(m: MealLibraryItem) {
    const res = await setMealActive(m.id, !m.active);
    if (res.error) {
      setError(res.error);
      return;
    }
    await reload();
  }

  if (error && !rows) return <EmptyState text={`Could not load the Meal Library: ${error}`} />;

  return (
    <div>
      <PageHead
        title="Meal Library"
        hint="Reusable meals for the whole system — create once, use in every menu"
        actions={
          <Btn variant="brand" onClick={openCreate}>
            <Icon name="apple" size={15} /> Add meal
          </Btn>
        }
      />

      {error && <Banner kind="err">{error}</Banner>}

      <div className="toolbar">
        <div className="search-box">
          <Icon name="search" size={15} />
          <input
            placeholder="Search meals…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="check-inline">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      {!rows ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState text="No meals yet. Click “Add meal” to create the first one." />
      ) : (
        <div className="meal-grid">
          {visible.map((m) => (
            <Card key={m.id}>
              <div className="meal-card">
                <div className="meal-thumb">
                  {thumbs[m.id] ? (
                    <img src={thumbs[m.id]} alt={m.name} />
                  ) : (
                    <Icon name="utensils" size={22} />
                  )}
                </div>
                <div className="meal-body">
                  <div className="meal-title-row">
                    <b>{m.name}</b>
                    {!m.active && <Pill variant="reduced">Archived</Pill>}
                    {m.nutrition_status === 'APPROVED' && <Pill variant="free">Approved</Pill>}
                  </div>
                  {m.allergens.length > 0 && (
                    <div className="meal-allergens">
                      {m.allergens.map((a) => (
                        <Pill key={a} variant="reduced">
                          {a}
                        </Pill>
                      ))}
                    </div>
                  )}
                  {m.portion && <div className="tmc-meta">Portion: {m.portion}</div>}
                  <div className="meal-actions">
                    <Btn size="sm" onClick={() => openEdit(m)}>
                      Edit
                    </Btn>
                    <Btn size="sm" variant="ghost" onClick={() => void toggleArchive(m)}>
                      {m.active ? 'Archive' : 'Restore'}
                    </Btn>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {draft && (
        <Modal
          title={draft.id ? 'Edit meal' : 'Add meal'}
          onClose={() => setDraft(null)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Btn>
              <Btn variant="brand" onClick={onSave} disabled={busy || !draft.name.trim()}>
                {busy ? 'Saving…' : 'Save meal'}
              </Btn>
            </>
          }
        >
          <form onSubmit={onSave}>
            <Field label="Name">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Chicken Pasta"
                autoFocus
              />
            </Field>
            <Field label="Ingredients (comma-separated)">
              <input
                value={draft.ingredients}
                onChange={(e) => setDraft({ ...draft, ingredients: e.target.value })}
                placeholder="chicken, pasta, tomato"
              />
            </Field>
            <Field label="Allergens (comma-separated)">
              <input
                value={draft.allergens}
                onChange={(e) => setDraft({ ...draft, allergens: e.target.value })}
                placeholder="gluten, dairy"
              />
            </Field>
            <Field label="Portion">
              <input
                value={draft.portion}
                onChange={(e) => setDraft({ ...draft, portion: e.target.value })}
                placeholder="1 bowl"
              />
            </Field>
            <Field label="Nutrition (one per line, key: value)">
              <textarea
                rows={3}
                value={draft.nutrition}
                onChange={(e) => setDraft({ ...draft, nutrition: e.target.value })}
                placeholder={'kcal: 420\nprotein: 12'}
              />
            </Field>
            <Field label="Image">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImgFile(e.target.files?.[0] ?? null)}
              />
            </Field>
            {draft.id && (
              <p className="tmc-meta">
                Saving creates a new revision. Past meals children were served keep their original
                recipe.
              </p>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
