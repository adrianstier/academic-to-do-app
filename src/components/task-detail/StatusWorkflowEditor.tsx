'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  Plus,
  Trash2,
  GripVertical,
  Palette,
  Check,
  ChevronDown,
  Workflow,
  X,
  RotateCcw,
} from 'lucide-react';
import type { CustomStatus, WorkflowPreset } from '@/types/project';
import {
  WORKFLOW_PRESETS,
  STATUS_COLOR_PALETTE,
  generateStatusId,
} from '@/types/project';

interface StatusWorkflowEditorProps {
  statuses: CustomStatus[];
  onChange: (statuses: CustomStatus[]) => void;
  darkMode?: boolean;
}

/**
 * StatusWorkflowEditor -- Manage custom status columns for a project.
 * Supports reordering, adding/removing statuses, color picking, and
 * loading from preset templates (Manuscript, Experiment, Grant).
 */
export default function StatusWorkflowEditor({
  statuses,
  onChange,
  darkMode = false,
}: StatusWorkflowEditorProps) {
  const [showPresets, setShowPresets] = useState(false);
  const [editingColorId, setEditingColorId] = useState<string | null>(null);
  const [newStatusName, setNewStatusName] = useState('');

  const handleReorder = useCallback(
    (reordered: CustomStatus[]) => {
      // Update order values to match new positions
      const updated = reordered.map((s, index) => ({ ...s, order: index }));
      onChange(updated);
    },
    [onChange]
  );

  const handleAdd = useCallback(() => {
    const name = newStatusName.trim();
    if (!name) return;
    const nextOrder = statuses.length;
    // Pick a color from the palette based on position
    const color = STATUS_COLOR_PALETTE[nextOrder % STATUS_COLOR_PALETTE.length];
    const newStatus: CustomStatus = {
      id: generateStatusId(name),
      name,
      color,
      order: nextOrder,
    };
    onChange([...statuses, newStatus]);
    setNewStatusName('');
  }, [newStatusName, statuses, onChange]);

  const handleRemove = useCallback(
    (id: string) => {
      if (statuses.length <= 2) return; // Minimum 2 statuses
      const filtered = statuses.filter((s) => s.id !== id);
      const reordered = filtered.map((s, index) => ({ ...s, order: index }));
      onChange(reordered);
    },
    [statuses, onChange]
  );

  const handleRename = useCallback(
    (id: string, name: string) => {
      onChange(statuses.map((s) => (s.id === id ? { ...s, name } : s)));
    },
    [statuses, onChange]
  );

  const handleColorChange = useCallback(
    (id: string, color: string) => {
      onChange(statuses.map((s) => (s.id === id ? { ...s, color } : s)));
      setEditingColorId(null);
    },
    [statuses, onChange]
  );

  const handleLoadPreset = useCallback(
    (preset: WorkflowPreset) => {
      onChange([...preset.statuses]);
      setShowPresets(false);
    },
    [onChange]
  );

  const handleClearCustom = useCallback(() => {
    onChange([]);
    setShowPresets(false);
  }, [onChange]);

  const sorted = [...statuses].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      {/* Header with preset dropdown */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-[var(--brand-blue)]" />
          <span
            className={`text-sm font-medium ${
              darkMode ? 'text-white' : 'text-[var(--foreground)]'
            }`}
          >
            Status Workflow
          </span>
          <span
            className={`text-xs ${
              darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'
            }`}
          >
            ({sorted.length} columns)
          </span>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              transition-colors border
              ${
                darkMode
                  ? 'border-white/10 text-white/60 hover:text-white hover:bg-white/5'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]'
              }
            `}
          >
            Load Preset
            <ChevronDown className={`w-3 h-3 transition-transform ${showPresets ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showPresets && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className={`
                  absolute right-0 top-full mt-1 z-50 w-64 rounded-xl shadow-xl overflow-hidden
                  border
                  ${
                    darkMode
                      ? 'bg-[var(--surface-2)] border-white/10'
                      : 'bg-white border-[var(--border)]'
                  }
                `}
              >
                {WORKFLOW_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleLoadPreset(preset)}
                    className={`
                      w-full text-left px-4 py-3 transition-colors
                      ${
                        darkMode
                          ? 'hover:bg-white/5 text-white'
                          : 'hover:bg-[var(--surface)] text-[var(--foreground)]'
                      }
                    `}
                  >
                    <div className="text-sm font-medium">{preset.name}</div>
                    <div
                      className={`text-xs mt-0.5 ${
                        darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {preset.description}
                    </div>
                    <div className="flex items-center gap-1 mt-1.5">
                      {preset.statuses.map((s) => (
                        <div
                          key={s.id}
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: s.color }}
                          title={s.name}
                        />
                      ))}
                    </div>
                  </button>
                ))}
                <div
                  className={`border-t ${
                    darkMode ? 'border-white/10' : 'border-[var(--border)]'
                  }`}
                >
                  <button
                    onClick={handleClearCustom}
                    className={`
                      w-full text-left px-4 py-3 transition-colors flex items-center gap-2
                      ${
                        darkMode
                          ? 'hover:bg-white/5 text-white/50'
                          : 'hover:bg-[var(--surface)] text-[var(--text-muted)]'
                      }
                    `}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="text-sm">Reset to Default</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Status list (reorderable) */}
      {sorted.length > 0 ? (
        <Reorder.Group
          axis="y"
          values={sorted}
          onReorder={handleReorder}
          className="space-y-2"
        >
          {sorted.map((status) => (
            <Reorder.Item
              key={status.id}
              value={status}
              className={`
                flex items-center gap-2 p-2 rounded-lg border cursor-grab active:cursor-grabbing
                transition-colors
                ${
                  darkMode
                    ? 'bg-[var(--surface-2)] border-white/5 hover:border-white/15'
                    : 'bg-white border-[var(--border)] hover:border-[var(--brand-blue)]/30'
                }
              `}
            >
              <GripVertical
                className={`w-4 h-4 flex-shrink-0 ${
                  darkMode ? 'text-white/20' : 'text-[var(--text-muted)]'
                }`}
              />

              {/* Color dot / picker */}
              <div className="relative">
                <button
                  onClick={() =>
                    setEditingColorId(editingColorId === status.id ? null : status.id)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && editingColorId === status.id) {
                      e.stopPropagation();
                      setEditingColorId(null);
                    }
                  }}
                  className="w-5 h-5 rounded-full flex-shrink-0 ring-2 ring-offset-1 transition-all hover:scale-110"
                  style={{
                    backgroundColor: status.color,
                    '--tw-ring-color': status.color,
                  } as React.CSSProperties}
                  title="Change color"
                  aria-label={`Change color for ${status.name}`}
                  aria-expanded={editingColorId === status.id}
                />

                <AnimatePresence>
                  {editingColorId === status.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className={`
                        absolute left-0 top-full mt-2 z-50 p-2 rounded-lg shadow-xl
                        border grid grid-cols-6 gap-1.5
                        ${
                          darkMode
                            ? 'bg-[var(--surface)] border-white/10'
                            : 'bg-white border-[var(--border)]'
                        }
                      `}
                    >
                      {STATUS_COLOR_PALETTE.map((color) => (
                        <button
                          key={color}
                          onClick={() => handleColorChange(status.id, color)}
                          className={`
                            w-6 h-6 rounded-full transition-all hover:scale-110
                            flex items-center justify-center
                          `}
                          style={{ backgroundColor: color }}
                        >
                          {color === status.color && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Name input */}
              <input
                type="text"
                value={status.name}
                onChange={(e) => handleRename(status.id, e.target.value)}
                aria-label={`Rename status: ${status.name}`}
                className={`
                  flex-1 min-w-0 px-2 py-1 rounded-md text-sm font-medium
                  border-transparent focus:outline-none focus:ring-1 focus:ring-[var(--brand-blue)]/30
                  bg-transparent
                  ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}
                `}
              />

              {/* Order indicator */}
              <span
                className={`text-xs tabular-nums flex-shrink-0 ${
                  darkMode ? 'text-white/20' : 'text-[var(--text-muted)]'
                }`}
              >
                {status.order + 1}
              </span>

              {/* Remove button (disabled if only 2 statuses) */}
              <button
                onClick={() => handleRemove(status.id)}
                disabled={statuses.length <= 2}
                className={`
                  p-1 rounded-md transition-colors flex-shrink-0
                  ${
                    statuses.length <= 2
                      ? 'opacity-20 cursor-not-allowed'
                      : darkMode
                        ? 'text-white/30 hover:text-red-400 hover:bg-red-900/20'
                        : 'text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50'
                  }
                `}
                title={statuses.length <= 2 ? 'Minimum 2 statuses required' : 'Remove status'}
                aria-label={`Remove status: ${status.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      ) : (
        <div
          className={`text-center py-6 rounded-lg border border-dashed ${
            darkMode
              ? 'border-white/10 text-white/40'
              : 'border-[var(--border)] text-[var(--text-muted)]'
          }`}
        >
          <Workflow className="w-6 h-6 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No custom workflow set</p>
          <p className="text-xs mt-0.5">Using default statuses (To Do, In Progress, Done)</p>
        </div>
      )}

      {/* Add new status */}
      {sorted.length > 0 && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newStatusName}
            onChange={(e) => setNewStatusName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Add status column..."
            className={`
              flex-1 px-3 py-2 rounded-lg text-sm
              border focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30
              ${
                darkMode
                  ? 'bg-[var(--surface-2)] border-white/10 text-white placeholder-white/30'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] placeholder-[var(--text-muted)]'
              }
            `}
          />
          <button
            onClick={handleAdd}
            disabled={!newStatusName.trim()}
            className={`
              p-2 rounded-lg transition-colors
              ${
                newStatusName.trim()
                  ? 'bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-navy)]'
                  : darkMode
                    ? 'bg-white/5 text-white/20'
                    : 'bg-[var(--surface)] text-[var(--text-muted)]'
              }
            `}
            title="Add status"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Visual pipeline preview */}
      {sorted.length > 0 && (
        <div className="pt-2">
          <div
            className={`text-xs mb-2 ${
              darkMode ? 'text-white/30' : 'text-[var(--text-muted)]'
            }`}
          >
            Pipeline Preview
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {sorted.map((status, index) => (
              <div key={status.id} className="flex items-center gap-1 flex-shrink-0">
                <div
                  className="px-2.5 py-1 rounded-md text-xs font-medium text-white whitespace-nowrap"
                  style={{ backgroundColor: status.color }}
                >
                  {status.name}
                </div>
                {index < sorted.length - 1 && (
                  <span
                    className={`text-xs ${
                      darkMode ? 'text-white/20' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    &rarr;
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
