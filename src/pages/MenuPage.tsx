import { Icon } from '../components/icons';
import { useEffect, useState } from 'react';
import { listMenu, menuWeeks, publishMenuWeek, saveMenuItem } from '../lib/api';
import type { AppPeriod, MenuItem } from '../lib/types';
import { Btn, Banner, Card, Field, Modal, PageHead, Spinner } from '../components/ui';
import { WEEKDAY_NAMES } from '../lib/format';
import { can } from '../lib/rbac';
import { useRole } from '../lib/auth';

const PERIODS: AppPeriod[] = ['breakfast', 'snack', 'lunch', 'afternoon_snack'];
const PERIOD_LABEL: Record<AppPeriod, string> = {
  breakfast: 'Breakfast',
  snack: 'Snack',
  lunch: 'Lunch',
  afternoon_snack: 'Afternoon snack',
};

interface MenuUploadRow {
  week_number: number;
  weekday: number;
  period: AppPeriod;
  dish_name: string;
}

export default function MenuPage() {
  const role = useRole();
  const canEdit = can(role, 'menu', 'create');
  const canPublish = can(role, 'menu', 'publish');


  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [rows, setRows] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<{
    week: number;
    weekday: number;
    period: AppPeriod;
    dish: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  // The weeks that actually exist in the menu table, not four derived from
  // today's calendar week. See menuWeeks() for why.
  const [weeks, setWeeks] = useState<number[]>([]);

  useEffect(() => {
    let active = true;
    void menuWeeks().then((res) => {
      if (!active) return;
      const w = res.data ?? [];
      setWeeks(w);
      setSelectedWeek((prev) => prev ?? w[0] ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (weeks.length === 0) return;
    let active = true;
    void listMenu(weeks).then((res) => {
      if (!active) return;
      if (res.error) setError(res.error);
      setRows(res.data ?? []);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dishFor = (week: number, weekday: number, period: AppPeriod): MenuItem | undefined =>
    rows?.find((r) => r.week_number === week && r.weekday === weekday && r.period === period);

  async function saveDish() {
    if (!editing) return;
    setBusy(true);
    const res = await saveMenuItem({
      week_number: editing.week,
      weekday: editing.weekday,
      period: editing.period,
      dish_name: editing.dish.trim(),
    });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      setEditing(null);
      return;
    }
    setRows((prev) => {
      const next = (prev ?? []).filter(
        (r) =>
          !(
            r.week_number === editing.week &&
            r.weekday === editing.weekday &&
            r.period === editing.period
          ),
      );
      return res.data ? [...next, res.data] : next;
    });
    setEditing(null);
  }

  async function publish() {
    if (selectedWeek === null) return;
    setBusy(true);
    const res = await publishMenuWeek(selectedWeek);
    setBusy(false);
    setPublishMsg(res.error ?? `Week ${selectedWeek} published to families.`);
    if (!res.error) {
      setRows((prev) =>
        (prev ?? []).map((r) => (r.week_number === selectedWeek ? { ...r, published: true } : r)),
      );
    }
  }

  function onUploadFile(file: File) {
    void file.text().then((text) => {
      try {
        const parsed = JSON.parse(text) as { menus?: MenuUploadRow[]; items?: MenuUploadRow[] };
        const items = parsed.menus ?? parsed.items ?? [];
        if (!Array.isArray(items) || items.length === 0) throw new Error('no menu rows in file');
        void Promise.all(items.map((row) => saveMenuItem({ ...row, allergens: [] }))).then(
          (results) => {
            if (results.some((r) => r.error)) {
              setUploadMsg(`Upload completed with errors: ${results.find((r) => r.error)?.error}`);
              return;
            }
            const saved = results.map((r) => r.data!).filter(Boolean) as MenuItem[];
            setRows((prev) => [...(prev ?? []), ...saved]);
            setUploadMsg(`Imported ${items.length} menu item${items.length === 1 ? '' : 's'}.`);
          },
        );
      } catch (err) {
        setUploadMsg(err instanceof Error ? err.message : 'invalid file');
      }
    });
  }

  return (
    <div>
      <PageHead
        title="4-week menu"
        hint="single source of truth — every institution reads from here"
        actions={
          canEdit ? (
            <label className="btn ghost">
              Upload menu
              <input
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && onUploadFile(e.target.files[0])}
              />
            </label>
          ) : undefined
        }
      />

      {/*
        This screen still edits the legacy `menus` table, while Kitchen,
        Classroom and Parent now read dated `meal_services`. Saving here does
        NOT reach families until the schedule is republished. Saying so is the
        whole point: a screen that looks like it publishes, but doesn't, is
        exactly the kind of dead control the doctrine forbids.
      */}
      <Banner kind="info">
        Changes saved here update the master menu only. Kitchen, Classroom and Parent read the
        published dated schedule, so they will not change until the schedule is republished. The
        Calendar screen that does this is not built yet.
      </Banner>
      {error && <Banner kind="err">{error}</Banner>}
      {publishMsg && (
        <Banner kind={publishMsg.startsWith('Week') ? 'info' : 'err'}>{publishMsg}</Banner>
      )}
      {uploadMsg && <Banner kind="info">{uploadMsg}</Banner>}

      <Card
        title="Menu grid"
        hint="click a dish to edit (super admin)"
        actions={
          <>
            <div className="week-tabs">
              {weeks.map((w) => (
                <button
                  key={w}
                  className={`week-tab${w === selectedWeek ? ' active' : ''}`}
                  onClick={() => setSelectedWeek(w)}
                >
                  Week {w}
                </button>
              ))}
            </div>
            {canPublish && (
              <Btn variant="brand" onClick={() => void publish()} disabled={busy}>
                Publish week
              </Btn>
            )}
          </>
        }
      >
        {!rows ? (
          <Spinner />
        ) : (
          <div className="menu-grid">
            {WEEKDAY_NAMES.map((day, weekday) => {
              const date = new Date();
              const monday = new Date(date);
              monday.setDate(date.getDate() - ((date.getDay() + 6) % 7) + weekday);
              return (
                <div className="menu-day" key={day}>
                  <div className="day">
                    {day}
                    <small>{monday.getDate()}</small>
                  </div>
                  {PERIODS.map((period) => {
                    const item = selectedWeek === null ? undefined : dishFor(selectedWeek, weekday, period);
                    return (
                      <button
                        key={period}
                        className={`btn meal ${period === 'breakfast' ? 'bf' : period === 'lunch' ? 'lu' : 'emit'}`}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          display: item ? undefined : 'block',
                        }}
                        onClick={() =>
                          canEdit &&
                          selectedWeek !== null &&
                          setEditing({
                            week: selectedWeek,
                            weekday,
                            period,
                            dish: item?.dish_name ?? '',
                          })
                        }
                        disabled={!canEdit}
                      >
                        <b>
                          {PERIOD_LABEL[period]}
                          {item?.published ? (
                            <>
                              {' '}
                              <Icon name="checkCircle" size={11} />
                            </>
                          ) : null}
                        </b>
                        {item?.dish_name ?? '— add meal'}
                        {item?.portion ? ` · ${item.portion}` : ''}
                        {item?.allergens?.length ? (
                          <span className="meal-allergens">
                            {' '}
                            · allergens: {item.allergens.join(', ')}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {editing && (
        <Modal
          title={`Edit ${PERIOD_LABEL[editing.period]} · ${WEEKDAY_NAMES[editing.weekday]} · Week ${editing.week}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Btn>
              <Btn
                variant="brand"
                onClick={() => void saveDish()}
                disabled={busy || !editing.dish.trim()}
              >
                {busy ? 'Saving…' : 'Save dish'}
              </Btn>
            </>
          }
        >
          <Field label="Dish name">
            <textarea
              value={editing.dish}
              onChange={(e) => setEditing({ ...editing, dish: e.target.value })}
              rows={3}
              autoFocus
            />
          </Field>
        </Modal>
      )}

      <Banner kind="warn">
        Kitchen production math, dispatch/delivery states and report KPIs are <b>NOT_YET_DEFINED</b>{' '}
        in the spec — this menu editor works; production stays an honest shell.
      </Banner>
    </div>
  );
}
