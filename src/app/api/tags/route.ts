/**
 * Tags API - List and Create
 *
 * GET  /api/tags - List all tags for the current team
 * POST /api/tags - Create a new tag
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
 * GET /api/tags - List all tags for the current team
 */
export const GET = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    let query = supabase
      .from('tags')
      .select('*')
      .order('name', { ascending: true });

    // Team-scope the query
    if (context.teamId && context.teamId.trim() !== '') {
      query = query.eq('team_id', context.teamId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    logger.error('Error fetching tags', error as Error, {
      component: 'api/tags',
      action: 'GET',
    });
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/tags - Create a new tag
 */
export const POST = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const body = await request.json();
    const {
      name,
      color = '#6366f1',
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Tag name is required' },
        { status: 400 }
      );
    }

    const insertData: Record<string, unknown> = {
      name: name.trim(),
      color,
    };

    if (context.teamId && context.teamId.trim() !== '') {
      insertData.team_id = context.teamId;
    }

    const { data, error } = await supabase
      .from('tags')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation (duplicate tag name within team)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A tag with this name already exists' },
          { status: 409 }
        );
      }
      throw error;
    }

    logger.info('Tag created', {
      component: 'api/tags',
      action: 'POST',
      tagId: data.id,
      tagName: name.trim(),
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Error creating tag', error as Error, {
      component: 'api/tags',
      action: 'POST',
    });
    return NextResponse.json(
      { error: 'Failed to create tag' },
      { status: 500 }
    );
  }
});
