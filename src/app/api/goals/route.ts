import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { withTeamAdminAuth, TeamAuthContext } from '@/lib/teamAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// GET - Fetch all strategic goals with categories and milestones
export const GET = withTeamAdminAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');

    let query = supabase
      .from('strategic_goals')
      .select(`
        *,
        category:goal_categories(*),
        milestones:goal_milestones(*)
      `)
      .order('display_order', { ascending: true });

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    // Scope to team if multi-tenancy is enabled
    if (context.teamId) {
      query = query.eq('team_id', context.teamId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('Error fetching goals', error, { component: 'api/goals', action: 'GET' });
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 });
  }
});

// POST - Create a new strategic goal
export const POST = withTeamAdminAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const body = await request.json();
    const {
      title,
      description,
      category_id,
      status,
      priority,
      target_date,
      target_value,
      notes,
    } = body;

    if (!title || (typeof title === 'string' && !title.trim())) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    // Validate status enum if provided
    const validStatuses = ['not_started', 'in_progress', 'on_hold', 'completed', 'cancelled'];
    const goalStatus = status || 'not_started';
    if (!validStatuses.includes(goalStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate priority enum if provided
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    const goalPriority = priority || 'medium';
    if (!validPriorities.includes(goalPriority)) {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
        { status: 400 }
      );
    }

    // Get max display_order for new goal
    let maxOrderQuery = supabase
      .from('strategic_goals')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1);

    if (context.teamId) {
      maxOrderQuery = maxOrderQuery.eq('team_id', context.teamId);
    }

    const { data: maxOrderData } = await maxOrderQuery.single();

    const nextOrder = (maxOrderData?.display_order || 0) + 1;

    const insertData: Record<string, unknown> = {
      title: typeof title === 'string' ? title.trim() : title,
      description: description || null,
      category_id: category_id || null,
      status: goalStatus,
      priority: goalPriority,
      target_date: target_date || null,
      target_value: target_value || null,
      notes: notes || null,
      display_order: nextOrder,
      created_by: context.userName,
    };

    if (context.teamId) {
      insertData.team_id = context.teamId;
    }

    const { data, error } = await supabase
      .from('strategic_goals')
      .insert(insertData)
      .select(`
        *,
        category:goal_categories(*),
        milestones:goal_milestones(*)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    logger.error('Error creating goal', error, { component: 'api/goals', action: 'POST' });
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
  }
});

// PUT - Update a strategic goal
export const PUT = withTeamAdminAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const body = await request.json();
    const {
      id,
      title,
      description,
      category_id,
      status,
      priority,
      target_date,
      target_value,
      current_value,
      progress_percent,
      notes,
      display_order,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Validate UUID format
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'id must be a valid UUID' },
        { status: 400 }
      );
    }

    // Validate status enum if provided
    if (status !== undefined) {
      const validStatuses = ['not_started', 'in_progress', 'on_hold', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate priority enum if provided
    if (priority !== undefined) {
      const validPriorities = ['low', 'medium', 'high', 'critical'];
      if (!validPriorities.includes(priority)) {
        return NextResponse.json(
          { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate title if provided
    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      return NextResponse.json(
        { error: 'title cannot be empty' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = typeof title === 'string' ? title.trim() : title;
    if (description !== undefined) updateData.description = description;
    if (category_id !== undefined) updateData.category_id = category_id;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (target_date !== undefined) updateData.target_date = target_date;
    if (target_value !== undefined) updateData.target_value = target_value;
    if (current_value !== undefined) updateData.current_value = current_value;
    if (progress_percent !== undefined) updateData.progress_percent = progress_percent;
    if (notes !== undefined) updateData.notes = notes;
    if (display_order !== undefined) updateData.display_order = display_order;

    let updateQuery = supabase
      .from('strategic_goals')
      .update(updateData)
      .eq('id', id);

    // Scope to team if multi-tenancy is enabled
    if (context.teamId) {
      updateQuery = updateQuery.eq('team_id', context.teamId);
    }

    const { data, error } = await updateQuery
      .select(`
        *,
        category:goal_categories(*),
        milestones:goal_milestones(*)
      `)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Goal not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    logger.error('Error updating goal', error, { component: 'api/goals', action: 'PUT' });
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
  }
});

// DELETE - Delete a strategic goal
export const DELETE = withTeamAdminAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Validate UUID format
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'id must be a valid UUID' },
        { status: 400 }
      );
    }

    // Verify goal exists before deleting
    let verifyQuery = supabase
      .from('strategic_goals')
      .select('id')
      .eq('id', id);

    if (context.teamId) {
      verifyQuery = verifyQuery.eq('team_id', context.teamId);
    }

    const { data: existing, error: verifyError } = await verifyQuery.single();
    if (verifyError || !existing) {
      return NextResponse.json(
        { error: 'Goal not found' },
        { status: 404 }
      );
    }

    let deleteQuery = supabase
      .from('strategic_goals')
      .delete()
      .eq('id', id);

    // Scope to team if multi-tenancy is enabled
    if (context.teamId) {
      deleteQuery = deleteQuery.eq('team_id', context.teamId);
    }

    const { error } = await deleteQuery;

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting goal', error, { component: 'api/goals', action: 'DELETE' });
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 });
  }
});
