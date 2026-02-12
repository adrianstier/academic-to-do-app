'use client';

import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Code,
  Link,
  Eye,
  Pencil,
} from 'lucide-react';

interface MarkdownToolbarProps {
  onInsert: (before: string, after: string, placeholder: string) => void;
  isPreview: boolean;
  onTogglePreview: () => void;
}

const toolbarButtons = [
  { label: 'Bold', icon: Bold, before: '**', after: '**', placeholder: 'bold text' },
  { label: 'Italic', icon: Italic, before: '*', after: '*', placeholder: 'italic text' },
  { label: 'Heading', icon: Heading2, before: '## ', after: '', placeholder: 'heading' },
  { label: 'Bullet list', icon: List, before: '- ', after: '', placeholder: 'list item' },
  { label: 'Numbered list', icon: ListOrdered, before: '1. ', after: '', placeholder: 'list item' },
  { label: 'Code', icon: Code, before: '`', after: '`', placeholder: 'code' },
  { label: 'Link', icon: Link, before: '[', after: '](url)', placeholder: 'link text' },
] as const;

export default function MarkdownToolbar({
  onInsert,
  isPreview,
  onTogglePreview,
}: MarkdownToolbarProps) {
  return (
    <div
      className="flex items-center gap-0.5 px-1.5 py-1 border-b"
      style={{ borderColor: 'var(--border-subtle)' }}
      role="toolbar"
      aria-label="Markdown formatting"
    >
      {toolbarButtons.map((btn) => {
        const Icon = btn.icon;
        return (
          <button
            key={btn.label}
            type="button"
            onClick={() => onInsert(btn.before, btn.after, btn.placeholder)}
            disabled={isPreview}
            className="flex items-center justify-center rounded-[var(--radius-sm)] transition-colors btn-icon-tiny"
            style={{
              width: '28px',
              height: '28px',
              color: isPreview ? 'var(--text-light)' : 'var(--text-muted)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!isPreview) {
                e.currentTarget.style.background = 'var(--surface-2)';
                e.currentTarget.style.color = 'var(--foreground)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = isPreview ? 'var(--text-light)' : 'var(--text-muted)';
            }}
            aria-label={btn.label}
            title={btn.label}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Preview / Edit toggle */}
      <button
        type="button"
        onClick={onTogglePreview}
        className="flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-colors btn-icon-tiny"
        style={{
          color: isPreview ? 'var(--accent)' : 'var(--text-muted)',
          background: isPreview ? 'var(--accent-light)' : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!isPreview) {
            e.currentTarget.style.background = 'var(--surface-2)';
            e.currentTarget.style.color = 'var(--foreground)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isPreview ? 'var(--accent-light)' : 'transparent';
          e.currentTarget.style.color = isPreview ? 'var(--accent)' : 'var(--text-muted)';
        }}
        aria-label={isPreview ? 'Switch to edit mode' : 'Switch to preview mode'}
        title={isPreview ? 'Edit' : 'Preview'}
      >
        {isPreview ? (
          <>
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </>
        ) : (
          <>
            <Eye className="w-3.5 h-3.5" />
            Preview
          </>
        )}
      </button>
    </div>
  );
}
