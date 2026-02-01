import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { withTeamAuth } from '@/lib/teamAuth';
import type { Todo, ActivityLogEntry } from '@/types/todo';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize Supabase client with service role for server-side queries
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration is missing');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Response types
export interface DailyDigestTask {
  id: string;
  text: string;
  priority: string;
  due_date?: string;
  assigned_to?: string;
  status: string;
  subtasks_count: number;
  subtasks_completed: number;
}

export interface DailyDigestResponse {
  greeting: string;
  overdueTasks: {
    count: number;
    summary: string;
    tasks: DailyDigestTask[];
  };
  todaysTasks: {
    count: number;
    summary: string;
    tasks: DailyDigestTask[];
  };
  teamActivity: {
    summary: string;
    highlights: string[];
  };
  focusSuggestion: string;
  generatedAt: string;
}

// Helper to get time of day greeting
function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Helper to format task for AI prompt
function formatTaskForPrompt(task: Todo): string {
  const subtasksInfo = task.subtasks && task.subtasks.length > 0
    ? ` (${task.subtasks.filter(s => s.completed).length}/${task.subtasks.length} subtasks done)`
    : '';
  const assignedInfo = task.assigned_to ? ` [Assigned: ${task.assigned_to}]` : '';
  const dueInfo = task.due_date ? ` [Due: ${new Date(task.due_date).toLocaleDateString()}]` : '';

  return `- ${task.text} (${task.priority} priority)${assignedInfo}${dueInfo}${subtasksInfo}`;
}

