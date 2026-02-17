/**
 * Todo Dependencies API - List, Create, Delete
 *
 * GET    /api/todos/dependencies?todoId=xxx - List dependencies for a todo
 * POST   /api/todos/dependencies            - Create a dependency
 * DELETE  /api/todos/dependencies            - Remove a dependency
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
 * GET /api/todos/dependencies?todoId=xxx
 * Returns both "blocks" (todos this task blocks) and "blockedBy" (todos that block this task),
 * enriched with task text and status.
 */
export const GET = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const { searchParams } = new URL(request.url);
    const todoId = searchParams.get('todoId');

    if (!todoId) {
      return NextResponse.json(
        { error: 'todoId query parameter is required' },
        { status: 400 }
      );
    }

    // Validate UUID format to prevent injection
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(todoId)) {
      return NextResponse.json(
        { error: 'todoId must be a valid UUID' },
        { status: 400 }
      );
    }

    // Verify the todo belongs to this team
    const { data: todo, error: todoError } = await supabase
      .from('todos')
      .select('id, team_id')
      .eq('id', todoId)
      .single();

    if (todoError || !todo) {
      return NextResponse.json(
        { error: 'Todo not found' },
        { status: 404 }
      );
    }

    if (context.teamId && context.teamId.trim() !== '' && todo.team_id !== context.teamId) {
      return NextResponse.json(
        { error: 'Todo does not belong to your team' },
        { status: 403 }
      );
    }

    // Get todos that this task blocks (this task is the blocker)
    const { data: blocksRaw, error: blocksError } = await supabase
      .from('todo_dependencies')
      .select('blocker_id, blocked_id, created_at')
      .eq('blocker_id', todoId);

    if (blocksError) throw blocksError;

    // Get todos that block this task (this task is blocked)
    const { data: blockedByRaw, error: blockedByError } = await supabase
      .from('todo_dependencies')
      .select('blocker_id, blocked_id, created_at')
      .eq('blocked_id', todoId);

    if (blockedByError) throw blockedByError;

    // Collect all related todo IDs to fetch their text and status
    const relatedIds = new Set<string>();
    (blocksRaw || []).forEach(d => relatedIds.add(d.blocked_id));
    (blockedByRaw || []).forEach(d => relatedIds.add(d.blocker_id));

    let todosMap: Record<string, { text: string; status: string }> = {};
    if (relatedIds.size > 0) {
      const { data: relatedTodos, error: relatedError } = await supabase
        .from('todos')
        .select('id, text, status')
        .in('id', Array.from(relatedIds));

      if (relatedError) throw relatedError;

      (relatedTodos || []).forEach(t => {
        todosMap[t.id] = { text: t.text, status: t.status };
      });
    }

    // Enrich with task text and status
    const blocks = (blocksRaw || []).map(d => ({
      blocker_id: d.blocker_id,
      blocked_id: d.blocked_id,
      task_text: todosMap[d.blocked_id]?.text || 'Unknown task',
      task_status: todosMap[d.blocked_id]?.status || 'todo',
    }));

    const blockedBy = (blockedByRaw || []).map(d => ({
      blocker_id: d.blocker_id,
      blocked_id: d.blocked_id,
      task_text: todosMap[d.blocker_id]?.text || 'Unknown task',
      task_status: todosMap[d.blocker_id]?.status || 'todo',
    }));

    return NextResponse.json({
      success: true,
      data: { blocks, blockedBy },
    });
  } catch (error) {
    logger.error('Error fetching dependencies', error as Error, {
      component: 'api/todos/dependencies',
      action: 'GET',
    });
    return NextResponse.json(
      { error: 'Failed to fetch dependencies' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/todos/dependencies
 * Create a dependency. Body: { blocker_id, blocked_id }
 * Validates both todos belong to the same team and checks for circular dependencies.
 */
export const POST = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const body = await request.json();
    const { blocker_id, blocked_id } = body;

    if (!blocker_id || !blocked_id) {
      return NextResponse.json(
        { error: 'blocker_id and blocked_id are required' },
        { status: 400 }
      );
    }

    // Validate UUID format to prevent injection
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof blocker_id !== 'string' || typeof blocked_id !== 'string' ||
        !UUID_REGEX.test(blocker_id) || !UUID_REGEX.test(blocked_id)) {
      return NextResponse.json(
        { error: 'blocker_id and blocked_id must be valid UUIDs' },
        { status: 400 }
      );
    }

    if (blocker_id === blocked_id) {
      return NextResponse.json(
        { error: 'A task cannot depend on itself' },
        { status: 400 }
      );
    }

    // Verify both todos exist and belong to the same team
    const { data: todos, error: todosError } = await supabase
      .from('todos')
      .select('id, team_id')
      .in('id', [blocker_id, blocked_id]);

    if (todosError) throw todosError;

    if (!todos || todos.length !== 2) {
      return NextResponse.json(
        { error: 'One or both todos not found' },
        { status: 404 }
      );
    }

    const blockerTodo = todos.find(t => t.id === blocker_id);
    const blockedTodo = todos.find(t => t.id === blocked_id);

    if (!blockerTodo || !blockedTodo) {
      return NextResponse.json(
        { error: 'One or both todos not found' },
        { status: 404 }
      );
    }

    // Verify team membership
    if (context.teamId && context.teamId.trim() !== '') {
      if (blockerTodo.team_id !== context.teamId || blockedTodo.team_id !== context.teamId) {
        return NextResponse.json(
          { error: 'Both todos must belong to your team' },
          { status: 403 }
        );
      }
    }

    // Check for circular dependency: walk the dependency chain from blocked_id
    // to see if blocker_id is reachable (meaning adding this edge would create a cycle).
    // This detects both direct (A->B, B->A) and transitive (A->B, B->C, C->A) cycles.
    const visited = new Set<string>();
    const queue: string[] = [blocked_id];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (currentId === blocker_id) {
        return NextResponse.json(
          { error: 'Circular dependency detected: adding this dependency would create a cycle' },
          { status: 409 }
        );
      }
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // Get all tasks that currentId blocks (i.e., where currentId is the blocker)
      const { data: downstream, error: downstreamError } = await supabase
        .from('todo_dependencies')
        .select('blocked_id')
        .eq('blocker_id', currentId);

      if (downstreamError) throw downstreamError;

      if (downstream) {
        for (const dep of downstream) {
          if (!visited.has(dep.blocked_id)) {
            queue.push(dep.blocked_id);
          }
        }
      }
    }

    // Check for existing dependency
    const { data: existingCheck, error: existingError } = await supabase
      .from('todo_dependencies')
      .select('blocker_id')
      .eq('blocker_id', blocker_id)
      .eq('blocked_id', blocked_id);

    if (existingError) throw existingError;

    if (existingCheck && existingCheck.length > 0) {
      return NextResponse.json(
        { error: 'This dependency already exists' },
        { status: 409 }
      );
    }

    // Create the dependency
    const { data, error } = await supabase
      .from('todo_dependencies')
      .insert({ blocker_id, blocked_id })
      .select()
      .single();

    if (error) throw error;

    logger.info('Dependency created', {
      component: 'api/todos/dependencies',
      action: 'POST',
      blocker_id,
      blocked_id,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('Error creating dependency', error as Error, {
      component: 'api/todos/dependencies',
      action: 'POST',
    });
    return NextResponse.json(
      { error: 'Failed to create dependency' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/todos/dependencies
 * Remove a dependency. Body: { blocker_id, blocked_id }
 */
export const DELETE = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const body = await request.json();
    const { blocker_id, blocked_id } = body;

    if (!blocker_id || !blocked_id) {
      return NextResponse.json(
        { error: 'blocker_id and blocked_id are required' },
        { status: 400 }
      );
    }

    // Validate UUID format to prevent injection
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof blocker_id !== 'string' || typeof blocked_id !== 'string' ||
        !UUID_REGEX.test(blocker_id) || !UUID_REGEX.test(blocked_id)) {
      return NextResponse.json(
        { error: 'blocker_id and blocked_id must be valid UUIDs' },
        { status: 400 }
      );
    }

    // Verify both todos belong to this team before deleting
    const { data: relatedTodos, error: todoError } = await supabase
      .from('todos')
      .select('id, team_id')
      .in('id', [blocker_id, blocked_id]);

    if (todoError) throw todoError;

    const blockerTodo = relatedTodos?.find(t => t.id === blocker_id);
    const blockedTodo = relatedTodos?.find(t => t.id === blocked_id);

    if (!blockerTodo || !blockedTodo) {
      return NextResponse.json(
        { error: 'One or both todos not found' },
        { status: 404 }
      );
    }

    if (context.teamId && context.teamId.trim() !== '') {
      if (blockerTodo.team_id !== context.teamId || blockedTodo.team_id !== context.teamId) {
        return NextResponse.json(
          { error: 'Both todos must belong to your team' },
          { status: 403 }
        );
      }
    }

    const { error } = await supabase
      .from('todo_dependencies')
      .delete()
      .eq('blocker_id', blocker_id)
      .eq('blocked_id', blocked_id);

    if (error) throw error;

    logger.info('Dependency removed', {
      component: 'api/todos/dependencies',
      action: 'DELETE',
      blocker_id,
      blocked_id,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    logger.error('Error removing dependency', error as Error, {
      component: 'api/todos/dependencies',
      action: 'DELETE',
    });
    return NextResponse.json(
      { error: 'Failed to remove dependency' },
      { status: 500 }
    );
  }
});
