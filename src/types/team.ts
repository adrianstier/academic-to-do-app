/**
 * Team Types for Multi-Tenancy
 *
 * These types support the multi-team architecture allowing multiple
 * research teams to use the platform with complete data isolation.
 */

// ============================================
// Core Team Types
// ============================================

export type SubscriptionTier = 'starter' | 'professional' | 'enterprise';

export interface Team {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  subscription_tier: SubscriptionTier;
  max_users: number;
  max_storage_mb: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// Team Membership Types
// ============================================

export type TeamRole = 'owner' | 'admin' | 'member' | 'collaborator';

export type MemberStatus = 'active' | 'invited' | 'suspended';

export interface TeamPermissions {
  can_create_tasks: boolean;
  can_delete_tasks: boolean;
  can_view_strategic_goals: boolean;
  can_invite_users: boolean;
  can_manage_templates: boolean;
  /** Only owner can manage team settings (name, slug, color) */
  can_manage_team_settings: boolean;
  /** Only owner can transfer ownership */
  can_transfer_ownership: boolean;
  /** Only owner can deactivate the team */
  can_delete_team: boolean;
  /** Owner and admin can manage member roles */
  can_manage_roles: boolean;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  permissions: TeamPermissions;
  status: MemberStatus;
  is_default_team: boolean;
  joined_at: string;
  created_at: string;
  updated_at: string;
  // Joined data
  user?: {
    id: string;
    name: string;
    color: string;
    email?: string;
  };
  team?: Team;
}

// ============================================
// Team Invitation Types
// ============================================

export interface TeamInvitation {
  id: string;
  team_id: string;
  email: string;
  role: Exclude<TeamRole, 'owner'>; // Can't invite as owner
  token: string;
  invited_by?: string;
  expires_at: string;
  accepted_at?: string;
  created_at: string;
  // Joined data
  team?: Team;
}

// ============================================
// Team Context Types
// ============================================

/**
 * User's membership in a team, used for team switching
 */
export interface TeamMembership {
  team_id: string;
  team_name: string;
  team_slug: string;
  role: TeamRole;
  permissions: TeamPermissions;
  is_default: boolean;
}

/**
 * Current team context for the application
 */
export interface TeamContext {
  currentTeam: Team | null;
  currentTeamId: string | null;
  currentRole: TeamRole | null;
  currentPermissions: TeamPermissions | null;
  teams: TeamMembership[];
  isLoading: boolean;
  error: string | null;
}

// ============================================
// API Request/Response Types
// ============================================

export interface CreateTeamRequest {
  name: string;
  slug?: string; // Auto-generated from name if not provided
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
}

export interface UpdateTeamRequest {
  name?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
}

export interface InviteUserRequest {
  email: string;
  role: Exclude<TeamRole, 'owner'>;
}

export interface UpdateMemberRequest {
  role?: TeamRole;
  permissions?: Partial<TeamPermissions>;
  status?: MemberStatus;
}

// ============================================
// Default Permissions by Role
// ============================================

export const DEFAULT_PERMISSIONS: Record<TeamRole, TeamPermissions> = {
  owner: {
    can_create_tasks: true,
    can_delete_tasks: true,
    can_view_strategic_goals: true,
    can_invite_users: true,
    can_manage_templates: true,
    can_manage_team_settings: true,
    can_transfer_ownership: true,
    can_delete_team: true,
    can_manage_roles: true,
  },
  admin: {
    can_create_tasks: true,
    can_delete_tasks: true,
    can_view_strategic_goals: true,
    can_invite_users: true,
    can_manage_templates: true,
    can_manage_team_settings: false,
    can_transfer_ownership: false,
    can_delete_team: false,
    can_manage_roles: true,
  },
  member: {
    can_create_tasks: true,
    can_delete_tasks: false,
    can_view_strategic_goals: false,
    can_invite_users: false,
    can_manage_templates: false,
    can_manage_team_settings: false,
    can_transfer_ownership: false,
    can_delete_team: false,
    can_manage_roles: false,
  },
  collaborator: {
    can_create_tasks: false,
    can_delete_tasks: false,
    can_view_strategic_goals: false,
    can_invite_users: false,
    can_manage_templates: false,
    can_manage_team_settings: false,
    can_transfer_ownership: false,
    can_delete_team: false,
    can_manage_roles: false,
  },
};

// ============================================
// Subscription Tier Limits
// ============================================

export const SUBSCRIPTION_LIMITS: Record<SubscriptionTier, { users: number; storage_mb: number }> = {
  starter: { users: 10, storage_mb: 1024 },        // 1GB
  professional: { users: 50, storage_mb: 5120 },   // 5GB
  enterprise: { users: 999, storage_mb: 51200 },   // 50GB
};

// ============================================
// Helper Functions
// ============================================

/**
 * Check if user has a specific permission in their current team
 */
export function hasPermission(
  permissions: TeamPermissions | null | undefined,
  permission: keyof TeamPermissions
): boolean {
  if (!permissions) return false;
  return permissions[permission] === true;
}

/**
 * Check if user is team owner
 */
export function isTeamOwner(membership: TeamMembership | TeamMember | null | undefined): boolean {
  if (!membership) return false;
  return membership.role === 'owner';
}

/**
 * Check if user is team admin (owner or admin)
 */
export function isTeamAdmin(membership: TeamMembership | TeamMember | null | undefined): boolean {
  if (!membership) return false;
  return membership.role === 'owner' || membership.role === 'admin';
}

/**
 * Check if user can view strategic goals
 */
export function canViewGoals(membership: TeamMembership | TeamMember | null | undefined): boolean {
  if (!membership) return false;
  if (isTeamAdmin(membership)) return true;
  const permissions = 'permissions' in membership ? membership.permissions : null;
  return hasPermission(permissions, 'can_view_strategic_goals');
}

/**
 * Check if user can invite other users
 */
export function canInviteUsers(membership: TeamMembership | TeamMember | null | undefined): boolean {
  if (!membership) return false;
  if (isTeamAdmin(membership)) return true;
  const permissions = 'permissions' in membership ? membership.permissions : null;
  return hasPermission(permissions, 'can_invite_users');
}

/**
 * Generate URL-friendly slug from team name
 */
export function generateTeamSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

/**
 * Check if invitation is still valid (not expired and not accepted)
 */
export function isInvitationValid(invitation: TeamInvitation): boolean {
  if (invitation.accepted_at) return false;
  return new Date(invitation.expires_at) > new Date();
}

