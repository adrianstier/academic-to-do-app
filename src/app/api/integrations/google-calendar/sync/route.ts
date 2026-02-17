/**
 * Google Calendar Sync Endpoint
 *
 * POST /api/integrations/google-calendar/sync
 *
 * Syncs tasks between the academic todo app and Google Calendar.
 *
 * Request body:
 * {
 *   direction: 'push' | 'pull' | 'both',
 *   since?: string,              // ISO date - only sync items modified after this time
 *   accessToken: string,         // Google access token from client storage
 *   refreshToken: string,        // Google refresh token for token refresh
 *   calendarIds?: string[],      // Calendar IDs to pull from (for pull/both)
 *   projectIds?: string[] | 'all', // Project IDs to push (for push/both)
 * }
 *
 * Response:
 * { pushed: number, pulled: number, errors: string[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { withTeamAuth, TeamAuthContext } from '@/lib/teamAuth';
import {
  getValidAccessToken,
  listEvents,
  createEvent,
  buildEventFromTodo,
  type GoogleTokens,
  type SyncResult,
  type SyncDirection,
} from '@/lib/googleCalendar';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SyncRequestBody {
  direction: SyncDirection;
  since?: string;
  accessToken: string;
  refreshToken: string;
  calendarIds?: string[];
  projectIds?: string[] | 'all';
}

export const POST = withTeamAuth(async (request: NextRequest, context: TeamAuthContext) => {
  try {
    const body: SyncRequestBody = await request.json();

    // Validate request
    if (!body.direction || !['push', 'pull', 'both'].includes(body.direction)) {
      return NextResponse.json(
        { error: 'Invalid direction. Must be "push", "pull", or "both".' },
        { status: 400 }
      );
    }

    if (!body.accessToken || !body.refreshToken) {
      return NextResponse.json(
        { error: 'Missing Google Calendar credentials. Please reconnect your account.' },
        { status: 401 }
      );
    }

    // Build tokens object and ensure we have a valid access token
    const tokens: GoogleTokens = {
      access_token: body.accessToken,
      refresh_token: body.refreshToken,
      expires_at: 0, // Force refresh check
      token_type: 'Bearer',
      scope: '',
    };

    let validTokens: GoogleTokens;
    try {
      validTokens = await getValidAccessToken(tokens);
    } catch {
      return NextResponse.json(
        {
          error: 'Google Calendar token expired or invalid. Please reconnect.',
          reconnect: true,
        },
        { status: 401 }
      );
    }

    const result: SyncResult = { pushed: 0, pulled: 0, errors: [] };

    // Execute sync based on direction
    if (body.direction === 'push' || body.direction === 'both') {
      const pushResult = await pushToCalendar(
        validTokens.access_token,
        context,
        body.projectIds || 'all',
        body.since
      );
      result.pushed = pushResult.pushed;
      result.errors.push(...pushResult.errors);
    }

    if (body.direction === 'pull' || body.direction === 'both') {
      const pullResult = await pullFromCalendar(
        validTokens.access_token,
        context,
        body.calendarIds || ['primary'],
        body.since
      );
      result.pulled = pullResult.pulled;
      result.errors.push(...pullResult.errors);
    }

    logger.info('Google Calendar sync completed', {
      component: 'api/integrations/google-calendar/sync',
      action: 'POST',
      userId: context.userId,
      metadata: {
        direction: body.direction,
        pushed: result.pushed,
        pulled: result.pulled,
        errorCount: result.errors.length,
      },
    });

    // Return updated tokens if they were refreshed
    return NextResponse.json({
      success: true,
      ...result,
      // Return refreshed tokens so client can update storage
      ...(validTokens.access_token !== body.accessToken
        ? {
            updatedTokens: {
              access_token: validTokens.access_token,
              expires_at: validTokens.expires_at,
            },
          }
        : {}),
    });
  } catch (error) {
    logger.error('Error syncing with Google Calendar', error as Error, {
      component: 'api/integrations/google-calendar/sync',
      action: 'POST',
    });
    return NextResponse.json(
      { error: 'Failed to sync with Google Calendar' },
      { status: 500 }
    );
  }
});

// ============================================
// Push: Tasks -> Google Calendar
// ============================================

async function pushToCalendar(
  accessToken: string,
  context: TeamAuthContext,
  projectIds: string[] | 'all',
  since?: string
): Promise<{ pushed: number; errors: string[] }> {
  const pushed = { count: 0 };
  const errors: string[] = [];

  try {
    // Fetch todos with due dates
    let query = supabase
      .from('todos')
      .select('id, text, due_date, notes, project_id, status, completed')
      .not('due_date', 'is', null)
      .eq('completed', false);

    // Team-scope the query
    if (context.teamId && context.teamId.trim() !== '') {
      query = query.eq('team_id', context.teamId);
    }

    // Filter by projects if specified
    if (projectIds !== 'all' && Array.isArray(projectIds) && projectIds.length > 0) {
      query = query.in('project_id', projectIds);
    }

    // Only sync items modified since a given date
    if (since) {
      query = query.gte('updated_at', since);
    }

    const { data: todos, error: todosError } = await query;

    if (todosError) {
      errors.push(`Failed to fetch tasks: ${todosError.message}`);
      return { pushed: pushed.count, errors };
    }

    if (!todos || todos.length === 0) {
      return { pushed: 0, errors };
    }

    // Fetch project colors for color mapping
    const projectIdsToFetch = [...new Set(todos.map((t) => t.project_id).filter(Boolean))];
    let projectColors: Record<string, string> = {};

    if (projectIdsToFetch.length > 0) {
      const { data: projects } = await supabase
        .from('projects')
        .select('id, color')
        .in('id', projectIdsToFetch);

      if (projects) {
        projectColors = Object.fromEntries(projects.map((p) => [p.id, p.color]));
      }
    }

    // Push each todo as a calendar event
    for (const todo of todos) {
      try {
        const projectColor = todo.project_id ? projectColors[todo.project_id] : undefined;
        const eventInput = buildEventFromTodo(todo, projectColor);

        if (!eventInput) continue;

        // Check if this todo already has a linked calendar event
        // We use extendedProperties to track the link
        // For MVP, always create new events (idempotency via extendedProperties.private.todoAppId)
        // A production version would check existing events first

        await createEvent(accessToken, 'primary', eventInput);
        pushed.count++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to push task "${todo.text}": ${message}`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Push sync error: ${message}`);
  }

  return { pushed: pushed.count, errors };
}

// ============================================
// Pull: Google Calendar -> Tasks
// ============================================

async function pullFromCalendar(
  accessToken: string,
  context: TeamAuthContext,
  calendarIds: string[],
  since?: string
): Promise<{ pulled: number; errors: string[] }> {
  let pulled = 0;
  const errors: string[] = [];

  try {
    // Set time range for pulling events
    const timeMin = since || new Date().toISOString();
    // Look 90 days ahead by default
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 90);
    const timeMax = futureDate.toISOString();

    for (const calendarId of calendarIds) {
      try {
        const events = await listEvents(accessToken, calendarId, timeMin, timeMax);

        for (const event of events) {
          try {
            // Skip cancelled events
            if (event.status === 'cancelled') continue;

            // Skip events that originated from this app (avoid duplicates)
            const todoAppId = event.extendedProperties?.private?.todoAppId;
            if (todoAppId) continue;

            // Skip events without a title
            if (!event.summary) continue;

            // Check if this event was already imported (by external ID / Google event ID)
            // Search for existing todos with matching text and date to avoid duplicates
            const eventDate = event.start?.date || event.start?.dateTime?.split('T')[0];
            if (!eventDate) continue;

            const { data: existing } = await supabase
              .from('todos')
              .select('id')
              .eq('text', event.summary)
              .eq('due_date', eventDate)
              .limit(1);

            if (existing && existing.length > 0) continue;

            // Create a new todo from the calendar event
            const newTodo: Record<string, unknown> = {
              text: event.summary,
              due_date: eventDate,
              completed: false,
              status: 'todo',
              priority: 'medium',
              created_by: context.userName,
              created_at: new Date().toISOString(),
            };

            // Add notes from event description
            if (event.description) {
              newTodo.notes = event.description.substring(0, 8000);
            }

            // Team-scope
            if (context.teamId && context.teamId.trim() !== '') {
              newTodo.team_id = context.teamId;
            }

            const { error: insertError } = await supabase.from('todos').insert(newTodo);

            if (insertError) {
              errors.push(`Failed to import "${event.summary}": ${insertError.message}`);
            } else {
              pulled++;
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`Failed to process event "${event.summary}": ${message}`);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to fetch events from calendar "${calendarId}": ${message}`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Pull sync error: ${message}`);
  }

  return { pulled, errors };
}
