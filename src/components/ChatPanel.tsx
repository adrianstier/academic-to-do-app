'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { ChatMessage, AuthUser, ChatConversation, TapbackType, MessageReaction, PresenceStatus } from '@/types/todo';
import { v4 as uuidv4 } from 'uuid';
import {
  MessageSquare, Send, X, Minimize2, Maximize2, ChevronDown,
  Users, ChevronLeft, User, Smile, Check, CheckCheck, Wifi, WifiOff,
  Bell, BellOff, Search, Reply, MoreHorizontal, Edit3, Trash2, Pin,
  AtSign, Plus, Moon, Volume2, VolumeX, Sparkles, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { logger } from '@/lib/logger';
import { TaskAssignmentCard, SystemNotificationType } from './chat/TaskAssignmentCard';
import { Todo } from '@/types/todo';
import {
  sanitizeHTML,
  validateMessage,
  extractAndValidateMentions,
  checkRateLimit,
  recordMessageSend,
  CHAT_LIMITS,
  getMessageAriaLabel,
  getReactionAriaLabel,
  truncateText,
  debounce,
} from '@/lib/chatUtils';

// Notification sound URL - using external file for better caching and memory efficiency
// Falls back to a small inline data URL if the file fails to load
const NOTIFICATION_SOUND_URL = '/sounds/notification-chime.wav';
const NOTIFICATION_SOUND_FALLBACK = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleTs1WpbOzq1fMUJFk8zSrGg/V0Bml8jRzaZ4g2pqmaW4zc7Mu7/Fz8q9rZ2WnqWyxdLOv62WiaOxyb6kkXuNqL+2pJZ7cn2ftLaylnuFjJmnq52Xjn5/gI+dn6OZj4KGjJGVl5qakIuIhYaHiYuOkJGQj42Lh4OCgoKEhoeIiIiHhoWDgoGBgYGCg4SEhISDgoGAgICAgIGBgoKCgoKBgYCAgICAgICBgYGBgYGBgICAgICAgICAgYGBgYGBgYCAgICAgA==';

// Track if permission request is in progress to prevent race conditions
let permissionRequestInProgress = false;

// Helper to request notification permission
async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    // User has permanently denied notifications
    return false;
  }

  // Prevent multiple simultaneous permission requests
  if (permissionRequestInProgress) {
    return false;
  }

  try {
    permissionRequestInProgress = true;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch {
    // Permission request failed
    return false;
  } finally {
    permissionRequestInProgress = false;
  }
}

// Helper to show browser notification
function showBrowserNotification(title: string, body: string, onClick?: () => void) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'chat-message',
      requireInteraction: false,
    });

    if (onClick) {
      notification.onclick = () => {
        window.focus();
        onClick();
        try {
          notification.close();
        } catch {
          // Notification may already be closed
        }
      };
    }

    // Auto-close after 5 seconds
    setTimeout(() => {
      try {
        notification.close();
      } catch {
        // Notification may already be closed by user
      }
    }, 5000);
  } catch {
    // Failed to create notification - browser may not support it
  }
}

// Tapback emoji mapping
const TAPBACK_EMOJIS: Record<TapbackType, string> = {
  heart: '❤️',
  thumbsup: '👍',
  thumbsdown: '👎',
  haha: '😂',
  exclamation: '❗',
  question: '❓',
};

// Expanded emoji picker with categories
const EMOJI_CATEGORIES = {
  recent: ['😀', '😂', '❤️', '👍', '🎉', '🔥'],
  smileys: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌'],
  gestures: ['👍', '👎', '👏', '🙌', '🤝', '🙏', '💪', '✌️', '🤞', '🤙', '👋', '✋'],
  symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '💯', '✨', '🔥', '⭐', '💫', '🎉'],
};

// Presence status config - using semantic color values for consistency
const PRESENCE_CONFIG: Record<PresenceStatus, { color: string; label: string }> = {
  online: { color: 'var(--success-vivid)', label: 'Online' },
  away: { color: 'var(--warning)', label: 'Away' },
  dnd: { color: 'var(--danger)', label: 'Do Not Disturb' },
  offline: { color: 'var(--text-muted)', label: 'Offline' },
};

interface ChatPanelProps {
  currentUser: AuthUser;
  users: { name: string; color: string }[];
  onCreateTask?: (text: string, assignedTo?: string) => void;
  onTaskLinkClick?: (todoId: string) => void;
  /** Map of todos for rendering system notification cards */
  todosMap?: Map<string, Todo>;
  /** Whether the chat is docked in a sidebar (changes styling from floating) */
  docked?: boolean;
  /** Initial conversation to open (for restoring previous state) */
  initialConversation?: ChatConversation | null;
  /** Callback when conversation changes (for persisting state) */
  onConversationChange?: (conversation: ChatConversation | null, showList: boolean) => void;
}

/**
 * Helper to check if a message is a system notification that should render as a card
 */
function isSystemNotificationMessage(message: ChatMessage): boolean {
  return message.created_by === 'System' && !!message.related_todo_id;
}

/**
 * Parse system message to extract notification type and metadata
 */
function parseSystemMessage(message: ChatMessage): {
  notificationType: SystemNotificationType;
  actionBy: string;
  previousAssignee?: string;
} | null {
  if (!isSystemNotificationMessage(message)) return null;

  const text = message.text;

  // Detect notification type from message content
  if (text.includes('New Task Assigned') || text.includes('Task Reassigned to You')) {
    // Extract "From: Username" or "By: Username"
    const fromMatch = text.match(/From:\s*(\w+)/);
    const byMatch = text.match(/By:\s*(\w+)/);
    const actionBy = fromMatch?.[1] || byMatch?.[1] || 'Unknown';

    if (text.includes('Reassigned')) {
      return { notificationType: 'task_reassignment', actionBy };
    }
    return { notificationType: 'task_assignment', actionBy };
  }

  if (text.includes('Task Completed')) {
    const byMatch = text.match(/By:\s*(\w+)/);
    return { notificationType: 'task_completion', actionBy: byMatch?.[1] || 'Unknown' };
  }

  if (text.includes('Task Reassigned')) {
    const byMatch = text.match(/by\s+(\w+)/);
    return {
      notificationType: 'task_reassignment',
      actionBy: byMatch?.[1] || 'Unknown',
    };
  }

  return null;
}

