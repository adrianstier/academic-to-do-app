/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { todoService } from '@/lib/db/todoService';
import { supabase } from '@/lib/supabaseClient';
import { createMockTodo } from '../factories/todoFactory';

vi.mock('@/lib/supabaseClient');
vi.mock('@/lib/featureFlags', () => ({
  isFeatureEnabled: vi.fn(() => false), // Default: flags off
}));

// Mock logger to avoid Sentry issues
vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('TodoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTodo', () => {
    it('should create todo in old schema (JSONB)', async () => {
      const mockTodo = createMockTodo({ text: 'Test task' });

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockTodo, error: null }),
          }),
        }),
      } as any);

      const result = await todoService.createTodo({
        text: 'Test task',
        created_by: 'TestUser',
      });

      expect(result.text).toBe('Test task');
      expect(supabase.from).toHaveBeenCalledWith('todos');
    });

    it('should handle creation errors gracefully', async () => {
      const error = new Error('Database error');

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error }),
          }),
        }),
      } as any);

      await expect(
        todoService.createTodo({ text: 'Test', created_by: 'User' })
      ).rejects.toThrow('Database error');
    });
  });

  describe('updateTodo', () => {
    it('should update todo successfully', async () => {
      const updatedTodo = createMockTodo({ text: 'Updated text' });

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: updatedTodo, error: null }),
            }),
          }),
        }),
      } as any);

      const result = await todoService.updateTodo('todo-id', { text: 'Updated text' });

      expect(result.text).toBe('Updated text');
    });
  });

  describe('getTodo', () => {
    it('should fetch todo by id', async () => {
      const mockTodo = createMockTodo();

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockTodo, error: null }),
          }),
        }),
      } as any);

      const result = await todoService.getTodo('todo-id');

      expect(result).toEqual(mockTodo);
    });

    it('should return null if todo not found', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      } as any);

      const result = await todoService.getTodo('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getTodos', () => {
    it('should fetch all todos', async () => {
      const mockTodos = [createMockTodo(), createMockTodo()];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockTodos, error: null }),
        }),
      } as any);

      const result = await todoService.getTodos();

      expect(result).toHaveLength(2);
    });

    it('should filter todos by assignedTo', async () => {
      const mockTodos = [createMockTodo({ assigned_to: 'Derrick' })];

      // The query chain is: select -> order -> eq (filter applied after order)
      // But the implementation builds: select().order() then query.eq()
      // So order returns object with eq method that resolves final result
      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
      };
      // Add the final resolution when awaited
      (mockQuery as any).then = (resolve: (value: any) => void) => {
        resolve({ data: mockTodos, error: null });
        return mockQuery;
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue(mockQuery),
        }),
      } as any);

      const result = await todoService.getTodos({ assignedTo: 'Derrick' });

      expect(result[0].assigned_to).toBe('Derrick');
    });

    it('should return empty array on error', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
        }),
      } as any);

      const result = await todoService.getTodos();

      expect(result).toEqual([]);
    });
  });

  describe('deleteTodo', () => {
    it('should delete todo successfully', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      } as any);

      await expect(todoService.deleteTodo('todo-id')).resolves.not.toThrow();
    });

    it('should throw on delete error', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: new Error('Delete failed') }),
        }),
      } as any);

      await expect(todoService.deleteTodo('todo-id')).rejects.toThrow('Delete failed');
    });
  });

  describe('updateTodo error handling', () => {
    it('should throw on update error', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: new Error('Update failed') }),
            }),
          }),
        }),
      } as any);

      await expect(todoService.updateTodo('todo-id', { text: 'updated' })).rejects.toThrow('Update failed');
    });
  });

  describe('getTodo error handling', () => {
    it('should return null on getTodo error', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('Fetch failed') }),
          }),
        }),
      } as any);

      const result = await todoService.getTodo('todo-id');

      expect(result).toBeNull();
    });
  });

  describe('getTodos with filters', () => {
    it('should filter by createdBy', async () => {
      const mockTodos = [createMockTodo({ created_by: 'TestUser' })];
      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
      };
      (mockQuery as any).then = (resolve: (value: any) => void) => {
        resolve({ data: mockTodos, error: null });
        return mockQuery;
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue(mockQuery),
        }),
      } as any);

      const result = await todoService.getTodos({ createdBy: 'TestUser' });

      expect(mockQuery.eq).toHaveBeenCalledWith('created_by', 'TestUser');
      expect(result).toHaveLength(1);
    });

    it('should filter by status', async () => {
      const mockTodos = [createMockTodo({ status: 'in_progress' })];
      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
      };
      (mockQuery as any).then = (resolve: (value: any) => void) => {
        resolve({ data: mockTodos, error: null });
        return mockQuery;
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue(mockQuery),
        }),
      } as any);

      const result = await todoService.getTodos({ status: 'in_progress' });

      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'in_progress');
      expect(result).toHaveLength(1);
    });

    it('should filter by completed', async () => {
      const mockTodos = [createMockTodo({ completed: true })];
      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
      };
      (mockQuery as any).then = (resolve: (value: any) => void) => {
        resolve({ data: mockTodos, error: null });
        return mockQuery;
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue(mockQuery),
        }),
      } as any);

      const result = await todoService.getTodos({ completed: true });

      expect(mockQuery.eq).toHaveBeenCalledWith('completed', true);
      expect(result).toHaveLength(1);
    });

    it('should return empty array when data is null', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as any);

      const result = await todoService.getTodos();

      expect(result).toEqual([]);
    });
  });
});

