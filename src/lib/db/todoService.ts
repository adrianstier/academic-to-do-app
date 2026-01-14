/**
 * Todo Service with Dual-Write Support
 *
 * Writes to both old (JSONB) and new (normalized) schemas
 * for zero-downtime migration
 */

import { supabase } from '@/lib/supabaseClient';
import { isFeatureEnabled } from '@/lib/featureFlags';
import { logger } from '@/lib/logger';
import { Todo, Subtask, Attachment, TodoStatus, TodoPriority } from '@/types/todo';

export class TodoService {
  /**
   * Create a new todo with dual-write support
   */
  async createTodo(todo: Partial<Todo>): Promise<Todo> {
    const useNormalizedSchema = isFeatureEnabled('normalized_schema');

    try {
      // Always write to old schema (backward compatibility)
      const { data: newTodo, error } = await supabase
        .from('todos')
        .insert({
          text: todo.text,
          completed: todo.completed || false,
          status: todo.status || 'todo',
          priority: todo.priority || 'medium',
          created_by: todo.created_by,
          assigned_to: todo.assigned_to,
          due_date: todo.due_date,
          notes: todo.notes,
          recurrence: todo.recurrence,
          subtasks: todo.subtasks || [],
          attachments: todo.attachments || [],
          transcription: todo.transcription,
        })
        .select()
        .single();

      if (error) throw error;

      // Also write to new schema if enabled
      if (useNormalizedSchema && newTodo) {
        await this.syncToNormalizedSchema(newTodo);
      }

      return newTodo;
    } catch (error) {
      logger.error('Failed to create todo', error as Error, {
        component: 'TodoService',
        action: 'createTodo',
      });
      throw error;
    }
  }

  /**
   * Update a todo with dual-write support
   */
  async updateTodo(id: string, updates: Partial<Todo>): Promise<Todo> {
    const useNormalizedSchema = isFeatureEnabled('normalized_schema');

    try {
      // Update old schema
      const { data: updated, error } = await supabase
        .from('todos')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Sync to new schema if enabled
      if (useNormalizedSchema && updated) {
        await this.syncToNormalizedSchema(updated);
      }

      return updated;
    } catch (error) {
      logger.error('Failed to update todo', error as Error, {
        component: 'TodoService',
        action: 'updateTodo',
        todoId: id,
      });
      throw error;
    }
  }

