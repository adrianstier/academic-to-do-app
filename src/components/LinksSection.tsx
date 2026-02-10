'use client';

import { useState } from 'react';
import {
  FileText,
  Database,
  GitBranch,
  File,
  Link as LinkIcon,
  Plus,
  X,
  ExternalLink,
} from 'lucide-react';
import type { TodoLink, TodoLinkType } from '@/types/tag';
import { LINK_TYPE_CONFIG } from '@/types/tag';

interface LinksSectionProps {
  links: TodoLink[];
  onAddLink: (url: string, label: string, type: TodoLinkType) => void;
  onRemoveLink: (linkId: string) => void;
  readOnly?: boolean;
}

const LINK_TYPE_ICONS: Record<TodoLinkType, typeof FileText> = {
  paper: FileText,
  dataset: Database,
  repo: GitBranch,
  doc: File,
  other: LinkIcon,
};

export default function LinksSection({
  links,
  onAddLink,
  onRemoveLink,
  readOnly = false,
}: LinksSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<TodoLinkType>('other');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    onAddLink(
      newUrl.trim(),
      newLabel.trim() || newUrl.trim(),
      newType
    );

    setNewUrl('');
    setNewLabel('');
    setNewType('other');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-2">
      {/* Existing links */}
      {links.length > 0 && (
        <div className="space-y-1.5">
          {links.map(link => {
            const Icon = LINK_TYPE_ICONS[link.type] || LinkIcon;
            const config = LINK_TYPE_CONFIG[link.type];

            return (
              <div
                key={link.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg
                  bg-[var(--surface-2)] border border-[var(--border)]/50
                  group transition-colors hover:border-[var(--accent)]/30"
              >
                <Icon className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-[var(--accent)] hover:underline truncate block"
                  >
                    {link.label || link.url}
                  </a>
                  <span className="text-xs text-[var(--text-muted)]">{config.label}</span>
                </div>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors opacity-0 group-hover:opacity-100"
                  aria-label={`Open ${link.label || link.url} in new tab`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => onRemoveLink(link.id)}
                    className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors opacity-0 group-hover:opacity-100"
                    aria-label={`Remove link ${link.label || link.url}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add link button / form */}
      {!readOnly && (
        <>
          {showAddForm ? (
            <form onSubmit={handleSubmit} className="space-y-2 p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]/50">
              <div>
                <label htmlFor="link-url" className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                  URL
                </label>
                <input
                  id="link-url"
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://..."
                  required
                  className="w-full px-3 py-1.5 text-sm rounded-md border
                    border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]
                    placeholder:text-[var(--text-muted)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label htmlFor="link-label" className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    Label
                  </label>
                  <input
                    id="link-label"
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Display name (optional)"
                    className="w-full px-3 py-1.5 text-sm rounded-md border
                      border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]
                      placeholder:text-[var(--text-muted)]
                      focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                <div className="w-32">
                  <label htmlFor="link-type" className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                    Type
                  </label>
                  <select
                    id="link-type"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as TodoLinkType)}
                    className="w-full px-2 py-1.5 text-sm rounded-md border
                      border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]
                      cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    {Object.entries(LINK_TYPE_CONFIG).map(([value, config]) => (
                      <option key={value} value={value}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewUrl('');
                    setNewLabel('');
                    setNewType('other');
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-md
                    bg-[var(--surface)] text-[var(--text-muted)]
                    border border-[var(--border)]
                    hover:text-[var(--foreground)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newUrl.trim()}
                  className="px-3 py-1.5 text-xs font-medium rounded-md
                    bg-[var(--accent)] text-white
                    hover:brightness-110 transition-all
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Link
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                text-[var(--text-muted)] hover:text-[var(--foreground)]
                hover:bg-[var(--surface-2)] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Reference Link
            </button>
          )}
        </>
      )}

      {/* Empty state */}
      {links.length === 0 && readOnly && (
        <p className="text-xs text-[var(--text-muted)] italic py-2">
          No reference links attached
        </p>
      )}
    </div>
  );
}