// Import isFeatureEnabled for mocking in normalized schema tests
import { isFeatureEnabled } from '@/lib/featureFlags';

describe('TodoService with Normalized Schema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Enable normalized schema for these tests
    vi.mocked(isFeatureEnabled).mockReturnValue(true);
  });

  describe('createTodo with dual-write', () => {
    it('should sync to normalized schema when enabled', async () => {
      const mockTodo = createMockTodo({
        text: 'Test task',
        subtasks: [{ id: 'sub-1', text: 'Subtask 1', completed: false, priority: 'medium' }],
        attachments: [{
          id: 'att-1',
          file_name: 'test.pdf',
          file_type: 'pdf',
          file_size: 1024,
          storage_path: 'path/to/file',
          mime_type: 'application/pdf',
          uploaded_by: 'TestUser',
          uploaded_at: '2025-01-01',
        }],
        assigned_to: 'Derrick',
      });

      // Mock for main insert
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockTodo, error: null }),
        }),
      });
      // Mock for subtasks delete and insert
      const mockSubtasksDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockSubtasksInsert = vi.fn().mockResolvedValue({ error: null });
      // Mock for attachments delete and insert
      const mockAttachmentsDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockAttachmentsInsert = vi.fn().mockResolvedValue({ error: null });
      // Mock for user lookup
      const mockUserSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'user-id' }, error: null }),
        }),
      });
      // Mock for upsert
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'todos') return { insert: mockInsert } as any;
        if (table === 'subtasks_v2') return { delete: mockSubtasksDelete, insert: mockSubtasksInsert } as any;
        if (table === 'attachments_v2') return { delete: mockAttachmentsDelete, insert: mockAttachmentsInsert } as any;
        if (table === 'users') return { select: mockUserSelect } as any;
        if (table === 'user_assignments') return { upsert: mockUpsert } as any;
        return {} as any;
      });

      const result = await todoService.createTodo(mockTodo);

      expect(result.text).toBe('Test task');
      // Verify sync was called
      expect(supabase.from).toHaveBeenCalledWith('subtasks_v2');
      expect(supabase.from).toHaveBeenCalledWith('attachments_v2');
      expect(supabase.from).toHaveBeenCalledWith('users');
    });
  });

  describe('updateTodo with dual-write', () => {
    it('should sync updates to normalized schema', async () => {
      const updatedTodo = createMockTodo({ text: 'Updated' });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedTodo, error: null }),
          }),
        }),
      });
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'todos') return { update: mockUpdate } as any;
        if (table === 'subtasks_v2') return { delete: mockDelete, insert: vi.fn().mockResolvedValue({ error: null }) } as any;
        if (table === 'attachments_v2') return { delete: mockDelete, insert: vi.fn().mockResolvedValue({ error: null }) } as any;
        return {} as any;
      });

      const result = await todoService.updateTodo('todo-id', { text: 'Updated' });

      expect(result.text).toBe('Updated');
    });
  });

  describe('getTodo with normalized schema', () => {
    it('should enrich todo from normalized schema', async () => {
      const baseTodo = createMockTodo({ text: 'Base todo', subtasks: [], attachments: [] });
      const mockSubtasks = [
        { id: 'sub-1', text: 'Subtask', completed: false, priority: 'high', estimated_minutes: 30, display_order: 0 },
      ];
      const mockAttachments = [
        { id: 'att-1', file_name: 'doc.pdf', file_type: 'pdf', file_size: 1024, storage_path: 'path', mime_type: 'application/pdf', uploaded_by_name: 'User', uploaded_at: '2025-01-01' },
      ];

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'todos') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: baseTodo, error: null }),
              }),
            }),
          } as any;
        }
        if (table === 'subtasks_v2') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockSubtasks, error: null }),
              }),
            }),
          } as any;
        }
        if (table === 'attachments_v2') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: mockAttachments, error: null }),
            }),
          } as any;
        }
        return {} as any;
      });

      const result = await todoService.getTodo('todo-id');

      expect(result).not.toBeNull();
      expect(result?.subtasks).toHaveLength(1);
      expect(result?.subtasks?.[0].text).toBe('Subtask');
      expect(result?.attachments).toHaveLength(1);
      expect(result?.attachments?.[0].file_name).toBe('doc.pdf');
    });

    it('should handle enrichment errors gracefully', async () => {
      const baseTodo = createMockTodo({ text: 'Base todo' });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'todos') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: baseTodo, error: null }),
              }),
            }),
          } as any;
        }
        if (table === 'subtasks_v2') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockRejectedValue(new Error('Subtasks fetch failed')),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const result = await todoService.getTodo('todo-id');

      // Should return original todo on enrichment error
      expect(result).not.toBeNull();
      expect(result?.text).toBe('Base todo');
    });
  });

  describe('getTodos with normalized schema', () => {
    it('should enrich all todos from normalized schema', async () => {
      const baseTodos = [
        createMockTodo({ id: 'todo-1', text: 'Todo 1' }),
        createMockTodo({ id: 'todo-2', text: 'Todo 2' }),
      ];

      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'todos') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: baseTodos, error: null }),
            }),
          } as any;
        }
        if (table === 'subtasks_v2') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          } as any;
        }
        if (table === 'attachments_v2') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          } as any;
        }
        return {} as any;
      });

      const result = await todoService.getTodos();

      expect(result).toHaveLength(2);
    });
  });

  describe('deleteTodo with normalized schema', () => {
    it('should delete from both schemas', async () => {
      const mockUserAssignmentsDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockTodosDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'user_assignments') return { delete: mockUserAssignmentsDelete } as any;
        if (table === 'todos') return { delete: mockTodosDelete } as any;
        return {} as any;
      });

      await todoService.deleteTodo('todo-id');

      expect(supabase.from).toHaveBeenCalledWith('user_assignments');
      expect(supabase.from).toHaveBeenCalledWith('todos');
    });
  });

  describe('syncToNormalizedSchema error handling', () => {
    it('should handle sync errors gracefully (not throw)', async () => {
      const mockTodo = createMockTodo({
        text: 'Test task',
        subtasks: [{ id: 'sub-1', text: 'Subtask 1', completed: false, priority: 'medium' }],
      });

      // Mock for main insert
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockTodo, error: null }),
        }),
      });
      // Mock for subtasks that errors
      const mockSubtasksDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockRejectedValue(new Error('Sync failed')),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'todos') return { insert: mockInsert } as any;
        if (table === 'subtasks_v2') return { delete: mockSubtasksDelete } as any;
        return {} as any;
      });

      // Should not throw - sync errors are logged but don't prevent the main operation
      const result = await todoService.createTodo(mockTodo);

      expect(result.text).toBe('Test task');
    });
  });

  describe('syncToNormalizedSchema without user found', () => {
    it('should handle missing user for assignment', async () => {
      const mockTodo = createMockTodo({
        text: 'Test task',
        assigned_to: 'NonExistentUser',
        subtasks: [],
        attachments: [],
      });

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockTodo, error: null }),
        }),
      });
      const mockUserSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'todos') return { insert: mockInsert } as any;
        if (table === 'users') return { select: mockUserSelect } as any;
        if (table === 'subtasks_v2') return { delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }), insert: vi.fn().mockResolvedValue({ error: null }) } as any;
        if (table === 'attachments_v2') return { delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }), insert: vi.fn().mockResolvedValue({ error: null }) } as any;
        return {} as any;
      });

      const result = await todoService.createTodo(mockTodo);

      expect(result.text).toBe('Test task');
      // Should not call upsert when user not found
      expect(supabase.from).not.toHaveBeenCalledWith('user_assignments');
    });
  });
});
