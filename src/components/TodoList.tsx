'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Todo, TodoStatus, TodoPriority, ViewMode } from '@/types/todo';
import TodoItem from './TodoItem';
import AddTodo from './AddTodo';
import KanbanBoard from './KanbanBoard';
import { v4 as uuidv4 } from 'uuid';
import {
  LayoutList,
  LayoutGrid,
  Wifi,
  WifiOff,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Filter
} from 'lucide-react';
import { AuthUser } from '@/types/todo';
import UserSwitcher from './UserSwitcher';

interface TodoListProps {
  currentUser: AuthUser;
  onUserChange: (user: AuthUser | null) => void;
}

export default function TodoList({ currentUser, onUserChange }: TodoListProps) {
  const userName = currentUser.name;
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [users, setUsers] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

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
      const uniqueUsers = [...new Set((data || []).map((t: Todo) => t.created_by).filter(Boolean))];
      setUsers((prev) => [...new Set([...prev, ...uniqueUsers])]);
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

    let isMounted = true;

    const init = async () => {
      await fetchTodos();
      if (isMounted) {
        setUsers((prev) => [...new Set([...prev, userName])]);
      }
    };

    init();

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
          if (!isMounted) return;
          console.log('Real-time update:', payload);

          if (payload.eventType === 'INSERT') {
            setTodos((prev) => {
              const exists = prev.some((t) => t.id === (payload.new as Todo).id);
              if (exists) return prev;
              return [payload.new as Todo, ...prev];
            });
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
        if (isMounted) {
          setConnected(status === 'SUBSCRIBED');
        }
      });

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [fetchTodos, userName]);

  const addTodo = async (text: string, priority: TodoPriority, dueDate?: string) => {
    const newTodo: Todo = {
      id: uuidv4(),
      text,
      completed: false,
      status: 'todo',
      priority,
      created_at: new Date().toISOString(),
      created_by: userName,
      due_date: dueDate,
    };

    setTodos((prev) => [newTodo, ...prev]);

    const { error: insertError } = await supabase.from('todos').insert([{
      id: newTodo.id,
      text: newTodo.text,
      completed: newTodo.completed,
      status: newTodo.status,
      priority: newTodo.priority,
      created_at: newTodo.created_at,
      created_by: newTodo.created_by,
      due_date: newTodo.due_date,
    }]);

    if (insertError) {
      console.error('Error adding todo:', insertError);
      setTodos((prev) => prev.filter((t) => t.id !== newTodo.id));
    }
  };

  const updateStatus = async (id: string, status: TodoStatus) => {
    const oldTodo = todos.find((t) => t.id === id);
    const completed = status === 'done';

    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, status, completed } : todo))
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ status, completed })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating status:', updateError);
      if (oldTodo) {
        setTodos((prev) =>
          prev.map((todo) => (todo.id === id ? oldTodo : todo))
        );
      }
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, completed } : todo))
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ completed })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating todo:', updateError);
      setTodos((prev) =>
        prev.map((todo) =>
          todo.id === id ? { ...todo, completed: !completed } : todo
        )
      );
    }
  };

  const deleteTodo = async (id: string) => {
    const todoToDelete = todos.find((t) => t.id === id);

    setTodos((prev) => prev.filter((todo) => todo.id !== id));

    const { error: deleteError } = await supabase.from('todos').delete().eq('id', id);

    if (deleteError) {
      console.error('Error deleting todo:', deleteError);
      if (todoToDelete) {
        setTodos((prev) => [...prev, todoToDelete]);
      }
    }
  };

  const assignTodo = async (id: string, assignedTo: string | null) => {
    const oldTodo = todos.find((t) => t.id === id);

    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, assigned_to: assignedTo || undefined } : todo
      )
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ assigned_to: assignedTo })
      .eq('id', id);

    if (updateError) {
      console.error('Error assigning todo:', updateError);
      if (oldTodo) {
        setTodos((prev) =>
          prev.map((todo) => (todo.id === id ? oldTodo : todo))
        );
      }
    }
  };

  const setDueDate = async (id: string, dueDate: string | null) => {
    const oldTodo = todos.find((t) => t.id === id);

    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, due_date: dueDate || undefined } : todo
      )
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ due_date: dueDate })
      .eq('id', id);

    if (updateError) {
      console.error('Error setting due date:', updateError);
      if (oldTodo) {
        setTodos((prev) =>
          prev.map((todo) => (todo.id === id ? oldTodo : todo))
        );
      }
    }
  };

  const setPriority = async (id: string, priority: TodoPriority) => {
    const oldTodo = todos.find((t) => t.id === id);

    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, priority } : todo
      )
    );

    const { error: updateError } = await supabase
      .from('todos')
      .update({ priority })
      .eq('id', id);

    if (updateError) {
      console.error('Error setting priority:', updateError);
      if (oldTodo) {
        setTodos((prev) =>
          prev.map((todo) => (todo.id === id ? oldTodo : todo))
        );
      }
    }
  };


  const filteredTodos = todos.filter((todo) => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  const stats = {
    total: todos.length,
    completed: todos.filter((t) => t.completed).length,
    overdue: todos.filter((t) => {
      if (!t.due_date || t.completed) return false;
      const d = new Date(t.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      d.setHours(0, 0, 0, 0);
      return d < today;
    }).length,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-[#0033A0] flex items-center justify-center shadow-lg">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-3 border-white border-t-transparent rounded-full"
            />
          </div>
          <p className="text-slate-500 dark:text-slate-400">Loading your tasks...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-200 dark:border-slate-800"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
            Configuration Required
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-4">{error}</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            See SETUP.md for instructions
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/90 dark:bg-slate-900/90 border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm">
        {/* Allstate Blue Top Bar */}
        <div className="h-1 bg-[#0033A0]" />
        <div className={`mx-auto px-4 sm:px-6 py-4 ${viewMode === 'kanban' ? 'max-w-7xl' : 'max-w-3xl'}`}>
          <div className="flex items-center justify-between">
            {/* Logo & User */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#0033A0] flex items-center justify-center shadow-lg shadow-[#0033A0]/20">
                  <span className="text-white font-bold text-lg">B</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                    Bealer Agency
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Welcome, <span className="font-medium text-[#0033A0] dark:text-blue-400">{userName}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* View Switcher */}
              <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                <motion.button
                  onClick={() => setViewMode('list')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-slate-700 shadow-sm text-[#0033A0] dark:text-blue-400'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <LayoutList className="w-5 h-5" />
                </motion.button>
                <motion.button
                  onClick={() => setViewMode('kanban')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === 'kanban'
                      ? 'bg-white dark:bg-slate-700 shadow-sm text-[#0033A0] dark:text-blue-400'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <LayoutGrid className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Connection Status */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                connected
                  ? 'bg-emerald-50 dark:bg-emerald-900/20'
                  : 'bg-red-50 dark:bg-red-900/20'
              }`}>
                <div className="relative">
                  {connected ? (
                    <Wifi className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-red-500" />
                  )}
                  {connected && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  )}
                </div>
                <span className={`text-sm font-medium ${
                  connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {connected ? 'Live' : 'Offline'}
                </span>
              </div>

              {/* User Switcher */}
              <UserSwitcher currentUser={currentUser} onUserChange={onUserChange} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`mx-auto px-4 sm:px-6 py-8 ${viewMode === 'kanban' ? 'max-w-7xl' : 'max-w-3xl'}`}>
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-4 mb-8"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#0033A0]/10 dark:bg-[#0033A0]/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#0033A0] dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.total}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Tasks</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.completed}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Completed</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats.overdue}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Overdue</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Add Todo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <AddTodo onAdd={addTodo} />
        </motion.div>

        {/* Filter (for list view) */}
        {viewMode === 'list' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 mb-6"
          >
            <Filter className="w-4 h-4 text-slate-400" />
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
              {(['all', 'active', 'completed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    filter === f
                      ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Todo List or Kanban */}
        <AnimatePresence mode="wait">
          {viewMode === 'list' ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {filteredTodos.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-16"
                >
                  <div className="w-20 h-20 mx-auto mb-4 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 mb-2">
                    {filter === 'all' ? 'No tasks yet' : `No ${filter} tasks`}
                  </p>
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    {filter === 'all' ? 'Add your first task above!' : 'Try changing the filter'}
                  </p>
                </motion.div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {filteredTodos.map((todo, index) => (
                    <motion.div
                      key={todo.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 100 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <TodoItem
                        todo={todo}
                        users={users}
                        onToggle={toggleTodo}
                        onDelete={deleteTodo}
                        onAssign={assignTodo}
                        onSetDueDate={setDueDate}
                        onSetPriority={setPriority}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="kanban"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <KanbanBoard
                todos={todos}
                users={users}
                onStatusChange={updateStatus}
                onDelete={deleteTodo}
                onAssign={assignTodo}
                onSetDueDate={setDueDate}
                onSetPriority={setPriority}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
