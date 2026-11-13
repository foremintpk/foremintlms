/**
 * Pure helpers for drag-and-drop ordering in the curriculum editor.
 * The client keeps a lightweight structure and sends the final order to the
 * `reorder_curriculum` RPC in one call.
 */

export interface ModuleOrder {
  id: string;
  lessonIds: string[];
}

export function arrayMove<T>(items: readonly T[], from: number, to: number): T[] {
  const copy = [...items];
  if (from < 0 || from >= copy.length) return copy;
  const [item] = copy.splice(from, 1);
  const target = Math.max(0, Math.min(to, copy.length));
  copy.splice(target, 0, item);
  return copy;
}

export function findModuleOfLesson(structure: readonly ModuleOrder[], lessonId: string): string | null {
  return structure.find((m) => m.lessonIds.includes(lessonId))?.id ?? null;
}

/** Move a lesson to `toModuleId` at `toIndex` (clamped). Returns a new structure. */
export function moveLesson(structure: readonly ModuleOrder[], lessonId: string, toModuleId: string, toIndex: number): ModuleOrder[] {
  const fromModuleId = findModuleOfLesson(structure, lessonId);
  if (!fromModuleId || !structure.some((m) => m.id === toModuleId)) return structure.map((m) => ({ ...m, lessonIds: [...m.lessonIds] }));

  if (fromModuleId === toModuleId) {
    return structure.map((m) => {
      if (m.id !== toModuleId) return { ...m, lessonIds: [...m.lessonIds] };
      const from = m.lessonIds.indexOf(lessonId);
      return { ...m, lessonIds: arrayMove(m.lessonIds, from, toIndex) };
    });
  }

  return structure.map((m) => {
    if (m.id === fromModuleId) return { ...m, lessonIds: m.lessonIds.filter((id) => id !== lessonId) };
    if (m.id === toModuleId) {
      const next = [...m.lessonIds];
      next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, lessonId);
      return { ...m, lessonIds: next };
    }
    return { ...m, lessonIds: [...m.lessonIds] };
  });
}

export function moveModule(structure: readonly ModuleOrder[], moduleId: string, toIndex: number): ModuleOrder[] {
  const from = structure.findIndex((m) => m.id === moduleId);
  return arrayMove(
    structure.map((m) => ({ ...m, lessonIds: [...m.lessonIds] })),
    from,
    toIndex,
  );
}

/** Payload for public.reorder_curriculum. */
export function toReorderPayload(structure: readonly ModuleOrder[]): { id: string; lessons: string[] }[] {
  return structure.map((m) => ({ id: m.id, lessons: [...m.lessonIds] }));
}

export function sameOrder(a: readonly ModuleOrder[], b: readonly ModuleOrder[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((m, i) => m.id === b[i].id && m.lessonIds.length === b[i].lessonIds.length && m.lessonIds.every((l, j) => l === b[i].lessonIds[j]));
}
