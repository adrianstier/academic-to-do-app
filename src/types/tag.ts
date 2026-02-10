/**
 * Tag and Link Types for Academic Task Management
 *
 * Tags provide flexible categorization beyond the fixed TaskCategory.
 * Links attach external resources (papers, datasets, repos) to tasks.
 */

export interface Tag {
  id: string;
  team_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TodoTag {
  todo_id: string;
  tag_id: string;
}

export type TodoLinkType = 'paper' | 'dataset' | 'repo' | 'doc' | 'other';

export interface TodoLink {
  id: string;
  todo_id: string;
  url: string;
  label?: string;
  type: TodoLinkType;
  created_at?: string;
}

export interface CreateTagRequest {
  name: string;
  color?: string;
}

export const DEFAULT_TAG_COLORS = [
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#a855f7', // Purple
  '#84cc16', // Lime
  '#06b6d4', // Cyan
  '#ef4444', // Red
];

export const LINK_TYPE_CONFIG: Record<TodoLinkType, { label: string; icon: string }> = {
  paper: { label: 'Paper', icon: 'FileText' },
  dataset: { label: 'Dataset', icon: 'Database' },
  repo: { label: 'Repository', icon: 'GitBranch' },
  doc: { label: 'Document', icon: 'File' },
  other: { label: 'Other', icon: 'Link' },
};
