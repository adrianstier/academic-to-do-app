'use client';

import { FileText } from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';

interface NotesSectionProps {
  notes: string;
  onNotesChange: (notes: string) => void;
  onSaveNotes: () => void;
}

export default function NotesSection({ notes, onNotesChange, onSaveNotes }: NotesSectionProps) {
  return (
    <CollapsibleSection
      title="Notes"
      icon={<FileText className="w-4 h-4" />}
      defaultOpen={!!notes}
    >
      <textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        onBlur={onSaveNotes}
        placeholder="Add notes or context..."
        className="input-refined w-full text-sm px-3 py-2.5 text-[var(--foreground)] resize-none"
        rows={3}
        aria-label="Task notes"
      />
    </CollapsibleSection>
  );
}
