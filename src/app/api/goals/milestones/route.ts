import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { withTeamAdminAuth, TeamAuthContext } from '@/lib/teamAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// GET - Fetch milestones for a goal
export const GET = withTeamAdminAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const { searchParams } = new URL(request.url);
    const goalId = searchParams.get('goalId');

    let query = supabase
      .from('goal_milestones')
      .select('*')
      .order('display_order', { ascending: true });

    if (goalId) {
      query = query.eq('goal_id', goalId);
    }

    // Scope to team if multi-tenancy is enabled
    if (context.teamId) {
      query = query.eq('team_id', context.teamId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('Error fetching milestones', error, { component: 'api/goals/milestones', action: 'GET' });
    return NextResponse.json({ error: 'Failed to fetch milestones' }, { status: 500 });
  }
});

// POST - Create a new milestone
export const POST = withTeamAdminAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const body = await request.json();
    const { goal_id, title, target_date } = body;

    if (!goal_id || !title) {
      return NextResponse.json({ error: 'goal_id and title are required' }, { status: 400 });
    }

    // Get max display_order for this goal
    const { data: maxOrderData } = await supabase
      .from('goal_milestones')
      .select('display_order')
      .eq('goal_id', goal_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrderData?.display_order || 0) + 1;

    const insertData: Record<string, unknown> = {
      goal_id,
      title,
      target_date: target_date || null,
      display_order: nextOrder,
    };

    if (context.teamId) {
      insertData.team_id = context.teamId;
    }

    const { data, error } = await supabase
      .from('goal_milestones')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // Update goal progress based on milestones
    await updateGoalProgress(goal_id, context.teamId);

    return NextResponse.json(data);
  } catch (error) {
    logger.error('Error creating milestone', error, { component: 'api/goals/milestones', action: 'POST' });
    return NextResponse.json({ error: 'Failed to create milestone' }, { status: 500 });
  }
});

// PUT - Update a milestone
export const PUT = withTeamAdminAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const body = await request.json();
    const { id, title, completed, target_date, display_order } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (completed !== undefined) updateData.completed = completed;
    if (target_date !== undefined) updateData.target_date = target_date;
    if (display_order !== undefined) updateData.display_order = display_order;

    let updateQuery = supabase
      .from('goal_milestones')
      .update(updateData)
      .eq('id', id);

    // Scope to team if multi-tenancy is enabled
    if (context.teamId) {
      updateQuery = updateQuery.eq('team_id', context.teamId);
    }

    const { data, error } = await updateQuery
      .select()
      .single();

    if (error) throw error;

    // Update goal progress if completion changed
    if (completed !== undefined && data) {
      await updateGoalProgress(data.goal_id, context.teamId);
    }

    return NextResponse.json(data);
  } catch (error) {
    logger.error('Error updating milestone', error, { component: 'api/goals/milestones', action: 'PUT' });
    return NextResponse.json({ error: 'Failed to update milestone' }, { status: 500 });
  }
});

// DELETE - Delete a milestone
export const DELETE = withTeamAdminAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Get goal_id before deleting (scoped to team)
    let prefetchQuery = supabase
      .from('goal_milestones')
      .select('goal_id')
      .eq('id', id);

    if (context.teamId) {
      prefetchQuery = prefetchQuery.eq('team_id', context.teamId);
    }

    const { data: milestone } = await prefetchQuery.single();

    let deleteQuery = supabase
      .from('goal_milestones')
      .delete()
      .eq('id', id);

    // Scope to team if multi-tenancy is enabled
    if (context.teamId) {
      deleteQuery = deleteQuery.eq('team_id', context.teamId);
    }

    const { error } = await deleteQuery;

    if (error) throw error;

    // Update goal progress
    if (milestone) {
      await updateGoalProgress(milestone.goal_id, context.teamId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting milestone', error, { component: 'api/goals/milestones', action: 'DELETE' });
    return NextResponse.json({ error: 'Failed to delete milestone' }, { status: 500 });
  }
});

// Helper function to update goal progress based on milestones
async function updateGoalProgress(goalId: string, teamId?: string) {
  let milestoneQuery = supabase
    .from('goal_milestones')
    .select('completed')
    .eq('goal_id', goalId);

  if (teamId) {
    milestoneQuery = milestoneQuery.eq('team_id', teamId);
  }

  const { data: milestones } = await milestoneQuery;

  if (milestones && milestones.length > 0) {
    const completedCount = milestones.filter(m => m.completed).length;
    const progressPercent = Math.round((completedCount / milestones.length) * 100);

    let goalQuery = supabase
      .from('strategic_goals')
      .update({
        progress_percent: progressPercent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', goalId);

    if (teamId) {
      goalQuery = goalQuery.eq('team_id', teamId);
    }

    await goalQuery;
  }
}
