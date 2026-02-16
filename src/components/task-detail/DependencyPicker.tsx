'use client';

import { useState, useRef, useEffect } from 'react';
import { Link2, X, Lock, ArrowRight, ChevronDown, Search } from 'lucide-react';
import type { TodoStatus, TodoDependencyDisplay } from '@/types/todo';
import { STATUS_CONFIG } from '@/types/todo';

interface DependencyPickerProps {
  todoId: string;
  teamId: string;
  blocks: TodoDependencyDisplay[];
  blockedBy: TodoDependencyDisplay[];
  onAddDependency: (blockerId: string, blockedId: string) => void;
  onRemoveDependency: (blockerId: string, blockedId: string) => void;
  allTodos: Array<{ id: string; text: string; status: TodoStatus }>;
}

type AddMode = 'blockedBy' | 'blocks' | null;

function StatusDot({ status }: { status: TodoStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: config.color }}
      title={config.label}
    />
  );
}

function DependencyChip({
  dep,
  direction,
  onRemove,
}: {
  dep: TodoDependencyDisplay;
  direction: 'blockedBy' | 'blocks';
  onRemove: () => void;
}) {
  const config = STATUS_CONFIG[dep.task_status] || STATUS_CONFIG.todo;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border transition-colors max-w-full"
      style={{
        backgroundColor: config.bgColor,
        borderColor: config.color + '30',
        color: config.color,
      }}
    >
      <StatusDot status={dep.task_status} />
      <span className="truncate max-w-[180px]" title={dep.task_text}>
        {dep.task_text}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/20 transition-colors flex-shrink-0"
        aria-label={`Remove dependency: ${dep.task_text}`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

export default function DependencyPicker({
  todoId,
  teamId,
  blocks,
  blockedBy,
  onAddDependency,
  onRemoveDependency,
  allTodos,
}: DependencyPickerProps) {
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!addMode) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAddMode(null);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [addMode]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (addMode && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [addMode]);

  // Get existing dependency IDs to exclude from search
  const existingDepIds = new Set<string>();
  existingDepIds.add(todoId); // Exclude self
  blocks.forEach(d => existingDepIds.add(d.blocked_id));
  blockedBy.forEach(d => existingDepIds.add(d.blocker_id));

  // Filter available todos
  const filteredTodos = allTodos.filter(t => {
    if (existingDepIds.has(t.id)) return false;
    if (!searchQuery) return true;
    return t.text.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleSelect = (selectedTodoId: string) => {
    if (addMode === 'blockedBy') {
      // The selected todo blocks our current todo
      onAddDependency(selectedTodoId, todoId);
    } else if (addMode === 'blocks') {
      // Our current todo blocks the selected todo
      onAddDependency(todoId, selectedTodoId);
    }
    setAddMode(null);
    setSearchQuery('');
  };

  const totalDeps = blocks.length + blockedBy.length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-sm font-medium text-[var(--foreground)]">
            Dependencies
          </span>
          {totalDeps > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-[var(--surface-2)] text-[var(--text-muted)]">
              {totalDeps}
            </span>
          )}
        </div>
      </div>

      {/* Blocked By section */}
      {blockedBy.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <Lock className="w-3 h-3" />
            <span>Blocked by</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {blockedBy.map(dep => (
              <DependencyChip
                key={`blockedBy-${dep.blocker_id}`}
                dep={dep}
                direction="blockedBy"
                onRemove={() => onRemoveDependency(dep.blocker_id, dep.blocked_id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Blocks section */}
      {blocks.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <ArrowRight className="w-3 h-3" />
            <span>Blocks</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {blocks.map(dep => (
              <DependencyChip
                key={`blocks-${dep.blocked_id}`}
                dep={dep}
                direction="blocks"
                onRemove={() => onRemoveDependency(dep.blocker_id, dep.blocked_id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add dependency dropdown */}
      <div className="relative" ref={dropdownRef}>
        {!addMode ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddMode('blockedBy')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                border border-dashed border-[var(--border)] text-[var(--text-muted)]
                hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              aria-label="Add a task that blocks this one"
            >
              <Lock className="w-3 h-3" />
              Add blocker
            </button>
            <button
              onClick={() => setAddMode('blocks')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                border border-dashed border-[var(--border)] text-[var(--text-muted)]
                hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              aria-label="Add a task that this one blocks"
            >
              <ArrowRight className="w-3 h-3" />
              Add blocked task
            </button>
          </div>
        ) : (
          <div className="border border-[var(--border)] rounded-lg bg-[var(--surface)] shadow-lg overflow-hidden">
            {/* Search header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setAddMode(null);
                    setSearchQuery('');
                  }
                }}
                placeholder={
                  addMode === 'blockedBy'
                    ? 'Search for a task that blocks this one...'
                    : 'Search for a task this one blocks...'
                }
                aria-label={
                  addMode === 'blockedBy'
                    ? 'Search for a blocking task'
                    : 'Search for a task to block'
                }
                className="flex-1 text-sm bg-transparent border-none outline-none text-[var(--foreground)] placeholder-[var(--text-muted)]"
              />
              <button
                onClick={() => {
                  setAddMode(null);
                  setSearchQuery('');
                }}
                className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-muted)]"
                aria-label="Close dependency search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-48 overflow-y-auto" role="listbox" aria-label="Available tasks">
              {filteredTodos.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">
                  {searchQuery ? 'No matching tasks found' : 'No available tasks'}
                </div>
              ) : (
                filteredTodos.slice(0, 20).map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleSelect(t.id)}
                    role="option"
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm
                      hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <StatusDot status={t.status} />
                    <span className="truncate text-[var(--foreground)]">{t.text}</span>
                    <span className="ml-auto text-xs text-[var(--text-muted)] flex-shrink-0">
                      {STATUS_CONFIG[t.status].label}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
