'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Minimize2, Maximize2, ChevronDown } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { AuthUser, Todo } from '@/types/todo';
import dynamic from 'next/dynamic';
import { ChatPanelSkeleton } from './LoadingSkeletons';

// Lazy load ChatPanel for better performance
const ChatPanel = dynamic(() => import('./ChatPanel'), {
  ssr: false,
  loading: () => <ChatPanelSkeleton />,
});

interface FloatingChatProps {
  currentUser: AuthUser;
  users: { name: string; color: string }[];
  todosMap?: Map<string, Todo>;
  onTaskLinkClick?: (todoId: string) => void;
  /** Unread message count to show on badge */
  unreadCount?: number;
}

type ChatState = 'closed' | 'minimized' | 'open' | 'expanded';

/**
 * FloatingChat - A Google Chat-style floating chat widget
 *
 * Features:
 * - Floating button in bottom-right corner
 * - Minimized state (just header bar)
 * - Open state (standard chat window)
 * - Expanded state (larger window)
 * - Smooth animations between states
 * - Draggable position (future enhancement)
 */
export default function FloatingChat({
  currentUser,
  users,
  todosMap,
  onTaskLinkClick,
  unreadCount = 0,
}: FloatingChatProps) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const [chatState, setChatState] = useState<ChatState>('closed');
  const [hasNewMessage, setHasNewMessage] = useState(false);

  // Pulse animation when new messages arrive while closed
  useEffect(() => {
    if (unreadCount > 0 && chatState === 'closed') {
      setHasNewMessage(true);
    } else {
      setHasNewMessage(false);
    }
  }, [unreadCount, chatState]);

  const toggleChat = useCallback(() => {
    setChatState(prev => prev === 'closed' ? 'open' : 'closed');
  }, []);

  const minimizeChat = useCallback(() => {
    setChatState('minimized');
  }, []);

  const expandChat = useCallback(() => {
    setChatState(prev => prev === 'expanded' ? 'open' : 'expanded');
  }, []);

  const closeChat = useCallback(() => {
    setChatState('closed');
  }, []);

  const openFromMinimized = useCallback(() => {
    setChatState('open');
  }, []);

  // Get dimensions based on state
  const getDimensions = () => {
    switch (chatState) {
      case 'minimized':
        return { width: 320, height: 48 };
      case 'open':
        return { width: 380, height: 500 };
      case 'expanded':
        return { width: 480, height: 600 };
      default:
        return { width: 0, height: 0 };
    }
  };

  const dimensions = getDimensions();

  return (
    <>
      {/* Floating Chat Button - shown when chat is closed */}
      <AnimatePresence>
        {chatState === 'closed' && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleChat}
            className={`
              fixed bottom-6 right-6 z-50
              w-14 h-14 rounded-full
              flex items-center justify-center
              shadow-lg shadow-[var(--brand-blue)]/30
              transition-colors
              ${darkMode
                ? 'bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-sky)]'
                : 'bg-gradient-to-br from-[var(--brand-blue)] to-[var(--brand-sky)]'
              }
              ${hasNewMessage ? 'animate-pulse' : ''}
            `}
            aria-label="Open chat"
          >
            <MessageSquare className="w-6 h-6 text-white" />

            {/* Unread badge */}
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--danger)] text-white text-xs font-bold flex items-center justify-center"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </motion.span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {chatState !== 'closed' && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              width: dimensions.width,
              height: dimensions.height,
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`
              fixed bottom-6 right-6 z-50
              rounded-2xl overflow-hidden
              shadow-2xl
              flex flex-col
              ${darkMode
                ? 'bg-[var(--surface)] border border-white/10'
                : 'bg-white border border-[var(--border)]'
              }
            `}
            style={{
              width: dimensions.width,
              height: dimensions.height,
            }}
          >
            {/* Header Bar */}
            <div
              className={`
                flex items-center justify-between px-4 h-12 flex-shrink-0
                cursor-pointer select-none
                ${darkMode
                  ? 'bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-navy)]'
                  : 'bg-gradient-to-r from-[var(--brand-blue)] to-[var(--brand-sky)]'
                }
              `}
              onClick={chatState === 'minimized' ? openFromMinimized : undefined}
            >
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-white" />
                <span className="text-white font-medium text-sm">Team Chat</span>
                {unreadCount > 0 && chatState === 'minimized' && (
                  <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-medium">
                    {unreadCount}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {chatState !== 'minimized' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        expandChat();
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                      aria-label={chatState === 'expanded' ? 'Shrink' : 'Expand'}
                    >
                      {chatState === 'expanded' ? (
                        <Minimize2 className="w-4 h-4 text-white" />
                      ) : (
                        <Maximize2 className="w-4 h-4 text-white" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        minimizeChat();
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                      aria-label="Minimize"
                    >
                      <ChevronDown className="w-4 h-4 text-white" />
                    </button>
                  </>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeChat();
                  }}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Chat Content - hidden when minimized */}
            {chatState !== 'minimized' && (
              <div className="flex-1 overflow-hidden">
                <ChatPanel
                  currentUser={currentUser}
                  users={users}
                  todosMap={todosMap}
                  docked={true}
                  onTaskLinkClick={onTaskLinkClick}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
