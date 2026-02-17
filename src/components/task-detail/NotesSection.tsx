'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { FileText } from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import MarkdownToolbar from './MarkdownToolbar';
import MarkdownPreview from './MarkdownPreview';

interface NotesSectionProps {
  notes: string;
  onNotesChange: (notes: string) => void;
  onSaveNotes: () => void;
}

export default function NotesSection({ notes, onNotesChange, onSaveNotes }: NotesSectionProps) {
  const [isPreview, setIsPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize the textarea to fit its content
  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.max(ta.scrollHeight, 80)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [notes, isPreview, autoResize]);

  /**
   * Insert markdown formatting around the current selection (or at cursor).
   * If text is selected, it wraps the selection. Otherwise it inserts the
   * placeholder wrapped by the before/after markers.
   */
  const handleInsert = useCallback(
    (before: string, after: string, placeholder: string) => {
      const ta = textareaRef.current;
      if (!ta) return;

      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = ta.value.substring(start, end);
      const insertText = selected || placeholder;

      const newValue =
        ta.value.substring(0, start) +
        before +
        insertText +
        after +
        ta.value.substring(end);

      onNotesChange(newValue);

      // Restore focus and set the cursor/selection after React re-renders
      requestAnimationFrame(() => {
        ta.focus();
        if (selected) {
          // Place cursor after the inserted formatting
          const cursorPos = start + before.length + insertText.length + after.length;
          ta.setSelectionRange(cursorPos, cursorPos);
        } else {
          // Select the placeholder text so the user can type over it
          const selectStart = start + before.length;
          const selectEnd = selectStart + placeholder.length;
          ta.setSelectionRange(selectStart, selectEnd);
        }
      });
    },
    [onNotesChange],
  );

  const handleTogglePreview = useCallback(() => {
    setIsPreview((prev) => {
      // Save notes when switching to preview mode to prevent data loss
      if (!prev) {
        onSaveNotes();
      }
      return !prev;
    });
  }, [onSaveNotes]);

  return (
    <CollapsibleSection
      title="Notes"
      icon={<FileText className="w-4 h-4" />}
      defaultOpen={!!notes}
    >
      <div
        className="rounded-[var(--radius-lg)] border overflow-hidden"
        style={{ borderColor: 'var(--border)' }}
      >
        <MarkdownToolbar
          onInsert={handleInsert}
          isPreview={isPreview}
          onTogglePreview={handleTogglePreview}
        />

        {isPreview ? (
          <MarkdownPreview content={notes} />
        ) : (
          <textarea
            ref={textareaRef}
            value={notes}
            onChange={(e) => {
              onNotesChange(e.target.value);
              autoResize();
            }}
            onBlur={onSaveNotes}
            placeholder="Add notes or context... (supports **bold**, *italic*, ## headings, - lists, `code`)"
            className="w-full text-sm px-3 py-2.5 resize-none border-0 outline-none"
            style={{
              color: 'var(--foreground)',
              background: 'var(--surface)',
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '0.8125rem',
              lineHeight: '1.6',
              minHeight: '80px',
            }}
            aria-label="Task notes (markdown supported)"
          />
        )}
      </div>
    </CollapsibleSection>
  );
}
