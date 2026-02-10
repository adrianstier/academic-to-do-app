import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { withTeamAuth, TeamAuthContext } from '@/lib/teamAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// GET - Fetch all templates (user's own + shared)
export const GET = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    // Get user's own templates and shared templates
    // BUG-API-8: Sanitize userName for PostgREST filter to prevent filter injection.
    // Escape characters that could alter the filter logic: double quotes, commas,
    // parentheses, and backslashes in PostgREST filter expressions.
    const safeUserName = context.userName.replace(/[",()\\]/g, '');
    let query = supabase
      .from('task_templates')
      .select('*')
      .or(`created_by.eq.${safeUserName},is_shared.eq.true`)
      .order('created_at', { ascending: false });

    // Scope to team if multi-tenancy is enabled
    if (context.teamId) {
      query = query.eq('team_id', context.teamId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('Error fetching templates', error, { component: 'api/templates', action: 'GET' });
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
});

// POST - Create a new template
export const POST = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const body = await request.json();
    const { name, description, default_priority, default_assigned_to, subtasks, is_shared } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const insertData: Record<string, unknown> = {
      name,
      description: description || null,
      default_priority: default_priority || 'medium',
      default_assigned_to: default_assigned_to || null,
      subtasks: subtasks || [],
      created_by: context.userName,
      is_shared: is_shared || false,
    };

    if (context.teamId) {
      insertData.team_id = context.teamId;
    }

    const { data, error } = await supabase
      .from('task_templates')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Log activity
    const activityData: Record<string, unknown> = {
      action: 'template_created',
      user_name: context.userName,
      details: { template_name: name, is_shared },
    };

    if (context.teamId) {
      activityData.team_id = context.teamId;
    }

    await supabase.from('activity_log').insert(activityData);

    return NextResponse.json(data);
  } catch (error) {
    logger.error('Error creating template', error, { component: 'api/templates', action: 'POST' });
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
});

// DELETE - Delete a template
export const DELETE = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Only allow deletion by the creator, scoped to team
    let deleteQuery = supabase
      .from('task_templates')
      .delete()
      .eq('id', id)
      .eq('created_by', context.userName);

    // Scope to team if multi-tenancy is enabled
    if (context.teamId) {
      deleteQuery = deleteQuery.eq('team_id', context.teamId);
    }

    const { error } = await deleteQuery;

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting template', error, { component: 'api/templates', action: 'DELETE' });
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
});
