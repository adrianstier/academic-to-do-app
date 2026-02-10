/**
 * Secure Todos API with Field-Level Encryption
 *
 * Server-side API for todo operations that handles:
 * - Field-level encryption for PII (transcription, notes)
 * - Team-scoped access control via withTeamAuth
 * - Activity logging
 *
 * This API should be used instead of direct Supabase client calls
 * when handling sensitive data like transcriptions.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';
import { withTeamAuth } from '@/lib/teamAuth';
import { encryptTodoPII, decryptTodoPII } from '@/lib/fieldEncryption';

// Use service role key for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/todos - Fetch todos with decrypted PII fields
 */
export const GET = withTeamAuth(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const includeCompleted = searchParams.get('includeCompleted') === 'true';

    let query = supabase.from('todos').select('*');

    // Team-scope the query when multi-tenancy is active
    // BUG-API-9: Also guard against empty string teamId to prevent returning all teams' data
    if (context.teamId && context.teamId.trim() !== '') {
      query = query.eq('team_id', context.teamId);
    }

    if (id) {
      // Fetch single todo
      query = query.eq('id', id);
    } else {
      // Fetch all todos (optionally filter completed)
      if (!includeCompleted) {
        query = query.eq('completed', false);
      }
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Decrypt PII fields
    const decryptedData = (data || []).map(todo => decryptTodoPII(todo));

    return NextResponse.json({
      success: true,
      data: id ? decryptedData[0] : decryptedData,
    });
  } catch (error) {
    logger.error('Error fetching todos', error as Error, {
      component: 'api/todos',
      action: 'GET',
    });
    return NextResponse.json(
      { error: 'Failed to fetch todos' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/todos - Create a new todo with encrypted PII
 */
export const POST = withTeamAuth(async (request, context) => {
  try {
    const body = await request.json();
    const {
      text,
      priority = 'medium',
      assignedTo,
      dueDate,
      notes,
      transcription,
      subtasks = [],
      status = 'todo',
    } = body;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: 'Task text is required' },
        { status: 400 }
      );
    }

    const taskId = uuidv4();
    const now = new Date().toISOString();

    // Build task object with team_id
    const task: Record<string, unknown> = {
      id: taskId,
      text: text.trim(),
      completed: false,
      status,
      priority,
      created_at: now,
      created_by: context.userName,
      assigned_to: assignedTo?.trim() || null,
      due_date: dueDate || null,
      notes: notes || null,
      transcription: transcription || null,
      subtasks: subtasks,
    };

    if (context.teamId && context.teamId.trim() !== '') {
      task.team_id = context.teamId;
    }

    // Encrypt PII fields before storage
    const encryptedTask = encryptTodoPII(task);

    const { data, error } = await supabase
      .from('todos')
      .insert([encryptedTask])
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Log activity
    const activityRecord: Record<string, unknown> = {
      action: 'task_created',
      todo_id: taskId,
      todo_text: text.trim().substring(0, 100),
      user_name: context.userName,
      details: { priority, has_transcription: !!transcription },
    };
    if (context.teamId && context.teamId.trim() !== '') {
      activityRecord.team_id = context.teamId;
    }
    await supabase.from('activity_log').insert(activityRecord);

    logger.info('Todo created with encryption', {
      component: 'api/todos',
      action: 'POST',
      todoId: taskId,
      hasTranscription: !!transcription,
      hasNotes: !!notes,
    });

    // Return decrypted data
    return NextResponse.json({
      success: true,
      data: decryptTodoPII(data),
    });
  } catch (error) {
    logger.error('Error creating todo', error as Error, {
      component: 'api/todos',
      action: 'POST',
    });
    return NextResponse.json(
      { error: 'Failed to create todo' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/todos - Update a todo with encrypted PII
 */
export const PUT = withTeamAuth(async (request, context) => {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Todo ID is required' },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: context.userName,
    };

    // Copy allowed fields
    const allowedFields = [
      'text', 'completed', 'status', 'priority',
      'assigned_to', 'due_date', 'notes', 'transcription',
      'subtasks', 'recurrence',
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    // Encrypt PII fields if present
    if (updateData.notes !== undefined || updateData.transcription !== undefined) {
      const encrypted = encryptTodoPII(updateData as { notes?: string; transcription?: string });
      if (updateData.notes !== undefined) {
        updateData.notes = encrypted.notes;
      }
      if (updateData.transcription !== undefined) {
        updateData.transcription = encrypted.transcription;
      }
    }

    let query = supabase
      .from('todos')
      .update(updateData)
      .eq('id', id);

    // Team-scope the update
    if (context.teamId && context.teamId.trim() !== '') {
      query = query.eq('team_id', context.teamId);
    }

    const { data, error } = await query.select().single();

    if (error) {
      throw error;
    }

    // Log activity for significant changes
    if (updates.completed !== undefined) {
      const activityRecord: Record<string, unknown> = {
        action: updates.completed ? 'task_completed' : 'task_reopened',
        todo_id: id,
        todo_text: data.text?.substring(0, 100),
        user_name: context.userName,
      };
      if (context.teamId && context.teamId.trim() !== '') {
        activityRecord.team_id = context.teamId;
      }
      await supabase.from('activity_log').insert(activityRecord);
    }

    logger.info('Todo updated with encryption', {
      component: 'api/todos',
      action: 'PUT',
      todoId: id,
      updatedFields: Object.keys(updateData),
    });

    // Return decrypted data
    return NextResponse.json({
      success: true,
      data: decryptTodoPII(data),
    });
  } catch (error) {
    logger.error('Error updating todo', error as Error, {
      component: 'api/todos',
      action: 'PUT',
    });
    return NextResponse.json(
      { error: 'Failed to update todo' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/todos - Delete a todo
 */
export const DELETE = withTeamAuth(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Todo ID is required' },
        { status: 400 }
      );
    }

    // Get todo text for activity log before deletion
    let todoQuery = supabase
      .from('todos')
      .select('text')
      .eq('id', id);
    if (context.teamId && context.teamId.trim() !== '') {
      todoQuery = todoQuery.eq('team_id', context.teamId);
    }
    const { data: todo } = await todoQuery.single();

    let deleteQuery = supabase
      .from('todos')
      .delete()
      .eq('id', id);
    if (context.teamId && context.teamId.trim() !== '') {
      deleteQuery = deleteQuery.eq('team_id', context.teamId);
    }
    const { error } = await deleteQuery;

    if (error) {
      throw error;
    }

    // Log activity
    const activityRecord: Record<string, unknown> = {
      action: 'task_deleted',
      todo_id: id,
      todo_text: todo?.text?.substring(0, 100),
      user_name: context.userName,
    };
    if (context.teamId && context.teamId.trim() !== '') {
      activityRecord.team_id = context.teamId;
    }
    await supabase.from('activity_log').insert(activityRecord);

    logger.info('Todo deleted', {
      component: 'api/todos',
      action: 'DELETE',
      todoId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting todo', error as Error, {
      component: 'api/todos',
      action: 'DELETE',
    });
    return NextResponse.json(
      { error: 'Failed to delete todo' },
      { status: 500 }
    );
  }
});
