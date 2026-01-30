'use client';

import { Mic } from 'lucide-react';
import { sanitizeTranscription } from '@/lib/sanitize';

interface TranscriptionSectionProps {
  transcription: string;
}

export default function TranscriptionSection({ transcription }: TranscriptionSectionProps) {
  return (
    <div
      className="p-3 rounded-[var(--radius-lg)] border border-[var(--accent)]/10 bg-[var(--accent)]/5"
      role="region"
      aria-label="Voicemail transcription"
    >
      <div className="flex items-center gap-2 mb-2">
        <Mic className="w-4 h-4 text-[var(--accent)]" aria-hidden="true" />
        <span className="text-sm font-medium text-[var(--accent)]">
          Voicemail Transcription
        </span>
      </div>
      <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">
        {sanitizeTranscription(transcription)}
      </p>
    </div>
  );
}
