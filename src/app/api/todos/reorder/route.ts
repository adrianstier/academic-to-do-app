import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { withTeamAuth, type TeamAuthContext } from '@/lib/teamAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/todos/reorder
 *
 * Reorder tasks in the list view by updating display_order
 *
 * Request body options:
 * 1. Move task to specific position:
 *    { todoId: string, newOrder: number }
 *
 * 2. Move task up or down one position:
 *    { todoId: string, direction: 'up' | 'down' }
 *
 * 3. Swap two tasks:
 *    { todoId: string, targetTodoId: string }
 */
export const POST = withTeamAuth(async (request, context: TeamAuthContext) => {
  try {
    const body = await request.json();
    const { todoId, newOrder, direction, targetTodoId } = body;
    const userName = context.userName;
    const teamId = context.teamId;

    if (!todoId) {
      return NextResponse.json(
        { error: 'todoId is required' },
        { status: 400 }
      );
    }

    // Get the current task (team-scoped)
    let fetchQuery = supabase
      .from('todos')
      .select('*')
      .eq('id', todoId);

    if (teamId) {
      fetchQuery = fetchQuery.eq('team_id', teamId);
    }

    const { data: currentTask, error: fetchError } = await fetchQuery.single();

    if (fetchError || !currentTask) {
      logger.error('Task not found for reordering', fetchError, { todoId });
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    let updatedTasks: any[] = [];

    // Handle different reorder modes
    if (newOrder !== undefined) {
      // BUG-API-16: Validate newOrder is a non-negative integer
      if (typeof newOrder !== 'number' || !Number.isInteger(newOrder) || newOrder < 0) {
        return NextResponse.json(
          { error: 'newOrder must be a non-negative integer' },
          { status: 400 }
        );
      }
      // Mode 1: Move to specific position
      updatedTasks = await moveToPosition(todoId, currentTask.display_order ?? 0, newOrder, teamId);
    } else if (direction) {
      // BUG-API-17: Validate direction is 'up' or 'down'
      if (direction !== 'up' && direction !== 'down') {
        return NextResponse.json(
          { error: "direction must be 'up' or 'down'" },
          { status: 400 }
        );
      }
      // Mode 2: Move up or down
      updatedTasks = await moveUpOrDown(todoId, currentTask.display_order ?? 0, direction, teamId);
    } else if (targetTodoId) {
      // Mode 3: Swap with target task
      updatedTasks = await swapTasks(todoId, targetTodoId, teamId);
    } else {
      return NextResponse.json(
        { error: 'Must provide newOrder, direction, or targetTodoId' },
        { status: 400 }
      );
    }

    // Log activity
    if (userName) {
      const activityRecord: Record<string, unknown> = {
        action: 'task_reordered',
        todo_id: todoId,
        todo_text: currentTask.text,
        user_name: userName,
        details: {
          from: currentTask.display_order ?? 0,
          to: updatedTasks.find(t => t.id === todoId)?.display_order ?? 0,
        },
      };
      if (teamId) {
        activityRecord.team_id = teamId;
      }
      await supabase.from('activity_log').insert(activityRecord);
    }

    return NextResponse.json({
      success: true,
      updatedTasks,
    });
  } catch (error) {
    logger.error('Error reordering tasks', error, { component: 'reorder-api' });
    return NextResponse.json(
      { error: 'Failed to reorder tasks' },
      { status: 500 }
    );
  }
});

/**
 * Move task to a specific position
 */
async function moveToPosition(
  todoId: string,
  currentOrder: number,
  newOrder: number,
  teamId?: string
): Promise<any[]> {
  // Get all tasks ordered by display_order (team-scoped)
  let query = supabase
    .from('todos')
    .select('*')
    .order('display_order', { ascending: true, nullsFirst: false });

  if (teamId) {
    query = query.eq('team_id', teamId);
  }

  const { data: allTasks } = await query;

  if (!allTasks) return [];

  // Remove task from current position
  const task = allTasks.find(t => t.id === todoId);
  const otherTasks = allTasks.filter(t => t.id !== todoId);

  if (!task) return [];

  // Insert task at new position
  otherTasks.splice(newOrder, 0, task);

  // Reassign display_order to all tasks
  const updates = otherTasks.map((t, index) => ({
    id: t.id,
    display_order: index,
  }));

  // Batch update
  const updatedTasks = [];
  for (const update of updates) {
    const { data, error } = await supabase
      .from('todos')
      .update({ display_order: update.display_order, updated_at: new Date().toISOString() })
      .eq('id', update.id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating task display_order', error, { taskId: update.id });
    } else if (data) {
      updatedTasks.push(data);
    }
  }

  return updatedTasks;
}

/**
 * Move task up or down one position
 */
async function moveUpOrDown(
  todoId: string,
  currentOrder: number,
  direction: 'up' | 'down',
  teamId?: string
): Promise<any[]> {
  const offset = direction === 'up' ? -1 : 1;
  const targetOrder = currentOrder + offset;

  if (targetOrder < 0) {
    // Already at top
    return [];
  }

  // Find the task at the target position (team-scoped)
  let query = supabase
    .from('todos')
    .select('*')
    .eq('display_order', targetOrder);

  if (teamId) {
    query = query.eq('team_id', teamId);
  }

  const { data: targetTask } = await query.single();

  if (!targetTask) {
    // No task at target position
    return [];
  }

  // Swap the two tasks
  const updates = [
    {
      id: todoId,
      display_order: targetOrder,
    },
    {
      id: targetTask.id,
      display_order: currentOrder,
    },
  ];

  const updatedTasks = [];
  for (const update of updates) {
    const { data, error } = await supabase
      .from('todos')
      .update({ display_order: update.display_order, updated_at: new Date().toISOString() })
      .eq('id', update.id)
      .select()
      .single();

    if (error) {
      logger.error('Error swapping task positions', error, { taskId: update.id });
    } else if (data) {
      updatedTasks.push(data);
    }
  }

  return updatedTasks;
}

/**
 * Swap two tasks
 */
async function swapTasks(todoId: string, targetTodoId: string, teamId?: string): Promise<any[]> {
  let query = supabase
    .from('todos')
    .select('*')
    .in('id', [todoId, targetTodoId]);

  if (teamId) {
    query = query.eq('team_id', teamId);
  }

  const { data: tasks } = await query;

  if (!tasks || tasks.length !== 2) {
    return [];
  }

  const [task1, task2] = tasks;

  // Swap display_order
  const updates = [
    { id: task1.id, display_order: task2.display_order ?? 0 },
    { id: task2.id, display_order: task1.display_order ?? 0 },
  ];

  const updatedTasks = [];
  for (const update of updates) {
    const { data, error } = await supabase
      .from('todos')
      .update({ display_order: update.display_order, updated_at: new Date().toISOString() })
      .eq('id', update.id)
      .select()
      .single();

    if (error) {
      logger.error('Error swapping tasks', error, { taskId: update.id });
    } else if (data) {
      updatedTasks.push(data);
    }
  }

  return updatedTasks;
}
