/**
 * Project Statistics API
 *
 * GET /api/projects/[id]/stats - Get statistics for a single project
 *
 * Returns task counts, completion rates, priority breakdowns, and recent activity.
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
 * Extract project ID from the URL path
 */
function getProjectIdFromUrl(request: NextRequest): string | null {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  // URL pattern: /api/projects/[id]/stats
  const projectsIndex = segments.indexOf('projects');
  if (projectsIndex !== -1 && segments.length > projectsIndex + 1) {
    return segments[projectsIndex + 1];
  }
  return null;
}

/**
 * GET /api/projects/[id]/stats - Get project statistics
 */
export const GET = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const projectId = getProjectIdFromUrl(request);

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Fetch the project (verify access)
    let projectQuery = supabase
      .from('projects')
      .select('*')
      .eq('id', projectId);

    if (context.teamId && context.teamId.trim() !== '') {
      projectQuery = projectQuery.eq('team_id', context.teamId);
    }

    const { data: project, error: projectError } = await projectQuery.single();

    if (projectError) {
      if (projectError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Project not found' },
          { status: 404 }
        );
      }
      throw projectError;
    }

    // Fetch all todos for this project
    let todosQuery = supabase
      .from('todos')
      .select('id, text, completed, status, priority, category, due_date, assigned_to, created_by, updated_at, created_at')
      .eq('project_id', projectId);

    if (context.teamId && context.teamId.trim() !== '') {
      todosQuery = todosQuery.eq('team_id', context.teamId);
    }

    const { data: todos, error: todosError } = await todosQuery;

    if (todosError) throw todosError;

    const allTodos = todos || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate seven days ago for recent completions
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Compute stats
    const totalTasks = allTodos.length;
    const completedTasks = allTodos.filter(t => t.completed).length;
    const inProgressTasks = allTodos.filter(t => !t.completed && t.status === 'in_progress').length;
    const todoTasks = allTodos.filter(t => !t.completed && (t.status === 'todo' || !t.status)).length;

    const overdueTasks = allTodos.filter(t => {
      if (t.completed || !t.due_date) return false;
      const dueDate = new Date(t.due_date);
      dueDate.setHours(23, 59, 59, 999);
      return dueDate < today;
    }).length;

    const completionRate = totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

    // Tasks by priority
    const tasksByPriority: Record<string, number> = {};
    for (const todo of allTodos) {
      const priority = todo.priority || 'medium';
      tasksByPriority[priority] = (tasksByPriority[priority] || 0) + 1;
    }

    // Tasks by category
    const tasksByCategory: Record<string, number> = {};
    for (const todo of allTodos) {
      const category = todo.category || 'uncategorized';
      tasksByCategory[category] = (tasksByCategory[category] || 0) + 1;
    }

    // Tasks by status
    const tasksByStatus: Record<string, number> = {
      todo: todoTasks,
      in_progress: inProgressTasks,
      done: completedTasks,
    };

    // Tasks by assignee
    const tasksByAssignee: Record<string, { total: number; completed: number }> = {};
    for (const todo of allTodos) {
      const assignee = todo.assigned_to || 'Unassigned';
      if (!tasksByAssignee[assignee]) {
        tasksByAssignee[assignee] = { total: 0, completed: 0 };
      }
      tasksByAssignee[assignee].total++;
      if (todo.completed) {
        tasksByAssignee[assignee].completed++;
      }
    }

    // Recent completions (last 7 days)
    const recentCompletions = allTodos.filter(t => {
      if (!t.completed) return false;
      const updatedAt = t.updated_at ? new Date(t.updated_at) : new Date(t.created_at);
      return updatedAt >= sevenDaysAgo;
    }).length;

    // Recent activity: last 10 tasks modified
    const recentActivity = [...allTodos]
      .sort((a, b) => {
        const aDate = a.updated_at || a.created_at;
        const bDate = b.updated_at || b.created_at;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      })
      .slice(0, 10)
      .map(t => ({
        id: t.id,
        text: t.text,
        completed: t.completed,
        status: t.status,
        priority: t.priority,
        assigned_to: t.assigned_to,
        due_date: t.due_date,
        updated_at: t.updated_at || t.created_at,
      }));

    return NextResponse.json({
      success: true,
      project,
      stats: {
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        in_progress_tasks: inProgressTasks,
        todo_tasks: todoTasks,
        overdue_tasks: overdueTasks,
        completion_rate: completionRate,
        tasks_by_priority: tasksByPriority,
        tasks_by_category: tasksByCategory,
        tasks_by_status: tasksByStatus,
        tasks_by_assignee: tasksByAssignee,
        recent_completions: recentCompletions,
        recent_activity: recentActivity,
      },
    });
  } catch (error) {
    logger.error('Error fetching project stats', error as Error, {
      component: 'api/projects/[id]/stats',
      action: 'GET',
    });
    return NextResponse.json(
      { error: 'Failed to fetch project statistics' },
      { status: 500 }
    );
  }
});
