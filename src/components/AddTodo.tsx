'use client';

import { useState, useCallback } from 'react';
import { Plus, Calendar, Flag, User, Sparkles, Loader2 } from 'lucide-react';
import { TodoPriority } from '@/types/todo';

interface AddTodoProps {
  onAdd: (text: string, priority: TodoPriority, dueDate?: string, assignedTo?: string) => void;
  users: string[];
}

interface EnhancedTask {
  text: string;
  priority: TodoPriority;
  dueDate: string;
  assignedTo: string;
  wasEnhanced: boolean;
}

export default function AddTodo({ onAdd, users }: AddTodoProps) {
  const [text, setText] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showEnhanced, setShowEnhanced] = useState(false);
  const [enhancedTask, setEnhancedTask] = useState<EnhancedTask | null>(null);

  const enhanceTask = useCallback(async (taskText: string): Promise<EnhancedTask | null> => {
    try {
      const response = await fetch('/api/ai/enhance-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: taskText, users }),
      });

      if (!response.ok) {
        console.error('Failed to enhance task');
        return null;
      }

      const data = await response.json();
      if (data.success && data.enhanced) {
        return data.enhanced as EnhancedTask;
      }
      return null;
    } catch (error) {
      console.error('Error enhancing task:', error);
      return null;
    }
  }, [users]);

  // Quick add without AI
  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd(text.trim(), priority, dueDate || undefined, assignedTo || undefined);
    resetForm();
  };

  // AI enhance then add
  const handleAiEnhance = async () => {
    if (!text.trim()) return;

    setIsEnhancing(true);
    const enhanced = await enhanceTask(text.trim());
    setIsEnhancing(false);

    if (enhanced) {
      setEnhancedTask(enhanced);
      setText(enhanced.text);
      setPriority(enhanced.priority);
      if (enhanced.dueDate) setDueDate(enhanced.dueDate);
      if (enhanced.assignedTo) setAssignedTo(enhanced.assignedTo);
      setShowEnhanced(true);
      setShowOptions(true);
    }
  };

  const resetForm = () => {
    setText('');
    setPriority('medium');
    setDueDate('');
    setAssignedTo('');
    setShowOptions(false);
    setShowEnhanced(false);
    setEnhancedTask(null);
  };

  const handleCancel = () => {
    resetForm();
  };

  const handleConfirm = () => {
    if (text.trim()) {
      onAdd(text.trim(), priority, dueDate || undefined, assignedTo || undefined);
      resetForm();
    }
  };

  return (
    <form onSubmit={handleQuickAdd} className="bg-white rounded-xl border-2 border-slate-100 overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 p-3">
        <div className="w-6 h-6 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center flex-shrink-0">
          {isEnhancing ? (
            <Loader2 className="w-4 h-4 text-[#D4A853] animate-spin" />
          ) : (
            <Plus className="w-4 h-4 text-slate-400" />
          )}
        </div>
        <input
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (showEnhanced) setShowEnhanced(false);
          }}
          onFocus={() => setShowOptions(true)}
          placeholder="What needs to be done?"
          className="flex-1 bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none text-base"
          disabled={isEnhancing}
        />

        {showEnhanced ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-2 text-slate-500 hover:text-slate-700 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 bg-[#D4A853] hover:bg-[#c49943] text-white rounded-lg font-medium transition-colors"
            >
              Confirm
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            {/* AI Enhance Button */}
            <button
              type="button"
              onClick={handleAiEnhance}
              disabled={!text.trim() || isEnhancing}
              className="px-3 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              title="Use AI to enhance task - add dates, priority, assignee"
            >
              {isEnhancing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{isEnhancing ? 'Enhancing...' : 'AI'}</span>
            </button>

            {/* Quick Add Button */}
            <button
              type="submit"
              disabled={!text.trim() || isEnhancing}
              className="px-4 py-2 bg-[#D4A853] hover:bg-[#c49943] disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
              title="Add task as-is"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* Enhanced task indicator */}
      {showEnhanced && enhancedTask?.wasEnhanced && (
        <div className="mx-3 mb-2 px-3 py-2 bg-purple-100 rounded-lg text-sm text-purple-700 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span>AI enhanced your task. Review and confirm, or edit below.</span>
        </div>
      )}

      {/* Options row */}
      {showOptions && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-100 flex items-center gap-3 flex-wrap">
          {/* Priority */}
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-slate-400" />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TodoPriority)}
              className="text-sm px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0] text-slate-700"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Due date */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="text-sm px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0] text-slate-700"
            />
          </div>

          {/* Assign to */}
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="text-sm px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#0033A0]/20 focus:border-[#0033A0] text-slate-700"
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </form>
  );
}
