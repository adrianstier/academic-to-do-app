'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ChatMessage, AuthUser, ChatConversation, TapbackType, MessageReaction } from '@/types/todo';
import { v4 as uuidv4 } from 'uuid';
import {
  MessageSquare, Send, X, Minimize2, Maximize2, ChevronDown,
  Users, ChevronLeft, User, Smile, Check, CheckCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Tapback emoji mapping
const TAPBACK_EMOJIS: Record<TapbackType, string> = {
  heart: '❤️',
  thumbsup: '👍',
  thumbsdown: '👎',
  haha: '😂',
  exclamation: '❗',
  question: '❓',
};

// Common emojis for quick picker
const QUICK_EMOJIS = ['😀', '😂', '❤️', '👍', '👎', '🎉', '🔥', '💯', '👏', '🙏', '😊', '🤔'];

interface ChatPanelProps {
  currentUser: AuthUser;
  users: { name: string; color: string }[];
}

export default function ChatPanel({ currentUser, users }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [showConversationList, setShowConversationList] = useState(true);
  // Track unread counts per conversation: { 'team': 5, 'userName': 3, ... }
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  // Track last read timestamp per conversation
  const [lastReadTimestamps, setLastReadTimestamps] = useState<Record<string, string>>({});
  // Emoji picker and tapback state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [tapbackMessageId, setTapbackMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Other users (excluding current user)
  const otherUsers = useMemo(() =>
    users.filter(u => u.name !== currentUser.name),
    [users, currentUser.name]
  );

  const getUserColor = useCallback((userName: string) => {
    const user = users.find(u => u.name === userName);
    return user?.color || '#0033A0';
  }, [users]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Get conversation key for unread tracking
  const getConversationKey = useCallback((conv: ChatConversation) => {
    return conv.type === 'team' ? 'team' : conv.userName;
  }, []);

  // Total unread count across all conversations
  const totalUnreadCount = useMemo(() => {
    return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  }, [unreadCounts]);

  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(isBottom);
    if (isBottom && isOpen && conversation) {
      // Mark current conversation as read
      const key = getConversationKey(conversation);
      setUnreadCounts(prev => ({ ...prev, [key]: 0 }));
      setLastReadTimestamps(prev => ({ ...prev, [key]: new Date().toISOString() }));
    }
  }, [isOpen, conversation, getConversationKey]);

  // Filter messages for current conversation
  const filteredMessages = useMemo(() => {
    if (!conversation) return [];
    if (conversation.type === 'team') {
      // Team chat: messages with no recipient (null or undefined)
      return messages.filter(m => !m.recipient);
    } else {
      // DM: messages between current user and the other user
      const otherUser = conversation.userName;
      return messages.filter(m =>
        (m.created_by === currentUser.name && m.recipient === otherUser) ||
        (m.created_by === otherUser && m.recipient === currentUser.name)
      );
    }
  }, [messages, conversation, currentUser.name]);

  // Get last message for each conversation (for sorting by most recent)
  const conversationLastMessages = useMemo(() => {
    const result: Record<string, ChatMessage | null> = { team: null };

    // Team messages
    const teamMessages = messages.filter(m => !m.recipient);
    if (teamMessages.length > 0) {
      result.team = teamMessages[teamMessages.length - 1];
    }

    // DM messages for each user
    otherUsers.forEach(user => {
      const dmMessages = messages.filter(m =>
        (m.created_by === currentUser.name && m.recipient === user.name) ||
        (m.created_by === user.name && m.recipient === currentUser.name)
      );
      result[user.name] = dmMessages.length > 0 ? dmMessages[dmMessages.length - 1] : null;
    });

    return result;
  }, [messages, otherUsers, currentUser.name]);

  // Find the most recent conversation with activity
  const mostRecentConversation = useMemo((): ChatConversation => {
    let mostRecentKey: string | null = null;
    let mostRecentTime: string | null = null;

    Object.entries(conversationLastMessages).forEach(([key, msg]) => {
      if (msg) {
        if (!mostRecentTime || msg.created_at > mostRecentTime) {
          mostRecentKey = key;
          mostRecentTime = msg.created_at;
        }
      }
    });

    if (mostRecentKey) {
      return mostRecentKey === 'team'
        ? { type: 'team' }
        : { type: 'dm', userName: mostRecentKey };
    }
    return { type: 'team' };
  }, [conversationLastMessages]);

  // Fetch all messages
  const fetchMessages = useCallback(async () => {
    if (!isSupabaseConfigured()) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(500);

    if (error) {
      console.error('Error fetching messages:', error);
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        setTableExists(false);
      }
    } else {
      setMessages(data || []);
      setTableExists(true);
    }
    setLoading(false);
  }, []);

  // Track state in refs to avoid re-subscribing
  const isOpenRef = useRef(isOpen);
  const isAtBottomRef = useRef(isAtBottom);
  const conversationRef = useRef(conversation);
  const showConversationListRef = useRef(showConversationList);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { isAtBottomRef.current = isAtBottom; }, [isAtBottom]);
  useEffect(() => { conversationRef.current = conversation; }, [conversation]);
  useEffect(() => { showConversationListRef.current = showConversationList; }, [showConversationList]);

  // Determine which conversation a message belongs to
  const getMessageConversationKey = useCallback((msg: ChatMessage): string | null => {
    if (!msg.recipient) {
      return 'team';
    }
    // DM - return the other person's name
    if (msg.created_by === currentUser.name) {
      return msg.recipient;
    }
    if (msg.recipient === currentUser.name) {
      return msg.created_by;
    }
    return null; // Not relevant to current user
  }, [currentUser.name]);

  // Real-time subscription
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    fetchMessages();

    const channel = supabase
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

            // Don't count own messages
            if (newMsg.created_by === currentUser.name) return;

            // Determine which conversation this message belongs to
            const msgConvKey = !newMsg.recipient ? 'team' :
              newMsg.recipient === currentUser.name ? newMsg.created_by : null;

            if (!msgConvKey) return; // Not relevant to current user

            // Check if this conversation is currently being viewed
            const currentConv = conversationRef.current;
            const currentKey = currentConv ? (currentConv.type === 'team' ? 'team' : currentConv.userName) : null;
            const isViewingThis = isOpenRef.current && !showConversationListRef.current &&
                                  currentKey === msgConvKey && isAtBottomRef.current;

            if (!isViewingThis) {
              // Increment unread for this conversation
              setUnreadCounts(prev => ({
                ...prev,
                [msgConvKey]: (prev[msgConvKey] || 0) + 1
              }));
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as ChatMessage;
            setMessages((prev) => prev.map(m =>
              m.id === updatedMsg.id ? { ...m, reactions: updatedMsg.reactions, read_by: updatedMsg.read_by } : m
            ));
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages, currentUser.name, getMessageConversationKey]);

  // Auto-scroll on new messages if at bottom
  useEffect(() => {
    if (isAtBottom && isOpen && !showConversationList) {
      scrollToBottom();
    }
  }, [filteredMessages, isAtBottom, isOpen, scrollToBottom, showConversationList]);

  // Focus input when opening chat or switching conversations
  useEffect(() => {
    if (isOpen && !isMinimized && !showConversationList && conversation) {
      setTimeout(() => inputRef.current?.focus(), 100);
      // Mark current conversation as read
      const key = getConversationKey(conversation);
      setUnreadCounts(prev => ({ ...prev, [key]: 0 }));
    }
  }, [isOpen, isMinimized, showConversationList, conversation, getConversationKey]);

  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text || !conversation) return;

    const message: ChatMessage = {
      id: uuidv4(),
      text,
      created_by: currentUser.name,
      created_at: new Date().toISOString(),
      recipient: conversation.type === 'dm' ? conversation.userName : null,
    };

    // Optimistic update
    setMessages((prev) => [...prev, message]);
    setNewMessage('');
    scrollToBottom();

    const { error } = await supabase.from('messages').insert([message]);

    if (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      setNewMessage(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Add emoji to message input
  const addEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  // Add or toggle tapback reaction on a message
  const toggleTapback = async (messageId: string, reaction: TapbackType) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const currentReactions = message.reactions || [];
    const existingReaction = currentReactions.find(r => r.user === currentUser.name);

    let newReactions: MessageReaction[];

    if (existingReaction?.reaction === reaction) {
      // Remove reaction if clicking same one
      newReactions = currentReactions.filter(r => r.user !== currentUser.name);
    } else if (existingReaction) {
      // Replace reaction
      newReactions = currentReactions.map(r =>
        r.user === currentUser.name
          ? { user: currentUser.name, reaction, created_at: new Date().toISOString() }
          : r
      );
    } else {
      // Add new reaction
      newReactions = [...currentReactions, {
        user: currentUser.name,
        reaction,
        created_at: new Date().toISOString()
      }];
    }

    // Optimistic update
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, reactions: newReactions } : m
    ));
    setTapbackMessageId(null);

    // Update in database
    const { error } = await supabase
      .from('messages')
      .update({ reactions: newReactions })
      .eq('id', messageId);

    if (error) {
      console.error('Error updating reaction:', error);
      // Revert on error
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, reactions: currentReactions } : m
      ));
    }
  };

  // Mark messages as read
  const markMessagesAsRead = useCallback(async (messageIds: string[]) => {
    if (messageIds.length === 0) return;

    // Update locally first
    setMessages(prev => prev.map(m => {
      if (messageIds.includes(m.id) && m.created_by !== currentUser.name) {
        const readBy = m.read_by || [];
        if (!readBy.includes(currentUser.name)) {
          return { ...m, read_by: [...readBy, currentUser.name] };
        }
      }
      return m;
    }));

    // Batch update in database
    for (const messageId of messageIds) {
      const message = messages.find(m => m.id === messageId);
      if (message && message.created_by !== currentUser.name) {
        const readBy = message.read_by || [];
        if (!readBy.includes(currentUser.name)) {
          await supabase
            .from('messages')
            .update({ read_by: [...readBy, currentUser.name] })
            .eq('id', messageId);
        }
      }
    }
  }, [messages, currentUser.name]);

  // Mark visible messages as read when viewing conversation
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

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
      // Close tapback menu when clicking elsewhere
      if (tapbackMessageId) {
        setTapbackMessageId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [tapbackMessageId]);

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

  // Get unread count per conversation
  const getConversationUnread = useCallback((conv: ChatConversation) => {
    const key = getConversationKey(conv);
    return unreadCounts[key] || 0;
  }, [unreadCounts, getConversationKey]);

  // Group consecutive messages by same user
  const groupedMessages = filteredMessages.reduce((acc, msg, idx) => {
    const prevMsg = filteredMessages[idx - 1];
    const isGrouped = prevMsg && prevMsg.created_by === msg.created_by &&
      new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 60000;

    return [...acc, { ...msg, isGrouped }];
  }, [] as (ChatMessage & { isGrouped: boolean })[]);

  const selectConversation = (conv: ChatConversation) => {
    setConversation(conv);
    setShowConversationList(false);
    // Clear unread count for this conversation
    const key = getConversationKey(conv);
    setUnreadCounts(prev => ({ ...prev, [key]: 0 }));
  };

  const getConversationTitle = () => {
    if (!conversation) return 'Messages';
    if (conversation.type === 'team') return 'Team Chat';
    return conversation.userName;
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => {
              setIsOpen(true);
              // Default to most recent conversation with activity, or show list
              if (messages.length > 0) {
                setConversation(mostRecentConversation);
                setShowConversationList(false);
              } else {
                setShowConversationList(true);
              }
            }}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full
                       bg-[var(--accent)] hover:bg-[var(--allstate-blue-dark)]
                       text-white shadow-lg hover:shadow-xl
                       transition-all duration-200 flex items-center justify-center
                       group"
          >
            <MessageSquare className="w-6 h-6" />
            {totalUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[1.5rem] h-6 px-1 bg-red-500
                             rounded-full text-xs font-bold flex items-center
                             justify-center animate-pulse">
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              height: isMinimized ? 'auto' : '500px'
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)]
                       bg-[var(--surface)] border border-[var(--border)]
                       rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3
                          bg-[var(--accent)] text-white">
              <div className="flex items-center gap-2">
                {showConversationList ? (
                  <>
                    <MessageSquare className="w-5 h-5" />
                    <span className="font-semibold">Messages</span>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setShowConversationList(true)}
                      className="p-1 hover:bg-white/20 rounded-lg transition-colors -ml-1"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    {conversation?.type === 'team' ? (
                      <Users className="w-5 h-5" />
                    ) : conversation?.type === 'dm' ? (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: getUserColor(conversation.userName) }}
                      >
                        {getInitials(conversation.userName)}
                      </div>
                    ) : (
                      <MessageSquare className="w-5 h-5" />
                    )}
                    <span className="font-semibold">{getConversationTitle()}</span>
                  </>
                )}
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            {!isMinimized && (
              <>
                {showConversationList ? (
                  /* Conversation List */
                  <div className="flex-1 overflow-y-auto bg-[var(--background)]">
                    {/* Team Chat Option */}
                    <button
                      onClick={() => selectConversation({ type: 'team' })}
                      className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--surface-2)] transition-colors
                                ${conversation?.type === 'team' ? 'bg-[var(--accent-light)]' : ''}`}
                    >
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-white">
                          <Users className="w-5 h-5" />
                        </div>
                        {(unreadCounts['team'] || 0) > 0 && (
                          <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 bg-red-500
                                         rounded-full text-xs font-bold flex items-center justify-center text-white">
                            {unreadCounts['team'] > 99 ? '99+' : unreadCounts['team']}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-[var(--foreground)]">Team Chat</div>
                        <div className="text-sm text-[var(--text-muted)]">
                          {conversationLastMessages.team
                            ? `${conversationLastMessages.team.created_by}: ${conversationLastMessages.team.text.slice(0, 30)}${conversationLastMessages.team.text.length > 30 ? '...' : ''}`
                            : 'Message everyone'}
                        </div>
                      </div>
                    </button>

                    {/* Divider */}
                    <div className="px-4 py-2">
                      <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                        Direct Messages
                      </div>
                    </div>

                    {/* User List for DMs */}
                    {otherUsers.length === 0 ? (
                      <div className="px-4 py-8 text-center text-[var(--text-muted)]">
                        <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No other users yet</p>
                      </div>
                    ) : (
                      otherUsers.map((user) => {
                        const isSelected = conversation?.type === 'dm' && conversation.userName === user.name;
                        const userUnread = unreadCounts[user.name] || 0;
                        const lastMsg = conversationLastMessages[user.name];
                        return (
                          <button
                            key={user.name}
                            onClick={() => selectConversation({ type: 'dm', userName: user.name })}
                            className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--surface-2)] transition-colors
                                      ${isSelected ? 'bg-[var(--accent-light)]' : ''}`}
                          >
                            <div className="relative">
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                                style={{ backgroundColor: user.color }}
                              >
                                {getInitials(user.name)}
                              </div>
                              {userUnread > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 bg-red-500
                                               rounded-full text-xs font-bold flex items-center justify-center text-white">
                                  {userUnread > 99 ? '99+' : userUnread}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 text-left">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-[var(--foreground)]">{user.name}</span>
                                {userUnread > 0 && (
                                  <span className="w-2 h-2 rounded-full bg-red-500" />
                                )}
                              </div>
                              <div className="text-sm text-[var(--text-muted)] truncate">
                                {lastMsg
                                  ? `${lastMsg.created_by === currentUser.name ? 'You' : lastMsg.created_by}: ${lastMsg.text.slice(0, 25)}${lastMsg.text.length > 25 ? '...' : ''}`
                                  : 'No messages yet'}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : (
                  /* Messages View */
                  <>
                    <div
                      ref={messagesContainerRef}
                      onScroll={handleScroll}
                      className="flex-1 overflow-y-auto p-4 space-y-1 bg-[var(--background)]"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
                          Loading messages...
                        </div>
                      ) : !tableExists ? (
                        <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] gap-2 p-4 text-center">
                          <MessageSquare className="w-12 h-12 opacity-30" />
                          <p className="font-medium">Chat Setup Required</p>
                          <p className="text-sm">Run the messages table migration in Supabase to enable chat.</p>
                        </div>
                      ) : filteredMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] gap-2">
                          <MessageSquare className="w-12 h-12 opacity-30" />
                          <p>No messages yet</p>
                          <p className="text-sm">
                            {conversation?.type === 'team'
                              ? 'Start the team conversation!'
                              : conversation?.type === 'dm'
                              ? `Start chatting with ${conversation.userName}!`
                              : 'Select a conversation'}
                          </p>
                        </div>
                      ) : (
                        groupedMessages.map((msg, msgIndex) => {
                          const isOwn = msg.created_by === currentUser.name;
                          const userColor = getUserColor(msg.created_by);
                          const reactions = msg.reactions || [];
                          const readBy = msg.read_by || [];
                          const isLastOwnMessage = isOwn && msgIndex === groupedMessages.length - 1;
                          const showTapbackMenu = tapbackMessageId === msg.id;

                          // Group reactions by type
                          const reactionCounts = reactions.reduce((acc, r) => {
                            acc[r.reaction] = (acc[r.reaction] || 0) + 1;
                            return acc;
                          }, {} as Record<TapbackType, number>);

                          return (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}
                                        ${msg.isGrouped ? 'mt-0.5' : 'mt-3'} group relative`}
                            >
                              <div className={`flex items-end gap-2 max-w-[80%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                                {/* Avatar - only show for first in group */}
                                {!msg.isGrouped ? (
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center
                                             text-white text-xs font-bold flex-shrink-0"
                                    style={{ backgroundColor: userColor }}
                                  >
                                    {getInitials(msg.created_by)}
                                  </div>
                                ) : (
                                  <div className="w-8 flex-shrink-0" />
                                )}

                                <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                                  {/* Name and time - only show for first in group */}
                                  {!msg.isGrouped && (
                                    <div className={`flex items-center gap-2 mb-1 text-xs
                                                  ${isOwn ? 'flex-row-reverse' : ''}`}>
                                      <span className="font-medium text-[var(--foreground)]">
                                        {isOwn ? 'You' : msg.created_by}
                                      </span>
                                      <span className="text-[var(--text-muted)]">
                                        {formatTime(msg.created_at)}
                                      </span>
                                    </div>
                                  )}

                                  {/* Message bubble with tapback trigger */}
                                  <div className="relative">
                                    <div
                                      onClick={() => setTapbackMessageId(tapbackMessageId === msg.id ? null : msg.id)}
                                      className={`px-3 py-2 rounded-2xl break-words whitespace-pre-wrap cursor-pointer
                                                transition-transform hover:scale-[1.02]
                                                ${isOwn
                                                  ? 'bg-[var(--accent)] text-white rounded-br-md'
                                                  : 'bg-[var(--surface-2)] text-[var(--foreground)] rounded-bl-md'
                                                }`}
                                    >
                                      {msg.text}
                                    </div>

                                    {/* Tapback menu */}
                                    <AnimatePresence>
                                      {showTapbackMenu && (
                                        <motion.div
                                          initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                          animate={{ opacity: 1, scale: 1, y: 0 }}
                                          exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                          className={`absolute ${isOwn ? 'right-0' : 'left-0'} bottom-full mb-2 z-10
                                                    bg-[var(--surface)] border border-[var(--border)]
                                                    rounded-full shadow-lg px-2 py-1 flex gap-1`}
                                        >
                                          {(Object.keys(TAPBACK_EMOJIS) as TapbackType[]).map((reaction) => {
                                            const myReaction = reactions.find(r => r.user === currentUser.name);
                                            const isSelected = myReaction?.reaction === reaction;
                                            return (
                                              <button
                                                key={reaction}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  toggleTapback(msg.id, reaction);
                                                }}
                                                className={`w-8 h-8 flex items-center justify-center rounded-full
                                                          transition-all hover:scale-125 text-lg
                                                          ${isSelected ? 'bg-[var(--accent-light)] scale-110' : 'hover:bg-[var(--surface-2)]'}`}
                                              >
                                                {TAPBACK_EMOJIS[reaction]}
                                              </button>
                                            );
                                          })}
                                        </motion.div>
                                      )}
                                    </AnimatePresence>

                                    {/* Reactions display */}
                                    {Object.keys(reactionCounts).length > 0 && (
                                      <div className={`absolute ${isOwn ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2'}
                                                    -bottom-2 flex gap-0.5 z-5`}>
                                        <div className="bg-[var(--surface)] border border-[var(--border)]
                                                      rounded-full px-1.5 py-0.5 flex gap-0.5 shadow-sm text-xs">
                                          {(Object.entries(reactionCounts) as [TapbackType, number][]).map(([reaction, count]) => (
                                            <span key={reaction} className="flex items-center">
                                              {TAPBACK_EMOJIS[reaction]}
                                              {count > 1 && <span className="text-[10px] ml-0.5 text-[var(--text-muted)]">{count}</span>}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Read receipts - show for own messages */}
                                  {isOwn && (
                                    <div className={`flex items-center gap-1 mt-1 text-xs text-[var(--text-muted)]
                                                  ${reactions.length > 0 ? 'mt-3' : ''}`}>
                                      {readBy.length === 0 ? (
                                        <Check className="w-3 h-3" />
                                      ) : (
                                        <>
                                          <CheckCheck className="w-3 h-3 text-blue-500" />
                                          {conversation?.type === 'dm' ? (
                                            <span className="text-[10px]">Read</span>
                                          ) : readBy.length > 0 && (
                                            <span className="text-[10px]">
                                              {readBy.length === 1
                                                ? `Read by ${readBy[0]}`
                                                : `Read by ${readBy.length}`}
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Scroll to bottom button */}
                    <AnimatePresence>
                      {!isAtBottom && filteredMessages.length > 0 && (
                        <motion.button
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          onClick={() => scrollToBottom()}
                          className="absolute bottom-20 left-1/2 -translate-x-1/2
                                   bg-[var(--surface)] border border-[var(--border)]
                                   rounded-full px-3 py-1.5 shadow-lg flex items-center gap-1
                                   text-sm text-[var(--text-muted)] hover:text-[var(--foreground)]
                                   transition-colors"
                        >
                          <ChevronDown className="w-4 h-4" />
                          {totalUnreadCount > 0 && `${totalUnreadCount} new`}
                        </motion.button>
                      )}
                    </AnimatePresence>

                    {/* Input Area */}
                    <div className="p-3 border-t border-[var(--border)] bg-[var(--surface)]">
                      {/* Emoji Picker */}
                      <AnimatePresence>
                        {showEmojiPicker && (
                          <motion.div
                            ref={emojiPickerRef}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="mb-2 p-2 bg-[var(--background)] border border-[var(--border)]
                                     rounded-xl shadow-lg"
                          >
                            <div className="grid grid-cols-6 gap-1">
                              {QUICK_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => addEmoji(emoji)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg
                                           hover:bg-[var(--surface-2)] transition-colors text-lg"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex items-end gap-2">
                        {/* Emoji button */}
                        <button
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          disabled={!tableExists}
                          className={`p-2.5 rounded-full transition-all duration-200
                                   hover:bg-[var(--surface-2)] disabled:opacity-50
                                   disabled:cursor-not-allowed
                                   ${showEmojiPicker ? 'bg-[var(--surface-2)] text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}
                        >
                          <Smile className="w-5 h-5" />
                        </button>

                        <textarea
                          ref={inputRef}
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder={
                            !tableExists
                              ? "Chat not available"
                              : !conversation
                              ? "Select a conversation"
                              : conversation.type === 'team'
                              ? "Message the team..."
                              : `Message ${conversation.userName}...`
                          }
                          disabled={!tableExists}
                          rows={1}
                          className="flex-1 px-4 py-2.5 rounded-2xl border border-[var(--border)]
                                   bg-[var(--background)] text-[var(--foreground)]
                                   placeholder:text-[var(--text-muted)]
                                   focus:outline-none focus:border-[var(--accent)]
                                   resize-none max-h-32 transition-colors
                                   disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            height: 'auto',
                            minHeight: '42px',
                            maxHeight: '128px'
                          }}
                          onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                          }}
                        />
                        <button
                          onClick={sendMessage}
                          disabled={!newMessage.trim() || !tableExists}
                          className="p-2.5 rounded-full bg-[var(--accent)] text-white
                                   hover:bg-[var(--allstate-blue-dark)] disabled:opacity-50
                                   disabled:cursor-not-allowed transition-all duration-200
                                   hover:scale-105 active:scale-95"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-2 text-center">
                        Tap message to react • Press Enter to send
                      </p>
                    </div>
                  </>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
