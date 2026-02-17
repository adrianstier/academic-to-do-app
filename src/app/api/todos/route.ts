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

    // Validate UUID format if id is provided
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (id && !UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Invalid todo ID format' },
        { status: 400 }
      );
    }

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
      // Exclude soft-deleted todos
      query = query.eq('is_deleted', false);
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
      project_id,
      start_date,
      tags,
    } = body;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: 'Task text is required' },
        { status: 400 }
      );
    }

    // Validate priority enum
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate status enum
    const validStatuses = ['todo', 'in_progress', 'done'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
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
      start_date: start_date || null,
      notes: notes || null,
      transcription: transcription || null,
      subtasks: subtasks,
      project_id: project_id || null,
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

    // Insert todo_tags if tags array is provided
    if (tags && Array.isArray(tags) && tags.length > 0) {
      const todoTagRecords = tags.map((tagId: string) => ({
        todo_id: taskId,
        tag_id: tagId,
      }));
      const { error: tagError } = await supabase
        .from('todo_tags')
        .insert(todoTagRecords);
      if (tagError) {
        logger.error('Error inserting todo tags', tagError as Error, {
          component: 'api/todos',
          action: 'POST',
          todoId: taskId,
        });
        // Non-fatal: the todo was created, just tags failed
      }
    }

    logger.info('Todo created with encryption', {
      component: 'api/todos',
      action: 'POST',
      todoId: taskId,
      hasTranscription: !!transcription,
      hasNotes: !!notes,
      hasProjectId: !!project_id,
      tagCount: tags?.length || 0,
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

    // Validate UUID format to prevent malformed IDs
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof id !== 'string' || !UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Todo ID must be a valid UUID' },
        { status: 400 }
      );
    }

    // Validate priority if provided
    if (updates.priority !== undefined) {
      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      if (!validPriorities.includes(updates.priority)) {
        return NextResponse.json(
          { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate status if provided
    if (updates.status !== undefined) {
      const validStatuses = ['todo', 'in_progress', 'done'];
      if (!validStatuses.includes(updates.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: context.userName,
    };

    // Copy allowed fields
    const allowedFields = [
      'text', 'completed', 'status', 'priority',
      'assigned_to', 'due_date', 'start_date', 'notes', 'transcription',
      'subtasks', 'recurrence', 'project_id',
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

    // Update tags if provided (replace all tags for this todo)
    if (updates.tags !== undefined && Array.isArray(updates.tags)) {
      // Delete existing tags for this todo
      await supabase.from('todo_tags').delete().eq('todo_id', id);

      // Insert new tags
      if (updates.tags.length > 0) {
        const todoTagRecords = updates.tags.map((tagId: string) => ({
          todo_id: id,
          tag_id: tagId,
        }));
        const { error: tagError } = await supabase
          .from('todo_tags')
          .insert(todoTagRecords);
        if (tagError) {
          logger.error('Error updating todo tags', tagError as Error, {
            component: 'api/todos',
            action: 'PUT',
            todoId: id,
          });
        }
      }
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

    // Validate UUID format
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: 'Todo ID must be a valid UUID' },
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
