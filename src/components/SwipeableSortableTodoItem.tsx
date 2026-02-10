'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import SwipeableTodoItem from './SwipeableTodoItem';
import TodoItem from './TodoItem';
import { Todo, TodoPriority, TodoStatus, RecurrencePattern, Subtask, Attachment } from '@/types/todo';

/**
 * SwipeableSortableTodoItem - Combines swipe gestures (mobile) with drag-and-drop sorting
 *
 * On mobile/touch devices: Swipe left to complete, swipe right for quick actions
 * On desktop: Drag handle for reordering
 *
 * The component intelligently disables swipe while dragging to prevent conflicts.
 */

interface SwipeableSortableTodoItemProps {
  todo: Todo;
  users: string[];
  currentUserName: string;
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onAssign: (id: string, assignedTo: string | null) => void;
  onSetDueDate: (id: string, dueDate: string | null) => void;
  onSetPriority: (id: string, priority: TodoPriority) => void;
  onStatusChange?: (id: string, status: TodoStatus) => void;
  onUpdateText?: (id: string, text: string) => void;
  onDuplicate?: (todo: Todo) => void;
  onUpdateNotes?: (id: string, notes: string) => void;
  onSetRecurrence?: (id: string, recurrence: RecurrencePattern) => void;
  onUpdateSubtasks?: (id: string, subtasks: Subtask[]) => void;
  onSaveAsTemplate?: (todo: Todo) => void;
  onUpdateAttachments?: (id: string, attachments: Attachment[], skipDbUpdate?: boolean) => void;
  onSetReminder?: (id: string, reminderAt: string | null) => void;
  onEditRequest?: (todo: Todo) => void;
  isDragEnabled?: boolean;
}

export default function SwipeableSortableTodoItem({
  todo,
  isDragEnabled = true,
  onEditRequest,
  ...props
}: SwipeableSortableTodoItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id, disabled: !isDragEnabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  // When dragging, disable swipe to prevent conflicts
  const isSwipeDisabled = isDragging;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isDragging ? 'shadow-2xl' : ''}`}
    >
      {isDragEnabled && (
        <div
          {...attributes}
          {...listeners}
          className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing z-10 text-[var(--text-light)] hover:text-[var(--foreground)]"
          aria-label="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      )}
      <div className={isDragEnabled ? 'pl-7' : ''}>
        <SwipeableTodoItem
          todo={todo}
          {...props}
          onEditRequest={onEditRequest}
          disabled={isSwipeDisabled}
        >
          <TodoItem
            todo={todo}
            {...props}
          />
        </SwipeableTodoItem>
      </div>
    </div>
  );
}
