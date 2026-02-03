import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

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
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { todoId, newOrder, direction, targetTodoId, userName } = body;

    if (!todoId) {
      return NextResponse.json(
        { error: 'todoId is required' },
        { status: 400 }
      );
    }

    // Get the current task
    const { data: currentTask, error: fetchError } = await supabase
      .from('todos')
      .select('*')
      .eq('id', todoId)
      .single();

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
      // Mode 1: Move to specific position
      updatedTasks = await moveToPosition(todoId, currentTask.display_order ?? 0, newOrder);
    } else if (direction) {
      // Mode 2: Move up or down
      updatedTasks = await moveUpOrDown(todoId, currentTask.display_order ?? 0, direction);
    } else if (targetTodoId) {
      // Mode 3: Swap with target task
      updatedTasks = await swapTasks(todoId, targetTodoId);
    } else {
      return NextResponse.json(
        { error: 'Must provide newOrder, direction, or targetTodoId' },
        { status: 400 }
      );
    }

    // Log activity
    if (userName) {
      await supabase.from('activity_log').insert({
        action: 'task_reordered',
        todo_id: todoId,
        todo_text: currentTask.text,
        user_name: userName,
        details: {
          from: currentTask.display_order ?? 0,
          to: updatedTasks.find(t => t.id === todoId)?.display_order ?? 0,
        },
      });
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
}

/**
 * Move task to a specific position
 */
async function moveToPosition(
  todoId: string,
  currentOrder: number,
  newOrder: number
): Promise<any[]> {
  // Get all tasks ordered by display_order
  const { data: allTasks } = await supabase
    .from('todos')
    .select('*')
    .order('display_order', { ascending: true, nullsFirst: false });

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
  direction: 'up' | 'down'
): Promise<any[]> {
  const offset = direction === 'up' ? -1 : 1;
  const targetOrder = currentOrder + offset;

  if (targetOrder < 0) {
    // Already at top
    return [];
  }

  // Find the task at the target position
  const { data: targetTask } = await supabase
    .from('todos')
    .select('*')
    .eq('display_order', targetOrder)
    .single();

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
async function swapTasks(todoId: string, targetTodoId: string): Promise<any[]> {
  const { data: tasks } = await supabase
    .from('todos')
    .select('*')
    .in('id', [todoId, targetTodoId]);

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
