/**
 * Project Detail API - Get, Update, Delete
 *
 * GET    /api/projects/[id] - Get a single project
 * PUT    /api/projects/[id] - Update a project
 * DELETE /api/projects/[id] - Archive (soft delete) a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { withTeamAuth, TeamAuthContext } from '@/lib/teamAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Extract project ID from the URL path
 */
function getProjectIdFromUrl(request: NextRequest): string | null {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  // URL pattern: /api/projects/[id]
  const projectsIndex = segments.indexOf('projects');
  if (projectsIndex !== -1 && segments.length > projectsIndex + 1) {
    return segments[projectsIndex + 1];
  }
  return null;
}

/**
 * GET /api/projects/[id] - Get a single project
 */
export const GET = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const projectId = getProjectIdFromUrl(request);

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    if (!UUID_REGEX.test(projectId)) {
      return NextResponse.json(
        { error: 'Project ID must be a valid UUID' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('projects')
      .select('*')
      .eq('id', projectId);

    // Verify team access
    if (context.teamId && context.teamId.trim() !== '') {
      query = query.eq('team_id', context.teamId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Error fetching project', error as Error, {
      component: 'api/projects/[id]',
      action: 'GET',
    });
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/projects/[id] - Update a project
 */
export const PUT = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const projectId = getProjectIdFromUrl(request);

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    if (!UUID_REGEX.test(projectId)) {
      return NextResponse.json(
        { error: 'Project ID must be a valid UUID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Copy allowed fields
    const allowedFields = [
      'name', 'description', 'color', 'icon', 'status',
      'pi_id', 'start_date', 'end_date', 'custom_statuses',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Validate status if provided
    if (updateData.status) {
      const validStatuses = ['active', 'archived', 'completed'];
      if (!validStatuses.includes(updateData.status as string)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate name if provided
    if (updateData.name !== undefined && !(updateData.name as string)?.trim()) {
      return NextResponse.json(
        { error: 'Project name cannot be empty' },
        { status: 400 }
      );
    }

    // Validate custom_statuses if provided
    if (updateData.custom_statuses !== undefined) {
      const cs = updateData.custom_statuses;
      // Must be an array (or null to clear)
      if (cs !== null && !Array.isArray(cs)) {
        return NextResponse.json(
          { error: 'custom_statuses must be an array or null' },
          { status: 400 }
        );
      }
      if (Array.isArray(cs)) {
        // Validate each status has required fields
        for (const status of cs) {
          if (!status || typeof status !== 'object') {
            return NextResponse.json(
              { error: 'Each custom status must be an object' },
              { status: 400 }
            );
          }
          if (typeof status.id !== 'string' || !status.id.trim()) {
            return NextResponse.json(
              { error: 'Each custom status must have a non-empty string id' },
              { status: 400 }
            );
          }
          if (typeof status.name !== 'string' || !status.name.trim()) {
            return NextResponse.json(
              { error: 'Each custom status must have a non-empty string name' },
              { status: 400 }
            );
          }
          if (typeof status.color !== 'string' || !status.color.trim()) {
            return NextResponse.json(
              { error: 'Each custom status must have a non-empty string color' },
              { status: 400 }
            );
          }
          if (typeof status.order !== 'number' || status.order < 0) {
            return NextResponse.json(
              { error: 'Each custom status must have a non-negative number order' },
              { status: 400 }
            );
          }
        }
        // Must have at least 2 statuses if not empty
        if (cs.length > 0 && cs.length < 2) {
          return NextResponse.json(
            { error: 'Custom statuses must have at least 2 entries' },
            { status: 400 }
          );
        }
      }
    }

    let query = supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId);

    // Team-scope the update
    if (context.teamId && context.teamId.trim() !== '') {
      query = query.eq('team_id', context.teamId);
    }

    const { data, error } = await query.select().single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    logger.info('Project updated', {
      component: 'api/projects/[id]',
      action: 'PUT',
      projectId,
      updatedFields: Object.keys(updateData),
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Error updating project', error as Error, {
      component: 'api/projects/[id]',
      action: 'PUT',
    });
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/projects/[id] - Soft delete (archive) a project
 */
export const DELETE = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const projectId = getProjectIdFromUrl(request);

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    if (!UUID_REGEX.test(projectId)) {
      return NextResponse.json(
        { error: 'Project ID must be a valid UUID' },
        { status: 400 }
      );
    }

    // Soft delete: set status to 'archived'
    let query = supabase
      .from('projects')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    // Team-scope the update
    if (context.teamId && context.teamId.trim() !== '') {
      query = query.eq('team_id', context.teamId);
    }

    const { data, error } = await query.select().single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    logger.info('Project archived', {
      component: 'api/projects/[id]',
      action: 'DELETE',
      projectId,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Error archiving project', error as Error, {
      component: 'api/projects/[id]',
      action: 'DELETE',
    });
    return NextResponse.json(
      { error: 'Failed to archive project' },
      { status: 500 }
    );
  }
});
