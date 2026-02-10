'use client';

import { memo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { listItemVariants, prefersReducedMotion, DURATION } from '@/lib/animations';
import { Todo, SortOption } from '@/types/todo';
import SortableTodoItem from '../SortableTodoItem';
import KanbanBoard from '../KanbanBoard';
import TaskSections from '../TaskSections';
import EmptyState from '../EmptyState';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface TodoListContentProps {
  todos: Todo[];
  users: string[];
  currentUserName: string;
  viewMode: 'list' | 'kanban';
  useSectionedView: boolean;
  shouldUseSections: boolean;
  sortOption: SortOption;
  darkMode: boolean;

  // Selection
  selectedTodos: Set<string>;
  showBulkActions: boolean;

  // Filters for empty state
  searchQuery: string;
  quickFilter: string;
  stats: { total: number; completed: number };

  // Handlers
  onDragEnd: (event: DragEndEvent) => void;
  onSelectTodo: (id: string) => void;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onAssign: (id: string, user: string | null) => void;
  onSetDueDate: (id: string, date: string | null) => void;
  onSetReminder: (id: string, date: string | null) => void;
  onSetPriority: (id: string, priority: 'low' | 'medium' | 'high' | 'urgent') => void;
  onStatusChange: (id: string, status: 'todo' | 'in_progress' | 'done') => void;
  onUpdateText: (id: string, text: string) => void;
  onDuplicate: (todo: Todo) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onSetRecurrence: (id: string, recurrence: 'daily' | 'weekly' | 'monthly' | null) => void;
  onUpdateSubtasks: (id: string, subtasks: { id: string; text: string; completed: boolean }[]) => void;
  onUpdateAttachments: (id: string, attachments: unknown[]) => void;
  onSaveAsTemplate: (todo: Todo) => void;
  onClearSearch: () => void;
  onAddTask: () => void;
}

function TodoListContent({
  todos,
  users,
  currentUserName,
  viewMode,
  useSectionedView,
  shouldUseSections,
  sortOption,
  darkMode,
  selectedTodos,
  showBulkActions,
  searchQuery,
  quickFilter,
  stats,
  onDragEnd,
  onSelectTodo,
  onToggle,
  onDelete,
  onAssign,
  onSetDueDate,
  onSetReminder,
  onSetPriority,
  onStatusChange,
  onUpdateText,
  onDuplicate,
  onUpdateNotes,
  onSetRecurrence,
  onUpdateSubtasks,
  onUpdateAttachments,
  onSaveAsTemplate,
  onClearSearch,
  onAddTask,
}: TodoListContentProps) {
  // DnD sensors for drag-and-drop reordering
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const isDragEnabled = !showBulkActions && sortOption === 'custom';

  // Determine empty state variant
  const getEmptyStateVariant = () => {
    if (searchQuery) return 'no-results';
    if (quickFilter === 'due_today') return 'no-due-today';
    if (quickFilter === 'overdue') return 'no-overdue';
    if (stats.total === 0) return 'no-tasks';
    if (stats.completed === stats.total && stats.total > 0) return 'all-done';
    return 'no-tasks';
  };

  const renderEmptyState = () => (
    <motion.div
      key="empty-state"
      initial={prefersReducedMotion() ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DURATION.fast }}
    >
      <EmptyState
        variant={getEmptyStateVariant()}
        darkMode={darkMode}
        searchQuery={searchQuery}
        onAddTask={onAddTask}
        onClearSearch={onClearSearch}
        userName={currentUserName}
      />
    </motion.div>
  );

  const renderTodoItem = (todo: Todo, index: number): ReactNode => (
    <motion.div
      key={todo.id}
      layout={!prefersReducedMotion()}
      variants={prefersReducedMotion() ? undefined : listItemVariants}
      initial={prefersReducedMotion() ? false : 'hidden'}
      animate="visible"
      exit="exit"
      transition={{
        layout: { type: 'spring', stiffness: 350, damping: 25 },
        delay: Math.min(index * 0.02, 0.1),
      }}
    >
      <SortableTodoItem
        todo={todo}
        users={users}
        currentUserName={currentUserName}
        selected={selectedTodos.has(todo.id)}
        onSelect={showBulkActions ? onSelectTodo : undefined}
        onToggle={onToggle}
        onDelete={onDelete}
        onAssign={onAssign}
        onSetDueDate={onSetDueDate}
        onSetReminder={onSetReminder}
        onSetPriority={onSetPriority}
        onStatusChange={onStatusChange}
        onUpdateText={onUpdateText}
        onDuplicate={onDuplicate}
        onUpdateNotes={onUpdateNotes}
        onSetRecurrence={onSetRecurrence}
        onUpdateSubtasks={onUpdateSubtasks}
        onUpdateAttachments={onUpdateAttachments}
        onSaveAsTemplate={onSaveAsTemplate}
        isDragEnabled={isDragEnabled}
      />
    </motion.div>
  );

  // Generate status message for screen readers
  const getStatusMessage = () => {
    if (todos.length === 0) {
      if (searchQuery) return `No tasks found for "${searchQuery}"`;
      return 'No tasks to display';
    }
    const taskWord = todos.length === 1 ? 'task' : 'tasks';
    if (searchQuery) {
      return `Showing ${todos.length} ${taskWord} matching "${searchQuery}"`;
    }
    if (quickFilter && quickFilter !== 'all') {
      return `Showing ${todos.length} ${taskWord}`;
    }
    return `${todos.length} ${taskWord} in list`;
  };

  return (
    <>
      {/* Screen reader status announcement for task list changes */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {getStatusMessage()}
      </div>

      <AnimatePresence mode="wait" initial={false}>
      {viewMode === 'list' ? (
        <motion.div
          key="list-view"
          initial={prefersReducedMotion() ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion() ? undefined : { opacity: 0, y: -10 }}
          transition={{ duration: DURATION.fast }}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={todos.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {/* Render sectioned view or flat list based on toggle */}
              {useSectionedView && shouldUseSections ? (
                <TaskSections
                  todos={todos}
                  users={users}
                  currentUserName={currentUserName}
                  selectedTodos={selectedTodos}
                  showBulkActions={showBulkActions}
                  onSelectTodo={showBulkActions ? onSelectTodo : undefined}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onAssign={onAssign}
                  onSetDueDate={onSetDueDate}
                  onSetReminder={onSetReminder}
                  onSetPriority={onSetPriority}
                  onStatusChange={onStatusChange}
                  onUpdateText={onUpdateText}
                  onDuplicate={onDuplicate}
                  onUpdateNotes={onUpdateNotes}
                  onSetRecurrence={onSetRecurrence}
                  onUpdateSubtasks={onUpdateSubtasks}
                  onUpdateAttachments={onUpdateAttachments}
                  onSaveAsTemplate={onSaveAsTemplate}
                  isDragEnabled={isDragEnabled}
                  renderTodoItem={renderTodoItem}
                  emptyState={renderEmptyState()}
                />
              ) : (
                /* Flat list view (original behavior) */
                <div className="space-y-2" role="list" aria-label="Task list">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {todos.length === 0 ? (
                      renderEmptyState()
                    ) : (
                      todos.map((todo, index) => renderTodoItem(todo, index))
                    )}
                  </AnimatePresence>
                </div>
              )}
            </SortableContext>
          </DndContext>
        </motion.div>
      ) : (
        <motion.div
          key="kanban-view"
          initial={prefersReducedMotion() ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion() ? undefined : { opacity: 0, y: -10 }}
          transition={{ duration: DURATION.fast }}
        >
          <KanbanBoard
            todos={todos}
            users={users}
            darkMode={darkMode}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
            onAssign={onAssign}
            onSetDueDate={onSetDueDate}
            onSetReminder={onSetReminder}
            onSetPriority={onSetPriority}
            onUpdateNotes={onUpdateNotes}
            onUpdateText={onUpdateText}
            onUpdateSubtasks={onUpdateSubtasks}
            onToggle={onToggle}
            onDuplicate={onDuplicate}
            onSetRecurrence={onSetRecurrence}
            onUpdateAttachments={onUpdateAttachments}
            onSaveAsTemplate={onSaveAsTemplate}
            showBulkActions={showBulkActions}
            selectedTodos={selectedTodos}
            onSelectTodo={onSelectTodo}
            useSectionedView={useSectionedView}
          />
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}

export default memo(TodoListContent);
