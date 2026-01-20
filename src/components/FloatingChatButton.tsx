'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppShell } from './layout/AppShell';
import { ChatPanelSkeleton } from './LoadingSkeletons';
import { AuthUser, ChatConversation } from '@/types/todo';

const CHAT_STATE_KEY = 'floating_chat_last_conversation';

// Lazy load ChatPanel for better performance
const ChatPanel = dynamic(() => import('./ChatPanel'), {
  ssr: false,
  loading: () => <ChatPanelSkeleton />,
});

interface FloatingChatButtonProps {
  currentUser: AuthUser;
  users: Array<{ name: string; color: string }>;
  onTaskLinkClick?: (taskId: string) => void;
}

export default function FloatingChatButton({
  currentUser,
  users,
  onTaskLinkClick,
}: FloatingChatButtonProps) {
  const { theme } = useTheme();
  const darkMode = theme === 'dark';
  const { activeView } = useAppShell();

  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Restore last conversation from localStorage
  const [lastConversation, setLastConversation] = useState<ChatConversation | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(CHAT_STATE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate the structure
        if (parsed && parsed.conversation) {
          return parsed.conversation as ChatConversation;
        }
      }
    } catch {
      // Invalid stored data, ignore
    }
    return null;
  });

  // Callback to persist conversation state
  const handleConversationChange = useCallback((conversation: ChatConversation | null, showList: boolean) => {
    // Only persist if we have a selected conversation (not showing list)
    if (conversation && !showList) {
      setLastConversation(conversation);
      try {
        localStorage.setItem(CHAT_STATE_KEY, JSON.stringify({ conversation }));
      } catch {
        // localStorage might be full or disabled
      }
    }
  }, []);

  // Don't show button when already on chat view
  const shouldShow = activeView !== 'chat';

  // Fetch unread message count
  useEffect(() => {
    if (!isSupabaseConfigured() || !currentUser.name) return;

    const fetchUnreadCount = async () => {
      try {
        // Get messages not read by current user
        // We need to fetch recipient to filter out DMs between other users
        const { data, error } = await supabase
          .from('messages')
          .select('id, read_by, recipient')
          .not('created_by', 'eq', currentUser.name)
          .is('deleted_at', null);

        if (error) throw error;

        // Count messages where:
        // 1. Current user is not in read_by array
        // 2. Message is either a team message (no recipient) OR a DM to the current user
        const unread = data?.filter((msg) => {
          // Skip if already read
          if (msg.read_by?.includes(currentUser.name)) return false;
          
          // Team message (no recipient) - count it
          if (!msg.recipient) return true;
          
          // DM to current user - count it
          if (msg.recipient === currentUser.name) return true;
          
          // DM between other users - don't count it
          return false;
        }).length || 0;

        setUnreadCount(unread);
      } catch (err) {
        console.error('Error fetching unread count:', err);
      }
    };

    fetchUnreadCount();

    // Subscribe to new messages
    const channel = supabase
      .channel('floating-chat-messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser.name]);

  // Clear unread count when opening chat
  useEffect(() => {
    if (isOpen) {
      // Delay to allow chat to mark messages as read
      const timer = setTimeout(() => {
        setUnreadCount(0);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!shouldShow) return null;

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className={`
          fixed bottom-6 right-6 z-40
          w-14 h-14 rounded-full
          flex items-center justify-center
          shadow-lg hover:shadow-xl
          transition-shadow duration-200
          ${darkMode
            ? 'bg-[var(--accent)] hover:bg-[var(--accent)]/90'
            : 'bg-[var(--accent)] hover:bg-[var(--accent)]/90'
          }
        `}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={`Open chat${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <MessageCircle className="w-6 h-6 text-white" />
        
        {/* Unread Badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className={`
                absolute -top-1 -right-1
                min-w-[22px] h-[22px]
                flex items-center justify-center
                px-1.5 rounded-full
                text-xs font-bold text-white
                bg-red-500 border-2
                ${darkMode ? 'border-[var(--background)]' : 'border-white'}
              `}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat Popup - Google Chat style */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Light backdrop - click to close */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Chat Popup Window - positioned above the FAB */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 400 }}
              className={`
                fixed bottom-24 right-6 z-50
                w-[360px] sm:w-[400px] h-[500px] max-h-[70vh]
                flex flex-col
                rounded-xl overflow-hidden
                ${darkMode
                  ? 'bg-[var(--surface)] border border-white/10'
                  : 'bg-white border border-[var(--border)]'
                }
                shadow-2xl
              `}
            >
              {/* Header with close button */}
              <div
                className={`
                  flex items-center justify-between
                  px-4 py-2.5 border-b
                  ${darkMode ? 'border-white/10 bg-[var(--surface-2)]' : 'border-[var(--border)] bg-[var(--surface)]'}
                `}
              >
                <div className="flex items-center gap-2">
                  <MessageCircle className={`w-4 h-4 ${darkMode ? 'text-[var(--accent)]' : 'text-[var(--accent)]'}`} />
                  <h2
                    className={`
                      font-medium text-sm
                      ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}
                    `}
                  >
                    Team Chat
                  </h2>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className={`
                    p-1.5 rounded-md transition-colors
                    ${darkMode
                      ? 'text-white/60 hover:text-white hover:bg-white/10'
                      : 'text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]'
                    }
                  `}
                  aria-label="Close chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chat Panel */}
              <div className="flex-1 overflow-hidden">
                <ChatPanel
                  currentUser={currentUser}
                  users={users}
                  docked={true}
                  initialConversation={lastConversation}
                  onConversationChange={handleConversationChange}
                  onTaskLinkClick={(taskId) => {
                    onTaskLinkClick?.(taskId);
                    setIsOpen(false);
                  }}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
