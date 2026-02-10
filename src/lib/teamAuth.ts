/**
 * Team (Lab) Authentication & Authorization
 *
 * Provides team-scoped access control for multi-tenant API routes.
 * Extends sessionValidator with team/lab context verification.
 * Internal data model uses 'team' terminology; UI displays academic labels.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateSession, SessionValidationResult } from './sessionValidator';
import { logger } from './logger';
import type {
  TeamRole,
  TeamPermissions,
  TeamMembership,
} from '@/types/team';
import { isFeatureEnabled } from './featureFlags';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ============================================
// Types
// ============================================

export interface TeamAuthContext {
  userId: string;
  userName: string;
  userRole: string;
  teamId: string;
  teamSlug: string;
  teamName: string;
  teamRole: TeamRole;
  permissions: TeamPermissions;
}

export interface TeamAuthResult {
  success: boolean;
  context?: TeamAuthContext;
  response?: NextResponse;
  error?: string;
}

export interface TeamAuthOptions {
  /** Team ID to verify access for. If not provided, uses X-Team-Id header */
  teamId?: string;
  /** Required role(s) - user must have one of these roles */
  requiredRoles?: TeamRole[];
  /** Required permission(s) - user must have all of these */
  requiredPermissions?: (keyof TeamPermissions)[];
  /** Allow super_admin to bypass team membership check */
  allowSuperAdmin?: boolean;
}

// ============================================
// Core Functions
// ============================================

/**
 * Verify user has access to a team with optional role/permission requirements
 *
 * Usage:
 * ```typescript
 * const auth = await verifyTeamAccess(request, { teamId });
 * if (!auth.success) return auth.response;
 *
 * // Now use auth.context.teamId for all queries
 * const { data } = await supabase
 *   .from('todos')
 *   .select('*')
 *   .eq('team_id', auth.context.teamId);
 * ```
 */
