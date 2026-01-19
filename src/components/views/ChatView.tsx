'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, ArrowLeft } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { AuthUser, Todo } from '@/types/todo';
import ChatPanel from '../ChatPanel';
import { useTodoStore } from '@/store/todoStore';

/**
 * ChatView - Dedicated full-page chat experience
 *
 * Replaces the floating chat widget with a proper view
 * accessible via the navigation sidebar "Messages" item.
 *
 * Features:
 * - Full-width chat interface
 * - Team chat and DMs
 * - Task linking and mentions
 * - Accessible via navigation
 */

interface ChatViewProps {
  currentUser: AuthUser;
  users: { name: string; color: string }[];
  onBack?: () => void;
  onTaskLinkClick?: (todoId: string) => void;
}

export default function ChatView({
  currentUser,
  users,
  onBack,
  onTaskLinkClick,
}: ChatViewProps) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const todos = useTodoStore((state) => state.todos);

  // Create a map of todos for task linking
  const todosMap = useMemo(() => new Map(todos.map(t => [t.id, t])), [todos]);

  const handleTaskLinkClick = (taskId: string) => {
    if (onTaskLinkClick) {
      onTaskLinkClick(taskId);
    } else {
      // Default behavior: navigate to task (scroll into view)
      const taskElement = document.getElementById(`todo-${taskId}`);
      if (taskElement) {
        taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        taskElement.classList.add('ring-2', 'ring-blue-500');
        setTimeout(() => {
          taskElement.classList.remove('ring-2', 'ring-blue-500');
        }, 2000);
      }
    }
  };

  return (
    <div className="flex flex-col h-full min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header
        className={`
          flex items-center gap-4 px-4 sm:px-6 h-16 border-b flex-shrink-0
          ${darkMode
            ? 'bg-[var(--surface)] border-white/10'
            : 'bg-white border-[var(--border)]'
          }
        `}
      >
        {/* Back button - for mobile or when onBack is provided */}
        {onBack && (
          <button
            onClick={onBack}
            className={`
              p-2 rounded-lg transition-colors md:hidden
              ${darkMode
                ? 'text-white/60 hover:text-white hover:bg-white/10'
                : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
              }
            `}
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-sky)] flex items-center justify-center shadow-md">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className={`font-semibold text-lg ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}`}>
              Messages
            </h1>
            <p className={`text-xs ${darkMode ? 'text-white/50' : 'text-[var(--text-muted)]'}`}>
              Team chat and direct messages
            </p>
          </div>
        </div>
      </header>

      {/* Chat Content - Full height */}
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="flex-1 overflow-hidden"
      >
        <ChatPanel
          currentUser={currentUser}
          users={users}
          todosMap={todosMap}
          docked={false}
          onTaskLinkClick={handleTaskLinkClick}
        />
      </motion.main>
    </div>
  );
}
