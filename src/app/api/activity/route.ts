import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { withTeamAuth, TeamAuthContext } from '@/lib/teamAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// GET - Fetch activity log (accessible to all authenticated users)
export const GET = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const { searchParams } = new URL(request.url);
    const parsedLimit = parseInt(searchParams.get('limit') || '50');
    const limit = Math.min(Math.max(isNaN(parsedLimit) ? 50 : parsedLimit, 1), 200);
    const todoId = searchParams.get('todoId');

    // Validate todoId UUID format if provided
    if (todoId) {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX.test(todoId)) {
        return NextResponse.json(
          { error: 'todoId must be a valid UUID' },
          { status: 400 }
        );
      }
    }

    let query = supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by todo_id if provided (for task-level history)
    if (todoId) {
      query = query.eq('todo_id', todoId);
    }

    // Scope to team if multi-tenancy is enabled
    if (context.teamId) {
      query = query.eq('team_id', context.teamId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('Error fetching activity', error, { component: 'api/activity', action: 'GET' });
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
});

// POST - Log an activity (called internally when tasks are modified)
export const POST = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const body = await request.json();
    const { action, todo_id, todo_text, user_name, details } = body;

    if (!action || !user_name) {
      return NextResponse.json({ error: 'action and user_name are required' }, { status: 400 });
    }

    // Validate action is a non-empty string
    if (typeof action !== 'string' || !action.trim()) {
      return NextResponse.json({ error: 'action must be a non-empty string' }, { status: 400 });
    }

    // Validate todo_id UUID format if provided
    if (todo_id) {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (typeof todo_id !== 'string' || !UUID_REGEX.test(todo_id)) {
        return NextResponse.json({ error: 'todo_id must be a valid UUID' }, { status: 400 });
      }
    }

    // Truncate todo_text to prevent oversized entries
    const safeTodoText = todo_text ? String(todo_text).substring(0, 200) : null;

    // Verify that the authenticated user matches the user_name in the body
    // This prevents users from logging activities as other users
    if (context.userName !== user_name) {
      return NextResponse.json(
        { error: 'Authenticated user does not match user_name in request body' },
        { status: 403 }
      );
    }

    const insertData: Record<string, unknown> = {
      action: action.trim(),
      todo_id: todo_id || null,
      todo_text: safeTodoText,
      user_name,
      details: details || {},
    };

    if (context.teamId) {
      insertData.team_id = context.teamId;
    }

    const { data, error } = await supabase
      .from('activity_log')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    logger.error('Error logging activity', error, { component: 'api/activity', action: 'POST' });
    return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 });
  }
});
