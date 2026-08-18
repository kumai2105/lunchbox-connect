import { createContext, useContext } from 'react';
import type { MenuItem, ServingNote, ServingRecord, Student } from '../../lib/types';

export interface ParentCtx {
  child: Student;
  children: Student[];
  photoUrl: string | null;
  /** Last 30 days of this child's authoritative Classroom Meal Records. */
  records: ServingRecord[];
  /** Only notes a reviewer has published are ever exposed here. */
  notes: Record<string, ServingNote>;
  /** Published menu rows for the current ISO week. */
  menu: MenuItem[];
  reload: () => Promise<void>;
}

export const ParentContext = createContext<ParentCtx | null>(null);

export function useParentData(): ParentCtx {
  const ctx = useContext(ParentContext);
  if (!ctx) throw new Error('useParentData must be used inside ParentShell');
  return ctx;
}
