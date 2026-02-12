/**
 * Project Types for Academic Task Management
 *
 * Projects allow grouping tasks by research project, grant, course, etc.
 * Each project belongs to a team and supports lifecycle tracking.
 */

export type ProjectStatus = 'active' | 'archived' | 'completed';

/**
 * A single status column in a project's custom workflow.
 * Maps to a column in the Kanban board when that project is selected.
 */
export interface CustomStatus {
  id: string;
  name: string;
  color: string;
  order: number;
}

export interface Project {
  id: string;
  team_id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  status: ProjectStatus;
  pi_id?: string; // Principal Investigator
  start_date?: string;
  end_date?: string;
  custom_statuses?: CustomStatus[]; // Custom workflow columns for Kanban
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  status?: ProjectStatus;
  pi_id?: string;
  start_date?: string;
  end_date?: string;
  custom_statuses?: CustomStatus[];
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  status?: ProjectStatus;
  pi_id?: string;
  start_date?: string;
  end_date?: string;
  custom_statuses?: CustomStatus[];
}

export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bgColor: string }> = {
  active: { label: 'Active', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)' },
  completed: { label: 'Completed', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' },
  archived: { label: 'Archived', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.1)' },
};

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  target_date?: string;
  completed: boolean;
  display_order: number;
  created_at: string;
}

export const DEFAULT_PROJECT_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#f97316', // Orange
];

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM STATUS WORKFLOWS
// Default and preset workflows for academic projects
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default workflow used when no project filter is active.
 * Maps to the built-in TodoStatus values: todo, in_progress, done.
 */
export const DEFAULT_WORKFLOW: CustomStatus[] = [
  { id: 'todo', name: 'To Do', color: '#6366f1', order: 0 },
  { id: 'in_progress', name: 'In Progress', color: '#f59e0b', order: 1 },
  { id: 'review', name: 'Review', color: '#8b5cf6', order: 2 },
  { id: 'done', name: 'Done', color: '#10b981', order: 3 },
];

export interface WorkflowPreset {
  id: string;
  name: string;
  description: string;
  statuses: CustomStatus[];
}

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Simple task workflow',
    statuses: DEFAULT_WORKFLOW,
  },
  {
    id: 'manuscript',
    name: 'Manuscript',
    description: 'Paper writing and publication pipeline',
    statuses: [
      { id: 'draft', name: 'Draft', color: '#6366f1', order: 0 },
      { id: 'internal_review', name: 'Internal Review', color: '#8b5cf6', order: 1 },
      { id: 'submitted', name: 'Submitted', color: '#f59e0b', order: 2 },
      { id: 'under_review', name: 'Under Review', color: '#f97316', order: 3 },
      { id: 'revisions', name: 'Revisions', color: '#ef4444', order: 4 },
      { id: 'accepted', name: 'Accepted', color: '#10b981', order: 5 },
      { id: 'published', name: 'Published', color: '#06b6d4', order: 6 },
    ],
  },
  {
    id: 'experiment',
    name: 'Experiment',
    description: 'Lab experiment lifecycle',
    statuses: [
      { id: 'planning', name: 'Planning', color: '#6366f1', order: 0 },
      { id: 'setup', name: 'Setup', color: '#8b5cf6', order: 1 },
      { id: 'running', name: 'Running', color: '#f59e0b', order: 2 },
      { id: 'analysis', name: 'Analysis', color: '#f97316', order: 3 },
      { id: 'complete', name: 'Complete', color: '#10b981', order: 4 },
    ],
  },
  {
    id: 'grant',
    name: 'Grant',
    description: 'Grant proposal and funding workflow',
    statuses: [
      { id: 'ideation', name: 'Ideation', color: '#6366f1', order: 0 },
      { id: 'writing', name: 'Writing', color: '#8b5cf6', order: 1 },
      { id: 'internal_review', name: 'Internal Review', color: '#f59e0b', order: 2 },
      { id: 'submitted', name: 'Submitted', color: '#f97316', order: 3 },
      { id: 'awarded', name: 'Awarded', color: '#10b981', order: 4 },
      { id: 'rejected', name: 'Rejected', color: '#ef4444', order: 5 },
    ],
  },
];

/**
 * Generate a unique ID for a new custom status.
 * Uses name-based slug with a random suffix to avoid collisions.
 */
export function generateStatusId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${slug}_${suffix}`;
}

/**
 * Status color palette for custom statuses.
 */
export const STATUS_COLOR_PALETTE = [
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#a855f7', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];
