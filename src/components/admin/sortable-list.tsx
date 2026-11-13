"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

function SortableRow({ id, children, disabled }: { id: string; children: React.ReactNode; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 border-b bg-card px-2 py-2 last:border-0 sm:px-3",
        isDragging && "relative z-10 rounded-lg shadow-raised",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        disabled={disabled}
        className="grid size-8 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

/**
 * Drag-and-drop (and keyboard: space, arrows, space) reordering. Calls
 * `onReorder` with the new id order; the parent persists it.
 */
export function SortableList<T extends { id: string }>({
  items,
  renderItem,
  onReorder,
  disabled,
  className,
}: {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  onReorder: (orderedIds: string[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  // Local order follows the server list until the user drags; a new list
  // from the server (different ids/order) replaces any local order.
  const itemsKey = items.map((i) => i.id).join(",");
  const [local, setLocal] = useState({ key: itemsKey, order: items.map((i) => i.id) });
  const order = local.key === itemsKey ? local.order : items.map((i) => i.id);
  const setOrder = (next: string[]) => setLocal({ key: itemsKey, order: next });
  const byId = new Map(items.map((i) => [i.id, i]));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setOrder(next);
    onReorder(next);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ul className={cn("overflow-hidden rounded-2xl border bg-card", className)}>
          {order.map((id, index) => {
            const item = byId.get(id);
            if (!item) return null;
            return (
              <SortableRow key={id} id={id} disabled={disabled}>
                {renderItem(item, index)}
              </SortableRow>
            );
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
