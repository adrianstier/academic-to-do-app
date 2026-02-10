'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Plus, ChevronDown } from 'lucide-react';
import type { Tag } from '@/types/tag';

interface TagPickerProps {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  tags: Tag[];
  className?: string;
}

export default function TagPicker({
  selectedTagIds,
  onChange,
  tags,
  className = '',
}: TagPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedTags = tags.filter(t => selectedTagIds.includes(t.id));
  const availableTags = tags.filter(t => !selectedTagIds.includes(t.id));

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleRemoveTag = (tagId: string) => {
    onChange(selectedTagIds.filter(id => id !== tagId));
  };

  const handleAddTag = (tagId: string) => {
    onChange([...selectedTagIds, tagId]);
    if (availableTags.length <= 1) {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Selected tags and add button */}
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedTags.map(tag => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors hover:opacity-80"
            style={{
              backgroundColor: tag.color + '20',
              color: tag.color,
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: tag.color }}
              aria-hidden="true"
            />
            {tag.name}
            <button
              type="button"
              onClick={() => handleRemoveTag(tag.id)}
              className="p-0.5 rounded-sm hover:bg-black/10 transition-colors"
              aria-label={`Remove tag ${tag.name}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {availableTags.length > 0 && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
              bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)]
              hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] transition-colors"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-label="Add tag"
          >
            <Plus className="w-3 h-3" />
            Tag
            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && availableTags.length > 0 && (
        <div
          className="absolute left-0 top-full mt-1 w-48 rounded-lg shadow-lg border z-50 overflow-hidden
            bg-[var(--surface)] border-[var(--border)]"
          role="listbox"
          aria-label="Available tags"
        >
          {availableTags.map(tag => (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleAddTag(tag.id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
              role="option"
              aria-selected={false}
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: tag.color }}
                aria-hidden="true"
              />
              {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
