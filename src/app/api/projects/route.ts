/**
 * Projects API - List and Create
 *
 * GET  /api/projects - List all projects for the current team
 * POST /api/projects - Create a new project
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { withTeamAuth, TeamAuthContext } from '@/lib/teamAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/projects - List all projects for the current team
 */
export const GET = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // Optional: filter by status

    let query = supabase
      .from('projects')
      .select('*')
      .order('name', { ascending: true });

    // Team-scope the query
    if (context.teamId && context.teamId.trim() !== '') {
      query = query.eq('team_id', context.teamId);
    }

    // Optionally filter by status
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    logger.error('Error fetching projects', error as Error, {
      component: 'api/projects',
      action: 'GET',
    });
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/projects - Create a new project
 */
export const POST = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const body = await request.json();
    const {
      name,
      description,
      color = '#3b82f6',
      icon,
      status = 'active',
      pi_id,
      start_date,
      end_date,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['active', 'archived', 'completed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const insertData: Record<string, unknown> = {
      name: name.trim(),
      description: description || null,
      color,
      icon: icon || null,
      status,
      pi_id: pi_id || null,
      start_date: start_date || null,
      end_date: end_date || null,
    };

    if (context.teamId && context.teamId.trim() !== '') {
      insertData.team_id = context.teamId;
    }

    const { data, error } = await supabase
      .from('projects')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    logger.info('Project created', {
      component: 'api/projects',
      action: 'POST',
      projectId: data.id,
      projectName: name.trim(),
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Error creating project', error as Error, {
      component: 'api/projects',
      action: 'POST',
    });
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
});