// Typing indicator component
function TypingIndicator({ userName }: { userName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-3 px-4 py-2"
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/[0.06] border border-white/[0.08]">
        <span className="text-sm text-white/50">{userName}</span>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
              animate={{
                y: [0, -4, 0],
                opacity: [0.4, 1, 0.4]
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut'
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Mention autocomplete component
function MentionAutocomplete({
  users,
  filter,
  onSelect,
  position
}: {
  users: { name: string; color: string }[];
  filter: string;
  onSelect: (name: string) => void;
  position: { top: number; left: number };
}) {
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(filter.toLowerCase())
  ).slice(0, 5);

  if (filteredUsers.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 5, scale: 0.95 }}
      className="absolute z-30 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl overflow-hidden min-w-[180px] backdrop-blur-xl"
      style={{ bottom: position.top, left: position.left }}
    >
      {filteredUsers.map((user) => (
        <button
          key={user.name}
          onClick={() => onSelect(user.name)}
          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.06] transition-all duration-200 text-left group"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-lg ring-1 ring-white/10 group-hover:ring-white/20 transition-all"
            style={{ backgroundColor: user.color }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm text-white/80 group-hover:text-white transition-colors">{user.name}</span>
        </button>
      ))}
    </motion.div>
  );
}

// Reactions summary tooltip
function ReactionsSummary({ reactions }: { reactions: MessageReaction[] }) {
  const groupedByReaction = reactions.reduce((acc, r) => {
    if (!acc[r.reaction]) acc[r.reaction] = [];
    acc[r.reaction].push(r.user);
    return acc;
  }, {} as Record<TapbackType, string[]>);

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl p-3 min-w-[140px] backdrop-blur-xl">
      {Object.entries(groupedByReaction).map(([reaction, userNames]) => (
        <div key={reaction} className="flex items-center gap-3 py-1.5">
          <span className="text-lg">{TAPBACK_EMOJIS[reaction as TapbackType]}</span>
          <div className="flex flex-wrap gap-1">
            {userNames.map(name => (
              <span key={name} className="text-xs text-white/70">{name}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Constants for resizable panel
const CHAT_PANEL_MIN_WIDTH = 280;
const CHAT_PANEL_MAX_WIDTH = 600;
const CHAT_PANEL_DEFAULT_WIDTH = 420;
const CHAT_PANEL_WIDTH_KEY = 'chat_panel_width';

export default function ChatPanel({ currentUser, users, onCreateTask, onTaskLinkClick, todosMap, docked = false, initialConversation, onConversationChange }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  // When docked, always show open state; otherwise start closed
  const [isOpen, setIsOpen] = useState(docked);
  const [isMinimized, setIsMinimized] = useState(false);

  // Resizable panel state
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return CHAT_PANEL_DEFAULT_WIDTH;
    try {
      const stored = localStorage.getItem(CHAT_PANEL_WIDTH_KEY);
      if (stored) {
        const width = parseInt(stored, 10);
        if (!isNaN(width) && width >= CHAT_PANEL_MIN_WIDTH && width <= CHAT_PANEL_MAX_WIDTH) {
          return width;
        }
      }
    } catch {
      // localStorage not available
    }
    return CHAT_PANEL_DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(CHAT_PANEL_DEFAULT_WIDTH);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const [conversation, setConversation] = useState<ChatConversation | null>(initialConversation ?? null);
  const [showConversationList, setShowConversationList] = useState(initialConversation ? false : true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState<keyof typeof EMOJI_CATEGORIES>('recent');
  const [tapbackMessageId, setTapbackMessageId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  });

  // New feature states
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [showMessageMenu, setShowMessageMenu] = useState<string | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const [userPresence, setUserPresence] = useState<Record<string, PresenceStatus>>({});
  const [mutedConversations, setMutedConversations] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem('chat_muted_conversations');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [isDndMode, setIsDndMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('chat_dnd_mode') === 'true';
  });
  const [rateLimitWarning, setRateLimitWarning] = useState<string | null>(null);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [showReactionsSummary, setShowReactionsSummary] = useState<string | null>(null);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [taskFromMessage, setTaskFromMessage] = useState<ChatMessage | null>(null);

  // Pagination state
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const MESSAGES_PER_PAGE = 50;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const lastTypingBroadcastRef = useRef<number>(0);
  const presenceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialScrolled = useRef<string | null>(null); // Track which conversation we scrolled for
  const messagesRef = useRef<ChatMessage[]>(messages);
  const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastPresenceTimestamps = useRef<Map<string, number>>(new Map());
  const PRESENCE_TIMEOUT_MS = 60000; // Mark offline after 60 seconds without presence

  // Initialize audio element for notification sound with cleanup
  useEffect(() => {
    const audio = new Audio(NOTIFICATION_SOUND_URL);
    audio.volume = 0.5;

    // Handle load error by falling back to inline audio
    audio.onerror = () => {
      logger.debug('Failed to load notification sound, using fallback', { component: 'ChatPanel' });
      audio.src = NOTIFICATION_SOUND_FALLBACK;
    };

    audioRef.current = audio;

    // Cleanup: pause audio and remove reference to prevent memory leak
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = ''; // Release audio resources
        audioRef.current = null;
      }
    };
  }, []);

  // Persist muted conversations to localStorage
  useEffect(() => {
    localStorage.setItem('chat_muted_conversations', JSON.stringify([...mutedConversations]));
  }, [mutedConversations]);

  // Persist DND mode to localStorage
  useEffect(() => {
    localStorage.setItem('chat_dnd_mode', isDndMode.toString());
  }, [isDndMode]);

  // Persist panel width to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_PANEL_WIDTH_KEY, panelWidth.toString());
    } catch {
      // localStorage not available
    }
  }, [panelWidth]);

  // Handle resize mouse events
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = panelWidth;
  }, [panelWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Panel is on the right, so dragging left (negative delta) increases width
      const delta = resizeStartX.current - e.clientX;
      const newWidth = Math.min(
        CHAT_PANEL_MAX_WIDTH,
        Math.max(CHAT_PANEL_MIN_WIDTH, resizeStartWidth.current + delta)
      );
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Add cursor style to body during resize
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // Auto-clear rate limit warning
  useEffect(() => {
    if (rateLimitWarning) {
      const timer = setTimeout(() => setRateLimitWarning(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [rateLimitWarning]);

  // Debounce search input to avoid filtering on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, CHAT_LIMITS.DEBOUNCE_TYPING_MS);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Function to play notification sound
  const playNotificationSound = useCallback(() => {
    if (isDndMode) return;
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, [isDndMode]);

  // Function to toggle notifications
  const toggleNotifications = useCallback(async () => {
    if (notificationsEnabled) {
      // Turn off notifications
      setNotificationsEnabled(false);
    } else {
      // Request permission and turn on notifications
      const granted = await requestNotificationPermission();
      setNotificationsEnabled(granted);
    }
  }, [notificationsEnabled]);

  // Other users (excluding current user)
  const otherUsers = useMemo(() =>
    users.filter(u => u.name !== currentUser.name),
    [users, currentUser.name]
  );

  const getUserColor = useCallback((userName: string) => {
    const user = users.find(u => u.name === userName);
    // Use CSS variable for fallback to support theme changes
    return user?.color || 'var(--accent)';
  }, [users]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const getConversationKey = useCallback((conv: ChatConversation) => {
    return conv.type === 'team' ? 'team' : conv.userName;
  }, []);

  const totalUnreadCount = useMemo(() => {
    return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  }, [unreadCounts]);

  // Load more (older) messages - defined before handleScroll which uses it
  const loadMoreMessages = useCallback(async () => {
    if (!isSupabaseConfigured() || isLoadingMore || !hasMoreMessages || messages.length === 0) return;

    setIsLoadingMore(true);
    const oldestMessage = messages[0];

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .lt('created_at', oldestMessage.created_at)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PER_PAGE);

    if (error) {
      logger.error('Error loading more messages', error, { component: 'ChatPanel' });
    } else {
      const olderMessages = (data || []).reverse();
      if (olderMessages.length > 0) {
        setMessages(prev => [...olderMessages, ...prev]);
      }
      setHasMoreMessages(data?.length === MESSAGES_PER_PAGE);
    }
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMoreMessages, messages]);

  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(isBottom);

    // Load more messages when scrolling near the top
    if (scrollTop < 100 && hasMoreMessages && !isLoadingMore) {
      loadMoreMessages();
    }

    if (isBottom && isOpen && conversation) {
      const key = getConversationKey(conversation);
      setUnreadCounts(prev => ({ ...prev, [key]: 0 }));
    }
  }, [isOpen, conversation, getConversationKey, hasMoreMessages, isLoadingMore, loadMoreMessages]);

  // Filter messages for current conversation (excluding deleted)
  const filteredMessages = useMemo(() => {
    if (!conversation) return [];
    let msgs = messages.filter(m => !m.deleted_at);

    if (conversation.type === 'team') {
      msgs = msgs.filter(m => !m.recipient);
    } else {
      const otherUser = conversation.userName;
      msgs = msgs.filter(m =>
        (m.created_by === currentUser.name && m.recipient === otherUser) ||
        (m.created_by === otherUser && m.recipient === currentUser.name)
      );
    }

    // Apply search filter if active
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      msgs = msgs.filter(m =>
        m.text.toLowerCase().includes(query) ||
        m.created_by.toLowerCase().includes(query)
      );
    }

    return msgs;
  }, [messages, conversation, currentUser.name, searchQuery]);

  // Pinned messages for current conversation
  const pinnedMessages = useMemo(() => {
    return filteredMessages.filter(m => m.is_pinned);
  }, [filteredMessages]);

  // Get conversations sorted by most recent activity
  const sortedConversations = useMemo(() => {
    const conversations: { conv: ChatConversation; lastMessage: ChatMessage | null; lastActivity: number }[] = [];

    const teamMessages = messages.filter(m => !m.recipient && !m.deleted_at);
    const lastTeamMsg = teamMessages.length > 0 ? teamMessages[teamMessages.length - 1] : null;
    conversations.push({
      conv: { type: 'team' },
      lastMessage: lastTeamMsg,
      lastActivity: lastTeamMsg ? new Date(lastTeamMsg.created_at).getTime() : 0
    });

    otherUsers.forEach(user => {
      const dmMessages = messages.filter(m =>
        !m.deleted_at &&
        ((m.created_by === currentUser.name && m.recipient === user.name) ||
        (m.created_by === user.name && m.recipient === currentUser.name))
      );
      const lastMsg = dmMessages.length > 0 ? dmMessages[dmMessages.length - 1] : null;
      conversations.push({
        conv: { type: 'dm', userName: user.name },
        lastMessage: lastMsg,
        lastActivity: lastMsg ? new Date(lastMsg.created_at).getTime() : 0
      });
    });

    return conversations.sort((a, b) => {
      if (a.lastActivity === 0 && b.lastActivity === 0) return 0;
      if (a.lastActivity === 0) return 1;
      if (b.lastActivity === 0) return -1;
      return b.lastActivity - a.lastActivity;
    });
  }, [messages, otherUsers, currentUser.name]);

  const mostRecentConversation = useMemo((): ChatConversation => {
    if (sortedConversations.length > 0 && sortedConversations[0].lastActivity > 0) {
      return sortedConversations[0].conv;
    }
    return { type: 'team' };
  }, [sortedConversations]);

  // Fetch initial messages (most recent) with pagination support
  const fetchMessages = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    setLoading(true);

    // Fetch most recent messages first (descending order), then reverse for display
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PER_PAGE);

    if (error) {
      logger.error('Error fetching messages', error, { component: 'ChatPanel' });
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        setTableExists(false);
      }
    } else {
      // Reverse to get chronological order for display
      const messages = (data || []).reverse();
      setMessages(messages);
      setTableExists(true);
      setHasMoreMessages(data?.length === MESSAGES_PER_PAGE);

      const initialUnreadCounts: Record<string, number> = {};
      let firstUnread: string | null = null;

      messages.forEach((msg: ChatMessage) => {
        if (msg.created_by === currentUser.name) return;
        if (msg.deleted_at) return;

        const readBy = msg.read_by || [];
        if (readBy.includes(currentUser.name)) return;

        let convKey: string | null = null;
        if (!msg.recipient) {
          convKey = 'team';
        } else if (msg.recipient === currentUser.name) {
          convKey = msg.created_by;
        }

        if (convKey) {
          initialUnreadCounts[convKey] = (initialUnreadCounts[convKey] || 0) + 1;
          if (!firstUnread) firstUnread = msg.id;
        }
      });

      setUnreadCounts(initialUnreadCounts);
      setFirstUnreadId(firstUnread);
    }
    setLoading(false);
  }, [currentUser.name]);

  // Track state in refs to avoid re-subscribing
  const isOpenRef = useRef(isOpen);
  const isAtBottomRef = useRef(isAtBottom);
  const conversationRef = useRef(conversation);
  const showConversationListRef = useRef(showConversationList);
  const playNotificationSoundRef = useRef(playNotificationSound);
  const mutedConversationsRef = useRef(mutedConversations);
  const isDndModeRef = useRef(isDndMode);

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { isAtBottomRef.current = isAtBottom; }, [isAtBottom]);
  useEffect(() => { conversationRef.current = conversation; }, [conversation]);
  useEffect(() => { showConversationListRef.current = showConversationList; }, [showConversationList]);

  // Notify parent when conversation changes (for persistence)
  useEffect(() => {
    onConversationChange?.(conversation, showConversationList);
  }, [conversation, showConversationList, onConversationChange]);
  useEffect(() => { playNotificationSoundRef.current = playNotificationSound; }, [playNotificationSound]);
  useEffect(() => { mutedConversationsRef.current = mutedConversations; }, [mutedConversations]);
  useEffect(() => { isDndModeRef.current = isDndMode; }, [isDndMode]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const getMessageConversationKey = useCallback((msg: ChatMessage): string | null => {
    if (!msg.recipient) {
      return 'team';
    }
    if (msg.created_by === currentUser.name) {
      return msg.recipient;
    }
    if (msg.recipient === currentUser.name) {
      return msg.created_by;
    }
    return null;
  }, [currentUser.name]);

  // Update presence periodically - uses ref to ensure channel is subscribed first
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const updatePresence = () => {
      // Only send if channel exists and is subscribed
      if (presenceChannelRef.current) {
        presenceChannelRef.current.send({
          type: 'broadcast',
          event: 'presence',
          payload: {
            user: currentUser.name,
            status: isDndMode ? 'dnd' : 'online',
            timestamp: Date.now()
          }
        });
      }
    };

    // Initial presence update will be triggered after channel subscription
    presenceIntervalRef.current = setInterval(updatePresence, 30000);

    return () => {
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
      }
    };
  }, [currentUser.name, isDndMode]);

  // Check for stale presence and mark users offline after timeout
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const checkStalePresence = () => {
      const now = Date.now();
      const staleUsers: string[] = [];

      lastPresenceTimestamps.current.forEach((timestamp, userName) => {
        if (now - timestamp > PRESENCE_TIMEOUT_MS) {
          staleUsers.push(userName);
        }
      });

      if (staleUsers.length > 0) {
        setUserPresence(prev => {
          const updated = { ...prev };
          staleUsers.forEach(user => {
            if (updated[user] !== 'offline') {
              updated[user] = 'offline';
            }
          });
          return updated;
        });
      }
    };

    // Check every 15 seconds for stale presence
    const presenceCheckInterval = setInterval(checkStalePresence, 15000);

    return () => {
      clearInterval(presenceCheckInterval);
    };
  }, []);

  // Real-time subscription for messages, typing, and presence
  // fetchMessages calls setState - this is the correct data loading pattern
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    fetchMessages();

    const messagesChannel = supabase
      .channel('messages-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as ChatMessage;
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === newMsg.id);
              if (exists) return prev;
              return [...prev, newMsg];
            });

            setTypingUsers(prev => ({ ...prev, [newMsg.created_by]: false }));

            // Skip notifications for own messages
            if (newMsg.created_by === currentUser.name) return;

            // Skip notifications for messages already read by current user
            const readBy = newMsg.read_by || [];
            if (readBy.includes(currentUser.name)) return;

            let msgConvKey: string | null = null;
            if (!newMsg.recipient) {
              msgConvKey = 'team';
            } else if (newMsg.recipient === currentUser.name) {
              msgConvKey = newMsg.created_by;
            }

            if (!msgConvKey) return;

            // Check if conversation is muted
            if (mutedConversationsRef.current.has(msgConvKey)) return;

            const currentConv = conversationRef.current;
            const currentKey = currentConv ? (currentConv.type === 'team' ? 'team' : currentConv.userName) : null;
            const isPanelOpen = isOpenRef.current;
            const isViewingConversation = !showConversationListRef.current;
            const isViewingThisConv = currentKey === msgConvKey;
            const isAtBottomOfChat = isAtBottomRef.current;

            const shouldMarkUnread = !isPanelOpen || !isViewingConversation || !isViewingThisConv || !isAtBottomOfChat;

            if (shouldMarkUnread) {
              setUnreadCounts(prev => ({
                ...prev,
                [msgConvKey]: (prev[msgConvKey] || 0) + 1
              }));

              if (!isDndModeRef.current) {
                playNotificationSoundRef.current();

                if (document.hidden) {
                  const title = newMsg.recipient
                    ? `Message from ${newMsg.created_by}`
                    : `${newMsg.created_by} in Team Chat`;
                  const body = newMsg.text.length > 100
                    ? newMsg.text.slice(0, 100) + '...'
                    : newMsg.text;
                  showBrowserNotification(title, body);
                }
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as ChatMessage;
            setMessages((prev) => prev.map(m =>
              m.id === updatedMsg.id ? updatedMsg : m
            ));
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    // Typing indicator channel - track timeouts for cleanup
    const typingChannel = supabase
      .channel('typing-channel')
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user !== currentUser.name) {
          setTypingUsers(prev => ({ ...prev, [payload.user]: true }));
          // Clear any existing timeout for this user
          const existingTimeout = typingTimeoutsRef.current.get(payload.user);
          if (existingTimeout) {
            clearTimeout(existingTimeout);
          }
          // Set new timeout and store reference
          const timeout = setTimeout(() => {
            setTypingUsers(prev => ({ ...prev, [payload.user]: false }));
            typingTimeoutsRef.current.delete(payload.user);
          }, 3000);
          typingTimeoutsRef.current.set(payload.user, timeout);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          typingChannelRef.current = typingChannel;
        }
      });

    // Presence channel - store in ref for use by presence update effect
    const presenceChannel = supabase
      .channel('presence-channel')
      .on('broadcast', { event: 'presence' }, ({ payload }) => {
        if (payload.user !== currentUser.name) {
          setUserPresence(prev => ({ ...prev, [payload.user]: payload.status }));
          // Track the timestamp of the last presence update
          lastPresenceTimestamps.current.set(payload.user, payload.timestamp || Date.now());
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Store ref and send initial presence
          presenceChannelRef.current = presenceChannel;
          presenceChannel.send({
            type: 'broadcast',
            event: 'presence',
            payload: {
              user: currentUser.name,
              status: isDndModeRef.current ? 'dnd' : 'online',
              timestamp: Date.now()
            }
          });
        }
      });

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(typingChannel);
      supabase.removeChannel(presenceChannel);
      typingChannelRef.current = null;
      presenceChannelRef.current = null;
      // Clean up all typing timeouts
      typingTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      typingTimeoutsRef.current.clear();
    };
  }, [fetchMessages, currentUser.name, getMessageConversationKey]);

  // Broadcast typing indicator (throttled)
  const broadcastTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingBroadcastRef.current > 2000 && typingChannelRef.current) {
      lastTypingBroadcastRef.current = now;
      typingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { user: currentUser.name, conversation: conversation ? getConversationKey(conversation) : null }
      });
    }
  }, [currentUser.name, conversation, getConversationKey]);

  // Auto-scroll on new messages if at bottom
  useEffect(() => {
    if (isAtBottom && isOpen && !showConversationList) {
      scrollToBottom();
    }
  }, [filteredMessages, isAtBottom, isOpen, scrollToBottom, showConversationList]);

  // Initial scroll to bottom when messages load for a conversation
  useEffect(() => {
    if (!loading && isOpen && conversation && !showConversationList && filteredMessages.length > 0) {
      const convKey = getConversationKey(conversation);
      // Only do initial scroll once per conversation
      if (hasInitialScrolled.current !== convKey) {
        hasInitialScrolled.current = convKey;
        // Use instant scroll on initial load to avoid animation
        setTimeout(() => scrollToBottom('instant'), 50);
      }
    }
  }, [loading, isOpen, conversation, showConversationList, filteredMessages.length, getConversationKey, scrollToBottom]);

  // Focus input and scroll to bottom when opening chat or switching conversations
  useEffect(() => {
    if (isOpen && !isMinimized && !showConversationList && conversation) {
      setTimeout(() => inputRef.current?.focus(), 100);
      // Scroll to bottom to show most recent messages
      setTimeout(() => scrollToBottom('instant'), 50);
      const key = getConversationKey(conversation);
      setUnreadCounts(prev => ({ ...prev, [key]: 0 }));
    }
  }, [isOpen, isMinimized, showConversationList, conversation, getConversationKey, scrollToBottom]);

  // Handle mention detection in input
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setNewMessage(value);

    // Detect @mention
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setShowMentions(true);
      setMentionFilter(mentionMatch[1]);
      setMentionCursorPos(cursorPos);
    } else {
      setShowMentions(false);
    }

    if (value.trim()) {
      broadcastTyping();
    }
  };

  const insertMention = (userName: string) => {
    const textBeforeMention = newMessage.slice(0, mentionCursorPos).replace(/@\w*$/, '');
    const textAfterCursor = newMessage.slice(mentionCursorPos);
    setNewMessage(`${textBeforeMention}@${userName} ${textAfterCursor}`);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  // Extract mentions from message text
  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      const userName = match[1];
      if (users.some(u => u.name.toLowerCase() === userName.toLowerCase())) {
        mentions.push(userName);
      }
    }
    return mentions;
  };

  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text || !conversation) return;

    // Check rate limiting
    const rateLimitStatus = checkRateLimit(currentUser.id);
    if (rateLimitStatus.isLimited) {
      const waitSeconds = Math.ceil(rateLimitStatus.remainingMs / 1000);
      logger.warn('Rate limit exceeded', { waitSeconds, component: 'ChatPanel' });
      setRateLimitWarning(`Slow down! You can send another message in ${waitSeconds}s`);
      return;
    }

    // Validate message
    const userNames = users.map(u => u.name);
    const validation = validateMessage(text, [], userNames);

    if (!validation.isValid) {
      logger.warn('Message validation failed', { errors: validation.errors, component: 'ChatPanel' });
      // Could show validation errors to user here
      return;
    }

    // Extract and validate mentions
    const mentions = extractAndValidateMentions(text, userNames);

    // Record the message send for rate limiting
    recordMessageSend(currentUser.id);

    const message: ChatMessage = {
      id: uuidv4(),
      text: validation.sanitizedText || text,
      created_by: currentUser.name,
      created_at: new Date().toISOString(),
      recipient: conversation.type === 'dm' ? conversation.userName : null,
      reply_to_id: replyingTo?.id || null,
      reply_to_text: replyingTo ? truncateText(sanitizeHTML(replyingTo.text), 100) : null,
      reply_to_user: replyingTo?.created_by || null,
      mentions: mentions.length > 0 ? mentions : undefined,
    };

    setMessages((prev) => [...prev, message]);
    setNewMessage('');
    setReplyingTo(null);
    scrollToBottom();

    const { error } = await supabase.from('messages').insert([message]);

    if (error) {
      logger.error('Error sending message', error, { component: 'ChatPanel' });
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      setNewMessage(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editingMessage) {
        saveEdit();
      } else {
        sendMessage();
      }
    }
    if (e.key === 'Escape') {
      setReplyingTo(null);
      setEditingMessage(null);
      setShowSearch(false);
    }
  };

  const addEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const toggleTapback = async (messageId: string, reaction: TapbackType) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const currentReactions = message.reactions || [];
    const existingReaction = currentReactions.find(r => r.user === currentUser.name);

    let newReactions: MessageReaction[];

    if (existingReaction?.reaction === reaction) {
      newReactions = currentReactions.filter(r => r.user !== currentUser.name);
    } else if (existingReaction) {
      newReactions = currentReactions.map(r =>
        r.user === currentUser.name
          ? { user: currentUser.name, reaction, created_at: new Date().toISOString() }
          : r
      );
    } else {
      newReactions = [...currentReactions, {
        user: currentUser.name,
        reaction,
        created_at: new Date().toISOString()
      }];
    }

    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, reactions: newReactions } : m
    ));
    setTapbackMessageId(null);

    const { error } = await supabase
      .from('messages')
      .update({ reactions: newReactions })
      .eq('id', messageId);

    if (error) {
      logger.error('Error updating reaction', error, { component: 'ChatPanel' });
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, reactions: currentReactions } : m
      ));
    }
  };

  // Edit message
  const startEdit = (message: ChatMessage) => {
    setEditingMessage(message);
    setEditText(message.text);
    setShowMessageMenu(null);
  };

  const saveEdit = async () => {
    if (!editingMessage || !editText.trim()) return;

    const originalMessage = editingMessage;
    const updatedMessage = {
      ...editingMessage,
      text: editText.trim(),
      edited_at: new Date().toISOString(),
    };

    setMessages(prev => prev.map(m =>
      m.id === editingMessage.id ? updatedMessage : m
    ));
    setEditingMessage(null);
    setEditText('');

    const { error } = await supabase
      .from('messages')
      .update({ text: editText.trim(), edited_at: new Date().toISOString() })
      .eq('id', editingMessage.id);

    if (error) {
      logger.error('Error editing message', error, { component: 'ChatPanel' });
      // Rollback on error
      setMessages(prev => prev.map(m =>
        m.id === originalMessage.id ? originalMessage : m
      ));
    }
  };

  // Delete message (soft delete)
  const deleteMessage = async (messageId: string) => {
    // Store original for rollback
    const originalMessage = messagesRef.current.find(m => m.id === messageId);

    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, deleted_at: new Date().toISOString() } : m
    ));
    setShowMessageMenu(null);

    const { error } = await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId);

    if (error) {
      logger.error('Error deleting message', error, { component: 'ChatPanel' });
      // Rollback on error
      if (originalMessage) {
        setMessages(prev => prev.map(m =>
          m.id === messageId ? originalMessage : m
        ));
      }
    }
  };

  // Pin/unpin message
  const togglePin = async (message: ChatMessage) => {
    const isPinned = !message.is_pinned;
    // Store original pin state for rollback
    const originalPinState = {
      is_pinned: message.is_pinned,
      pinned_by: message.pinned_by,
      pinned_at: message.pinned_at
    };

    setMessages(prev => prev.map(m =>
      m.id === message.id ? {
        ...m,
        is_pinned: isPinned,
        pinned_by: isPinned ? currentUser.name : null,
        pinned_at: isPinned ? new Date().toISOString() : null
      } : m
    ));
    setShowMessageMenu(null);

    const { error } = await supabase
      .from('messages')
      .update({
        is_pinned: isPinned,
        pinned_by: isPinned ? currentUser.name : null,
        pinned_at: isPinned ? new Date().toISOString() : null
      })
      .eq('id', message.id);

    if (error) {
      logger.error('Error pinning message', error, { component: 'ChatPanel' });
      // Rollback on error
      setMessages(prev => prev.map(m =>
        m.id === message.id ? { ...m, ...originalPinState } : m
      ));
    }
  };

  // Toggle mute for conversation
  const toggleMute = (convKey: string) => {
    setMutedConversations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(convKey)) {
        newSet.delete(convKey);
      } else {
        newSet.add(convKey);
      }
      return newSet;
    });
  };

  // Create task from message
  const createTaskFromMessage = (message: ChatMessage) => {
    setTaskFromMessage(message);
    setShowCreateTaskModal(true);
    setShowMessageMenu(null);
  };

  const handleCreateTask = () => {
    if (taskFromMessage && onCreateTask) {
      onCreateTask(taskFromMessage.text, taskFromMessage.created_by);
    }
    setShowCreateTaskModal(false);
    setTaskFromMessage(null);
  };

  const markMessagesAsRead = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) return;

    // Optimistic update - immediately update local state
    setMessages(prev => prev.map(m => {
      if (messageIds.includes(m.id) && m.created_by !== currentUser.name) {
        const readBy = m.read_by || [];
        if (!readBy.includes(currentUser.name)) {
          return { ...m, read_by: [...readBy, currentUser.name] };
        }
      }
      return m;
    }));

    // Use RPC function to atomically append to read_by array
    // This avoids race conditions when multiple tabs mark the same message as read
    try {
      const updatePromises = messageIds.map(async (messageId) => {
        // Use raw SQL via rpc to safely append to array without race conditions
        // Falls back to regular update if rpc not available
        const { error } = await supabase.rpc('mark_message_read', {
          p_message_id: messageId,
          p_user_name: currentUser.name
        });
        
        // If RPC doesn't exist, fall back to regular update
        if (error?.code === '42883') { // function does not exist
          const currentMessages = messagesRef.current;
          const message = currentMessages.find(m => m.id === messageId);
          if (message && message.created_by !== currentUser.name) {
            const readBy = message.read_by || [];
            if (!readBy.includes(currentUser.name)) {
              await supabase
                .from('messages')
                .update({ read_by: [...readBy, currentUser.name] })
                .eq('id', messageId);
            }
          }
        } else if (error) {
          logger.error('Error marking message as read', error, { component: 'ChatPanel', messageId });
        }
      });

      await Promise.all(updatePromises);
    } catch (err) {
      logger.error('Error in markMessagesAsRead', err, { component: 'ChatPanel' });
      // Don't revert optimistic update - user experience is better with stale read state
      // than flickering UI. The next page load will correct it if needed.
    }
  }, [currentUser.name]);

  // Mark messages as read when viewing conversation - intentional side effect
  useEffect(() => {
    if (isOpen && !showConversationList && conversation && filteredMessages.length > 0) {
      const unreadMessageIds = filteredMessages
        .filter(m => m.created_by !== currentUser.name && !(m.read_by || []).includes(currentUser.name))
        .map(m => m.id);

      if (unreadMessageIds.length > 0) {
        markMessagesAsRead(unreadMessageIds);
      }
    }
  }, [isOpen, showConversationList, conversation, filteredMessages, currentUser.name, markMessagesAsRead]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (tapbackMessageId) {
        setTapbackMessageId(null);
      }
      if (showMessageMenu) {
        setShowMessageMenu(null);
      }
      if (showReactionsSummary) {
        setShowReactionsSummary(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [tapbackMessageId, showMessageMenu, showReactionsSummary]);

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Render message text with mentions highlighted and XSS protection
  const renderMessageText = (text: string) => {
    // Sanitize text first to prevent XSS
    const sanitizedText = sanitizeHTML(text);
    const parts = sanitizedText.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const userName = part.slice(1);
        const isMentioned = users.some(u => u.name.toLowerCase() === userName.toLowerCase());
        const isMe = userName.toLowerCase() === currentUser.name.toLowerCase();

        if (isMentioned) {
          return (
            <span
              key={i}
              className={`px-1.5 py-0.5 rounded-md font-medium ${
                isMe
                  ? 'bg-[var(--accent)]/30 text-[var(--accent)]'
                  : 'bg-[var(--accent-dark)]/30 text-[var(--accent-dark)] dark:text-[var(--accent)]'
              }`}
              role="mark"
              aria-label={`Mention of ${userName}`}
            >
              {part}
            </span>
          );
        }
      }
      return part;
    });
  };

  const groupedMessages = useMemo(() => {
    return filteredMessages.reduce((acc, msg, idx) => {
      const prevMsg = filteredMessages[idx - 1];
      const isGrouped = prevMsg && prevMsg.created_by === msg.created_by &&
        new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 60000 &&
        !msg.reply_to_id;

      return [...acc, { ...msg, isGrouped }];
    }, [] as (ChatMessage & { isGrouped: boolean })[]);
  }, [filteredMessages]);

  const selectConversation = (conv: ChatConversation) => {
    setConversation(conv);
    setShowConversationList(false);
    const key = getConversationKey(conv);
    setUnreadCounts(prev => ({ ...prev, [key]: 0 }));
    // Reset initial scroll tracking so we scroll to bottom for the new conversation
    hasInitialScrolled.current = null;
  };

  const getConversationTitle = () => {
    if (!conversation) return 'Messages';
    if (conversation.type === 'team') return 'Team Chat';
    return conversation.userName;
  };

  const activeTypingUsers = useMemo(() => {
    if (!conversation) return [];
    return Object.entries(typingUsers)
      .filter(([user, isTyping]) => isTyping && user !== currentUser.name)
      .map(([user]) => user);
  }, [typingUsers, conversation, currentUser.name]);

  // For docked mode, render a simplified layout that fills the sidebar
  if (docked) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-b from-[var(--surface-dark)] to-[#050A12]">
        {/* Docked Header */}
        <div className="relative flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Team Chat</h2>
              <p className="text-white/50 text-xs">
                {connected ? 'Connected' : 'Connecting...'}
              </p>
            </div>
          </div>
          {totalUnreadCount > 0 && (
            <span className="px-2 py-0.5 bg-red-500 rounded-full text-xs font-bold text-white">
              {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
            </span>
          )}
        </div>

        {/* Conversation List or Chat Content */}
        <div className="flex-1 overflow-hidden">
          {showConversationList ? (
            <div className="h-full overflow-y-auto p-3 space-y-2">
              {/* Team Chat */}
              <button
                onClick={() => {
                  setConversation({ type: 'team' });
                  setShowConversationList(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent)]/30 to-[var(--accent)]/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-[var(--accent)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">Team Chat</p>
                  <p className="text-white/40 text-xs truncate">All team messages</p>
                </div>
                {unreadCounts['team'] > 0 && (
                  <span className="px-2 py-0.5 bg-red-500 rounded-full text-xs font-bold text-white">
                    {unreadCounts['team']}
                  </span>
                )}
              </button>

              {/* DM Users */}
              {users.filter(u => u.name !== currentUser.name).map(user => (
                <button
                  key={user.name}
                  onClick={() => {
                    setConversation({ type: 'dm', userName: user.name });
                    setShowConversationList(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                    style={{ backgroundColor: user.color }}
                  >
                    {user.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">{user.name}</p>
                    <p className="text-white/40 text-xs">Direct message</p>
                  </div>
                  {unreadCounts[user.name] > 0 && (
                    <span className="px-2 py-0.5 bg-red-500 rounded-full text-xs font-bold text-white">
                      {unreadCounts[user.name]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Back button */}
              <button
                onClick={() => setShowConversationList(true)}
                className="flex items-center gap-2 px-4 py-2 text-white/60 hover:text-white transition-colors text-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to conversations
              </button>

              {/* Messages */}
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto px-3 py-2 space-y-2"
              >
                {filteredMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4">
                    <motion.div
                      className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center mb-4"
                      animate={{ y: [-3, 3, -3] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <MessageSquare className="w-7 h-7 text-white/30" />
                    </motion.div>
                    <p className="font-medium text-white/70 text-sm">No messages yet</p>
                    <p className="text-xs mt-1.5 text-white/40">Start the conversation below</p>
                  </div>
                ) : (
                  filteredMessages.map((message, index) => {
                    const isOwn = message.created_by === currentUser.name;
                    const showAvatar = !isOwn && (index === 0 || filteredMessages[index - 1]?.created_by !== message.created_by);

                    // Handle system notification messages as cards
                    if (isSystemNotificationMessage(message)) {
                      const parsed = parseSystemMessage(message);
                      const todo = message.related_todo_id ? todosMap?.get(message.related_todo_id) : undefined;
                      if (parsed && todo) {
                        return (
                          <div key={message.id} className="py-1">
                            <TaskAssignmentCard
                              todo={todo}
                              notificationType={parsed.notificationType}
                              actionBy={parsed.actionBy}
                              previousAssignee={parsed.previousAssignee}
                              onViewTask={() => onTaskLinkClick?.(todo.id)}
                            />
                          </div>
                        );
                      }
                    }

                    return (
                      <div
                        key={message.id}
                        className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        {!isOwn && showAvatar && (
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                            style={{ backgroundColor: getUserColor(message.created_by) }}
                          >
                            {message.created_by[0]}
                          </div>
                        )}
                        {!isOwn && !showAvatar && <div className="w-7" />}
                        <div
                          className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                            isOwn
                              ? 'bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] text-white'
                              : 'bg-white/10 text-white'
                          }`}
                        >
                          {renderMessageText(message.text)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-white/10">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      // Broadcast typing indicator when user types
                      if (e.target.value.trim()) {
                        broadcastTyping();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 text-white placeholder-white/40 text-sm border border-white/10 focus:border-[var(--accent)]/50 focus:outline-none"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="p-2.5 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] text-white disabled:opacity-50 transition-opacity"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Original floating chat panel
  return (
    <>
      {/* Chat Toggle Button - Cinematic Design */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              setIsOpen(true);
              if (messages.length > 0) {
                setConversation(mostRecentConversation);
                setShowConversationList(false);
              } else {
                setShowConversationList(true);
              }
            }}
            className="fixed bottom-6 right-6 z-50 group"
            aria-label={`Open chat${totalUnreadCount > 0 ? `, ${totalUnreadCount} unread messages` : ''}`}
          >
            {/* Main button */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-200">
              <MessageSquare className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>

            {/* Unread badge */}
            {totalUnreadCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[1.75rem] h-7 px-2 bg-red-500 rounded-full text-xs font-bold flex items-center justify-center text-white shadow-lg border-2 border-[var(--surface-dark)]">
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel - Cinematic Design */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              height: isMinimized ? 'auto' : 'min(650px, 85vh)'
            }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: isResizing ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 right-6 z-50 max-w-[calc(100vw-2rem)] flex flex-col"
            style={{ width: `${panelWidth}px` }}
            role="dialog"
            aria-label="Chat panel"
          >
            {/* Resize handle on left edge */}
            <div
              onMouseDown={handleResizeMouseDown}
              className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize z-10 group/resize transition-colors duration-150 ${
                isResizing ? 'bg-[var(--accent)]/50' : 'bg-transparent hover:bg-white/20'
              }`}
              style={{ borderRadius: '28px 0 0 28px' }}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize chat panel"
              aria-valuenow={panelWidth}
              aria-valuemin={CHAT_PANEL_MIN_WIDTH}
              aria-valuemax={CHAT_PANEL_MAX_WIDTH}
            >
              {/* Visual indicator line */}
              <div
                className={`absolute left-0.5 top-1/2 -translate-y-1/2 w-0.5 h-12 rounded-full transition-all duration-150 ${
                  isResizing ? 'bg-[var(--accent)] h-16' : 'bg-white/20 group-hover/resize:bg-white/40 group-hover/resize:h-16'
                }`}
              />
            </div>

            {/* Outer glow */}
            <div className="absolute -inset-[1px] bg-gradient-to-b from-[var(--accent)]/30 via-white/[0.08] to-white/[0.02] rounded-[28px] blur-[1px]" />

            {/* Main container */}
            <div className="relative bg-gradient-to-b from-[var(--surface-dark)] to-[#050A12] rounded-[28px] border border-white/[0.1] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col h-full">

              {/* Header */}
              <div className="relative flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">

                <div className="flex items-center gap-3 relative z-10">
                  {showConversationList ? (
                    <>
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] flex items-center justify-center shadow-lg shadow-[var(--accent)]/20">
                        <MessageSquare className="w-5 h-5 text-white" strokeWidth={2.5} />
                      </div>
                      <span className="font-bold text-white text-lg tracking-tight">Messages</span>
                    </>
                  ) : (
                    <>
                      <motion.button
                        onClick={() => setShowConversationList(true)}
                        className="p-2 hover:bg-white/[0.08] rounded-xl transition-all duration-200 -ml-1"
                        aria-label="Back to conversations"
                        whileHover={{ x: -2 }}
                      >
                        <ChevronLeft className="w-5 h-5 text-white/70" />
                      </motion.button>
                      {conversation?.type === 'team' ? (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] flex items-center justify-center shadow-lg">
                          <Users className="w-5 h-5 text-white" />
                        </div>
                      ) : conversation?.type === 'dm' ? (
                        <div className="relative">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-lg ring-2 ring-white/10"
                            style={{ backgroundColor: getUserColor(conversation.userName) }}
                          >
                            {getInitials(conversation.userName)}
                          </div>
                          {/* Presence indicator */}
                          <div
                            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--surface-dark)]"
                            style={{ backgroundColor: PRESENCE_CONFIG[userPresence[conversation.userName] || 'offline'].color }}
                            title={PRESENCE_CONFIG[userPresence[conversation.userName] || 'offline'].label}
                          />
                        </div>
                      ) : (
                        <MessageSquare className="w-5 h-5 text-[var(--accent)]" />
                      )}
                      <span className="font-bold text-white text-lg tracking-tight">{getConversationTitle()}</span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1 relative z-10">
                  {/* Search toggle */}
                  {!showConversationList && (
                    <motion.button
                      onClick={() => setShowSearch(!showSearch)}
                      className={`p-2 rounded-xl transition-all duration-200 ${
                        showSearch ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'hover:bg-white/[0.08] text-white/50 hover:text-white'
                      }`}
                      title="Search messages"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Search className="w-4 h-4" />
                    </motion.button>
                  )}

                  {/* Pinned messages */}
                  {!showConversationList && pinnedMessages.length > 0 && (
                    <motion.button
                      onClick={() => setShowPinnedMessages(!showPinnedMessages)}
                      className={`p-2 rounded-xl transition-all duration-200 relative ${
                        showPinnedMessages ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'hover:bg-white/[0.08] text-white/50 hover:text-white'
                      }`}
                      title="Pinned messages"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Pin className="w-4 h-4" />
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--accent)] rounded-full text-[9px] flex items-center justify-center text-white font-bold">
                        {pinnedMessages.length}
                      </span>
                    </motion.button>
                  )}

                  {/* DND toggle */}
                  <motion.button
                    onClick={() => setIsDndMode(!isDndMode)}
                    className={`p-2 rounded-xl transition-all duration-200 ${
                      isDndMode
                        ? 'bg-red-500/20 text-red-400'
                        : 'hover:bg-white/[0.08] text-white/50 hover:text-white'
                    }`}
                    title={isDndMode ? 'Do Not Disturb (ON)' : 'Do Not Disturb (OFF)'}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Moon className="w-4 h-4" />
                  </motion.button>

                  {/* Notification toggle */}
                  <motion.button
                    onClick={toggleNotifications}
                    className={`p-2 rounded-xl transition-all duration-200 ${
                      notificationsEnabled
                        ? 'bg-green-500/20 text-green-400'
                        : 'hover:bg-white/[0.08] text-white/50'
                    }`}
                    title={notificationsEnabled ? 'Click to disable notifications' : 'Click to enable notifications'}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {notificationsEnabled ? (
                      <Bell className="w-4 h-4" />
                    ) : (
                      <BellOff className="w-4 h-4" />
                    )}
                  </motion.button>

                  {/* Connection status */}
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium ${
                      connected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}
                    title={connected ? 'Connected' : 'Disconnected'}
                  >
                    {connected ? (
                      <Wifi className="w-3.5 h-3.5" />
                    ) : (
                      <WifiOff className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <motion.button
                    onClick={() => setIsMinimized(!isMinimized)}
                    className="p-2 hover:bg-white/[0.08] rounded-xl transition-all duration-200 text-white/50 hover:text-white"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                  </motion.button>
                  <motion.button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-white/[0.08] rounded-xl transition-all duration-200 text-white/50 hover:text-white"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              {/* Search bar */}
              <AnimatePresence>
                {showSearch && !showConversationList && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-b border-white/[0.06] bg-white/[0.02]"
                  >
                    <div className="p-3">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                          type="text"
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                          placeholder="Search messages..."
                          className="w-full pl-11 pr-10 py-3 rounded-xl border border-white/[0.1] bg-white/[0.04] text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/20 transition-all duration-200"
                          autoFocus
                        />
                        {searchInput && (
                          <button
                            onClick={() => { setSearchInput(''); setSearchQuery(''); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/[0.1] rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4 text-white/40" />
                          </button>
                        )}
                      </div>
                      {searchInput && (
                        <div className="mt-2 text-xs text-white/40 px-1">
                          {filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Pinned messages panel */}
              <AnimatePresence>
                {showPinnedMessages && !showConversationList && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-b border-white/[0.06] bg-[var(--accent)]/5 max-h-36 overflow-y-auto"
                  >
                    <div className="p-3">
                      <div className="flex items-center gap-2 text-xs text-[var(--accent)]/70 mb-2 font-medium">
                        <Pin className="w-3.5 h-3.5" />
                        <span>Pinned Messages</span>
                      </div>
                      {pinnedMessages.map(msg => (
                        <div
                          key={msg.id}
                          className="text-sm p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-2 cursor-pointer hover:bg-white/[0.06] transition-colors"
                          onClick={() => setShowPinnedMessages(false)}
                        >
                          <span className="font-medium text-white">{msg.created_by}: </span>
                          <span className="text-white/60">
                            {msg.text.slice(0, 50)}{msg.text.length > 50 ? '...' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Content */}
              {!isMinimized && (
                <>
                  {showConversationList ? (
                    /* Conversation List */
                    <div className="flex-1 overflow-y-auto">
                      {sortedConversations.map(({ conv, lastMessage }, index) => {
                        const isTeam = conv.type === 'team';
                        const userName = conv.type === 'dm' ? conv.userName : '';
                        const userColor = isTeam ? 'var(--accent)' : getUserColor(userName);
                        const unreadCount = unreadCounts[isTeam ? 'team' : userName] || 0;
                        const isMuted = mutedConversations.has(isTeam ? 'team' : userName);
                        const presence = isTeam ? null : userPresence[userName];
                        const isSelected = conversation?.type === conv.type &&
                          (conv.type === 'team' || (conv.type === 'dm' && conversation?.type === 'dm' && conversation.userName === conv.userName));

                        return (
                          <motion.div
                            key={isTeam ? 'team' : userName}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05, duration: 0.3 }}
                            className={`px-4 py-4 flex items-center gap-4 transition-all duration-200 border-b border-white/[0.04] ${
                              isSelected ? 'bg-[var(--accent)]/10' : 'hover:bg-white/[0.04]'
                            } ${unreadCount > 0 && !isMuted ? 'bg-[var(--accent)]/5' : ''}`}
                          >
                            <button
                              onClick={() => selectConversation(conv)}
                              className="flex-1 flex items-center gap-4"
                            >
                              <div className="relative flex-shrink-0">
                                <motion.div
                                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-lg ring-1 ring-white/10`}
                                  style={{ backgroundColor: userColor }}
                                  whileHover={{ scale: 1.05 }}
                                >
                                  {isTeam ? <Users className="w-5 h-5" /> : getInitials(userName)}
                                </motion.div>
                                {/* Presence indicator for DMs */}
                                {!isTeam && presence && (
                                  <div
                                    className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[var(--surface-dark)]"
                                    style={{ backgroundColor: PRESENCE_CONFIG[presence].color }}
                                  />
                                )}
                                {unreadCount > 0 && !isMuted && (
                                  <motion.span
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 px-1.5 bg-gradient-to-br from-red-500 to-red-600 rounded-full text-[10px] font-bold flex items-center justify-center text-white shadow-lg border border-[var(--surface-dark)]"
                                  >
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                  </motion.span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`font-semibold text-white truncate ${
                                    unreadCount > 0 && !isMuted ? 'text-[var(--accent)]' : ''
                                  }`}>
                                    {isTeam ? 'Team Chat' : userName}
                                  </span>
                                  {lastMessage && (
                                    <span className={`text-xs flex-shrink-0 ${
                                      unreadCount > 0 && !isMuted ? 'text-[var(--accent)] font-medium' : 'text-white/40'
                                    }`}>
                                      {formatRelativeTime(lastMessage.created_at)}
                                    </span>
                                  )}
                                </div>
                                <div className={`text-sm truncate mt-1 ${
                                  unreadCount > 0 && !isMuted ? 'text-white/80 font-medium' : 'text-white/40'
                                }`}>
                                  {lastMessage ? (
                                    <>
                                      {lastMessage.created_by === currentUser.name ? 'You: ' : `${lastMessage.created_by}: `}
                                      {lastMessage.text.slice(0, 35)}{lastMessage.text.length > 35 ? '...' : ''}
                                    </>
                                  ) : (
                                    <span className="italic text-white/30">No messages yet</span>
                                  )}
                                </div>
                              </div>
                            </button>
                            {/* Mute button */}
                            <motion.button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMute(isTeam ? 'team' : userName);
                              }}
                              className={`p-2 rounded-xl transition-all duration-200 ${
                                isMuted ? 'bg-white/[0.06] text-white/40' : 'hover:bg-white/[0.06] text-white/30 hover:text-white/60'
                              }`}
                              title={isMuted ? 'Unmute' : 'Mute'}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            </motion.button>
                          </motion.div>
                        );
                      })}

                      {otherUsers.length === 0 && (
                        <div className="px-6 py-12 text-center">
                          <motion.div
                            className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.1] flex items-center justify-center"
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                          >
                            <Users className="w-8 h-8 text-[var(--accent)]/50" />
                          </motion.div>
                          <p className="font-semibold text-white/90 text-lg">No teammates yet</p>
                          <p className="text-sm mt-2 text-white/50 max-w-[200px] mx-auto">
                            Invite your team members to collaborate and chat in real-time
                          </p>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="mt-5 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium shadow-lg shadow-[var(--accent)]/20"
                          >
                            <span className="flex items-center gap-2">
                              <Plus className="w-4 h-4" />
                              Invite Team
                            </span>
                          </motion.button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Messages View */
                    <>
                      <div
                        ref={messagesContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
                      >
                        {loading ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="flex flex-col items-center gap-4">
                              <motion.div
                                className="w-10 h-10 border-3 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              />
                              <span className="text-white/50 text-sm">Loading messages...</span>
                            </div>
                          </div>
                        ) : !tableExists ? (
                          <div className="flex flex-col items-center justify-center h-full text-center px-6">
                            <div className="w-20 h-20 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-5">
                              <MessageSquare className="w-10 h-10 text-white/20" />
                            </div>
                            <p className="font-semibold text-white text-lg">Chat Setup Required</p>
                            <p className="text-sm mt-2 text-white/40">Run the messages migration in Supabase to enable chat.</p>
                          </div>
                        ) : filteredMessages.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full text-center px-6">
                            <motion.div
                              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] flex items-center justify-center mb-5"
                              animate={{ y: [-4, 4, -4] }}
                              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                            >
                              <Sparkles className="w-10 h-10 text-[var(--accent)]/60" />
                            </motion.div>
                            <p className="font-semibold text-white text-lg">
                              {searchQuery ? 'No messages found' : 'No messages yet'}
                            </p>
                            <p className="text-sm mt-2 text-white/50 max-w-xs">
                              {searchQuery
                                ? 'Try a different search term'
                                : conversation?.type === 'team'
                                ? 'Be the first to say hello to the team!'
                                : conversation?.type === 'dm'
                                ? `Start a conversation with ${conversation.userName}`
                                : 'Select a conversation to get started'}
                            </p>
                            {searchQuery ? (
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setSearchQuery('')}
                                className="mt-5 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <X className="w-4 h-4" />
                                  Clear Search
                                </span>
                              </motion.button>
                            ) : conversation && (
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  const input = document.querySelector('input[placeholder="Type a message..."]') as HTMLInputElement;
                                  input?.focus();
                                }}
                                className="mt-5 px-5 py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium shadow-lg shadow-[var(--accent)]/20"
                              >
                                <span className="flex items-center gap-2">
                                  <Send className="w-4 h-4" />
                                  Start Conversation
                                </span>
                              </motion.button>
                            )}
                          </div>
                        ) : (
                          <>
                            {/* Load more indicator at top */}
                            {hasMoreMessages && (
                              <div className="flex justify-center py-3">
                                {isLoadingMore ? (
                                  <div className="flex items-center gap-2 text-white/40 text-xs">
                                    <motion.div
                                      className="w-4 h-4 border-2 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full"
                                      animate={{ rotate: 360 }}
                                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    />
                                    <span>Loading older messages...</span>
                                  </div>
                                ) : (
                                  <button
                                    onClick={loadMoreMessages}
                                    className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors px-3 py-1.5 rounded-lg hover:bg-[var(--accent)]/10"
                                  >
                                    Load earlier messages
                                  </button>
                                )}
                              </div>
                            )}
                            {groupedMessages.map((msg, msgIndex) => {
                              const isOwn = msg.created_by === currentUser.name;
                              const userColor = getUserColor(msg.created_by);
                              const reactions = msg.reactions || [];
                              const readBy = msg.read_by || [];
                              const isLastOwnMessage = isOwn && msgIndex === groupedMessages.length - 1;
                              const showTapbackMenu = tapbackMessageId === msg.id;
                              const isHovered = hoveredMessageId === msg.id;
                              const isFirstUnread = msg.id === firstUnreadId;

                              const reactionCounts = reactions.reduce((acc, r) => {
                                acc[r.reaction] = (acc[r.reaction] || 0) + 1;
                                return acc;
                              }, {} as Record<TapbackType, number>);

                              return (
                                <div key={msg.id}>
                                  {/* Unread divider */}
                                  {isFirstUnread && (
                                    <div className="flex items-center gap-3 my-4">
                                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/50 to-transparent" />
                                      <span className="text-xs text-[var(--accent)] font-semibold px-3 py-1 bg-[var(--accent)]/10 rounded-full">New Messages</span>
                                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/50 to-transparent" />
                                    </div>
                                  )}

                                  <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${msg.isGrouped ? 'mt-0.5' : 'mt-4'} group relative`}
                                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                                    onMouseLeave={() => setHoveredMessageId(null)}
                                  >
                                    <div className={`flex items-end gap-2.5 max-w-[85%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                                      {/* Avatar */}
                                      {!msg.isGrouped ? (
                                        <div
                                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 shadow-lg ring-1 ring-white/10"
                                          style={{ backgroundColor: userColor }}
                                        >
                                          {getInitials(msg.created_by)}
                                        </div>
                                      ) : (
                                        <div className="w-8 flex-shrink-0" />
                                      )}

                                      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                                        {/* Name and time */}
                                        {!msg.isGrouped && (
                                          <div className={`flex items-center gap-2 mb-1 text-xs ${isOwn ? 'flex-row-reverse' : ''}`}>
                                            <span className="font-semibold text-white/80">
                                              {isOwn ? 'You' : msg.created_by}
                                            </span>
                                            <span className="text-white/30">
                                              {formatTime(msg.created_at)}
                                            </span>
                                            {msg.edited_at && (
                                              <span className="text-white/30 italic">(edited)</span>
                                            )}
                                            {msg.is_pinned && (
                                              <Pin className="w-3 h-3 text-[var(--accent)]" />
                                            )}
                                          </div>
                                        )}

                                        {/* Reply preview */}
                                        {msg.reply_to_text && (
                                          <div className={`text-xs px-3 py-1.5 mb-1.5 rounded-lg border-l-2 border-[var(--accent)] bg-white/[0.04] text-white/50 max-w-full truncate`}>
                                            <span className="font-medium text-[var(--accent)]">{msg.reply_to_user}: </span>
                                            {msg.reply_to_text}
                                          </div>
                                        )}

                                        {/* Message bubble - render as card for system notifications */}
                                        <div className="relative">
                                          {(() => {
                                            // Check if this is a system notification that should render as a card
                                            const systemMeta = parseSystemMessage(msg);
                                            const linkedTodo = msg.related_todo_id && todosMap?.get(msg.related_todo_id);

                                            // Render as card if: system message + has linked todo + todo data available
                                            if (systemMeta && linkedTodo && onTaskLinkClick) {
                                              return (
                                                <TaskAssignmentCard
                                                  todo={linkedTodo}
                                                  notificationType={systemMeta.notificationType}
                                                  actionBy={systemMeta.actionBy}
                                                  previousAssignee={systemMeta.previousAssignee}
                                                  onViewTask={() => onTaskLinkClick(msg.related_todo_id!)}
                                                  isOwnMessage={isOwn}
                                                />
                                              );
                                            }

                                            // Fallback to regular message bubble
                                            return (
                                              <motion.div
                                                onClick={() => setTapbackMessageId(tapbackMessageId === msg.id ? null : msg.id)}
                                                className={`px-4 py-2.5 rounded-2xl break-words whitespace-pre-wrap cursor-pointer transition-all duration-200 text-[15px] leading-relaxed ${
                                                  isOwn
                                                    ? 'bg-[var(--accent)] text-white rounded-br-md shadow-lg shadow-[var(--accent)]/20'
                                                    : 'bg-white/[0.08] text-white rounded-bl-md border border-white/[0.06]'
                                                } ${showTapbackMenu ? 'ring-2 ring-[var(--accent)]/50' : ''}`}
                                                whileHover={{ scale: 1.01 }}
                                              >
                                                {renderMessageText(msg.text)}

                                                {/* Task link button (Feature 2) - only show for non-system messages */}
                                                {msg.related_todo_id && onTaskLinkClick && !systemMeta && (
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      onTaskLinkClick(msg.related_todo_id!);
                                                    }}
                                                    className={`mt-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                      isOwn
                                                        ? 'bg-white/20 text-white hover:bg-white/30'
                                                        : 'bg-white/[0.1] text-white/80 hover:bg-white/[0.15]'
                                                    }`}
                                                  >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                    View Task
                                                  </button>
                                                )}
                                              </motion.div>
                                            );
                                          })()}

                                          {/* Action buttons on hover */}
                                          {isHovered && !showTapbackMenu && (
                                            <motion.div
                                              initial={{ opacity: 0, scale: 0.9 }}
                                              animate={{ opacity: 1, scale: 1 }}
                                              className={`absolute top-0 flex gap-0.5 bg-[var(--surface-dark)] border border-white/[0.1] rounded-xl shadow-xl p-1 ${
                                                isOwn ? 'right-full mr-2' : 'left-full ml-2'
                                              }`}
                                            >
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setReplyingTo(msg);
                                                }}
                                                className="p-2 hover:bg-white/[0.08] rounded-lg transition-colors"
                                                title="Reply"
                                              >
                                                <Reply className="w-3.5 h-3.5 text-white/50" />
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setShowMessageMenu(showMessageMenu === msg.id ? null : msg.id);
                                                }}
                                                className="p-2 hover:bg-white/[0.08] rounded-lg transition-colors"
                                                title="More"
                                              >
                                                <MoreHorizontal className="w-3.5 h-3.5 text-white/50" />
                                              </button>
                                            </motion.div>
                                          )}

                                          {/* Message menu dropdown */}
                                          <AnimatePresence>
                                            {showMessageMenu === msg.id && (
                                              <motion.div
                                                initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95, y: 5 }}
                                                className={`absolute top-full mt-2 z-30 bg-[var(--surface-dark)] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden min-w-[160px] backdrop-blur-xl ${
                                                  isOwn ? 'right-0' : 'left-0'
                                                }`}
                                              >
                                                <button
                                                  onClick={() => {
                                                    setReplyingTo(msg);
                                                    setShowMessageMenu(null);
                                                  }}
                                                  className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-white/[0.06] text-white/80 transition-colors"
                                                >
                                                  <Reply className="w-4 h-4" /> Reply
                                                </button>
                                                <button
                                                  onClick={() => togglePin(msg)}
                                                  className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-white/[0.06] text-white/80 transition-colors"
                                                >
                                                  <Pin className="w-4 h-4" /> {msg.is_pinned ? 'Unpin' : 'Pin'}
                                                </button>
                                                {onCreateTask && (
                                                  <button
                                                    onClick={() => createTaskFromMessage(msg)}
                                                    className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-white/[0.06] text-white/80 transition-colors"
                                                  >
                                                    <Plus className="w-4 h-4" /> Create Task
                                                  </button>
                                                )}
                                                {isOwn && (
                                                  <>
                                                    <button
                                                      onClick={() => startEdit(msg)}
                                                      className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-white/[0.06] text-white/80 transition-colors"
                                                    >
                                                      <Edit3 className="w-4 h-4" /> Edit
                                                    </button>
                                                    <button
                                                      onClick={() => deleteMessage(msg.id)}
                                                      className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-white/[0.06] text-red-400 transition-colors"
                                                    >
                                                      <Trash2 className="w-4 h-4" /> Delete
                                                    </button>
                                                  </>
                                                )}
                                              </motion.div>
                                            )}
                                          </AnimatePresence>

                                          {/* Time on hover for grouped messages */}
                                          {msg.isGrouped && isHovered && (
                                            <div className={`absolute top-1/2 -translate-y-1/2 text-[10px] text-white/30 pointer-events-none whitespace-nowrap ${
                                              isOwn ? 'right-full mr-3' : 'left-full ml-3'
                                            }`}>
                                              {formatTime(msg.created_at)}
                                            </div>
                                          )}

                                          {/* Tapback menu */}
                                          <AnimatePresence>
                                            {showTapbackMenu && (
                                              <motion.div
                                                initial={{ opacity: 0, scale: 0.9, y: 8 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.9, y: 8 }}
                                                transition={{ duration: 0.15 }}
                                                className={`absolute ${isOwn ? 'right-0' : 'left-0'} bottom-full mb-2 z-20 bg-[var(--surface-dark)] border border-white/[0.1] rounded-2xl shadow-2xl px-2 py-1.5 flex gap-1`}
                                              >
                                                {(Object.keys(TAPBACK_EMOJIS) as TapbackType[]).map((reaction) => {
                                                  const myReaction = reactions.find(r => r.user === currentUser.name);
                                                  const isSelected = myReaction?.reaction === reaction;
                                                  const reactionCount = reactions.filter(r => r.reaction === reaction).length;
                                                  return (
                                                    <motion.button
                                                      key={reaction}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleTapback(msg.id, reaction);
                                                      }}
                                                      aria-label={getReactionAriaLabel(reaction, reactionCount, isSelected)}
                                                      aria-pressed={isSelected}
                                                      className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 text-xl ${
                                                        isSelected
                                                          ? 'bg-[var(--accent)]/30 ring-2 ring-[var(--accent)]'
                                                          : 'hover:bg-white/[0.08]'
                                                      }`}
                                                      whileHover={{ scale: 1.15 }}
                                                      whileTap={{ scale: 0.9 }}
                                                    >
                                                      {TAPBACK_EMOJIS[reaction]}
                                                    </motion.button>
                                                  );
                                                })}
                                              </motion.div>
                                            )}
                                          </AnimatePresence>

                                          {/* Reactions display */}
                                          {Object.keys(reactionCounts).length > 0 && (
                                            <div
                                              className={`absolute ${isOwn ? '-left-2' : '-right-2'} -bottom-3 z-10`}
                                              onMouseEnter={() => setShowReactionsSummary(msg.id)}
                                              onMouseLeave={() => setShowReactionsSummary(null)}
                                            >
                                              <div className="bg-[var(--surface-dark)] border border-white/[0.1] rounded-full px-2 py-1 flex items-center gap-1 shadow-lg cursor-pointer">
                                                {(Object.entries(reactionCounts) as [TapbackType, number][]).map(([reaction, count]) => (
                                                  <span key={reaction} className="flex items-center text-sm">
                                                    {TAPBACK_EMOJIS[reaction]}
                                                    {count > 1 && (
                                                      <span className="text-[10px] ml-0.5 text-white/50 font-medium">
                                                        {count}
                                                      </span>
                                                    )}
                                                  </span>
                                                ))}
                                              </div>
                                              {/* Reactions summary tooltip */}
                                              <AnimatePresence>
                                                {showReactionsSummary === msg.id && (
                                                  <motion.div
                                                    initial={{ opacity: 0, y: 5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 5 }}
                                                    className={`absolute bottom-full mb-2 z-30 ${isOwn ? 'right-0' : 'left-0'}`}
                                                  >
                                                    <ReactionsSummary reactions={reactions} />
                                                  </motion.div>
                                                )}
                                              </AnimatePresence>
                                            </div>
                                          )}
                                        </div>

                                        {/* Read receipts */}
                                        {isOwn && isLastOwnMessage && (
                                          <div className={`flex items-center gap-1.5 mt-1.5 text-[10px] text-white/40 ${reactions.length > 0 ? 'mt-4' : ''}`}>
                                            {readBy.length === 0 ? (
                                              <span className="flex items-center gap-1">
                                                <Check className="w-3 h-3" />
                                                Sent
                                              </span>
                                            ) : (
                                              <span className="flex items-center gap-1 text-[var(--accent)]">
                                                <CheckCheck className="w-3 h-3" />
                                                {conversation?.type === 'dm' ? 'Read' : `Read by ${readBy.length}`}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                </div>
                              );
                            })}

                            {/* Typing indicator */}
                            <AnimatePresence>
                              {activeTypingUsers.length > 0 && (
                                <TypingIndicator userName={activeTypingUsers[0]} />
                              )}
                            </AnimatePresence>
                          </>
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      {/* Scroll to bottom button */}
                      <AnimatePresence>
                        {!isAtBottom && filteredMessages.length > 0 && (
                          <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            onClick={() => scrollToBottom()}
                            className="absolute bottom-[130px] left-1/2 -translate-x-1/2 bg-[var(--surface-dark)] border border-white/[0.1] rounded-full px-4 py-2 shadow-xl flex items-center gap-2 text-sm text-white hover:bg-white/[0.06] transition-all"
                          >
                            <ChevronDown className="w-4 h-4" />
                            <span>New messages</span>
                          </motion.button>
                        )}
                      </AnimatePresence>

                      {/* Reply preview bar */}
                      <AnimatePresence>
                        {replyingTo && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-white/[0.06] bg-[var(--accent)]/5 px-4 py-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm">
                                <Reply className="w-4 h-4 text-[var(--accent)]" />
                                <span className="text-white/50">Replying to</span>
                                <span className="font-semibold text-white">{replyingTo.created_by}</span>
                              </div>
                              <button
                                onClick={() => setReplyingTo(null)}
                                className="p-1.5 hover:bg-white/[0.08] rounded-lg transition-colors"
                              >
                                <X className="w-4 h-4 text-white/40" />
                              </button>
                            </div>
                            <p className="text-sm text-white/40 truncate mt-1 pl-6">
                              {replyingTo.text}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Edit mode bar */}
                      <AnimatePresence>
                        {editingMessage && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-white/[0.06] bg-[var(--accent)]/10 px-4 py-3"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2 text-sm">
                                <Edit3 className="w-4 h-4 text-[var(--accent)]" />
                                <span className="font-semibold text-white">Editing message</span>
                              </div>
                              <button
                                onClick={() => {
                                  setEditingMessage(null);
                                  setEditText('');
                                }}
                                className="p-1.5 hover:bg-white/[0.08] rounded-lg transition-colors"
                              >
                                <X className="w-4 h-4 text-white/40" />
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="flex-1 px-4 py-3 rounded-xl border border-white/[0.1] bg-white/[0.04] text-white text-sm focus:outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/20 transition-all"
                                autoFocus
                              />
                              <motion.button
                                onClick={saveEdit}
                                disabled={!editText.trim()}
                                className="px-5 py-3 bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-[var(--accent)]/20"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                Save
                              </motion.button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Rate Limit Warning */}
                      {rateLimitWarning && (
                        <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 text-amber-400 text-sm flex items-center gap-2">
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          {rateLimitWarning}
                        </div>
                      )}

                      {/* Input Area */}
                      {!editingMessage && (
                        <div className="p-4 border-t border-white/[0.06] bg-gradient-to-t from-[#050A12] to-transparent relative">
                          {/* Mention autocomplete */}
                          <AnimatePresence>
                            {showMentions && (
                              <MentionAutocomplete
                                users={otherUsers}
                                filter={mentionFilter}
                                onSelect={insertMention}
                                position={{ top: 60, left: 50 }}
                              />
                            )}
                          </AnimatePresence>

                          {/* Emoji Picker */}
                          <AnimatePresence>
                            {showEmojiPicker && (
                              <motion.div
                                ref={emojiPickerRef}
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="mb-3 bg-[var(--surface-dark)] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden"
                              >
                                <div className="flex border-b border-white/[0.06]">
                                  {(Object.keys(EMOJI_CATEGORIES) as (keyof typeof EMOJI_CATEGORIES)[]).map((cat) => (
                                    <button
                                      key={cat}
                                      onClick={() => setEmojiCategory(cat)}
                                      className={`flex-1 py-3 text-xs font-semibold capitalize transition-all duration-200 ${
                                        emojiCategory === cat
                                          ? 'bg-[var(--accent)]/20 text-[var(--accent)] border-b-2 border-[var(--accent)]'
                                          : 'text-white/40 hover:bg-white/[0.04] hover:text-white/60'
                                      }`}
                                    >
                                      {cat}
                                    </button>
                                  ))}
                                </div>
                                <div className="p-3">
                                  <div className="grid grid-cols-6 gap-1">
                                    {EMOJI_CATEGORIES[emojiCategory].map((emoji, i) => (
                                      <motion.button
                                        key={`${emoji}-${i}`}
                                        onClick={() => addEmoji(emoji)}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/[0.08] transition-all text-xl"
                                        whileHover={{ scale: 1.2 }}
                                        whileTap={{ scale: 0.9 }}
                                      >
                                        {emoji}
                                      </motion.button>
                                    ))}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <div className="flex items-end gap-2">
                            <motion.button
                              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                              disabled={!tableExists}
                              className={`p-3 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                                showEmojiPicker ? 'bg-[var(--accent)]/20 text-[var(--accent)]' : 'hover:bg-white/[0.06] text-white/40 hover:text-white/70'
                              }`}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Smile className="w-5 h-5" />
                            </motion.button>

                            {/* Mention button */}
                            <motion.button
                              onClick={() => {
                                setNewMessage(prev => prev + '@');
                                setShowMentions(true);
                                setMentionFilter('');
                                inputRef.current?.focus();
                              }}
                              disabled={!tableExists}
                              className="p-3 rounded-xl transition-all duration-200 hover:bg-white/[0.06] text-white/40 hover:text-white/70 disabled:opacity-50"
                              title="Mention someone"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <AtSign className="w-5 h-5" />
                            </motion.button>

                            <div className="flex-1 relative">
                              <textarea
                                ref={inputRef}
                                value={newMessage}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                maxLength={CHAT_LIMITS.MAX_MESSAGE_LENGTH}
                                placeholder={
                                  !tableExists
                                    ? "Chat not available"
                                    : !conversation
                                    ? "Select a conversation"
                                    : conversation.type === 'team'
                                    ? "Message team..."
                                    : `Message ${conversation.userName}...`
                                }
                                disabled={!tableExists}
                                rows={1}
                                aria-label={conversation ? `Message input for ${conversation.type === 'team' ? 'team chat' : conversation.userName}` : 'Message input'}
                                aria-describedby="char-counter"
                                className="w-full px-5 py-3 rounded-2xl border border-white/[0.1] bg-white/[0.04] text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/20 resize-none max-h-28 transition-all text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                  height: 'auto',
                                  minHeight: '48px',
                                  maxHeight: '112px'
                                }}
                                onInput={(e) => {
                                  const target = e.target as HTMLTextAreaElement;
                                  target.style.height = 'auto';
                                  target.style.height = Math.min(target.scrollHeight, 112) + 'px';
                                }}
                              />
                              {/* Character counter - shows when approaching limit */}
                              {newMessage.length > CHAT_LIMITS.MAX_MESSAGE_LENGTH * 0.8 && (
                                <span
                                  id="char-counter"
                                  className={`absolute bottom-1 right-2 text-xs ${
                                    newMessage.length > CHAT_LIMITS.MAX_MESSAGE_LENGTH * 0.95
                                      ? 'text-red-400'
                                      : 'text-white/40'
                                  }`}
                                >
                                  {newMessage.length}/{CHAT_LIMITS.MAX_MESSAGE_LENGTH}
                                </span>
                              )}
                            </div>
                            <motion.button
                              onClick={sendMessage}
                              disabled={!newMessage.trim() || !tableExists}
                              className="p-3 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-[var(--accent)]/20 disabled:shadow-none"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Send className="w-5 h-5" />
                            </motion.button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Task Modal */}
      <AnimatePresence>
        {showCreateTaskModal && taskFromMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowCreateTaskModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--surface-dark)] border border-white/[0.1] rounded-2xl shadow-2xl p-6 max-w-md w-full"
            >
              <h3 className="text-xl font-bold text-white mb-5">Create Task from Message</h3>
              <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl mb-5">
                <p className="text-sm text-white/50 mb-1">From {taskFromMessage.created_by}:</p>
                <p className="text-white">{taskFromMessage.text}</p>
              </div>
              <div className="flex justify-end gap-3">
                <motion.button
                  onClick={() => setShowCreateTaskModal(false)}
                  className="px-5 py-3 rounded-xl border border-white/[0.1] text-white/70 hover:bg-white/[0.04] transition-all font-medium"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={handleCreateTask}
                  className="px-5 py-3 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-light)] text-white font-semibold shadow-lg shadow-[var(--accent)]/20 hover:opacity-90 transition-all"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Create Task
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