  /**
   * Get a todo (reads from new schema if available, falls back to old)
   */
  async getTodo(id: string): Promise<Todo | null> {
    const useNormalizedSchema = isFeatureEnabled('normalized_schema');

    try {
      // Fetch base todo
      const { data: todo, error } = await supabase
        .from('todos')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!todo) return null;

      // If new schema enabled, fetch from normalized tables
      if (useNormalizedSchema) {
        return await this.enrichTodoFromNormalizedSchema(todo);
      }

      return todo;
    } catch (error) {
      logger.error('Failed to get todo', error as Error, {
        component: 'TodoService',
        action: 'getTodo',
        todoId: id,
      });
      return null;
    }
  }

  /**
   * Get all todos with optional filters
   */
  async getTodos(filters?: {
    assignedTo?: string;
    createdBy?: string;
    status?: TodoStatus;
    completed?: boolean;
  }): Promise<Todo[]> {
    const useNormalizedSchema = isFeatureEnabled('normalized_schema');

    try {
      let query = supabase.from('todos').select('*').order('created_at', { ascending: false });

      if (filters?.assignedTo) {
        query = query.eq('assigned_to', filters.assignedTo);
      }
      if (filters?.createdBy) {
        query = query.eq('created_by', filters.createdBy);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.completed !== undefined) {
        query = query.eq('completed', filters.completed);
      }

      const { data: todos, error } = await query;

      if (error) throw error;
      if (!todos) return [];

      // Enrich from normalized schema if enabled
      if (useNormalizedSchema) {
        return await Promise.all(
          todos.map(todo => this.enrichTodoFromNormalizedSchema(todo))
        );
      }

      return todos;
    } catch (error) {
      logger.error('Failed to get todos', error as Error, {
        component: 'TodoService',
        action: 'getTodos',
      });
      return [];
    }
  }

  /**
   * Delete a todo (deletes from both schemas)
   */
  async deleteTodo(id: string): Promise<void> {
    const useNormalizedSchema = isFeatureEnabled('normalized_schema');

    try {
      // Delete from new schema first (if enabled)
      if (useNormalizedSchema) {
        // Cascade delete will handle subtasks and attachments
        await supabase.from('user_assignments').delete().eq('todo_id', id);
      }

      // Delete from old schema
      const { error } = await supabase.from('todos').delete().eq('id', id);

      if (error) throw error;
    } catch (error) {
      logger.error('Failed to delete todo', error as Error, {
        component: 'TodoService',
        action: 'deleteTodo',
        todoId: id,
      });
      throw error;
    }
  }

  /**
   * Sync todo data to normalized schema
   * @private
   */
  private async syncToNormalizedSchema(todo: Todo): Promise<void> {
    try {
      // Sync subtasks
      if (todo.subtasks && todo.subtasks.length > 0) {
        // Delete existing
        await supabase.from('subtasks_v2').delete().eq('todo_id', todo.id);

        // Insert new
        const subtasksToInsert = todo.subtasks.map((st, index) => ({
          id: st.id,
          todo_id: todo.id,
          text: st.text,
          completed: st.completed,
          priority: st.priority,
          estimated_minutes: st.estimatedMinutes,
          display_order: index,
        }));

        await supabase.from('subtasks_v2').insert(subtasksToInsert);
      }

      // Sync attachments
      if (todo.attachments && todo.attachments.length > 0) {
        // Delete existing
        await supabase.from('attachments_v2').delete().eq('todo_id', todo.id);

        // Insert new
        const attachmentsToInsert = todo.attachments.map(att => ({
          id: att.id,
          todo_id: todo.id,
          file_name: att.file_name,
          file_type: att.file_type,
          file_size: att.file_size,
          storage_path: att.storage_path,
          mime_type: att.mime_type,
          uploaded_by_name: att.uploaded_by,
          uploaded_at: att.uploaded_at,
        }));

        await supabase.from('attachments_v2').insert(attachmentsToInsert);
      }

      // Sync user assignment
      if (todo.assigned_to) {
        // Get user ID from name
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('name', todo.assigned_to)
          .single();

        if (user) {
          await supabase
            .from('user_assignments')
            .upsert({
              todo_id: todo.id,
              user_id: user.id,
              assigned_at: todo.created_at,
            }, { onConflict: 'todo_id,user_id' });
        }
      }
    } catch (error) {
      logger.error('Failed to sync to normalized schema', error as Error, {
        component: 'TodoService',
        action: 'syncToNormalizedSchema',
        todoId: todo.id,
      });
      // Don't throw - this is a background sync
    }
  }

  /**
   * Enrich todo with data from normalized schema
   * @private
   */
  private async enrichTodoFromNormalizedSchema(todo: Todo): Promise<Todo> {
    try {
      // Fetch subtasks
      const { data: subtasks } = await supabase
        .from('subtasks_v2')
        .select('*')
        .eq('todo_id', todo.id)
        .order('display_order');

      if (subtasks && subtasks.length > 0) {
        todo.subtasks = subtasks.map(st => ({
          id: st.id,
          text: st.text,
          completed: st.completed,
          priority: st.priority as TodoPriority,
          estimatedMinutes: st.estimated_minutes,
        }));
      }

      // Fetch attachments
      const { data: attachments } = await supabase
        .from('attachments_v2')
        .select('*')
        .eq('todo_id', todo.id);

      if (attachments && attachments.length > 0) {
        todo.attachments = attachments.map(att => ({
          id: att.id,
          file_name: att.file_name,
          file_type: att.file_type,
          file_size: att.file_size,
          storage_path: att.storage_path,
          mime_type: att.mime_type,
          uploaded_by: att.uploaded_by_name || '',
          uploaded_at: att.uploaded_at,
        }));
      }

      return todo;
    } catch (error) {
      logger.error('Failed to enrich from normalized schema', error as Error, {
        component: 'TodoService',
        action: 'enrichTodoFromNormalizedSchema',
        todoId: todo.id,
      });
      // Return original todo on error
      return todo;
    }
  }
}

export const todoService = new TodoService();
