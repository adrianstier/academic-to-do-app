import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OWNER_USERNAME } from '@/types/todo';
import { logger } from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Verify owner access
function isOwner(userName: string | null): boolean {
  return userName === OWNER_USERNAME;
}

// GET - Fetch milestones for a goal
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userName = searchParams.get('userName');
    const goalId = searchParams.get('goalId');

    if (!isOwner(userName)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let query = supabase
      .from('goal_milestones')
      .select('*')
      .order('display_order', { ascending: true });

    if (goalId) {
      query = query.eq('goal_id', goalId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    logger.error('Error fetching milestones', error, { component: 'api/goals/milestones', action: 'GET' });
    return NextResponse.json({ error: 'Failed to fetch milestones' }, { status: 500 });
  }
}

// POST - Create a new milestone
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { goal_id, title, target_date, userName } = body;

    if (!isOwner(userName)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

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

    const { data, error } = await supabase
      .from('goal_milestones')
      .insert({
        goal_id,
        title,
        target_date: target_date || null,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (error) throw error;

    // Update goal progress based on milestones
    await updateGoalProgress(goal_id);

    return NextResponse.json(data);
  } catch (error) {
    logger.error('Error creating milestone', error, { component: 'api/goals/milestones', action: 'POST' });
    return NextResponse.json({ error: 'Failed to create milestone' }, { status: 500 });
  }
}

// PUT - Update a milestone
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, title, completed, target_date, display_order, userName } = body;

    if (!isOwner(userName)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (completed !== undefined) updateData.completed = completed;
    if (target_date !== undefined) updateData.target_date = target_date;
    if (display_order !== undefined) updateData.display_order = display_order;

    const { data, error } = await supabase
      .from('goal_milestones')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Update goal progress if completion changed
    if (completed !== undefined && data) {
      await updateGoalProgress(data.goal_id);
    }

    return NextResponse.json(data);
  } catch (error) {
    logger.error('Error updating milestone', error, { component: 'api/goals/milestones', action: 'PUT' });
    return NextResponse.json({ error: 'Failed to update milestone' }, { status: 500 });
  }
}

// DELETE - Delete a milestone
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userName = searchParams.get('userName');

    if (!isOwner(userName)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Get goal_id before deleting
    const { data: milestone } = await supabase
      .from('goal_milestones')
      .select('goal_id')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('goal_milestones')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Update goal progress
    if (milestone) {
      await updateGoalProgress(milestone.goal_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting milestone', error, { component: 'api/goals/milestones', action: 'DELETE' });
    return NextResponse.json({ error: 'Failed to delete milestone' }, { status: 500 });
  }
}

// Helper function to update goal progress based on milestones
async function updateGoalProgress(goalId: string) {
  const { data: milestones } = await supabase
    .from('goal_milestones')
    .select('completed')
    .eq('goal_id', goalId);

  if (milestones && milestones.length > 0) {
    const completedCount = milestones.filter(m => m.completed).length;
    const progressPercent = Math.round((completedCount / milestones.length) * 100);

    await supabase
      .from('strategic_goals')
      .update({
        progress_percent: progressPercent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', goalId);
  }
}
