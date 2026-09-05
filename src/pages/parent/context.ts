import { createContext, useContext } from 'react';
import type { ServingNote, ServingRecord, Student } from '../../lib/types';
import type { DayMeal } from '../../lib/api';

export interface ParentCtx {
  child: Student;
  children: Student[];
  photoUrl: string | null;
  /** Last 30 days of this child's authoritative Classroom Meal Records. */
  records: ServingRecord[];
  /** Only notes a reviewer has published are ever exposed here. */
  notes: Record<string, ServingNote>;
  /**
   * Published Meal Services for the displayed week, keyed by real dates.
   *
   * These are dated rows from `meal_services`, not template rows from the
   * legacy `menus` table. That table was addressed by a single global
   * calendar-week number, so it could not express this institution's
   * rotation, closures or date overrides — and the helper that computed the
   * number advanced it once every seven weeks, freezing the menu.
   */
  meals: DayMeal[];
  reload: () => Promise<void>;
}

export const ParentContext = createContext<ParentCtx | null>(null);

export function useParentData(): ParentCtx {
  const ctx = useContext(ParentContext);
  if (!ctx) throw new Error('useParentData must be used inside ParentShell');
  return ctx;
}