export async function verifyTeamAccess(
  request: NextRequest,
  options: TeamAuthOptions = {}
): Promise<TeamAuthResult> {
  // First validate the session
  const session = await validateSession(request);

  if (!session.valid || !session.userId || !session.userName) {
    return {
      success: false,
      error: session.error || 'Unauthorized',
      response: NextResponse.json(
        { error: 'Unauthorized', message: session.error },
        { status: 401 }
      ),
    };
  }

  // If multi-tenancy is disabled, return success with null team context
  if (!isFeatureEnabled('multi_tenancy')) {
    // Return a minimal context for backward compatibility
    return {
      success: true,
      context: {
        userId: session.userId,
        userName: session.userName,
        userRole: session.userRole || 'member',
        teamId: '', // No team in single-tenant mode
        teamSlug: '',
        teamName: '',
        teamRole: 'member',
        permissions: {
          can_create_tasks: true,
          can_delete_tasks: session.userRole === 'owner' || session.userRole === 'admin',
          can_view_strategic_goals: session.userRole === 'owner' || session.userRole === 'admin',
          can_invite_users: session.userRole === 'owner' || session.userRole === 'admin',
          can_manage_templates: true,
          can_manage_team_settings: session.userRole === 'owner',
          can_transfer_ownership: session.userRole === 'owner',
          can_delete_team: session.userRole === 'owner',
          can_manage_roles: session.userRole === 'owner' || session.userRole === 'admin',
        },
      },
    };
  }

  // Get team ID from options, header, or cookie
  // Support both new X-Team-Id and legacy X-Agency-Id headers
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let teamId = options.teamId;
  if (!teamId) {
    teamId = request.headers.get('X-Team-Id') ||
             request.headers.get('X-Agency-Id') ||
             request.cookies.get('current_team_id')?.value ||
             request.cookies.get('current_agency_id')?.value ||
             undefined;
  }

  // Validate team ID format to prevent injection
  if (teamId && !UUID_REGEX.test(teamId)) {
    logger.security('Invalid team ID format rejected', {
      userId: session.userId,
      userName: session.userName,
      teamId,
    });
    return {
      success: false,
      error: 'Invalid team ID format',
      response: NextResponse.json(
        { error: 'Bad request', message: 'Invalid team ID format' },
        { status: 400 }
      ),
    };
  }

  // Check if user is super_admin (can bypass team check if allowed)
  if (options.allowSuperAdmin !== false) {
    const { data: user } = await supabase
      .from('users')
      .select('global_role')
      .eq('id', session.userId)
      .single();

    if (user?.global_role === 'super_admin') {
      logger.security('Super admin bypass used', {
        userId: session.userId,
        userName: session.userName,
        teamId: teamId || 'none',
        route: request.nextUrl.pathname,
      });
      // Super admin can access any team
      if (teamId) {
        const team = await getTeamById(teamId);
        if (team) {
          return {
            success: true,
            context: {
              userId: session.userId,
              userName: session.userName,
              userRole: session.userRole || 'admin',
              teamId: team.id,
              teamSlug: team.slug,
              teamName: team.name,
              teamRole: 'owner', // Super admin has full access
              permissions: {
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
            },
          };
        }
      }
    }
  }

  // If no team specified, try to get user's default team
  if (!teamId) {
    const defaultTeam = await getUserDefaultTeam(session.userId);
    if (!defaultTeam) {
      return {
        success: false,
        error: 'No team specified and no default team found',
        response: NextResponse.json(
          { error: 'Team required', message: 'Please specify a team' },
          { status: 400 }
        ),
      };
    }
    teamId = defaultTeam.team_id;
  }

  // Verify user is a member of the team
  const membership = await getTeamMembership(session.userId, teamId);

  if (!membership) {
    logger.security('Team access denied - not a member', {
      userId: session.userId,
      userName: session.userName,
      teamId,
    });

    return {
      success: false,
      error: 'Access denied',
      response: NextResponse.json(
        { error: 'Access denied', message: 'You are not a member of this team' },
        { status: 403 }
      ),
    };
  }

  if (membership.status !== 'active') {
    return {
      success: false,
      error: 'Account suspended',
      response: NextResponse.json(
        { error: 'Account suspended', message: 'Your account in this team is suspended' },
        { status: 403 }
      ),
    };
  }

  // Check role requirements
  if (options.requiredRoles && options.requiredRoles.length > 0) {
    if (!options.requiredRoles.includes(membership.role)) {
      logger.security('Team access denied - insufficient role', {
        userId: session.userId,
        userName: session.userName,
        teamId,
        userRole: membership.role,
        requiredRoles: options.requiredRoles,
      });

      return {
        success: false,
        error: 'Insufficient permissions',
        response: NextResponse.json(
          { error: 'Forbidden', message: 'You do not have the required role' },
          { status: 403 }
        ),
      };
    }
  }

  // Check permission requirements
  if (options.requiredPermissions && options.requiredPermissions.length > 0) {
    const missingPermissions = options.requiredPermissions.filter(
      (perm) => !membership.permissions[perm]
    );

    if (missingPermissions.length > 0) {
      logger.security('Team access denied - missing permissions', {
        userId: session.userId,
        userName: session.userName,
        teamId,
        missingPermissions,
      });

      return {
        success: false,
        error: 'Insufficient permissions',
        response: NextResponse.json(
          { error: 'Forbidden', message: `Missing permissions: ${missingPermissions.join(', ')}` },
          { status: 403 }
        ),
      };
    }
  }

  // Get team details for context
  const team = await getTeamById(teamId);
  if (!team) {
    return {
      success: false,
      error: 'Team not found',
      response: NextResponse.json(
        { error: 'Not found', message: 'Team not found' },
        { status: 404 }
      ),
    };
  }

  return {
    success: true,
    context: {
      userId: session.userId,
      userName: session.userName,
      userRole: session.userRole || 'member',
      teamId: team.id,
      teamSlug: team.slug,
      teamName: team.name,
      teamRole: membership.role,
      permissions: membership.permissions,
    },
  };
}

// ============================================
// Helper Functions
// ============================================

interface TeamMemberRecord {
  role: TeamRole;
  permissions: TeamPermissions;
  status: string;
}

/**
 * Get user's membership in a team
 */
async function getTeamMembership(
  userId: string,
  teamId: string
): Promise<TeamMemberRecord | null> {
  // Try team_members first, fall back to agency_members
  let data;
  let error;

  const teamResult = await supabase
    .from('team_members')
    .select('role, permissions, status')
    .eq('user_id', userId)
    .eq('team_id', teamId)
    .single();

  if (teamResult.error?.code === '42P01') {
    // Table doesn't exist, try agency_members
    const agencyResult = await supabase
      .from('agency_members')
      .select('role, permissions, status')
      .eq('user_id', userId)
      .eq('agency_id', teamId)
      .single();

    data = agencyResult.data;
    error = agencyResult.error;
  } else {
    data = teamResult.data;
    error = teamResult.error;
  }

  if (error || !data) return null;

  return data as TeamMemberRecord;
}

interface TeamRecord {
  id: string;
  name: string;
  slug: string;
}

/**
 * Get team by ID
 */
async function getTeamById(teamId: string): Promise<TeamRecord | null> {
  // Try teams first, fall back to agencies
  let data;
  let error;

  const teamResult = await supabase
    .from('teams')
    .select('id, name, slug')
    .eq('id', teamId)
    .eq('is_active', true)
    .single();

  if (teamResult.error?.code === '42P01') {
    // Table doesn't exist, try agencies
    const agencyResult = await supabase
      .from('agencies')
      .select('id, name, slug')
      .eq('id', teamId)
      .eq('is_active', true)
      .single();

    data = agencyResult.data;
    error = agencyResult.error;
  } else {
    data = teamResult.data;
    error = teamResult.error;
  }

  if (error || !data) return null;

  return data as TeamRecord;
}

interface DefaultTeamRecord {
  team_id: string;
}

/**
 * Get user's default team
 */
async function getUserDefaultTeam(userId: string): Promise<DefaultTeamRecord | null> {
  // Try team_members first, fall back to agency_members
  let defaultTeam;
  let anyTeam;

  // First try team_members
  const teamDefaultResult = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('is_default_team', true)
    .eq('status', 'active')
    .single();

  if (teamDefaultResult.error?.code === '42P01') {
    // Table doesn't exist, try agency_members
    const agencyDefaultResult = await supabase
      .from('agency_members')
      .select('agency_id')
      .eq('user_id', userId)
      .eq('is_default_agency', true)
      .eq('status', 'active')
      .single();

    if (agencyDefaultResult.data) {
      return { team_id: agencyDefaultResult.data.agency_id };
    }

    // Try any active agency
    const agencyAnyResult = await supabase
      .from('agency_members')
      .select('agency_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (agencyAnyResult.data) {
      return { team_id: agencyAnyResult.data.agency_id };
    }

    return null;
  }

  if (teamDefaultResult.data) return teamDefaultResult.data as DefaultTeamRecord;

  // Otherwise get any active team
  const teamAnyResult = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .single();

  return teamAnyResult.data as DefaultTeamRecord | null;
}

/**
 * Get all teams a user belongs to
 */
export async function getUserTeams(userId: string): Promise<TeamMembership[]> {
  // Try team_members first, fall back to agency_members
  let data;
  let error;

  const teamResult = await supabase
    .from('team_members')
    .select(`
      team_id,
      role,
      permissions,
      is_default_team,
      teams!inner (
        id,
        name,
        slug,
        is_active
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'active');

  if (teamResult.error?.code === '42P01') {
    // Table doesn't exist, try agency_members
    const agencyResult = await supabase
      .from('agency_members')
      .select(`
        agency_id,
        role,
        permissions,
        is_default_agency,
        agencies!inner (
          id,
          name,
          slug,
          is_active
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'active');

    if (agencyResult.error || !agencyResult.data) return [];

    // Transform agency data to team format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawData = agencyResult.data as any[];
    return (rawData || [])
      .filter((m) => m.agencies?.is_active)
      .map((m) => ({
        team_id: m.agency_id,
        team_name: m.agencies.name,
        team_slug: m.agencies.slug,
        role: m.role as TeamRole,
        permissions: m.permissions as TeamPermissions,
        is_default: m.is_default_agency,
      }));
  }

  data = teamResult.data;
  error = teamResult.error;

  if (error || !data) return [];

  // Transform the data - Supabase returns joined data as nested objects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawData = data as any[];
  return (rawData || [])
    .filter((m) => m.teams?.is_active)
    .map((m) => ({
      team_id: m.team_id,
      team_name: m.teams.name,
      team_slug: m.teams.slug,
      role: m.role as TeamRole,
      permissions: m.permissions as TeamPermissions,
      is_default: m.is_default_team,
    }));
}

/**
 * Set session context for RLS policies
 * Call this before making database queries that use RLS
 */
export async function setTeamContext(
  teamId: string,
  userId: string,
  userName: string
): Promise<void> {
  try {
    await supabase.rpc('set_request_context', {
      p_user_id: userId,
      p_user_name: userName,
      p_team_id: teamId,
      p_agency_id: teamId, // Backward compatibility
    });
  } catch {
    // RPC might not exist, that's OK
  }
}

// ============================================
// Middleware Helper
// ============================================

/**
 * Create a simple team-scoped route handler wrapper
 *
 * Usage:
 * ```typescript
 * export const GET = withTeamAuth(async (request, context) => {
 *   const { data } = await supabase
 *     .from('todos')
 *     .select('*')
 *     .eq('team_id', context.teamId);
 *
 *   return NextResponse.json({ data });
 * });
 * ```
 */
export function withTeamAuth(
  handler: (request: NextRequest, context: TeamAuthContext) => Promise<NextResponse>,
  options: TeamAuthOptions = {}
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const auth = await verifyTeamAccess(request, options);

    if (!auth.success || !auth.context) {
      return auth.response || NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return handler(request, auth.context);
  };
}

/**
 * Create team-scoped route handler for owner/admin only routes
 */
export function withTeamAdminAuth(
  handler: (request: NextRequest, context: TeamAuthContext) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return withTeamAuth(handler, { requiredRoles: ['owner', 'admin'] });
}

/**
 * Create team-scoped route handler for owner only routes
 */
export function withTeamOwnerAuth(
  handler: (request: NextRequest, context: TeamAuthContext) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return withTeamAuth(handler, { requiredRoles: ['owner'] });
}

