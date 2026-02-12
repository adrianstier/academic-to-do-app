'use client';

import { DragOverlay } from '@dnd-kit/core';
import { Todo } from '@/types/todo';
import { CATEGORY_COLORS } from './constants';

interface CalendarDragOverlayProps {
  activeTodo: Todo | null;
}

export default function CalendarDragOverlay({ activeTodo }: CalendarDragOverlayProps) {
  const category = activeTodo?.category || 'other';

  return (
    <DragOverlay dropAnimation={null}>
      {activeTodo ? (
        <div
          className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[var(--surface)] border-2 border-[var(--accent)] shadow-2xl cursor-grabbing max-w-[260px] opacity-95"
          style={{
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.2), 0 4px 10px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className={`w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white/30 ${CATEGORY_COLORS[category]}`} />
          <span className="text-sm text-[var(--foreground)] truncate font-semibold">
            {activeTodo.text}
          </span>
        </div>
      ) : null}
    </DragOverlay>
  );
}
