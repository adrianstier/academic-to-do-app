'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Todo, TodoStatus, ViewMode } from '@/types/todo';
import TodoItem from './TodoItem';
import AddTodo from './AddTodo';
import KanbanBoard from './KanbanBoard';
import { v4 as uuidv4 } from 'uuid';

interface TodoListProps {
  userName: string;
}

export default function TodoList({ userName }: TodoListProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const fetchTodos = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured. Please check your environment variables.');
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching todos:', fetchError);
      setError('Failed to connect to database. Please check your Supabase configuration.');
    } else {
      setTodos(data || []);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured. Please check your environment variables.');
      setLoading(false);
      return;
    }

    fetchTodos();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('todos-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos',
        },
        (payload) => {
          console.log('Real-time update:', payload);

          if (payload.eventType === 'INSERT') {
            setTodos((prev) => [payload.new as Todo, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setTodos((prev) =>
              prev.map((todo) =>
                todo.id === payload.new.id ? (payload.new as Todo) : todo
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setTodos((prev) =>
              prev.filter((todo) => todo.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTodos]);

  const addTodo = async (text: string) => {
    const newTodo: Todo = {
      id: uuidv4(),
      text,
      completed: false,
      status: 'todo',
      created_at: new Date().toISOString(),
      created_by: userName,
    };

    // Optimistic update
    setTodos((prev) => [newTodo, ...prev]);

    // Insert without status field for backwards compatibility
    const { error: insertError } = await supabase.from('todos').insert([{
      id: newTodo.id,
      text: newTodo.text,
      completed: newTodo.completed,
      status: newTodo.status,
      created_at: newTodo.created_at,
      created_by: newTodo.created_by,
    }]);

    if (insertError) {
      console.error('Error adding todo:', insertError);
      // Rollback optimistic update
      setTodos((prev) => prev.filter((t) => t.id !== newTodo.id));
    }
  };

  const updateStatus = async (id: string, status: TodoStatus) => {
    const oldTodo = todos.find((t) => t.id === id);
    const completed = status === 'done';

    // Optimistic update
    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, status, completed } : todo))
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ status, completed })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating status:', updateError);
      // Rollback
      if (oldTodo) {
        setTodos((prev) =>
          prev.map((todo) => (todo.id === id ? oldTodo : todo))
        );
      }
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    // Optimistic update
    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, completed } : todo))
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ completed })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating todo:', updateError);
      // Rollback optimistic update
      setTodos((prev) =>
        prev.map((todo) =>
          todo.id === id ? { ...todo, completed: !completed } : todo
        )
      );
    }
  };

  const deleteTodo = async (id: string) => {
    const todoToDelete = todos.find((t) => t.id === id);

    // Optimistic update
    setTodos((prev) => prev.filter((todo) => todo.id !== id));

    const { error: deleteError } = await supabase.from('todos').delete().eq('id', id);

    if (deleteError) {
      console.error('Error deleting todo:', deleteError);
      // Rollback optimistic update
      if (todoToDelete) {
        setTodos((prev) => [...prev, todoToDelete]);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-zinc-500 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 px-4">
        <div className="bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-2">
            Configuration Required
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-4">{error}</p>
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            See SETUP.md for instructions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 py-8 px-4">
      <div className={viewMode === 'kanban' ? 'max-w-6xl mx-auto' : 'max-w-2xl mx-auto'}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-800 dark:text-zinc-100">
              Shared Todo List
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">
              Logged in as <span className="font-medium">{userName}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* View Switcher */}
            <div className="flex bg-white dark:bg-zinc-800 rounded-lg p-1 shadow-sm">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-zinc-900 dark:bg-zinc-600 text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewMode === 'kanban'
                    ? 'bg-zinc-900 dark:bg-zinc-600 text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Kanban
              </button>
            </div>
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  connected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {connected ? 'Live' : 'Connecting...'}
              </span>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <AddTodo onAdd={addTodo} />
        </div>

        {viewMode === 'list' ? (
          <div className="space-y-3">
            {todos.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">
                No todos yet. Add one above!
              </div>
            ) : (
              todos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  onToggle={toggleTodo}
                  onDelete={deleteTodo}
                />
              ))
            )}
          </div>
        ) : (
          <KanbanBoard
            todos={todos}
            onStatusChange={updateStatus}
            onDelete={deleteTodo}
          />
        )}

        <div className="mt-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
          {todos.length} todo{todos.length !== 1 ? 's' : ''} •{' '}
          {todos.filter((t) => t.completed).length} completed
        </div>
      </div>
    </div>
  );
}