// Helper to format activity for AI prompt
function formatActivityForPrompt(activity: ActivityLogEntry): string {
  const time = new Date(activity.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const actionDescriptions: Record<string, string> = {
    task_created: 'created task',
    task_completed: 'completed task',
    task_updated: 'updated task',
    task_deleted: 'deleted task',
    task_reopened: 'reopened task',
    status_changed: 'changed status of',
    priority_changed: 'changed priority of',
    assigned_to_changed: 'reassigned',
    subtask_completed: 'completed subtask on',
    subtask_added: 'added subtask to',
    attachment_added: 'added attachment to',
  };

  const actionText = actionDescriptions[activity.action] || activity.action.replace(/_/g, ' ');
  const taskText = activity.todo_text ? `"${activity.todo_text}"` : '';

  return `- ${time}: ${activity.user_name} ${actionText} ${taskText}`;
}

// Transform Todo to DailyDigestTask
function transformTask(task: Todo): DailyDigestTask {
  return {
    id: task.id,
    text: task.text,
    priority: task.priority,
    due_date: task.due_date,
    assigned_to: task.assigned_to,
    status: task.status,
    subtasks_count: task.subtasks?.length || 0,
    subtasks_completed: task.subtasks?.filter(s => s.completed).length || 0,
  };
}

export const POST = withTeamAuth(async (request, context) => {
  const startTime = Date.now();

  try {
    // Use authenticated userName from context
    const sanitizedUserName = context.userName;

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      logger.error('ANTHROPIC_API_KEY not configured', undefined, { component: 'DailyDigestAPI' });
      return NextResponse.json(
        { success: false, error: 'AI service not configured' },
        { status: 500 }
      );
    }

    const supabase = getSupabaseClient();

    // Get today's date boundaries
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Build base queries with optional team_id filtering
    let overdueQuery = supabase
      .from('todos')
      .select('*')
      .lt('due_date', todayStart.toISOString())
      .eq('completed', false)
      .order('due_date', { ascending: true });

    let todayQuery = supabase
      .from('todos')
      .select('*')
      .gte('due_date', todayStart.toISOString())
      .lt('due_date', todayEnd.toISOString())
      .eq('completed', false)
      .order('priority', { ascending: false });

    let completedQuery = supabase
      .from('todos')
      .select('*')
      .eq('completed', true)
      .gte('updated_at', yesterdayStart.toISOString())
      .lt('updated_at', todayStart.toISOString())
      .order('updated_at', { ascending: false });

    let activityQuery = supabase
      .from('activity_log')
      .select('*')
      .gte('created_at', last24Hours.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    // Apply team_id filtering if multi-tenancy is active
    if (context.teamId) {
      overdueQuery = overdueQuery.eq('team_id', context.teamId);
      todayQuery = todayQuery.eq('team_id', context.teamId);
      completedQuery = completedQuery.eq('team_id', context.teamId);
      activityQuery = activityQuery.eq('team_id', context.teamId);
    }

    // Run all 4 database queries in parallel for better performance
    const [
      overdueResult,
      todayResult,
      completedResult,
      activityResult,
    ] = await Promise.all([
      overdueQuery,
      todayQuery,
      completedQuery,
      activityQuery,
    ]);

    // Check for errors
    if (overdueResult.error) {
      logger.error('Failed to fetch overdue tasks', overdueResult.error, { component: 'DailyDigestAPI' });
      throw overdueResult.error;
    }
    if (todayResult.error) {
      logger.error('Failed to fetch today tasks', todayResult.error, { component: 'DailyDigestAPI' });
      throw todayResult.error;
    }
    if (completedResult.error) {
      logger.error('Failed to fetch completed tasks', completedResult.error, { component: 'DailyDigestAPI' });
      throw completedResult.error;
    }
    if (activityResult.error) {
      logger.error('Failed to fetch activity log', activityResult.error, { component: 'DailyDigestAPI' });
      throw activityResult.error;
    }

    const overdueTasks = overdueResult.data;
    const todayTasks = todayResult.data;
    const completedYesterday = completedResult.data;
    const recentActivity = activityResult.data;

    // Prepare data for AI prompt
    const overdueTasksTyped = (overdueTasks || []) as Todo[];
    const todayTasksTyped = (todayTasks || []) as Todo[];
    const completedYesterdayTyped = (completedYesterday || []) as Todo[];
    const recentActivityTyped = (recentActivity || []) as ActivityLogEntry[];

    // Filter tasks relevant to the user (assigned to them or created by them)
    const userOverdueTasks = overdueTasksTyped.filter(
      t => t.assigned_to === sanitizedUserName || t.created_by === sanitizedUserName || !t.assigned_to
    );
    const userTodayTasks = todayTasksTyped.filter(
      t => t.assigned_to === sanitizedUserName || t.created_by === sanitizedUserName || !t.assigned_to
    );

    // Build the AI prompt
    const prompt = `You are generating a personalized daily briefing for ${sanitizedUserName} on an academic research team.

Today is ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

Here is the current task and activity data:

=== OVERDUE TASKS (${userOverdueTasks.length} tasks) ===
${userOverdueTasks.length > 0
  ? userOverdueTasks.map(formatTaskForPrompt).join('\n')
  : 'No overdue tasks - great job staying on top of things!'}

=== TASKS DUE TODAY (${userTodayTasks.length} tasks) ===
${userTodayTasks.length > 0
  ? userTodayTasks.map(formatTaskForPrompt).join('\n')
  : 'No tasks due today.'}

=== TEAM COMPLETIONS YESTERDAY (${completedYesterdayTyped.length} tasks) ===
${completedYesterdayTyped.length > 0
  ? completedYesterdayTyped.map(t => `- ${t.text} (completed by ${t.updated_by || t.assigned_to || 'team'})`).join('\n')
  : 'No tasks were completed yesterday.'}

=== RECENT TEAM ACTIVITY (last 24 hours) ===
${recentActivityTyped.length > 0
  ? recentActivityTyped.slice(0, 20).map(formatActivityForPrompt).join('\n')
  : 'No recent activity recorded.'}

Based on this data, generate a personalized daily briefing. Be encouraging, professional, and aware of academic research workflows.

Respond with ONLY valid JSON (no markdown, no code blocks) in this exact format:
{
  "overdueSummary": "A brief 1-2 sentence summary of the overdue situation, with empathy if there are overdue tasks",
  "todaySummary": "A brief 1-2 sentence summary of what's on the plate for today",
  "teamActivitySummary": "A brief 1-2 sentence summary of team activity and momentum",
  "teamHighlights": ["Up to 3 notable team accomplishments or activity highlights"],
  "focusSuggestion": "A helpful, specific recommendation for what ${sanitizedUserName} should focus on first today, based on priorities and urgency. Be actionable and encouraging."
}

Guidelines:
- Keep summaries concise but warm and personalized
- Use academic terminology naturally when relevant (manuscripts, submissions, deadlines, data analysis, etc.)
- If there are urgent/high priority overdue tasks, emphasize those
- For focus suggestion, consider: urgent items first, then high priority, then by due date
- Acknowledge team wins to boost morale
- Be encouraging even if there are challenges`;

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text'
      ? message.content[0].text
      : '';

    // Parse the JSON from Claude's response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.error('Failed to parse AI response', undefined, {
        component: 'DailyDigestAPI',
        responseText: responseText.substring(0, 500)
      });
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    let aiResponse;
    try {
      aiResponse = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      logger.error('Failed to parse AI response JSON', parseError, {
        component: 'DailyDigestAPI',
        responseText: responseText.substring(0, 500)
      });
      return NextResponse.json(
        { success: false, error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    // Build the final response
    const greeting = `${getTimeOfDayGreeting()}, ${sanitizedUserName}!`;

    const response: DailyDigestResponse = {
      greeting,
      overdueTasks: {
        count: userOverdueTasks.length,
        summary: String(aiResponse.overdueSummary || 'No overdue tasks.'),
        tasks: userOverdueTasks.slice(0, 10).map(transformTask),
      },
      todaysTasks: {
        count: userTodayTasks.length,
        summary: String(aiResponse.todaySummary || 'No tasks due today.'),
        tasks: userTodayTasks.slice(0, 10).map(transformTask),
      },
      teamActivity: {
        summary: String(aiResponse.teamActivitySummary || 'No recent team activity.'),
        highlights: Array.isArray(aiResponse.teamHighlights)
          ? aiResponse.teamHighlights.map(String).slice(0, 5)
          : [],
      },
      focusSuggestion: String(aiResponse.focusSuggestion || 'Start with your highest priority task.'),
      generatedAt: new Date().toISOString(),
    };

    // Log performance - SEC-03 compliant: no PII (userName) in logs
    const duration = Date.now() - startTime;
    logger.performance('DailyDigest generation', duration, {
      component: 'DailyDigestAPI',
      // Note: userName intentionally omitted to comply with SEC-03 (No PII in logs)
      overdueTasks: userOverdueTasks.length,
      todayTasks: userTodayTasks.length,
    });

    return NextResponse.json({
      success: true,
      ...response,
    });

  } catch (error) {
    // Log detailed error internally for debugging (server-side only)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error generating daily digest', error, {
      component: 'DailyDigestAPI',
      // Internal logging can include details for debugging
      internalDetails: errorMessage
    });

    // CWE-209: Return generic error to client to prevent information leakage
    // Do not expose internal error details, stack traces, or system information
    return NextResponse.json(
      { success: false, error: 'Failed to generate daily digest' },
      { status: 500 }
    );
  }
});
