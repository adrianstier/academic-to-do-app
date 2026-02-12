import type { TeamRole } from '@/types/team';

/**
 * Academic role display configuration.
 * Internal data model uses 'owner' | 'admin' | 'member' | 'collaborator'.
 * These mappings provide academic-friendly display labels.
 */

export interface AcademicRoleConfig {
  label: string;
  description: string;
  icon: string;
}

export const ACADEMIC_ROLE_MAP: Record<TeamRole, AcademicRoleConfig> = {
  owner: {
    label: 'Principal Investigator',
    description: 'Lab director with full administrative control',
    icon: '🔬',
  },
  admin: {
    label: 'Lab Manager',
    description: 'Can manage members, tasks, and templates',
    icon: '📋',
  },
  member: {
    label: 'Researcher',
    description: 'Can create and manage assigned tasks',
    icon: '🎓',
  },
  collaborator: {
    label: 'Collaborator',
    description: 'View-only access to lab tasks and projects',
    icon: '👁️',
  },
};

/** Short form for compact UI (badges, chips) */
export const ACADEMIC_ROLE_SHORT: Record<TeamRole, string> = {
  owner: 'PI',
  admin: 'Lab Mgr',
  member: 'Researcher',
  collaborator: 'Collaborator',
};

/** Get the academic display label for a role */
export function getAcademicRoleLabel(role: TeamRole): string {
  return ACADEMIC_ROLE_MAP[role]?.label ?? role;
}

/** Get the short academic display label for a role */
export function getAcademicRoleShort(role: TeamRole): string {
  return ACADEMIC_ROLE_SHORT[role] ?? role;
}
