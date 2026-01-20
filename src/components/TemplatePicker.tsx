'use client';

import { useState, useEffect, useCallback } from 'react';
import { useEscapeKey } from '@/hooks';
import { FileText, Plus, Trash2, Share2, Lock, X, ChevronDown, Loader2 } from 'lucide-react';
import { TaskTemplate, TodoPriority, Subtask, PRIORITY_CONFIG } from '@/types/todo';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';
import { fetchWithCsrf } from '@/lib/csrf';

interface TemplatePickerProps {
  currentUserName: string;
  users: string[];
  darkMode?: boolean;
  compact?: boolean; // Show as subtle icon button instead of full dropdown button
  isOpen?: boolean; // Optional controlled open state
  onOpenChange?: (open: boolean) => void; // Callback when open state changes
  hideTrigger?: boolean; // Hide the trigger button (for use when controlled externally)
  onSelectTemplate: (
    text: string,
    priority: TodoPriority,
    assignedTo?: string,
    subtasks?: Subtask[]
  ) => void;
}

export default function TemplatePicker({
  currentUserName,
  users,
  darkMode = true,
  compact = false,
  isOpen: controlledIsOpen,
  onOpenChange,
  hideTrigger = false,
  onSelectTemplate,
}: TemplatePickerProps) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const setIsOpen = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    }
    if (controlledIsOpen === undefined) {
      setInternalIsOpen(open);
    }
  };
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<TodoPriority>('medium');
  const [newAssignedTo, setNewAssignedTo] = useState('');
  const [newIsShared, setNewIsShared] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!currentUserName) return;
    setIsLoading(true);
    try {
      const response = await fetchWithCsrf(`/api/templates?userName=${encodeURIComponent(currentUserName)}`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      logger.error('Failed to fetch templates', error, { component: 'TemplatePicker' });
    } finally {
      setIsLoading(false);
    }
  }, [currentUserName]);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, fetchTemplates]);

  const handleSelectTemplate = (template: TaskTemplate) => {
    // Convert template subtasks to task subtasks with IDs
    const subtasks: Subtask[] = template.subtasks.map((st) => ({
      id: uuidv4(),
      text: st.text,
      completed: false,
      priority: st.priority,
      estimatedMinutes: st.estimatedMinutes,
    }));

    onSelectTemplate(
      template.description || template.name,
      template.default_priority,
      template.default_assigned_to,
      subtasks.length > 0 ? subtasks : undefined
    );

    // Log template usage
    fetchWithCsrf('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'template_used',
        user_name: currentUserName,
        details: { template_name: template.name, template_id: template.id },
      }),
    });

    setIsOpen(false);
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetchWithCsrf('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || null,
          default_priority: newPriority,
          default_assigned_to: newAssignedTo || null,
          subtasks: [],
          created_by: currentUserName,
          is_shared: newIsShared,
        }),
      });

      if (response.ok) {
        setNewName('');
        setNewDescription('');
        setNewPriority('medium');
        setNewAssignedTo('');
        setNewIsShared(false);
        setShowCreateForm(false);
        fetchTemplates();
      }
    } catch (error) {
      logger.error('Failed to create template', error, { component: 'TemplatePicker' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (template: TaskTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete template "${template.name}"?`)) return;

    try {
      await fetchWithCsrf(`/api/templates?id=${template.id}&userName=${encodeURIComponent(currentUserName)}`, {
        method: 'DELETE',
      });
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    } catch (error) {
      logger.error('Failed to delete template', error, { component: 'TemplatePicker' });
    }
  };

  // Close dropdown on Escape key
  useEscapeKey(() => setIsOpen(false), { enabled: isOpen });

  const myTemplates = templates.filter((t) => t.created_by === currentUserName);
  const sharedTemplates = templates.filter((t) => t.is_shared && t.created_by !== currentUserName);

  return (
    <div className="relative">
      {!hideTrigger && (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={compact ? 'My Templates' : undefined}
          title={compact ? 'My Templates - Create and use custom task templates' : undefined}
          className={compact
            ? `flex items-center justify-center p-2 rounded-lg transition-colors min-h-[36px] min-w-[36px] touch-manipulation ${
                darkMode
                  ? 'text-[var(--text-light)] hover:text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`
            : `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] touch-manipulation ${
                darkMode
                  ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`
          }
        >
          <FileText className={compact ? 'w-4 h-4' : 'w-4 h-4'} />
          {!compact && (
            <>
              <span>Templates</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </>
          )}
        </button>
      )}

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div
            className={`absolute left-0 top-full mt-2 w-80 rounded-xl shadow-xl border z-50 overflow-hidden ${
              darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
            }`}
          >
            {/* Header */}
            <div
              className={`px-4 py-3 border-b flex items-center justify-between ${
                darkMode ? 'border-slate-700' : 'border-slate-200'
              }`}
            >
              <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                Task Templates
              </h3>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                aria-label={showCreateForm ? 'Cancel creating template' : 'Create new template'}
                className={`p-2 rounded-lg transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center touch-manipulation ${
                  darkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                }`}
              >
                {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>

            {/* Create Form */}
            {showCreateForm && (
              <form
                onSubmit={handleCreateTemplate}
                className={`p-4 border-b ${darkMode ? 'border-slate-700' : 'border-slate-200'}`}
              >
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Template name"
                  className={`w-full px-3 py-2 rounded-lg text-sm mb-2 ${
                    darkMode
                      ? 'bg-slate-700 text-white placeholder-slate-400 border-slate-600'
                      : 'bg-slate-50 text-slate-800 placeholder-slate-400 border-slate-200'
                  } border focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20`}
                />
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Default task description (optional)"
                  rows={2}
                  className={`w-full px-3 py-2 rounded-lg text-sm mb-2 resize-none ${
                    darkMode
                      ? 'bg-slate-700 text-white placeholder-slate-400 border-slate-600'
                      : 'bg-slate-50 text-slate-800 placeholder-slate-400 border-slate-200'
                  } border focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20`}
                />
                <div className="flex gap-2 mb-2">
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TodoPriority)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                      darkMode
                        ? 'bg-slate-700 text-white border-slate-600'
                        : 'bg-slate-50 text-slate-800 border-slate-200'
                    } border focus:outline-none`}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent Priority</option>
                  </select>
                  <select
                    value={newAssignedTo}
                    onChange={(e) => setNewAssignedTo(e.target.value)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                      darkMode
                        ? 'bg-slate-700 text-white border-slate-600'
                        : 'bg-slate-50 text-slate-800 border-slate-200'
                    } border focus:outline-none`}
                  >
                    <option value="">No assignee</option>
                    {users.map((user) => (
                      <option key={user} value={user}>
                        {user}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <label
                    className={`flex items-center gap-2 text-sm cursor-pointer ${
                      darkMode ? 'text-slate-300' : 'text-slate-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={newIsShared}
                      onChange={(e) => setNewIsShared(e.target.checked)}
                      className="rounded"
                    />
                    Share with team
                  </label>
                  <button
                    type="submit"
                    disabled={!newName.trim() || isSaving}
                    className="px-4 py-2 rounded-lg bg-[#0033A0] text-white text-sm font-medium hover:bg-[#002878] disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px] touch-manipulation"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                  </button>
                </div>
              </form>
            )}

            {/* Template List */}
            <div className="max-h-64 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center">
                  <Loader2
                    className={`w-6 h-6 animate-spin mx-auto ${
                      darkMode ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  />
                </div>
              ) : templates.length === 0 ? (
                <div className={`p-8 text-center ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <div
                    className={`w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center ${
                      darkMode ? 'bg-slate-800/50' : 'bg-slate-100'
                    }`}
                  >
                    <FileText className={`w-7 h-7 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  </div>
                  <p className={`font-medium text-sm ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    No templates yet
                  </p>
                  <p className={`text-xs mt-1.5 max-w-[180px] mx-auto ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                    Save time by creating reusable task templates
                  </p>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      // Trigger create template action - users can create from task menu
                    }}
                    className={`mt-4 px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                      darkMode
                        ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" />
                      Create your first template
                    </span>
                  </button>
                </div>
              ) : (
                <>
                  {/* My Templates */}
                  {myTemplates.length > 0 && (
                    <div>
                      <div
                        className={`px-4 py-2 text-xs font-medium uppercase tracking-wide ${
                          darkMode ? 'text-slate-400 bg-slate-900/50' : 'text-slate-500 bg-slate-50'
                        }`}
                      >
                        My Templates
                      </div>
                      {myTemplates.map((template) => (
                        <TemplateItem
                          key={template.id}
                          template={template}
                          darkMode={darkMode}
                          isOwner={true}
                          onSelect={() => handleSelectTemplate(template)}
                          onDelete={(e) => handleDeleteTemplate(template, e)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Shared Templates */}
                  {sharedTemplates.length > 0 && (
                    <div>
                      <div
                        className={`px-4 py-2 text-xs font-medium uppercase tracking-wide ${
                          darkMode ? 'text-slate-400 bg-slate-900/50' : 'text-slate-500 bg-slate-50'
                        }`}
                      >
                        Shared Templates
                      </div>
                      {sharedTemplates.map((template) => (
                        <TemplateItem
                          key={template.id}
                          template={template}
                          darkMode={darkMode}
                          isOwner={false}
                          onSelect={() => handleSelectTemplate(template)}
                          onDelete={() => {}}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Template item component
function TemplateItem({
  template,
  darkMode,
  isOwner,
  onSelect,
  onDelete,
}: {
  template: TaskTemplate;
  darkMode: boolean;
  isOwner: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const priorityConfig = PRIORITY_CONFIG[template.default_priority];

  return (
    <button
      onClick={onSelect}
      className={`w-full px-4 py-3 text-left transition-all flex items-start gap-3 group border border-dashed rounded-lg opacity-75 hover:opacity-100 ${
        darkMode
          ? 'border-slate-600/60 hover:bg-slate-700/30 hover:border-slate-500'
          : 'border-slate-300/80 hover:bg-slate-50 hover:border-slate-400'
      }`}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 opacity-80"
        style={{ backgroundColor: priorityConfig.bgColor }}
      >
        <FileText className="w-4 h-4" style={{ color: priorityConfig.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            {template.name}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            darkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
          }`}>
            Template
          </span>
          {template.is_shared ? (
            <Share2 className="w-3 h-3 text-blue-500 flex-shrink-0" />
          ) : (
            <Lock className="w-3 h-3 text-slate-400 flex-shrink-0" />
          )}
        </div>
        {template.description && (
          <p className={`text-xs truncate mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {template.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ backgroundColor: priorityConfig.bgColor, color: priorityConfig.color }}
          >
            {priorityConfig.label}
          </span>
          {template.default_assigned_to && (
            <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              → {template.default_assigned_to}
            </span>
          )}
          {template.subtasks.length > 0 && (
            <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {template.subtasks.length} subtask{template.subtasks.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
      {isOwner && (
        <button
          onClick={onDelete}
          aria-label={`Delete template: ${template.name}`}
          className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity min-h-[40px] min-w-[40px] flex items-center justify-center touch-manipulation ${
            darkMode ? 'hover:bg-slate-600 text-slate-400' : 'hover:bg-slate-200 text-slate-500'
          }`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </button>
  );
}
