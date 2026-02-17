'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  FolderKanban,
  Calendar,
  Clock,
  CheckCircle2,
  ChevronRight,
  Search,
  X,
  Activity,
  Circle,
  DollarSign,
  Pencil,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useTodoStore } from '@/store/todoStore';
import { fetchWithCsrf } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import type { Project, ProjectStatus, CustomStatus } from '@/types/project';
import type { ProjectBudget, BudgetExpense } from '@/types/budget';
import ProjectStats from './dashboard/ProjectStats';
import type { ProjectStatsData } from './dashboard/ProjectStats';
import MilestoneTracker from './dashboard/MilestoneTracker';
import StatusWorkflowEditor from './task-detail/StatusWorkflowEditor';

// Dynamic imports for budget components
const BudgetTracker = dynamic(() => import('./BudgetTracker'), { ssr: false });
const BudgetSetupForm = dynamic(() => import('./BudgetSetupForm'), { ssr: false });

// ===================================================================
// PROJECT DASHBOARD
// Main project dashboard component with list/grid and detail views
// ===================================================================

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bgColor: string }> = {
  active: { label: 'Active', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)' },
  completed: { label: 'Completed', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' },
  archived: { label: 'Archived', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.1)' },
};

const PRIORITY_DOT_COLORS: Record<string, string> = {
  urgent: 'bg-[var(--danger)]',
  high: 'bg-[var(--warning)]',
  medium: 'bg-[var(--brand-blue)]',
  low: 'bg-[var(--text-muted)]',
};

type DetailTab = 'overview' | 'budget';

// ===================================================================
// Budget localStorage helpers
// ===================================================================

function loadBudgetFromStorage(projectId: string): ProjectBudget | null {
  try {
    const raw = localStorage.getItem(`projectBudget:${projectId}`);
    if (!raw) return null;
    return JSON.parse(raw) as ProjectBudget;
  } catch {
    return null;
  }
}

function saveBudgetToStorage(projectId: string, budget: ProjectBudget): void {
  try {
    localStorage.setItem(`projectBudget:${projectId}`, JSON.stringify(budget));
  } catch (err) {
    logger.error('Failed to save budget to localStorage', err, { component: 'ProjectDashboard' });
  }
}

interface ProjectWithTaskCount extends Project {
  task_count?: number;
  completed_count?: number;
}

interface RecentActivityItem {
  id: string;
  text: string;
  completed: boolean;
  status: string;
  priority: string;
  assigned_to?: string;
  due_date?: string;
  updated_at: string;
}

export default function ProjectDashboard() {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const storeProjects = useTodoStore((state) => state.projects);
  const setProjects = useTodoStore((state) => state.setProjects);

  const [projects, setLocalProjects] = useState<ProjectWithTaskCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    start_date: '',
    end_date: '',
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectStats, setProjectStats] = useState<ProjectStatsData | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [projectBudget, setProjectBudget] = useState<ProjectBudget | null>(null);
  const [budgetEditMode, setBudgetEditMode] = useState(false);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchWithCsrf('/api/projects');
      if (res.ok) {
        const data = await res.json();
        const projectList = data.data || [];
        setLocalProjects(projectList);
        setProjects(projectList);
      } else {
        setError('Failed to load projects. Please try again.');
      }
    } catch (err) {
      logger.error('Failed to fetch projects', err, { component: 'ProjectDashboard' });
      setError('Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [setProjects]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Close create project modal on Escape key
  useEffect(() => {
    if (!showCreateForm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCreateForm(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showCreateForm]);

  // Get recent tasks from the store
  const todos = useTodoStore((state) => state.todos);

  const filteredRecentTasks = useMemo(() => {
    if (!selectedProject) return [];
    return todos
      .filter(t => t.project_id === selectedProject.id)
      .sort((a, b) => {
        const aDate = a.updated_at || a.created_at;
        const bDate = b.updated_at || b.created_at;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      })
      .slice(0, 10)
      .map(t => ({
        id: t.id,
        text: t.text,
        completed: t.completed,
        priority: t.priority || 'medium',
        status: t.status || 'todo',
        due_date: t.due_date,
        assigned_to: t.assigned_to,
        updated_at: t.updated_at || t.created_at,
      }));
  }, [todos, selectedProject]);

  // Use API activity data if available, fall back to store data
  const recentActivity: RecentActivityItem[] = useMemo(() => {
    if (projectStats?.recent_activity && projectStats.recent_activity.length > 0) {
      return projectStats.recent_activity;
    }
    return filteredRecentTasks.map(t => ({
      ...t,
      updated_at: t.updated_at,
    }));
  }, [projectStats, filteredRecentTasks]);

  // Filter projects by search
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }, [projects, searchQuery]);

  // Get task counts per project from store
  const projectTaskCounts = useMemo(() => {
    const counts: Record<string, { total: number; completed: number }> = {};
    for (const todo of todos) {
      if (todo.project_id) {
        if (!counts[todo.project_id]) {
          counts[todo.project_id] = { total: 0, completed: 0 };
        }
        counts[todo.project_id].total++;
        if (todo.completed) {
          counts[todo.project_id].completed++;
        }
      }
    }
    return counts;
  }, [todos]);

  // Budget summaries for project cards (loaded from localStorage)
  const projectBudgetSummaries = useMemo(() => {
    const summaries: Record<string, { spent: number; total: number; pct: number }> = {};
    for (const project of projects) {
      const saved = loadBudgetFromStorage(project.id);
      if (saved && saved.total_budget > 0) {
        const totalSpent = saved.categories.reduce((s, c) => s + c.spent, 0);
        const pct = Math.round((totalSpent / saved.total_budget) * 100);
        summaries[project.id] = { spent: totalSpent, total: saved.total_budget, pct };
      }
    }
    return summaries;
  }, [projects]);

  // Create project handler
  const handleCreateProject = useCallback(async () => {
    if (!createForm.name.trim()) return;

    try {
      setCreating(true);
      const res = await fetchWithCsrf('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          description: createForm.description.trim() || null,
          color: createForm.color,
          start_date: createForm.start_date || null,
          end_date: createForm.end_date || null,
          status: 'active',
        }),
      });

      if (res.ok) {
        setCreateForm({ name: '', description: '', color: '#3b82f6', start_date: '', end_date: '' });
        setShowCreateForm(false);
        await fetchProjects();
      } else {
        setError('Failed to create project. Please try again.');
      }
    } catch (err) {
      logger.error('Failed to create project', err, { component: 'ProjectDashboard' });
      setError('Failed to create project. Please try again.');
    } finally {
      setCreating(false);
    }
  }, [createForm, fetchProjects]);

  const handleSelectProject = useCallback((project: Project) => {
    setSelectedProject(project);
    setProjectStats(null); // Reset stats when switching projects
    setDetailTab('overview');
    setBudgetEditMode(false);
    // Load budget from localStorage
    const saved = loadBudgetFromStorage(project.id);
    setProjectBudget(saved);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedProject(null);
    setProjectStats(null);
    setDetailTab('overview');
    setProjectBudget(null);
    setBudgetEditMode(false);
  }, []);

  const handleStatsLoaded = useCallback((stats: ProjectStatsData) => {
    setProjectStats(stats);
  }, []);

  // --- Budget handlers ---

  const handleSaveBudget = useCallback((budget: ProjectBudget) => {
    if (!selectedProject) return;
    saveBudgetToStorage(selectedProject.id, budget);
    setProjectBudget(budget);
    setBudgetEditMode(false);
  }, [selectedProject]);

  const handleUpdateBudget = useCallback((budget: ProjectBudget) => {
    if (!selectedProject) return;
    saveBudgetToStorage(selectedProject.id, budget);
    setProjectBudget(budget);
  }, [selectedProject]);

  const handleAddExpense = useCallback((expense: Omit<BudgetExpense, 'id' | 'created_at'>) => {
    if (!selectedProject || !projectBudget) return;

    const newExpense: BudgetExpense = {
      ...expense,
      id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      created_at: new Date().toISOString(),
    };

    // Update category spent amount
    const updatedCategories = projectBudget.categories.map(cat => {
      if (cat.id === newExpense.category_id) {
        return { ...cat, spent: cat.spent + newExpense.amount };
      }
      return cat;
    });

    const updatedBudget: ProjectBudget = {
      ...projectBudget,
      categories: updatedCategories,
      expenses: [...projectBudget.expenses, newExpense],
    };

    saveBudgetToStorage(selectedProject.id, updatedBudget);
    setProjectBudget(updatedBudget);
  }, [selectedProject, projectBudget]);

  const handleDeleteExpense = useCallback((expenseId: string) => {
    if (!selectedProject || !projectBudget) return;

    const expenseToDelete = projectBudget.expenses.find(e => e.id === expenseId);
    if (!expenseToDelete) return;

    // Update category spent amount
    const updatedCategories = projectBudget.categories.map(cat => {
      if (cat.id === expenseToDelete.category_id) {
        return { ...cat, spent: Math.max(0, cat.spent - expenseToDelete.amount) };
      }
      return cat;
    });

    const updatedBudget: ProjectBudget = {
      ...projectBudget,
      categories: updatedCategories,
      expenses: projectBudget.expenses.filter(e => e.id !== expenseId),
    };

    saveBudgetToStorage(selectedProject.id, updatedBudget);
    setProjectBudget(updatedBudget);
  }, [selectedProject, projectBudget]);

  // Save custom workflow statuses for a project
  const handleSaveCustomStatuses = useCallback(async (projectId: string, customStatuses: CustomStatus[]) => {
    try {
      const res = await fetchWithCsrf(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_statuses: customStatuses }),
      });
      if (res.ok) {
        // Update local state
        setSelectedProject(prev => prev ? { ...prev, custom_statuses: customStatuses } : prev);
        setLocalProjects(prev => prev.map(p => p.id === projectId ? { ...p, custom_statuses: customStatuses } : p));
        // Update global store so KanbanBoard picks up the change
        const updatedProjects = storeProjects.map(p => p.id === projectId ? { ...p, custom_statuses: customStatuses } : p);
        setProjects(updatedProjects);
        logger.info('Custom statuses saved', { component: 'ProjectDashboard', projectId, count: customStatuses.length });
      } else {
        setError('Failed to save custom statuses. Please try again.');
      }
    } catch (err) {
      logger.error('Failed to save custom statuses', err, { component: 'ProjectDashboard' });
      setError('Failed to save custom statuses. Please try again.');
    }
  }, [storeProjects, setProjects]);

  // Relative time formatting
  const formatRelativeTime = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Handle future dates or invalid dates gracefully
    if (diffMs < 0 || isNaN(diffMs)) return 'just now';

    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, []);

  // Color palette for project creation
  const colorOptions = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#06b6d4', '#ec4899', '#f97316',
  ];

  // =================== Loading State ===================
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  // =================== Project Detail View ===================
  if (selectedProject) {
    const statusConfig = STATUS_CONFIG[selectedProject.status];
    return (
      <div className="min-h-screen bg-[var(--background)]">
        {/* Header */}
        <div className="relative overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background: darkMode
                ? `linear-gradient(135deg, ${selectedProject.color}40 0%, ${selectedProject.color}20 50%, transparent 100%)`
                : `linear-gradient(135deg, ${selectedProject.color}30 0%, ${selectedProject.color}10 50%, transparent 100%)`,
            }}
          />
          <div className="relative max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-6 py-6 sm:py-8">
            <button
              onClick={handleBack}
              className={`
                flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg text-sm font-medium
                transition-colors
                ${darkMode
                  ? 'text-white/70 hover:text-white hover:bg-white/10'
                  : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]'
                }
              `}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Projects
            </button>

            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                style={{ backgroundColor: selectedProject.color }}
              >
                <FolderKanban className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                    darkMode ? 'text-white' : 'text-[var(--foreground)]'
                  }`}>
                    {selectedProject.name}
                  </h1>
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}
                  >
                    {statusConfig.label}
                  </span>
                </div>
                {selectedProject.description && (
                  <p className={`mt-1.5 text-sm ${
                    darkMode ? 'text-white/60' : 'text-[var(--text-muted)]'
                  }`}>
                    {selectedProject.description}
                  </p>
                )}
                {(selectedProject.start_date || selectedProject.end_date) && (
                  <div className={`flex items-center gap-2 mt-2 text-xs ${
                    darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'
                  }`}>
                    <Calendar className="w-3.5 h-3.5" />
                    {selectedProject.start_date && (
                      <span>
                        {new Date(selectedProject.start_date).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })}
                      </span>
                    )}
                    {selectedProject.start_date && selectedProject.end_date && (
                      <span>-</span>
                    )}
                    {selectedProject.end_date && (
                      <span>
                        {new Date(selectedProject.end_date).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className={`border-b ${darkMode ? 'border-white/10' : 'border-[var(--border)]'}`}>
          <div className="max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-6">
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setDetailTab('overview'); setBudgetEditMode(false); }}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${detailTab === 'overview'
                    ? `border-[var(--brand-blue)] ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`
                    : `border-transparent ${darkMode ? 'text-white/50 hover:text-white/70' : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'}`
                  }
                `}
              >
                <Activity className="w-4 h-4" />
                Overview
              </button>
              <button
                onClick={() => setDetailTab('budget')}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${detailTab === 'budget'
                    ? `border-[var(--brand-blue)] ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`
                    : `border-transparent ${darkMode ? 'text-white/50 hover:text-white/70' : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'}`
                  }
                `}
              >
                <DollarSign className="w-4 h-4" />
                Budget
                {projectBudget && (() => {
                  const totalSpent = projectBudget.categories.reduce((s, c) => s + c.spent, 0);
                  const pct = projectBudget.total_budget > 0
                    ? Math.round((totalSpent / projectBudget.total_budget) * 100)
                    : 0;
                  return (
                    <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                      pct > 80 ? 'bg-[var(--danger)]/10 text-[var(--danger)]'
                        : pct > 60 ? 'bg-[var(--warning)]/10 text-[var(--warning)]'
                        : 'bg-[var(--success)]/10 text-[var(--success)]'
                    }`}>
                      {pct}%
                    </span>
                  );
                })()}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-6 py-6 space-y-6">
          {detailTab === 'overview' && (
            <>
              {/* Stats with category/priority/assignee breakdowns */}
              <ProjectStats projectId={selectedProject.id} onStatsLoaded={handleStatsLoaded} />

              {/* Custom Status Workflow */}
              <div className={`rounded-xl border overflow-hidden shadow-sm ${
                darkMode ? 'bg-[var(--surface-2)] border-white/5' : 'bg-white border-[var(--border)]'
              }`}>
                <div className="p-5">
                  <StatusWorkflowEditor
                    statuses={selectedProject.custom_statuses || []}
                    onChange={(statuses) => handleSaveCustomStatuses(selectedProject.id, statuses)}
                    darkMode={darkMode}
                  />
                </div>
              </div>

              {/* Two-column layout: Milestones + Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Milestones */}
                <MilestoneTracker projectId={selectedProject.id} />

                {/* Recent Activity Feed */}
                <div className="rounded-xl bg-white dark:bg-[var(--surface-2)] border border-[var(--border)] dark:border-white/5 shadow-sm overflow-hidden">
                  <div className="px-5 pt-5 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-[var(--brand-blue)]/10 dark:bg-[var(--brand-sky)]/20">
                        <Activity className="w-4 h-4 text-[var(--brand-blue)] dark:text-[var(--brand-sky)]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[var(--foreground)] dark:text-white text-sm">
                          Recent Activity
                        </h3>
                        {recentActivity.length > 0 && (
                          <p className="text-xs text-[var(--text-muted)] dark:text-white/50">
                            Latest updates in this project
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="px-5 pb-5">
                    {recentActivity.length === 0 ? (
                      <div className="text-center py-8">
                        <Clock className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] dark:text-white/30" />
                        <p className="text-sm text-[var(--text-muted)] dark:text-white/50">
                          No tasks in this project yet
                        </p>
                        <p className="text-xs text-[var(--text-muted)] dark:text-white/30 mt-1">
                          Tasks will appear here as they are added
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        {recentActivity.map((item) => {
                          // Compare in local timezone: treat due_date as end-of-day local time
                          const isOverdue = !item.completed && item.due_date && new Date(item.due_date + 'T23:59:59') < new Date();
                          return (
                            <div
                              key={item.id}
                              className={`
                                flex items-start gap-3 px-3 py-2.5 rounded-lg
                                transition-colors
                                hover:bg-[var(--surface)] dark:hover:bg-white/5
                              `}
                            >
                              {/* Status icon */}
                              <div className="flex-shrink-0 mt-0.5">
                                {item.completed ? (
                                  <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                                ) : item.status === 'in_progress' ? (
                                  <Clock className="w-4 h-4 text-[var(--warning)]" />
                                ) : (
                                  <Circle className="w-4 h-4 text-[var(--text-muted)] dark:text-white/30" />
                                )}
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm truncate ${
                                    item.completed
                                      ? 'line-through text-[var(--text-muted)] dark:text-white/40'
                                      : 'text-[var(--foreground)] dark:text-white'
                                  }`}>
                                    {item.text}
                                  </span>
                                  {/* Priority dot */}
                                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                    PRIORITY_DOT_COLORS[item.priority] || PRIORITY_DOT_COLORS.medium
                                  }`} />
                                </div>

                                {/* Metadata row */}
                                <div className="flex items-center gap-3 mt-1">
                                  {item.assigned_to && (
                                    <span className="text-xs text-[var(--text-muted)] dark:text-white/40">
                                      {item.assigned_to}
                                    </span>
                                  )}
                                  {item.due_date && (
                                    <span className={`text-xs ${
                                      isOverdue
                                        ? 'text-[var(--danger)] font-medium'
                                        : 'text-[var(--text-muted)] dark:text-white/40'
                                    }`}>
                                      {isOverdue ? 'Overdue: ' : 'Due '}
                                      {new Date(item.due_date).toLocaleDateString('en-US', {
                                        month: 'short', day: 'numeric',
                                      })}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Timestamp */}
                              <span className="text-xs text-[var(--text-muted)] dark:text-white/30 flex-shrink-0 mt-0.5">
                                {formatRelativeTime(item.updated_at)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {detailTab === 'budget' && (
            <>
              {/* Budget Tab Content */}
              {!projectBudget || budgetEditMode ? (
                /* Show setup form when no budget exists or in edit mode */
                <div className={`rounded-xl border overflow-hidden shadow-sm ${
                  darkMode ? 'bg-[var(--surface-2)] border-white/5' : 'bg-white border-[var(--border)]'
                }`}>
                  <div className="p-5">
                    <BudgetSetupForm
                      projectId={selectedProject.id}
                      existingBudget={projectBudget}
                      onSave={handleSaveBudget}
                      onCancel={projectBudget ? () => setBudgetEditMode(false) : undefined}
                    />
                  </div>
                </div>
              ) : (
                /* Show budget tracker when budget exists */
                <>
                  {/* Edit Budget button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => setBudgetEditMode(true)}
                      className={`
                        flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg
                        transition-colors
                        ${darkMode
                          ? 'text-white/60 hover:text-white hover:bg-white/10 border border-white/10'
                          : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] border border-[var(--border)]'
                        }
                      `}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit Budget
                    </button>
                  </div>
                  <BudgetTracker
                    projectId={selectedProject.id}
                    budget={projectBudget}
                    onUpdateBudget={handleUpdateBudget}
                    onAddExpense={handleAddExpense}
                    onDeleteExpense={handleDeleteExpense}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // =================== Project List View ===================
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Error banner */}
      {error && (
        <div className="max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-6 pt-4">
          <div className="p-3 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/20 text-[var(--danger)] text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 hover:opacity-70">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: darkMode
              ? 'linear-gradient(135deg, var(--brand-navy) 0%, #2c5282 50%, #3b6ea8 100%)'
              : 'linear-gradient(135deg, var(--brand-navy) 0%, var(--brand-blue) 50%, var(--brand-blue-light) 100%)',
          }}
        />
        <div className="relative max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-6 py-8 sm:py-10">
          <div className="flex items-center gap-3 mb-1">
            <FolderKanban className="w-5 h-5 text-white/60" />
            <span className="text-white/60 text-sm font-medium">Research & Academic</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2">
            Projects
          </h1>
          <p className="text-white/70 text-sm">
            {projects.length} project{projects.length !== 1 ? 's' : ''} &middot;{' '}
            {projects.filter(p => p.status === 'active').length} active
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-5 sm:px-6 py-6">
        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
              darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'
            }`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className={`
                w-full pl-10 pr-4 py-2 rounded-lg text-sm
                border focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30
                ${darkMode
                  ? 'bg-[var(--surface-2)] border-white/10 text-white placeholder-white/40'
                  : 'bg-white border-[var(--border)] text-[var(--foreground)] placeholder-[var(--text-muted)]'
                }
              `}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-navy)]
              transition-colors shadow-lg shadow-[var(--brand-blue)]/20"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Project</span>
          </button>
        </div>

        {/* Project Grid */}
        {filteredProjects.length === 0 ? (
          <div className="text-center py-16">
            <motion.div
              className={`
                inline-flex p-5 rounded-2xl mb-5
                ${darkMode
                  ? 'bg-[var(--brand-blue)]/10 border border-[var(--brand-blue)]/20'
                  : 'bg-[var(--brand-blue)]/5 border border-[var(--brand-blue)]/10'
                }
              `}
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <FolderKanban className={`w-12 h-12 ${
                darkMode ? 'text-[var(--brand-blue)]/70' : 'text-[var(--brand-blue)]'
              }`} />
            </motion.div>
            <h3 className={`text-xl font-semibold mb-2 ${
              darkMode ? 'text-white' : 'text-[var(--foreground)]'
            }`}>
              {searchQuery ? 'No projects found' : 'Create your first project'}
            </h3>
            <p className={`text-sm mb-5 max-w-xs mx-auto ${
              darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'
            }`}>
              {searchQuery
                ? 'Try adjusting your search to find what you are looking for'
                : 'Organize your research tasks, grants, and courses into projects'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 px-5 py-2.5 mx-auto
                  bg-[var(--brand-blue)] text-white text-sm font-medium rounded-lg
                  hover:bg-[var(--brand-navy)] transition-colors shadow-lg shadow-[var(--brand-blue)]/20"
              >
                <Plus className="w-4 h-4" />
                Create Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProjects.map((project, index) => {
              const statusCfg = STATUS_CONFIG[project.status];
              const counts = projectTaskCounts[project.id] || { total: 0, completed: 0 };
              const completionPct = counts.total > 0
                ? Math.round((counts.completed / counts.total) * 100)
                : 0;

              return (
                <motion.button
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleSelectProject(project)}
                  className={`
                    text-left w-full rounded-xl border overflow-hidden
                    transition-all group
                    ${darkMode
                      ? 'bg-[var(--surface-2)] border-white/5 hover:border-white/15 hover:shadow-lg'
                      : 'bg-white border-[var(--border)] hover:border-[var(--brand-blue)]/30 hover:shadow-lg'
                    }
                  `}
                >
                  {/* Color bar */}
                  <div
                    className="h-1.5 w-full"
                    style={{ backgroundColor: project.color }}
                  />

                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: project.color + '20' }}
                        >
                          <FolderKanban className="w-4.5 h-4.5" style={{ color: project.color }} />
                        </div>
                        <div className="min-w-0">
                          <h3 className={`font-semibold truncate ${
                            darkMode ? 'text-white' : 'text-[var(--foreground)]'
                          }`}>
                            {project.name}
                          </h3>
                        </div>
                      </div>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-2"
                        style={{ backgroundColor: statusCfg.bgColor, color: statusCfg.color }}
                      >
                        {statusCfg.label}
                      </span>
                    </div>

                    {project.description && (
                      <p className={`text-sm line-clamp-2 mb-3 ${
                        darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'
                      }`}>
                        {project.description}
                      </p>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center gap-4">
                      <div className={`flex items-center gap-1.5 text-xs ${
                        darkMode ? 'text-white/40' : 'text-[var(--text-muted)]'
                      }`}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{counts.completed}/{counts.total} tasks</span>
                      </div>

                      {/* Completion bar */}
                      <div className="flex-1">
                        <div className={`h-1.5 rounded-full overflow-hidden ${
                          darkMode ? 'bg-white/10' : 'bg-[var(--surface-3)]'
                        }`}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${completionPct}%`,
                              backgroundColor: project.color,
                            }}
                          />
                        </div>
                      </div>

                      <span className={`text-xs font-medium ${
                        darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'
                      }`}>
                        {completionPct}%
                      </span>

                      <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${
                        darkMode ? 'text-white/20' : 'text-[var(--border)]'
                      }`} />
                    </div>

                    {/* Budget indicator */}
                    {projectBudgetSummaries[project.id] && (() => {
                      const bs = projectBudgetSummaries[project.id];
                      const budgetColor = bs.pct > 80
                        ? 'var(--danger)'
                        : bs.pct > 60
                          ? 'var(--warning)'
                          : 'var(--success)';
                      return (
                        <div className="flex items-center gap-2 mt-2.5">
                          <DollarSign className="w-3 h-3 flex-shrink-0" style={{ color: budgetColor }} />
                          <div className="flex-1">
                            <div className={`h-1 rounded-full overflow-hidden ${
                              darkMode ? 'bg-white/10' : 'bg-[var(--surface-3)]'
                            }`}>
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(bs.pct, 100)}%`,
                                  backgroundColor: budgetColor,
                                }}
                              />
                            </div>
                          </div>
                          <span className="text-xs font-medium flex-shrink-0" style={{ color: budgetColor }}>
                            {bs.pct}% spent
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <AnimatePresence>
        {showCreateForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateForm(false)}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            />
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                role="dialog"
                aria-modal="true"
                aria-label="Create new project"
                className={`
                  w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden pointer-events-auto
                  ${darkMode ? 'bg-[var(--surface)]' : 'bg-white'}
                `}
              >
                <div className={`px-6 py-4 border-b flex items-center justify-between ${
                  darkMode ? 'border-white/10' : 'border-[var(--border)]'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[var(--brand-blue)]/10">
                      <FolderKanban className="w-4 h-4 text-[var(--brand-blue)]" />
                    </div>
                    <h2 className={`text-lg font-semibold ${
                      darkMode ? 'text-white' : 'text-[var(--foreground)]'
                    }`}>
                      New Project
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    aria-label="Close create project dialog"
                    className={`p-2 rounded-lg transition-colors ${
                      darkMode ? 'hover:bg-white/10 text-white/50' : 'hover:bg-[var(--surface)] text-[var(--text-muted)]'
                    }`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${
                      darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'
                    }`}>
                      Project Name
                    </label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., NSF Grant Proposal, CHEM 301"
                      autoFocus
                      className={`
                        w-full px-4 py-3 rounded-xl text-base font-medium
                        border-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30 focus:border-[var(--brand-blue)]
                        ${darkMode
                          ? 'bg-[var(--surface-2)] border-white/10 text-white placeholder-white/30'
                          : 'bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] placeholder-[var(--text-muted)]'
                        }
                      `}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${
                      darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'
                    }`}>
                      Description
                    </label>
                    <textarea
                      value={createForm.description}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description of the project..."
                      rows={3}
                      className={`
                        w-full px-4 py-3 rounded-xl text-sm resize-none
                        border focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30
                        ${darkMode
                          ? 'bg-[var(--surface-2)] border-white/10 text-white placeholder-white/30'
                          : 'bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] placeholder-[var(--text-muted)]'
                        }
                      `}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-medium mb-2 ${
                      darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'
                    }`}>
                      Color
                    </label>
                    <div className="flex items-center gap-2">
                      {colorOptions.map((color) => (
                        <button
                          key={color}
                          onClick={() => setCreateForm(prev => ({ ...prev, color }))}
                          aria-label={`Select color ${color}`}
                          aria-pressed={createForm.color === color}
                          className={`
                            w-8 h-8 rounded-lg transition-all
                            ${createForm.color === color
                              ? 'ring-2 ring-offset-2 ring-[var(--brand-blue)] scale-110'
                              : 'hover:scale-105'
                            }
                            ${darkMode ? 'ring-offset-[var(--surface)]' : 'ring-offset-white'}
                          `}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-xs font-medium mb-1.5 ${
                        darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'
                      }`}>
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={createForm.start_date}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, start_date: e.target.value }))}
                        className={`
                          w-full px-3 py-2 rounded-lg text-sm
                          border focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30
                          ${darkMode
                            ? 'bg-[var(--surface-2)] border-white/10 text-white'
                            : 'bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)]'
                          }
                        `}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1.5 ${
                        darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'
                      }`}>
                        End Date
                      </label>
                      <input
                        type="date"
                        value={createForm.end_date}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, end_date: e.target.value }))}
                        className={`
                          w-full px-3 py-2 rounded-lg text-sm
                          border focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30
                          ${darkMode
                            ? 'bg-[var(--surface-2)] border-white/10 text-white'
                            : 'bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)]'
                          }
                        `}
                      />
                    </div>
                  </div>
                  {createForm.start_date && createForm.end_date && createForm.end_date < createForm.start_date && (
                    <p className="text-xs text-[var(--danger)]">
                      End date cannot be before start date
                    </p>
                  )}
                </div>

                <div className={`px-6 py-4 border-t flex items-center justify-end gap-3 ${
                  darkMode ? 'border-white/10 bg-[var(--surface-2)]' : 'border-[var(--border)] bg-[var(--surface)]'
                }`}>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      darkMode ? 'text-white/50 hover:text-white hover:bg-white/10' : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateProject}
                    disabled={
                      !createForm.name.trim() ||
                      creating ||
                      (!!createForm.start_date && !!createForm.end_date && createForm.end_date < createForm.start_date)
                    }
                    className="px-4 py-2 bg-[var(--brand-blue)] text-white text-sm font-medium rounded-lg
                      hover:bg-[var(--brand-navy)] disabled:opacity-50 disabled:cursor-not-allowed
                      transition-all shadow-lg shadow-[var(--brand-blue)]/20"
                  >
                    {creating ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
