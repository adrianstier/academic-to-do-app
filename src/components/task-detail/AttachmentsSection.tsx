'use client';

import { Paperclip, Plus } from 'lucide-react';
import type { Todo, Attachment } from '@/types/todo';
import { MAX_ATTACHMENTS_PER_TODO } from '@/types/todo';
import AttachmentList from '@/components/AttachmentList';
import CollapsibleSection from './CollapsibleSection';

interface AttachmentsSectionProps {
  todo: Todo;
  currentUserName: string;
  onUpdateAttachments: (id: string, attachments: Attachment[], skipDbUpdate?: boolean) => void;
  onShowUpload: () => void;
}

export default function AttachmentsSection({
  todo,
  onUpdateAttachments,
  onShowUpload,
}: AttachmentsSectionProps) {
  const attachments = todo.attachments || [];
  const canAdd = attachments.length < MAX_ATTACHMENTS_PER_TODO;

  return (
    <CollapsibleSection
      title="Attachments"
      icon={<Paperclip className="w-4 h-4" />}
      badge={attachments.length > 0 ? `${attachments.length}/${MAX_ATTACHMENTS_PER_TODO}` : undefined}
      defaultOpen={attachments.length > 0}
      accentColor="var(--accent-gold)"
      actions={
        canAdd ? (
          <button
            onClick={onShowUpload}
            className="text-xs px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium flex items-center gap-1.5 transition-colors"
            aria-label="Add attachment"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        ) : undefined
      }
    >
      {attachments.length > 0 ? (
        <AttachmentList
          attachments={attachments}
          todoId={todo.id}
          onRemove={(attachmentId) => {
            const updated = attachments.filter(a => a.id !== attachmentId);
            onUpdateAttachments(todo.id, updated, true);
          }}
          canRemove={!todo.completed}
        />
      ) : (
        <button
          onClick={onShowUpload}
          className="w-full p-4 border-2 border-dashed border-[var(--accent-gold)]/30 rounded-[var(--radius-md)] text-center hover:border-[var(--accent-gold)]/50 hover:bg-[var(--accent-gold)]/5 transition-colors cursor-pointer"
        >
          <Paperclip className="w-5 h-5 text-[var(--accent-gold)]/50 mx-auto mb-1" />
          <p className="text-xs text-[var(--accent-gold)]/70">
            Drop files here or click to browse
          </p>
        </button>
      )}
    </CollapsibleSection>
  );
}
