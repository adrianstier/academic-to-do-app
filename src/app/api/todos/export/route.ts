/**
 * Todo Export API
 *
 * GET /api/todos/export?format=csv|json
 *
 * Exports all todos for the current team with their tags and project names.
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
 * Escape a value for CSV output
 */
function escapeCsvValue(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // If value contains comma, quote, or newline, wrap in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * GET /api/todos/export - Export todos as CSV or JSON
 */
export const GET = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    if (format !== 'csv' && format !== 'json') {
      return NextResponse.json(
        { error: 'Invalid format. Must be "csv" or "json"' },
        { status: 400 }
      );
    }

    // Fetch todos
    let todosQuery = supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false });

    if (context.teamId && context.teamId.trim() !== '') {
      todosQuery = todosQuery.eq('team_id', context.teamId);
    }

    const { data: todos, error: todosError } = await todosQuery;
    if (todosError) throw todosError;

    if (!todos || todos.length === 0) {
      if (format === 'csv') {
        return new NextResponse(
          'id,text,status,priority,category,due_date,start_date,project_name,tags,assigned_to,notes,created_at\n',
          {
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': 'attachment; filename="todos-export.csv"',
            },
          }
        );
      }
      return NextResponse.json({ success: true, data: [] });
    }

    // Fetch projects for this team
    let projectsQuery = supabase
      .from('projects')
      .select('id, name');

    if (context.teamId && context.teamId.trim() !== '') {
      projectsQuery = projectsQuery.eq('team_id', context.teamId);
    }

    const { data: projects } = await projectsQuery;
    const projectMap = new Map((projects || []).map(p => [p.id, p.name]));

    // Fetch todo_tags with tag names
    const todoIds = todos.map(t => t.id);
    let todoTagsQuery = supabase
      .from('todo_tags')
      .select('todo_id, tag_id, tags(name)')
      .in('todo_id', todoIds);

    const { data: todoTags } = await todoTagsQuery;

    // Build a map of todo_id -> tag names
    const todoTagMap = new Map<string, string[]>();
    if (todoTags) {
      for (const tt of todoTags) {
        const tagNames = todoTagMap.get(tt.todo_id) || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tagData = tt.tags as any;
        if (tagData?.name) {
          tagNames.push(tagData.name);
        }
        todoTagMap.set(tt.todo_id, tagNames);
      }
    }

    if (format === 'json') {
      // JSON export: full todo objects with nested project and tags
      const enrichedTodos = todos.map(todo => ({
        ...todo,
        project_name: todo.project_id ? projectMap.get(todo.project_id) || null : null,
        tags: todoTagMap.get(todo.id) || [],
      }));

      return NextResponse.json({
        success: true,
        data: enrichedTodos,
      });
    }

    // CSV export
    const csvHeader = 'id,text,status,priority,category,due_date,start_date,project_name,tags,assigned_to,notes,created_at';
    const csvRows = todos.map(todo => {
      const projectName = todo.project_id ? projectMap.get(todo.project_id) || '' : '';
      const tagNames = (todoTagMap.get(todo.id) || []).join('; ');

      return [
        escapeCsvValue(todo.id),
        escapeCsvValue(todo.text),
        escapeCsvValue(todo.status),
        escapeCsvValue(todo.priority),
        escapeCsvValue(todo.category),
        escapeCsvValue(todo.due_date),
        escapeCsvValue(todo.start_date),
        escapeCsvValue(projectName),
        escapeCsvValue(tagNames),
        escapeCsvValue(todo.assigned_to),
        escapeCsvValue(todo.notes),
        escapeCsvValue(todo.created_at),
      ].join(',');
    });

    const csvContent = [csvHeader, ...csvRows].join('\n');

    logger.info('Todos exported', {
      component: 'api/todos/export',
      action: 'GET',
      format,
      count: todos.length,
    });

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="todos-export.csv"',
      },
    });
  } catch (error) {
    logger.error('Error exporting todos', error as Error, {
      component: 'api/todos/export',
      action: 'GET',
    });
    return NextResponse.json(
      { error: 'Failed to export todos' },
      { status: 500 }
    );
  }
});
