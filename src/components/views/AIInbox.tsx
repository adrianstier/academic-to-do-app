'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox,
  Mail,
  Mic,
  FileText,
  GitMerge,
  Check,
  X,
  Pencil,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Calendar,
  Flag,
  User,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Todo, TodoPriority, Subtask, PRIORITY_CONFIG } from '@/types/todo';
import { prefersReducedMotion, DURATION } from '@/lib/animations';

// ═══════════════════════════════════════════════════════════════════════════
// AI INBOX VIEW
// A staged review area for AI-derived task items
// Users can review, edit, accept, or dismiss AI suggestions before they become tasks
// ═══════════════════════════════════════════════════════════════════════════

// Types for AI-derived items
export interface AIInboxItem {
  id: string;
  type: 'email' | 'voicemail' | 'document' | 'duplicate';
  source: {
    label: string;
    preview: string;
    receivedAt: string;
    from?: string;
  };
  proposedTask: {
    text: string;
    priority: TodoPriority;
    dueDate?: string;
    assignedTo?: string;
    subtasks?: Subtask[];
    notes?: string;
  };
  confidence: number; // 0-1 AI confidence score
  status: 'pending' | 'accepted' | 'dismissed';
  createdAt: string;
}

interface AIInboxProps {
  items: AIInboxItem[];
  users: string[];
  onAccept: (item: AIInboxItem, editedTask?: Partial<AIInboxItem['proposedTask']>) => Promise<void>;
  onDismiss: (itemId: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
  isLoading?: boolean;
}

// Category configuration
const CATEGORY_CONFIG = {
  email: {
    label: 'Parsed Emails',
    icon: Mail,
    color: 'var(--accent)',
    description: 'Tasks extracted from incoming emails',
  },
  voicemail: {
    label: 'Parsed Voicemails',
    icon: Mic,
    color: 'var(--warning)',
    description: 'Tasks extracted from voicemail transcriptions',
  },
  document: {
    label: 'Document Tasks',
    icon: FileText,
    color: 'var(--success)',
    description: 'Tasks extracted from uploaded documents',
  },
  duplicate: {
    label: 'Possible Duplicates',
    icon: GitMerge,
    color: 'var(--info)',
    description: 'Tasks that may be duplicates of existing tasks',
  },
} as const;

type CategoryType = keyof typeof CATEGORY_CONFIG;

export default function AIInbox({
  items,
  users,
  onAccept,
  onDismiss,
  onRefresh,
  isLoading = false,
}: AIInboxProps) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';

  // Track expanded categories
  const [expandedCategories, setExpandedCategories] = useState<Set<CategoryType>>(
    new Set(['email', 'voicemail', 'document', 'duplicate'])
  );

