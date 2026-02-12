'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '@/components/ui/Modal';
import { MAX_ATTACHMENTS_PER_TODO } from '@/types/todo';
import type { TodoDependencyDisplay } from '@/types/todo';
import ContentToSubtasksImporter from '@/components/ContentToSubtasksImporter';
import AttachmentUpload from '@/components/AttachmentUpload';
import DependencyPicker from './DependencyPicker';
import { useTodoStore } from '@/store/todoStore';
import { fetchWithCsrf } from '@/lib/csrf';

const sectionStagger = {
  hidden: { opacity: 0, y: 4 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.04 * i, duration: 0.15 },
  }),
};

import type { TaskDetailModalProps } from './types';
import { useTaskDetailState } from './useTaskDetailState';
import TaskDetailHeader from './TaskDetailHeader';
import MetadataSection from './MetadataSection';
import RecurrenceRow from './RecurrenceRow';
import ReminderRow from './ReminderRow';
import NotesSection from './NotesSection';
import TranscriptionSection from './TranscriptionSection';
import SubtasksSection from './SubtasksSection';
import AttachmentsSection from './AttachmentsSection';
import QuickActionsBar from './QuickActionsBar';
import TaskDetailFooter from './TaskDetailFooter';

export default function TaskDetailModal({
  todo,
  isOpen,
  onClose,
  users,
  currentUserName,
  onToggle,
  onDelete,
  onAssign,
  onSetDueDate,
  onSetPriority,
  onStatusChange,
  onUpdateText,
  onUpdateNotes,
  onSetRecurrence,
  onUpdateSubtasks,
  onUpdateAttachments,
  onSetReminder,
  onDuplicate,
  onSaveAsTemplate,
}: TaskDetailModalProps) {
  const state = useTaskDetailState({
    todo,
    onUpdateText,
    onUpdateNotes,
    onUpdateSubtasks,
    onSetDueDate,
  });

  // Dependencies state
  const allTodos = useTodoStore(s => s.todos);
  const storeDeps = useTodoStore(s => s.dependencies[todo.id]);
  const setDependencies = useTodoStore(s => s.setDependencies);
  const [depsBlocks, setDepsBlocks] = useState<TodoDependencyDisplay[]>([]);
  const [depsBlockedBy, setDepsBlockedBy] = useState<TodoDependencyDisplay[]>([]);

  // Fetch dependencies when modal opens
  useEffect(() => {
    if (!isOpen) return;

    // Use cached store data if available
    if (storeDeps) {
      setDepsBlocks(storeDeps.blocks);
      setDepsBlockedBy(storeDeps.blockedBy);
    }

    // Always fetch fresh data when modal opens
    const fetchDeps = async () => {
      try {
        const res = await fetch(`/api/todos/dependencies?todoId=${todo.id}`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && json.data) {
          setDepsBlocks(json.data.blocks || []);
          setDepsBlockedBy(json.data.blockedBy || []);
          setDependencies(todo.id, {
            blocks: json.data.blocks || [],
            blockedBy: json.data.blockedBy || [],
          });
        }
      } catch {
        // Silently fail - dependencies are supplementary
      }
    };
    fetchDeps();
  }, [isOpen, todo.id, setDependencies]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddDependency = useCallback(async (blockerId: string, blockedId: string) => {
    try {
      const res = await fetchWithCsrf('/api/todos/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocker_id: blockerId, blocked_id: blockedId }),
      });
      if (!res.ok) return;

      // Re-fetch dependencies after adding
      const fetchRes = await fetch(`/api/todos/dependencies?todoId=${todo.id}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (fetchRes.ok) {
        const json = await fetchRes.json();
        if (json.success && json.data) {
          setDepsBlocks(json.data.blocks || []);
          setDepsBlockedBy(json.data.blockedBy || []);
          setDependencies(todo.id, {
            blocks: json.data.blocks || [],
            blockedBy: json.data.blockedBy || [],
          });
        }
      }
    } catch {
      // Silently fail
    }
  }, [todo.id, setDependencies]);

  const handleRemoveDependency = useCallback(async (blockerId: string, blockedId: string) => {
    try {
      const res = await fetchWithCsrf('/api/todos/dependencies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocker_id: blockerId, blocked_id: blockedId }),
      });
      if (!res.ok) return;

      // Re-fetch dependencies after removing
      const fetchRes = await fetch(`/api/todos/dependencies?todoId=${todo.id}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (fetchRes.ok) {
        const json = await fetchRes.json();
        if (json.success && json.data) {
          setDepsBlocks(json.data.blocks || []);
          setDepsBlockedBy(json.data.blockedBy || []);
          setDependencies(todo.id, {
            blocks: json.data.blocks || [],
            blockedBy: json.data.blockedBy || [],
          });
        }
      }
    } catch {
      // Silently fail
    }
  }, [todo.id, setDependencies]);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="2xl"
        title={`Task details: ${todo.text}`}
        showCloseButton={false}
        className="flex flex-col h-[92vh] sm:h-[85vh]"
      >
        {/* Header with editable title + priority border */}
        <TaskDetailHeader
          todo={todo}
          editingText={state.editingText}
          text={state.text}
          onTextChange={state.setText}
          onSaveText={state.handleSaveText}
          onCancelEdit={state.handleCancelEdit}
          onStartEdit={() => state.setEditingText(true)}
          onClose={onClose}
          canEditText={!!onUpdateText}
        />

        {/* Scrollable body with gradient fade hints */}
        <div className="relative flex-1 min-h-0">
          {/* Top fade */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-[var(--surface)] to-transparent" />

          <div className="absolute inset-0 overflow-y-auto px-4 sm:px-5 py-4 space-y-3">
            {/* Quick actions bar */}
            <QuickActionsBar
              todo={todo}
              onToggle={onToggle}
              onDuplicate={onDuplicate}
              onSaveAsTemplate={onSaveAsTemplate}
            />

            {/* Divider */}
            <div className="border-t border-[var(--border)] my-4" />

            {/* Metadata grid: Status, Priority, Due Date+Snooze, Assigned To */}
            <MetadataSection
              todo={todo}
              users={users}
              onStatusChange={onStatusChange}
              onSetPriority={onSetPriority}
              onSetDueDate={onSetDueDate}
              onAssign={onAssign}
              showSnoozeMenu={state.showSnoozeMenu}
              onToggleSnooze={() => state.setShowSnoozeMenu(!state.showSnoozeMenu)}
              onSnooze={state.handleSnooze}
            />

            {/* Recurrence */}
            {onSetRecurrence && (
              <RecurrenceRow
                todoId={todo.id}
                recurrence={todo.recurrence ?? null}
                onSetRecurrence={onSetRecurrence}
              />
            )}

            {/* Reminder */}
            {onSetReminder && (
              <ReminderRow
                todo={todo}
                onSetReminder={onSetReminder}
              />
            )}

            {/* Divider */}
            <div className="border-t border-[var(--border)] my-4" />

            {/* Notes - Visual card with staggered animation */}
            {onUpdateNotes && (
              <motion.div
                custom={0}
                initial="hidden"
                animate="visible"
                variants={sectionStagger}
                className="bg-[var(--surface-2)]/30 rounded-xl p-4 border border-[var(--border)]/50"
              >
                <NotesSection
                  notes={state.notes}
                  onNotesChange={state.setNotes}
                  onSaveNotes={state.handleSaveNotes}
                />
                {/* Transcription within notes card */}
                {todo.transcription && (
                  <div className="mt-4 pt-4 border-t border-[var(--border)]/30">
                    <TranscriptionSection transcription={todo.transcription} />
                  </div>
                )}
              </motion.div>
            )}

            {/* Subtasks - Visual card with staggered animation */}
            {onUpdateSubtasks && (
              <motion.div
                custom={1}
                initial="hidden"
                animate="visible"
                variants={sectionStagger}
                className="bg-[var(--surface-2)]/30 rounded-xl p-4 border border-[var(--border)]/50"
              >
                <SubtasksSection
                  subtasks={state.subtasks}
                  completedSubtasks={state.completedSubtasks}
                  subtaskProgress={state.subtaskProgress}
                  newSubtaskText={state.newSubtaskText}
                  onNewSubtaskTextChange={state.setNewSubtaskText}
                  onToggleSubtask={state.toggleSubtask}
                  onDeleteSubtask={state.deleteSubtask}
                  onUpdateSubtaskText={state.updateSubtaskText}
                  onAddSubtask={state.addManualSubtask}
                  onShowContentImporter={() => state.setShowContentImporter(true)}
                />
              </motion.div>
            )}

            {/* Dependencies - Visual card with staggered animation */}
            <motion.div
              custom={2}
              initial="hidden"
              animate="visible"
              variants={sectionStagger}
              className="bg-[var(--surface-2)]/30 rounded-xl p-4 border border-[var(--border)]/50"
            >
              <DependencyPicker
                todoId={todo.id}
                teamId={todo.team_id || ''}
                blocks={depsBlocks}
                blockedBy={depsBlockedBy}
                onAddDependency={handleAddDependency}
                onRemoveDependency={handleRemoveDependency}
                allTodos={allTodos.map(t => ({ id: t.id, text: t.text, status: t.status }))}
              />
            </motion.div>

            {/* Attachments - Visual card with staggered animation */}
            {onUpdateAttachments && (
              <motion.div
                custom={3}
                initial="hidden"
                animate="visible"
                variants={sectionStagger}
                className="bg-[var(--surface-2)]/30 rounded-xl p-4 border border-[var(--border)]/50"
              >
                <AttachmentsSection
                  todo={todo}
                  onUpdateAttachments={onUpdateAttachments}
                  onShowUpload={() => state.setShowAttachmentUpload(true)}
                />
              </motion.div>
            )}
          </div>

          {/* Bottom fade */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-[var(--surface)] to-transparent" />
        </div>

        {/* Footer: metadata + delete */}
        <TaskDetailFooter
          todo={todo}
          showDeleteConfirm={state.showDeleteConfirm}
          onShowDeleteConfirm={() => state.setShowDeleteConfirm(true)}
          onDelete={onDelete}
          onCancelDelete={() => state.setShowDeleteConfirm(false)}
          onClose={onClose}
        />
      </Modal>

      {/* Content to Subtasks Importer (rendered outside Modal to avoid z-index issues) */}
      {state.showContentImporter && (
        <ContentToSubtasksImporter
          onClose={() => state.setShowContentImporter(false)}
          onAddSubtasks={state.handleAddImportedSubtasks}
          parentTaskText={todo.text}
        />
      )}

      {/* Attachment Upload Modal */}
      {state.showAttachmentUpload && onUpdateAttachments && (
        <AttachmentUpload
          todoId={todo.id}
          userName={currentUserName}
          onUploadComplete={(newAttachment) => {
            const updatedAttachments = [...(todo.attachments || []), newAttachment];
            onUpdateAttachments(todo.id, updatedAttachments, true);
          }}
          onClose={() => state.setShowAttachmentUpload(false)}
          currentAttachmentCount={todo.attachments?.length || 0}
          maxAttachments={MAX_ATTACHMENTS_PER_TODO}
        />
      )}
    </>
  );
}
