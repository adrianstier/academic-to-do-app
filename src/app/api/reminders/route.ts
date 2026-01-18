/**
 * Reminders API
 *
 * Endpoints for managing task reminders:
 * - GET: Fetch reminders for a task or user
 * - POST: Create a new reminder
 * - DELETE: Remove a reminder
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractUserName, validateUserName, verifyTodoAccess } from '@/lib/apiAuth';
import type { TaskReminder, ReminderType } from '@/types/todo';

// Create Supabase client lazily to avoid build-time errors
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * GET /api/reminders
 * Fetch reminders for a specific task or user
 *
 * Query params:
 * - todoId: Fetch reminders for a specific task
 * - userId: Fetch reminders for a specific user
 * - status: Filter by status ('pending', 'sent', 'failed', 'cancelled')
 */
export async function GET(request: NextRequest) {
  const userName = extractUserName(request);
  const authError = validateUserName(userName);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const todoId = searchParams.get('todoId');
  const userId = searchParams.get('userId');
  const status = searchParams.get('status');

  const supabase = getSupabaseClient();
  let query = supabase
    .from('task_reminders')
    .select(`
      *,
      todos:todo_id (
        id,
        text,
        priority,
        due_date,
        assigned_to,
        completed
      )
    `)
    .order('reminder_time', { ascending: true });

  if (todoId) {
    query = query.eq('todo_id', todoId);
  }

  if (userId) {
    query = query.eq('user_id', userId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching reminders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reminders' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, reminders: data || [] });
}

/**
 * POST /api/reminders
 * Create a new reminder for a task
 *
 * Request body:
 * - todoId: UUID of the task
 * - reminderTime: ISO timestamp for when to send the reminder
 * - reminderType?: 'push_notification' | 'chat_message' | 'both' (default: 'both')
 * - message?: Custom reminder message
 * - userId?: UUID of user to remind (default: assigned user)
 */
export async function POST(request: NextRequest) {
  const userName = extractUserName(request);
  const authError = validateUserName(userName);
  if (authError) return authError;

  const supabase = getSupabaseClient();

  try {
    const body = await request.json();
    const {
      todoId,
      reminderTime,
      reminderType = 'both',
      message,
      userId,
    } = body;

    // Validate required fields
    if (!todoId) {
      return NextResponse.json(
        { success: false, error: 'todoId is required' },
        { status: 400 }
      );
    }

    if (!reminderTime) {
      return NextResponse.json(
        { success: false, error: 'reminderTime is required' },
        { status: 400 }
      );
    }

    // Validate reminder time is in the future
    const reminderDate = new Date(reminderTime);
    if (isNaN(reminderDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid reminderTime format' },
        { status: 400 }
      );
    }

    if (reminderDate <= new Date()) {
      return NextResponse.json(
        { success: false, error: 'Reminder time must be in the future' },
        { status: 400 }
      );
    }

    // Validate reminder type
    const validTypes: ReminderType[] = ['push_notification', 'chat_message', 'both'];
    if (!validTypes.includes(reminderType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid reminderType' },
        { status: 400 }
      );
    }

    // Verify user has access to the todo
    const { todo, error: accessError } = await verifyTodoAccess(todoId, userName!);
    if (accessError) return accessError;

    // Check if task is already completed
    if (todo.completed) {
      return NextResponse.json(
        { success: false, error: 'Cannot add reminder to completed task' },
        { status: 400 }
      );
    }

    // Create the reminder
    const reminderData = {
      todo_id: todoId,
      user_id: userId || null, // null = remind assigned user
      reminder_time: reminderDate.toISOString(),
      reminder_type: reminderType,
      message: message || null,
      status: 'pending',
      created_by: userName,
    };

    const { data: reminder, error: insertError } = await supabase
      .from('task_reminders')
      .insert(reminderData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating reminder:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to create reminder' },
        { status: 500 }
      );
    }

    // Also update the simple reminder_at field on the todo for backward compatibility
    // Only if no reminder_at is set or the new one is sooner
    if (!todo.reminder_at || new Date(todo.reminder_at) > reminderDate) {
      await supabase
        .from('todos')
        .update({
          reminder_at: reminderDate.toISOString(),
          reminder_sent: false,
          updated_at: new Date().toISOString(),
          updated_by: userName,
        })
        .eq('id', todoId);
    }

    return NextResponse.json({
      success: true,
      reminder: reminder as TaskReminder,
    });
  } catch (error) {
    console.error('Error in POST /api/reminders:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reminders
 * Remove a reminder
 *
 * Query params:
 * - id: UUID of the reminder to delete
 */
export async function DELETE(request: NextRequest) {
  const userName = extractUserName(request);
  const authError = validateUserName(userName);
  if (authError) return authError;

  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);
  const reminderId = searchParams.get('id');

  if (!reminderId) {
    return NextResponse.json(
      { success: false, error: 'Reminder id is required' },
      { status: 400 }
    );
  }

  // First, fetch the reminder to verify access
  const { data: reminder, error: fetchError } = await supabase
    .from('task_reminders')
    .select('*, todos:todo_id (id, created_by, assigned_to, updated_by)')
    .eq('id', reminderId)
    .single();

  if (fetchError || !reminder) {
    return NextResponse.json(
      { success: false, error: 'Reminder not found' },
      { status: 404 }
    );
  }

  // Verify user has access to the associated todo
  const todo = reminder.todos as { id: string; created_by: string; assigned_to: string; updated_by: string };
  const hasAccess =
    reminder.created_by === userName ||
    todo.created_by === userName ||
    todo.assigned_to === userName ||
    todo.updated_by === userName;

  if (!hasAccess) {
    return NextResponse.json(
      { success: false, error: 'Access denied' },
      { status: 403 }
    );
  }

  // Delete the reminder
  const { error: deleteError } = await supabase
    .from('task_reminders')
    .delete()
    .eq('id', reminderId);

  if (deleteError) {
    console.error('Error deleting reminder:', deleteError);
    return NextResponse.json(
      { success: false, error: 'Failed to delete reminder' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

/**
 * PATCH /api/reminders
 * Update a reminder (e.g., change time or cancel)
 *
 * Request body:
 * - id: UUID of the reminder
 * - reminderTime?: New reminder time
 * - status?: New status ('cancelled' to cancel)
 * - message?: Updated message
 */
export async function PATCH(request: NextRequest) {
  const userName = extractUserName(request);
  const authError = validateUserName(userName);
  if (authError) return authError;

  const supabase = getSupabaseClient();

  try {
    const body = await request.json();
    const { id, reminderTime, status, message } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Reminder id is required' },
        { status: 400 }
      );
    }

    // Fetch the reminder to verify access
    const { data: reminder, error: fetchError } = await supabase
      .from('task_reminders')
      .select('*, todos:todo_id (id, created_by, assigned_to, updated_by)')
      .eq('id', id)
      .single();

    if (fetchError || !reminder) {
      return NextResponse.json(
        { success: false, error: 'Reminder not found' },
        { status: 404 }
      );
    }

    // Verify access
    const todo = reminder.todos as { id: string; created_by: string; assigned_to: string; updated_by: string };
    const hasAccess =
      reminder.created_by === userName ||
      todo.created_by === userName ||
      todo.assigned_to === userName ||
      todo.updated_by === userName;

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Build update object
    const updateData: Partial<TaskReminder> = {};

    if (reminderTime) {
      const newTime = new Date(reminderTime);
      if (isNaN(newTime.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid reminderTime format' },
          { status: 400 }
        );
      }
      if (newTime <= new Date()) {
        return NextResponse.json(
          { success: false, error: 'Reminder time must be in the future' },
          { status: 400 }
        );
      }
      updateData.reminder_time = newTime.toISOString();
    }

    if (status) {
      const validStatuses = ['pending', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: 'Invalid status. Can only update to pending or cancelled' },
          { status: 400 }
        );
      }
      updateData.status = status;
    }

    if (message !== undefined) {
      updateData.message = message;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update the reminder
    const { data: updatedReminder, error: updateError } = await supabase
      .from('task_reminders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating reminder:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update reminder' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reminder: updatedReminder as TaskReminder,
    });
  } catch (error) {
    console.error('Error in PATCH /api/reminders:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
