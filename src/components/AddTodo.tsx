'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Calendar, Flag, Sparkles } from 'lucide-react';
import { TodoPriority, PRIORITY_CONFIG } from '@/types/todo';

interface AddTodoProps {
  onAdd: (text: string, priority: TodoPriority, dueDate?: string) => void;
}

export default function AddTodo({ onAdd }: AddTodoProps) {
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [priority, setPriority] = useState<TodoPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      onAdd(text.trim(), priority, dueDate || undefined);
      setText('');
      setPriority('medium');
      setDueDate('');
      setIsExpanded(false);
    }
  };

  const handleFocus = () => {
    setIsExpanded(true);
  };

  const priorityOptions: TodoPriority[] = ['urgent', 'high', 'medium', 'low'];

  return (
    <motion.div
      layout
      className="relative"
    >
      <motion.form
        onSubmit={handleSubmit}
        layout
        className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-hidden"
      >
        {/* Main input area */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={handleFocus}
            placeholder="What needs to be done?"
            className="w-full px-5 py-4 pr-14 text-lg bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
          />
          <motion.button
            type="submit"
            disabled={!text.trim()}
            whileHover={{ scale: text.trim() ? 1.05 : 1 }}
            whileTap={{ scale: text.trim() ? 0.95 : 1 }}
            className={`absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
              text.trim()
                ? 'bg-[#0033A0] hover:bg-[#002878] text-white shadow-lg shadow-[#0033A0]/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}
          >
            <Plus className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Expanded options */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-slate-100 dark:border-slate-800"
            >
              <div className="px-5 py-3 flex items-center gap-3 flex-wrap">
                {/* Priority selector */}
                <div className="relative">
                  <motion.button
                    type="button"
                    onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    style={{ color: PRIORITY_CONFIG[priority].color }}
                  >
                    <Flag className="w-4 h-4" />
                    <span className="text-sm font-medium">{PRIORITY_CONFIG[priority].label}</span>
                  </motion.button>

                  <AnimatePresence>
                    {showPriorityMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 min-w-[140px]"
                      >
                        {priorityOptions.map((p) => (
                          <motion.button
                            key={p}
                            type="button"
                            onClick={() => {
                              setPriority(p);
                              setShowPriorityMenu(false);
                            }}
                            whileHover={{ backgroundColor: 'rgba(0, 51, 160, 0.1)' }}
                            className={`w-full px-4 py-2.5 flex items-center gap-2 text-left transition-colors ${
                              priority === p ? 'bg-[#0033A0]/10 dark:bg-[#0033A0]/20' : ''
                            }`}
                            style={{ color: PRIORITY_CONFIG[p].color }}
                          >
                            <Flag className="w-4 h-4" />
                            <span className="text-sm font-medium">{PRIORITY_CONFIG[p].label}</span>
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Due date */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="text-sm bg-transparent text-slate-600 dark:text-slate-300 focus:outline-none"
                  />
                </div>

                {/* Quick action hint */}
                <div className="flex-1" />
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-1.5 text-xs text-slate-400"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Press Enter to add</span>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.form>

      {/* Click outside to collapse */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-[-1]"
          onClick={() => {
            if (!text.trim()) {
              setIsExpanded(false);
            }
            setShowPriorityMenu(false);
          }}
        />
      )}
    </motion.div>
  );
}
