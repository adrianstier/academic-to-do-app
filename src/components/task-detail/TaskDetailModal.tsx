'use client';

import { Modal } from '@/components/ui/Modal';
import { MAX_ATTACHMENTS_PER_TODO } from '@/types/todo';
import ContentToSubtasksImporter from '@/components/ContentToSubtasksImporter';
import AttachmentUpload from '@/components/AttachmentUpload';

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
  onEmailCustomer,
}: TaskDetailModalProps) {
  const state = useTaskDetailState({
    todo,
    onUpdateText,
    onUpdateNotes,
    onUpdateSubtasks,
    onSetDueDate,
  });

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="lg"
        title={`Task details: ${todo.text}`}
        showCloseButton={false}
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

        {/* Scrollable body */}
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 overflow-y-auto max-h-[calc(85vh-200px)] space-y-4">
          {/* Quick actions bar */}
          <QuickActionsBar
            todo={todo}
            onToggle={onToggle}
            onDuplicate={onDuplicate}
            onSaveAsTemplate={onSaveAsTemplate}
            onEmailCustomer={onEmailCustomer}
          />

          {/* Divider */}
          <div className="h-px bg-[var(--border-subtle)]" />

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
          <div className="h-px bg-[var(--border-subtle)]" />

          {/* Notes */}
          {onUpdateNotes && (
            <NotesSection
              notes={state.notes}
              onNotesChange={state.setNotes}
              onSaveNotes={state.handleSaveNotes}
            />
          )}

          {/* Transcription */}
          {todo.transcription && (
            <TranscriptionSection transcription={todo.transcription} />
          )}

          {/* Subtasks */}
          {onUpdateSubtasks && (
            <SubtasksSection
              todoId={todo.id}
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
          )}

          {/* Attachments */}
          {onUpdateAttachments && (
            <AttachmentsSection
              todo={todo}
              currentUserName={currentUserName}
              onUpdateAttachments={onUpdateAttachments}
              onShowUpload={() => state.setShowAttachmentUpload(true)}
            />
          )}
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