  // Track which item is being edited
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editedTask, setEditedTask] = useState<Partial<AIInboxItem['proposedTask']> | null>(null);

  // Track loading state per item
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());

  // Group items by type
  const groupedItems = useMemo(() => {
    const groups: Record<CategoryType, AIInboxItem[]> = {
      email: [],
      voicemail: [],
      document: [],
      duplicate: [],
    };

    items
      .filter(item => item.status === 'pending')
      .forEach(item => {
        if (groups[item.type]) {
          groups[item.type].push(item);
        }
      });

    return groups;
  }, [items]);

  // Total pending count
  const totalPending = useMemo(
    () => items.filter(i => i.status === 'pending').length,
    [items]
  );

  // Toggle category expansion
  const toggleCategory = useCallback((category: CategoryType) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  }, []);

  // Handle accept with optional edits
  const handleAccept = useCallback(async (item: AIInboxItem) => {
    setProcessingItems(prev => new Set(prev).add(item.id));
    try {
      const edits = editingItemId === item.id ? editedTask : undefined;
      await onAccept(item, edits || undefined);
      setEditingItemId(null);
      setEditedTask(null);
    } finally {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  }, [editingItemId, editedTask, onAccept]);

  // Handle dismiss
  const handleDismiss = useCallback(async (itemId: string) => {
    setProcessingItems(prev => new Set(prev).add(itemId));
    try {
      await onDismiss(itemId);
    } finally {
      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  }, [onDismiss]);

  // Start editing an item
  const startEditing = useCallback((item: AIInboxItem) => {
    setEditingItemId(item.id);
    setEditedTask({ ...item.proposedTask });
  }, []);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingItemId(null);
    setEditedTask(null);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header
        className={`
          flex items-center justify-between px-6 py-4 border-b flex-shrink-0
          ${darkMode ? 'border-white/10' : 'border-[var(--border)]'}
        `}
      >
        <div className="flex items-center gap-3">
          <div
            className={`
              w-10 h-10 rounded-xl flex items-center justify-center
              bg-gradient-to-br from-[var(--accent)] to-[var(--accent-dark)]
            `}
          >
            <Inbox className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
              AI Inbox
            </h1>
            <p className={`text-sm ${darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'}`}>
              {totalPending > 0
                ? `${totalPending} item${totalPending !== 1 ? 's' : ''} to review`
                : 'All caught up!'}
            </p>
          </div>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className={`
              p-2 rounded-lg transition-colors
              ${darkMode
                ? 'text-white/60 hover:text-white hover:bg-white/10'
                : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
              }
              disabled:opacity-50
            `}
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {totalPending === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full px-6 py-12">
            <motion.div
              className={`
                w-20 h-20 rounded-2xl flex items-center justify-center mb-5
                ${darkMode
                  ? 'bg-gradient-to-br from-[var(--accent)]/10 to-[var(--accent)]/5 border border-[var(--accent)]/20'
                  : 'bg-gradient-to-br from-[var(--accent)]/10 to-[var(--accent)]/5 border border-[var(--accent)]/20'}
              `}
              animate={{ y: [-3, 3, -3] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Inbox className={`w-10 h-10 ${darkMode ? 'text-[var(--accent)]/60' : 'text-[var(--accent)]'}`} />
            </motion.div>
            <h2 className={`text-xl font-semibold mb-2 ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
              All caught up!
            </h2>
            <p className={`text-sm text-center max-w-xs mb-6 ${darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'}`}>
              When AI extracts tasks from emails, voicemails, or documents, they will appear here for your review.
            </p>
            <div className={`flex flex-wrap gap-3 justify-center text-xs ${darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'}`}>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5">
                <Mail className="w-3.5 h-3.5" />
                Emails
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5">
                <Mic className="w-3.5 h-3.5" />
                Voicemails
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5">
                <FileText className="w-3.5 h-3.5" />
                Documents
              </span>
            </div>
          </div>
        ) : (
          /* Category List */
          <div className="p-4 space-y-4">
            {(Object.keys(CATEGORY_CONFIG) as CategoryType[]).map(category => {
              const categoryItems = groupedItems[category];
              const config = CATEGORY_CONFIG[category];
              const Icon = config.icon;
              const isExpanded = expandedCategories.has(category);

              if (categoryItems.length === 0) return null;

              return (
                <div key={category} className="space-y-2">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-xl
                      transition-colors
                      ${darkMode
                        ? 'bg-white/5 hover:bg-white/10'
                        : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)]'
                      }
                    `}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${config.color}20` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: config.color }} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={`font-medium ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
                        {config.label}
                      </p>
                      <p className={`text-xs ${darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'}`}>
                        {config.description}
                      </p>
                    </div>
                    <span
                      className={`
                        px-2.5 py-1 rounded-full text-sm font-medium
                        ${darkMode ? 'bg-white/10 text-white' : 'bg-[var(--surface-3)] text-[var(--foreground)]'}
                      `}
                    >
                      {categoryItems.length}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className={`w-5 h-5 ${darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'}`} />
                    ) : (
                      <ChevronRight className={`w-5 h-5 ${darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'}`} />
                    )}
                  </button>

                  {/* Category Items */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={prefersReducedMotion() ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={prefersReducedMotion() ? undefined : { opacity: 0, height: 0 }}
                        transition={{ duration: DURATION.normal }}
                        className="space-y-2 overflow-hidden"
                      >
                        {categoryItems.map(item => (
                          <AIInboxItemCard
                            key={item.id}
                            item={item}
                            users={users}
                            darkMode={darkMode}
                            isEditing={editingItemId === item.id}
                            editedTask={editingItemId === item.id ? editedTask : null}
                            isProcessing={processingItems.has(item.id)}
                            onStartEditing={() => startEditing(item)}
                            onCancelEditing={cancelEditing}
                            onEditChange={setEditedTask}
                            onAccept={() => handleAccept(item)}
                            onDismiss={() => handleDismiss(item.id)}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AI INBOX ITEM CARD
// ═══════════════════════════════════════════════════════════════════════════

interface AIInboxItemCardProps {
  item: AIInboxItem;
  users: string[];
  darkMode: boolean;
  isEditing: boolean;
  editedTask: Partial<AIInboxItem['proposedTask']> | null;
  isProcessing: boolean;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onEditChange: (task: Partial<AIInboxItem['proposedTask']> | null) => void;
  onAccept: () => void;
  onDismiss: () => void;
}

function AIInboxItemCard({
  item,
  users,
  darkMode,
  isEditing,
  editedTask,
  isProcessing,
  onStartEditing,
  onCancelEditing,
  onEditChange,
  onAccept,
  onDismiss,
}: AIInboxItemCardProps) {
  const task = isEditing && editedTask ? editedTask : item.proposedTask;
  const priorityConfig = PRIORITY_CONFIG[task.priority || 'medium'];

  return (
    <div
      className={`
        rounded-xl border overflow-hidden
        ${darkMode
          ? 'bg-white/5 border-white/10'
          : 'bg-[var(--surface)] border-[var(--border)]'
        }
        ${isProcessing ? 'opacity-60' : ''}
      `}
    >
      {/* Source Info */}
      <div
        className={`
          px-4 py-3 border-b
          ${darkMode ? 'bg-white/5 border-white/10' : 'bg-[var(--surface-2)] border-[var(--border)]'}
        `}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium truncate ${darkMode ? 'text-white/80' : 'text-[var(--foreground)]'}`}>
              {item.source.label}
            </p>
            {item.source.from && (
              <p className={`text-xs truncate ${darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'}`}>
                From: {item.source.from}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`
                px-2 py-0.5 rounded-full text-xs font-medium
                ${item.confidence >= 0.8
                  ? 'bg-green-500/20 text-green-500'
                  : item.confidence >= 0.5
                    ? 'bg-yellow-500/20 text-yellow-500'
                    : 'bg-orange-500/20 text-orange-500'
                }
              `}
            >
              {Math.round(item.confidence * 100)}% confident
            </span>
          </div>
        </div>
        <p className={`text-xs mt-2 line-clamp-2 ${darkMode ? 'text-white/40' : 'text-[var(--text-light)]'}`}>
          &ldquo;{item.source.preview}&rdquo;
        </p>
      </div>

      {/* Proposed Task */}
      <div className="p-4 space-y-3">
        {/* Task Text */}
        {isEditing ? (
          <input
            type="text"
            value={editedTask?.text || ''}
            onChange={(e) => onEditChange({ ...editedTask, text: e.target.value })}
            className={`
              w-full px-3 py-2 rounded-lg border text-sm font-medium
              ${darkMode
                ? 'bg-white/5 border-white/20 text-white focus:border-[var(--accent)]'
                : 'bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] focus:border-[var(--accent)]'
              }
            `}
            autoFocus
          />
        ) : (
          <p className={`font-medium ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
            {task.text}
          </p>
        )}

        {/* Task Metadata */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Priority */}
          {isEditing ? (
            <select
              value={editedTask?.priority || 'medium'}
              onChange={(e) => onEditChange({ ...editedTask, priority: e.target.value as TodoPriority })}
              className={`
                px-2 py-1 rounded-lg border text-xs font-medium
                ${darkMode
                  ? 'bg-white/5 border-white/10 text-white'
                  : 'bg-[var(--surface)] border-[var(--border)]'
                }
              `}
              style={{ color: PRIORITY_CONFIG[editedTask?.priority || 'medium'].color }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: `${priorityConfig.color}20`, color: priorityConfig.color }}
            >
              <Flag className="w-3 h-3" />
              {priorityConfig.label}
            </span>
          )}

          {/* Due Date */}
          {(task.dueDate || isEditing) && (
            isEditing ? (
              <input
                type="date"
                value={editedTask?.dueDate || ''}
                onChange={(e) => onEditChange({ ...editedTask, dueDate: e.target.value })}
                className={`
                  px-2 py-1 rounded-lg border text-xs
                  ${darkMode
                    ? 'bg-white/5 border-white/10 text-white'
                    : 'bg-[var(--surface)] border-[var(--border)]'
                  }
                `}
              />
            ) : (
              <span
                className={`
                  inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                  ${darkMode ? 'bg-white/10 text-white/80' : 'bg-[var(--surface-2)] text-[var(--foreground)]'}
                `}
              >
                <Calendar className="w-3 h-3" />
                {new Date(task.dueDate!).toLocaleDateString()}
              </span>
            )
          )}

          {/* Assignee */}
          {(task.assignedTo || isEditing) && (
            isEditing ? (
              <select
                value={editedTask?.assignedTo || ''}
                onChange={(e) => onEditChange({ ...editedTask, assignedTo: e.target.value || undefined })}
                className={`
                  px-2 py-1 rounded-lg border text-xs
                  ${darkMode
                    ? 'bg-white/5 border-white/10 text-white'
                    : 'bg-[var(--surface)] border-[var(--border)]'
                  }
                `}
              >
                <option value="">Unassigned</option>
                {users.map(user => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
            ) : (
              <span
                className={`
                  inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                  ${darkMode ? 'bg-white/10 text-white/80' : 'bg-[var(--surface-2)] text-[var(--foreground)]'}
                `}
              >
                <User className="w-3 h-3" />
                {task.assignedTo}
              </span>
            )
          )}

          {/* Subtasks count */}
          {task.subtasks && task.subtasks.length > 0 && (
            <span
              className={`
                inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                ${darkMode ? 'bg-white/10 text-white/80' : 'bg-[var(--surface-2)] text-[var(--foreground)]'}
              `}
            >
              {task.subtasks.length} subtask{task.subtasks.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div
        className={`
          flex items-center justify-between px-4 py-3 border-t
          ${darkMode ? 'border-white/10' : 'border-[var(--border)]'}
        `}
      >
        <button
          onClick={onDismiss}
          disabled={isProcessing}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
            transition-colors
            ${darkMode
              ? 'text-white/60 hover:text-white hover:bg-white/10'
              : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
            }
            disabled:opacity-50
          `}
        >
          <Trash2 className="w-4 h-4" />
          Dismiss
        </button>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={onCancelEditing}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium
                  ${darkMode
                    ? 'text-white/60 hover:text-white hover:bg-white/10'
                    : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
                  }
                `}
              >
                Cancel
              </button>
              <button
                onClick={onAccept}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-[var(--accent)] hover:brightness-110 disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Save & Create
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onStartEditing}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                  ${darkMode
                    ? 'text-white/80 bg-white/10 hover:bg-white/20'
                    : 'text-[var(--foreground)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)]'
                  }
                `}
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={onAccept}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-[var(--accent)] hover:brightness-110 disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Accept
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
