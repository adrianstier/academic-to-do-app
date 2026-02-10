/**
 * Project Types for Academic Task Management
 *
 * Projects allow grouping tasks by research project, grant, course, etc.
 * Each project belongs to a team and supports lifecycle tracking.
 */

export type ProjectStatus = 'active' | 'archived' | 'completed';

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
}

export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bgColor: string }> = {
  active: { label: 'Active', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)' },
  completed: { label: 'Completed', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' },
  archived: { label: 'Archived', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.1)' },
};

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
