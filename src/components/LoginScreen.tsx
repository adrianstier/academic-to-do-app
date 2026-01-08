'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, AlertCircle, ChevronLeft, Lock, CheckSquare, Search, Shield, Sparkles, ArrowRight, Users } from 'lucide-react';
import { AuthUser } from '@/types/todo';
import {
  hashPin,
  verifyPin,
  isValidPin,
  getRandomUserColor,
  getUserInitials,
  isLockedOut,
  incrementLockout,
  clearLockout,
  setStoredSession,
  getLockoutState,
} from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { OAuthLoginButtons } from './OAuthLoginButtons';

interface LoginScreenProps {
  onLogin: (user: AuthUser) => void;
}

type Screen = 'users' | 'pin' | 'register';

// Floating particle component - uses CSS vars for consistency
function FloatingParticle({ delay, duration, size, left, top }: { delay: number; duration: number; size: number; left: string; top: string }) {
  return (
    <motion.div
      className="absolute rounded-full bg-[var(--brand-sky)]/20"
      style={{ width: size, height: size, left, top }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 0.5, 0.3, 0.5, 0],
        scale: [0.5, 1, 0.8, 1, 0.5],
        y: [-20, 20, -10, 15, -20],
        x: [-10, 15, -5, 10, -10],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// Animated logo component - unified with main app branding
function AnimatedLogo() {
  return (
    <motion.div
      className="relative"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Outer glow rings - brand sky blue */}
      <motion.div
        className="absolute -inset-8 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(114,181,232,0.25) 0%, transparent 70%)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.6, 1, 0.6],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute -inset-4 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(0,51,160,0.3) 0%, transparent 70%)',
        }}
        animate={{
          scale: [1.1, 1, 1.1],
          opacity: [0.4, 0.7, 0.4],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.5,
        }}
      />

      {/* Main logo container - brand gradient */}
      <motion.div
        className="relative w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, var(--brand-sky) 0%, var(--brand-blue) 50%, var(--brand-navy) 100%)',
          boxShadow: '0 20px 60px -10px rgba(0,51,160,0.5), inset 0 -4px 20px rgba(0,0,0,0.15), inset 0 4px 20px rgba(255,255,255,0.2)',
        }}
        whileHover={{ scale: 1.05 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      >
        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.4) 50%, transparent 65%)',
          }}
          animate={{
            x: ['-100%', '200%'],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            repeatDelay: 3,
            ease: 'easeInOut',
          }}
        />
        <CheckSquare className="w-10 h-10 text-white relative z-10" strokeWidth={2.5} />
      </motion.div>
    </motion.div>
  );
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [screen, setScreen] = useState<Screen>('users');
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teamStats, setTeamStats] = useState<{ totalTasks: number; completedThisWeek: number; activeUsers: number } | null>(null);
  const [showStats, setShowStats] = useState(false);
  const splashHighlights = [
    {
      Icon: Sparkles,
      title: 'AI task triage',
      copy: 'Turn messy notes and emails into crisp, action-first tasks.',
    },
    {
      Icon: Shield,
      title: 'PIN-secured sessions',
      copy: 'Fast, shared-device login without passwords or friction.',
    },
    {
      Icon: Users,
      title: 'Live team board',
      copy: 'List + kanban views stay perfectly in sync across devices.',
    },
  ];

  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const newPinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmPinRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('users')
        .select('id, name, color, role, created_at, last_login')
        .order('name');
      if (data) {
        setUsers(data.map(u => ({ ...u, role: u.role || 'member' })));
      }
      setLoading(false);
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    // Check if stats were already shown today
    const checkAndFetchStats = async () => {
      const lastShownDate = localStorage.getItem('statsLastShown');
      const today = new Date().toDateString();

      if (lastShownDate !== today) {
        // First login of the day - show stats
        setShowStats(true);

        // Get total tasks
        const { count: totalTasks } = await supabase
          .from('todos')
          .select('*', { count: 'exact', head: true });

        // Get tasks completed this week
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday
        startOfWeek.setHours(0, 0, 0, 0);

        const { count: completedThisWeek } = await supabase
          .from('todos')
          .select('*', { count: 'exact', head: true })
          .eq('completed', true)
          .gte('updated_at', startOfWeek.toISOString());

        // Get active users (logged in within last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { count: activeUsers } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .gte('last_login', sevenDaysAgo.toISOString());

        setTeamStats({
          totalTasks: totalTasks || 0,
          completedThisWeek: completedThisWeek || 0,
          activeUsers: activeUsers || 0,
        });

        // Mark stats as shown today
        localStorage.setItem('statsLastShown', today);
      } else {
        // Already shown today - hide stats
        setShowStats(false);
      }
    };
    checkAndFetchStats();
  }, []);

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedUsers = filteredUsers.reduce((acc, user) => {
    const firstLetter = user.name[0].toUpperCase();
    if (!acc[firstLetter]) acc[firstLetter] = [];
    acc[firstLetter].push(user);
    return acc;
  }, {} as Record<string, AuthUser[]>);

  useEffect(() => {
    if (!selectedUser) return;
    const checkLockout = () => {
      const { locked, remainingSeconds } = isLockedOut(selectedUser.id);
      setLockoutSeconds(locked ? remainingSeconds : 0);
      const state = getLockoutState(selectedUser.id);
      setAttemptsRemaining(Math.max(0, 3 - state.attempts));
    };
    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [selectedUser]);

  const handleUserSelect = (user: AuthUser) => {
    setSelectedUser(user);
    setScreen('pin');
    setPin(['', '', '', '']);
    setError('');
    const state = getLockoutState(user.id);
    setAttemptsRemaining(Math.max(0, 3 - state.attempts));
    setTimeout(() => pinRefs.current[0]?.focus(), 100);
  };

  const handlePinChange = (
    index: number,
    value: string,
    refs: React.RefObject<(HTMLInputElement | null)[]>,
    pinState: string[],
    setPinState: (p: string[]) => void
  ) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pinState];
    newPin[index] = value.slice(-1);
    setPinState(newPin);
    if (value && index < 3) {
      refs.current?.[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (
    e: React.KeyboardEvent,
    index: number,
    refs: React.RefObject<(HTMLInputElement | null)[]>,
    pinState: string[],
  ) => {
    if (e.key === 'Backspace' && !pinState[index] && index > 0) {
      refs.current?.[index - 1]?.focus();
    }
  };

  const handlePinSubmit = async () => {
    if (!selectedUser || lockoutSeconds > 0) return;

    const pinString = pin.join('');
    if (!isValidPin(pinString)) {
      setError('Enter a 4-digit PIN');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const { data } = await supabase
        .from('users')
        .select('pin_hash')
        .eq('id', selectedUser.id)
        .single();

      if (!data) {
        setError('User not found');
        setIsSubmitting(false);
        return;
      }

      const isValid = await verifyPin(pinString, data.pin_hash);

      if (isValid) {
        clearLockout(selectedUser.id);
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', selectedUser.id);
        setStoredSession(selectedUser);
        onLogin(selectedUser);
      } else {
        const lockout = incrementLockout(selectedUser.id);
        const remaining = Math.max(0, 3 - lockout.attempts);
        setAttemptsRemaining(remaining);
        if (lockout.lockedUntil) {
          setError('Too many attempts. Please wait.');
        } else {
          setError(`Incorrect PIN`);
        }
        setPin(['', '', '', '']);
        pinRefs.current[0]?.focus();
      }
    } catch {
      setError('Something went wrong.');
    }

    setIsSubmitting(false);
  };

  const handleRegister = async () => {
    const name = newUserName.trim();
    if (!name) {
      setError('Enter your name');
      return;
    }

    const pinString = newUserPin.join('');
    if (!isValidPin(pinString)) {
      setError('Enter a 4-digit PIN');
      return;
    }

    const confirmString = confirmPin.join('');
    if (pinString !== confirmString) {
      setError('PINs don\'t match');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const pinHash = await hashPin(pinString);
      const color = getRandomUserColor();

      const { data, error: insertError } = await supabase
        .from('users')
        .insert({ name, pin_hash: pinHash, color, role: 'member' })
        .select('id, name, color, role, created_at, last_login')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          setError('Name already taken');
        } else {
          setError('Failed to create account');
        }
        setIsSubmitting(false);
        return;
      }

      if (data) {
        const userData = { ...data, role: data.role || 'member' };
        setStoredSession(userData);
        onLogin(userData);
      }
    } catch {
      setError('Something went wrong.');
    }

    setIsSubmitting(false);
  };

  useEffect(() => {
    if (screen === 'pin' && pin.every((d) => d !== '') && !isSubmitting) {
      handlePinSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, screen]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] relative overflow-hidden">
        {/* Ambient background matching main app */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 right-1/3 w-[800px] h-[800px] bg-[var(--brand-sky)]/8 rounded-full blur-[200px]" />
          <div className="absolute bottom-1/3 left-1/4 w-[600px] h-[600px] bg-[var(--brand-blue)]/20 rounded-full blur-[150px]" />
        </div>

        <motion.div
          className="relative z-10 flex flex-col items-center gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <AnimatedLogo />
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-[var(--brand-sky)]"
                animate={{
                  y: [-8, 8, -8],
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 py-10 overflow-hidden relative">
      {/* Skip link for accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:z-50">
        Skip to content
      </a>

      {/* Unified background - matches Dashboard hero */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Main gradient - same as dashboard header */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(160deg, var(--brand-navy) 0%, var(--brand-blue) 40%, #1E3A5F 100%)',
          }}
        />

        {/* Animated gradient orbs */}
        <motion.div
          className="absolute top-0 right-0 w-[1000px] h-[1000px] rounded-full opacity-60"
          style={{
            background: 'radial-gradient(circle, rgba(114,181,232,0.15) 0%, transparent 60%)',
          }}
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-[800px] h-[800px] rounded-full opacity-50"
          style={{
            background: 'radial-gradient(circle, rgba(30,58,95,0.4) 0%, transparent 60%)',
          }}
          animate={{
            x: [0, -30, 0],
            y: [0, -40, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(114,181,232,0.1) 0%, transparent 50%)',
          }}
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Floating particles */}
        <FloatingParticle delay={0} duration={8} size={6} left="10%" top="20%" />
        <FloatingParticle delay={1} duration={10} size={4} left="85%" top="15%" />
        <FloatingParticle delay={2} duration={7} size={8} left="70%" top="70%" />
        <FloatingParticle delay={0.5} duration={9} size={5} left="20%" top="80%" />
        <FloatingParticle delay={1.5} duration={11} size={7} left="50%" top="10%" />
        <FloatingParticle delay={3} duration={8} size={4} left="30%" top="50%" />

        {/* Subtle noise overlay */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
          }}
        />

        {/* Decorative light beams */}
        <motion.div
          className="absolute top-0 left-1/4 w-px h-48 bg-gradient-to-b from-[var(--brand-sky)]/30 via-[var(--brand-sky)]/10 to-transparent"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-0 right-1/3 w-px h-32 bg-gradient-to-t from-[var(--brand-sky)]/20 via-[var(--brand-sky)]/5 to-transparent"
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
      </div>

      <div className="relative z-10 w-full max-w-6xl">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            className="hidden lg:block"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="max-w-xl">
              <motion.div
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--brand-sky-light)]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <span className="h-2 w-2 rounded-full bg-[var(--brand-sky)] shadow-[0_0_12px_rgba(114,181,232,0.8)]" />
                Bealer Agency OS
              </motion.div>

              <motion.h1
                className="mt-6 text-6xl md:text-7xl font-bold tracking-[-0.02em] leading-[1.1] text-white"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                Run the day{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--brand-sky-light)] via-[var(--brand-sky)] to-[var(--brand-blue)]">
                  in sync
                </span>
              </motion.h1>
              <motion.p
                className="mt-5 text-lg text-white/70 leading-relaxed"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Real-time task control for small teams, with AI that cleans inputs, spots urgency,
                and keeps everyone aligned from inbox to completion.
              </motion.p>

              <motion.div
                className="mt-10 grid gap-4"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                {splashHighlights.map(({ Icon, title, copy }) => (
                  <div
                    key={title}
                    className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur"
                  >
                    <div className="mt-1 rounded-xl bg-[var(--brand-sky)]/15 p-2.5 text-[var(--brand-sky)] shadow-[0_0_20px_rgba(114,181,232,0.2)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-white">{title}</p>
                      <p className="mt-1 text-sm text-white/60">{copy}</p>
                    </div>
                  </div>
                ))}
              </motion.div>

              {showStats && teamStats && (
                <motion.div
                  className="mt-10 grid grid-cols-3 gap-4"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ delay: 0.5 }}
                >
                  {/* Total Tasks */}
                  <motion.div
                    className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] px-4 py-5 backdrop-blur relative overflow-hidden"
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand-blue)]/20 to-transparent opacity-50" />
                    <div className="relative">
                      <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Total Tasks</p>
                      <p className="text-3xl font-bold text-white tabular-nums">
                        {teamStats.totalTasks}
                      </p>
                    </div>
                  </motion.div>

                  {/* Completed This Week */}
                  <motion.div
                    className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] px-4 py-5 backdrop-blur relative overflow-hidden"
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand-sky)]/20 to-transparent opacity-50" />
                    <div className="relative">
                      <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">This Week</p>
                      <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-[var(--brand-sky-light)] to-[var(--brand-sky)] tabular-nums">
                        {teamStats.completedThisWeek}
                      </p>
                    </div>
                  </motion.div>

                  {/* Active Users */}
                  <motion.div
                    className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] px-4 py-5 backdrop-blur relative overflow-hidden"
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--success)]/15 to-transparent opacity-50" />
                    <div className="relative">
                      <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Active Users</p>
                      <p className="text-3xl font-bold text-[var(--success-vivid)] tabular-nums">
                        {teamStats.activeUsers}
                      </p>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </div>
          </motion.div>

          <div id="main-content" className="w-full max-w-[440px] lg:justify-self-end relative">
            <AnimatePresence mode="wait">
              {screen === 'users' && (
                <motion.div
                  key="users"
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="relative"
                >
                  <motion.div
                    className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-white/70 lg:hidden"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <p className="text-sm font-semibold text-white">Bealer Agency OS</p>
                    <p className="text-xs text-white/50 mt-1">AI-assisted tasks with live team sync.</p>
                  </motion.div>

                  {/* Card border glow */}
                  <div className="absolute -inset-[1px] bg-gradient-to-b from-[var(--brand-sky)]/30 via-white/[0.08] to-white/[0.02] rounded-[32px] blur-[1px]" />

                  {/* Main card */}
                  <div className="relative bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-2xl rounded-[32px] border border-white/[0.08] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)]">
                    {/* Premium Header */}
                    <div className="relative px-8 pt-10 pb-8 text-center overflow-hidden">
                      {/* Header background effects */}
                      <div className="absolute inset-0 bg-gradient-to-b from-[var(--brand-navy)]/80 via-transparent to-transparent" />
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(114,181,232,0.15)_0%,_transparent_60%)]" />

                      {/* Animated accent line at bottom */}
                      <motion.div
                        className="absolute bottom-0 left-0 right-0 h-px"
                        style={{
                          background: 'linear-gradient(90deg, transparent, rgba(114,181,232,0.5), transparent)',
                        }}
                        animate={{ opacity: [0.3, 0.7, 0.3] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      />

                      <div className="relative z-10">
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <AnimatedLogo />
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.3 }}
                        >
                          <h1 className="text-3xl font-bold text-white tracking-tight mt-6">
                            Bealer Agency
                          </h1>
                          <p className="text-sm text-[var(--brand-sky)]/80 mt-2 font-medium tracking-[0.2em] uppercase">
                            Task Management
                          </p>
                        </motion.div>
                      </div>
                    </div>

                {/* Search bar for larger user lists */}
                {users.length > 5 && (
                  <motion.div
                    className="px-6 pt-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 transition-colors duration-300 group-focus-within:text-[var(--brand-sky)]" aria-hidden="true" />
                      <input
                        type="text"
                        placeholder="Search team members..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-sky)]/30 focus:border-[var(--brand-sky)]/40 focus:bg-white/[0.06] transition-all duration-300 min-h-[52px]"
                        aria-label="Search users"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Users list */}
                {filteredUsers.length > 0 ? (
                  <motion.div
                    className="px-6 py-6 max-h-[50vh] sm:max-h-[380px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <div className="flex items-center gap-4 mb-5 px-1">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.25em]">Select Account</p>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    </div>

                    {users.length > 10 ? (
                      Object.entries(groupedUsers).sort().map(([letter, letterUsers], groupIndex) => (
                        <motion.div
                          key={letter}
                          className="mb-5"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 + groupIndex * 0.05 }}
                        >
                          <p className="text-xs font-bold text-[var(--brand-sky)]/50 px-3 py-1.5 mb-2 tracking-wide">{letter}</p>
                          <div className="space-y-1.5">
                            {letterUsers.map((user, index) => (
                              <UserButton
                                key={user.id}
                                user={user}
                                onSelect={handleUserSelect}
                                delay={0.5 + groupIndex * 0.05 + index * 0.03}
                              />
                            ))}
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="space-y-2">
                        {filteredUsers.map((user, index) => (
                          <UserButton
                            key={user.id}
                            user={user}
                            onSelect={handleUserSelect}
                            delay={0.5 + index * 0.08}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                ) : null}

                {/* OAuth buttons for existing users */}
                {filteredUsers.length > 0 && (
                  <motion.div
                    className="px-6 pb-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    <OAuthLoginButtons />
                  </motion.div>
                )}

                {filteredUsers.length === 0 && users.length === 0 ? (
                  <motion.div
                    className="px-8 py-16 text-center"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    {/* Animated shield forming */}
                    <motion.div
                      className="relative inline-block mb-6"
                      animate={{
                        y: [-4, 4, -4],
                      }}
                      transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    >
                      <div className="absolute inset-0 bg-[var(--brand-sky)]/30 rounded-3xl blur-xl scale-150" />
                      <svg
                        viewBox="0 0 100 100"
                        className="w-24 h-24 relative"
                        aria-hidden="true"
                      >
                        <defs>
                          <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="var(--brand-sky-light)" />
                            <stop offset="50%" stopColor="var(--brand-sky)" />
                            <stop offset="100%" stopColor="var(--brand-blue)" />
                          </linearGradient>
                        </defs>
                        <motion.path
                          d="M50 10 L85 25 L85 55 Q85 75 50 90 Q15 75 15 55 L15 25 Z"
                          fill="none"
                          stroke="url(#brandGradient)"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity, repeatDelay: 2 }}
                        />
                        <motion.circle
                          cx="50"
                          cy="50"
                          r="8"
                          fill="url(#brandGradient)"
                          initial={{ scale: 0 }}
                          animate={{ scale: [0, 1, 0] }}
                          transition={{ duration: 2, delay: 1.5, ease: 'easeOut', repeat: Infinity, repeatDelay: 2 }}
                        />
                      </svg>
                    </motion.div>
                    <h2 className="text-white font-bold text-2xl tracking-tight">Your team starts here</h2>
                    <p className="text-base text-white/40 mt-2">Create the first account to protect your workflow</p>
                  </motion.div>
                ) : (
                  filteredUsers.length === 0 && (
                    <motion.div
                      className="px-8 py-14 text-center"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                        <Search className="w-7 h-7 text-white/25" />
                      </div>
                      <p className="text-white/40 text-sm">No results for &ldquo;{searchQuery}&rdquo;</p>
                    </motion.div>
                  )
                )}

                {/* Add user button */}
                {users.length === 0 && (
                  <motion.div
                    className="p-6 pt-0"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    <motion.button
                      onClick={() => {
                        setScreen('register');
                        setNewUserName('');
                        setNewUserPin(['', '', '', '']);
                        setConfirmPin(['', '', '', '']);
                        setError('');
                      }}
                      className="group relative w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-bold text-base overflow-hidden min-h-[60px]"
                      style={{
                        background: 'linear-gradient(135deg, var(--brand-sky-light) 0%, var(--brand-sky) 50%, var(--brand-blue) 100%)',
                        boxShadow: '0 20px 40px -10px rgba(114,181,232,0.5), inset 0 -2px 10px rgba(0,0,0,0.1), inset 0 2px 10px rgba(255,255,255,0.3)',
                      }}
                      whileHover={{ scale: 1.02, boxShadow: '0 25px 50px -10px rgba(114,181,232,0.7)' }}
                      whileTap={{ scale: 0.98 }}
                      aria-label="Add new user account"
                    >
                      {/* Enhanced shimmer for metallic look */}
                      <motion.div
                        className="absolute inset-0"
                        style={{
                          background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.5) 50%, transparent 65%)',
                        }}
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ duration: 2, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
                      />
                      <UserPlus className="w-5 h-5 text-white relative z-10" aria-hidden="true" />
                      <span className="text-white relative z-10">Get Started</span>
                      <ArrowRight className="w-5 h-5 text-white relative z-10 transition-transform group-hover:translate-x-1" />
                    </motion.button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {screen === 'pin' && selectedUser && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="absolute -inset-[1px] bg-gradient-to-b from-[var(--brand-sky)]/30 via-white/[0.08] to-white/[0.02] rounded-[32px] blur-[1px]" />

              <div className="relative bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-2xl rounded-[32px] border border-white/[0.08] p-8 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)]">
                <motion.button
                  onClick={() => {
                    setScreen('users');
                    setSearchQuery('');
                  }}
                  className="group flex items-center gap-2 text-sm text-white/40 hover:text-white mb-8 transition-all duration-300 min-h-[44px] -ml-2 px-3 rounded-xl hover:bg-white/[0.05]"
                  aria-label="Go back to user selection"
                  whileHover={{ x: -2 }}
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  Back
                </motion.button>

                <div className="text-center mb-10">
                  {/* User avatar with animated glow */}
                  <motion.div
                    className="relative inline-block mb-6"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <motion.div
                      className="absolute inset-0 rounded-3xl blur-2xl opacity-50 scale-125"
                      style={{ backgroundColor: selectedUser.color }}
                      animate={{
                        scale: [1.2, 1.4, 1.2],
                        opacity: [0.3, 0.5, 0.3],
                      }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <div
                      className="relative w-24 h-24 rounded-3xl flex items-center justify-center text-white text-3xl font-bold shadow-2xl ring-2 ring-white/20"
                      style={{
                        backgroundColor: selectedUser.color,
                        boxShadow: `0 20px 40px -10px ${selectedUser.color}80`,
                      }}
                      aria-hidden="true"
                    >
                      {getUserInitials(selectedUser.name)}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <h2 className="text-2xl font-bold text-white tracking-tight">{selectedUser.name}</h2>
                    <p className="text-sm text-white/40 mt-3 flex items-center justify-center gap-2">
                      <Shield className="w-4 h-4 text-[var(--brand-sky)]" />
                      Enter your 4-digit PIN
                    </p>
                  </motion.div>

                  {lockoutSeconds === 0 && attemptsRemaining < 3 && (
                    <motion.div
                      className="mt-5 inline-flex items-center gap-2.5 text-xs text-amber-400/90 font-medium bg-amber-500/10 px-5 py-2.5 rounded-full border border-amber-500/20"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <AlertCircle className="w-4 h-4" />
                      {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
                    </motion.div>
                  )}
                </div>

                <motion.div
                  className="flex justify-center gap-4 mb-8"
                  role="group"
                  aria-label="PIN entry"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  {pin.map((digit, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + index * 0.08 }}
                      className="relative"
                    >
                      {/* Glow effect when filled - brand sky blue */}
                      {digit && (
                        <motion.div
                          className="absolute inset-0 rounded-2xl bg-[var(--brand-sky)]/40 blur-lg"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1.1 }}
                        />
                      )}
                      <input
                        ref={(el) => { pinRefs.current[index] = el; }}
                        type="password"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handlePinChange(index, e.target.value, pinRefs, pin, setPin)}
                        onKeyDown={(e) => handlePinKeyDown(e, index, pinRefs, pin)}
                        disabled={lockoutSeconds > 0 || isSubmitting}
                        aria-label={`PIN digit ${index + 1}`}
                        className={`relative w-16 h-20 sm:w-[72px] sm:h-[88px] text-center text-3xl font-bold rounded-2xl border-2 transition-all duration-300 focus:outline-none focus:ring-4 ${
                          lockoutSeconds > 0
                            ? 'border-red-500/50 bg-red-500/10 focus:ring-red-500/20 text-red-400'
                            : digit
                              ? 'border-[var(--brand-sky)] bg-[var(--brand-sky)]/10 focus:ring-[var(--brand-sky)]/20 text-white shadow-[0_0_20px_rgba(114,181,232,0.3)]'
                              : 'border-white/10 focus:border-[var(--brand-sky)] focus:ring-[var(--brand-sky)]/10 bg-white/[0.03] text-white hover:border-white/20'
                        }`}
                      />
                    </motion.div>
                  ))}
                </motion.div>

                <AnimatePresence mode="wait">
                  {(error || lockoutSeconds > 0) && (
                    <motion.div
                      className="flex items-center justify-center gap-3 text-red-400 text-sm bg-red-500/10 py-4 px-6 rounded-2xl border border-red-500/20"
                      role="alert"
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    >
                      <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <span className="font-medium">{lockoutSeconds > 0 ? `Account locked. Please wait ${lockoutSeconds}s` : error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {isSubmitting && (
                  <motion.div
                    className="flex flex-col items-center gap-4"
                    aria-live="polite"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="relative w-12 h-12">
                      <div className="absolute inset-0 border-3 border-[var(--brand-sky)]/20 rounded-full" />
                      <motion.div
                        className="absolute inset-0 border-3 border-[var(--brand-sky)] border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                    </div>
                    <span className="text-sm text-white/50 font-medium">Verifying...</span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {screen === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="absolute -inset-[1px] bg-gradient-to-b from-[var(--brand-blue)]/30 via-white/[0.08] to-white/[0.02] rounded-[32px] blur-[1px]" />

              <div className="relative bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-2xl rounded-[32px] border border-white/[0.08] p-8 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)]">
                <motion.button
                  onClick={() => setScreen('users')}
                  className="group flex items-center gap-2 text-sm text-white/40 hover:text-white mb-8 transition-all duration-300 min-h-[44px] -ml-2 px-3 rounded-xl hover:bg-white/[0.05]"
                  aria-label="Go back to user selection"
                  whileHover={{ x: -2 }}
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  Back
                </motion.button>

                <div className="text-center mb-10">
                  <motion.div
                    className="relative inline-block mb-6"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-[var(--brand-blue)] rounded-3xl blur-2xl opacity-40 scale-125"
                      animate={{
                        scale: [1.2, 1.4, 1.2],
                        opacity: [0.3, 0.5, 0.3],
                      }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <div
                      className="relative w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl ring-1 ring-white/10"
                      style={{
                        background: 'linear-gradient(135deg, var(--brand-sky) 0%, var(--brand-blue) 100%)',
                        boxShadow: '0 20px 40px -10px rgba(0,51,160,0.5)',
                      }}
                    >
                      <UserPlus className="w-10 h-10 text-white" aria-hidden="true" />
                    </div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <h2 className="text-2xl font-bold text-white tracking-tight">Create Account</h2>
                    <p className="text-sm text-white/40 mt-2">Join the team in seconds</p>
                  </motion.div>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleRegister(); }} className="space-y-7">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <label htmlFor="user-name" className="block text-sm font-semibold text-white/60 mb-3">
                      Your Name
                    </label>
                    <input
                      id="user-name"
                      type="text"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Enter your name"
                      autoFocus
                      autoComplete="name"
                      className="w-full px-5 py-4 rounded-2xl bg-white/[0.04] border border-white/[0.1] focus:border-[var(--brand-sky)]/40 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[var(--brand-sky)]/20 transition-all duration-300 text-white placeholder-white/25 text-base min-h-[60px]"
                    />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <label className="block text-sm font-semibold text-white/60 mb-3">
                      Choose a PIN
                    </label>
                    <div className="flex justify-center gap-3" role="group" aria-label="Choose PIN">
                      {newUserPin.map((digit, index) => (
                        <motion.input
                          key={index}
                          ref={(el) => { newPinRefs.current[index] = el; }}
                          type="password"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handlePinChange(index, e.target.value, newPinRefs, newUserPin, setNewUserPin)}
                          onKeyDown={(e) => handlePinKeyDown(e, index, newPinRefs, newUserPin)}
                          aria-label={`New PIN digit ${index + 1}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 + index * 0.05 }}
                          className={`w-14 h-16 sm:w-16 sm:h-[72px] text-center text-2xl font-bold rounded-2xl border-2 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[var(--brand-sky)]/10 ${
                            digit ? 'border-[var(--brand-sky)] bg-[var(--brand-sky)]/10 text-white shadow-[0_0_15px_rgba(114,181,232,0.2)]' : 'border-white/10 bg-white/[0.03] focus:border-[var(--brand-sky)] focus:bg-white/[0.05] text-white hover:border-white/20'
                          }`}
                        />
                      ))}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <label className="block text-sm font-semibold text-white/60 mb-3">
                      Confirm PIN
                    </label>
                    <div className="flex justify-center gap-3" role="group" aria-label="Confirm PIN">
                      {confirmPin.map((digit, index) => (
                        <motion.input
                          key={index}
                          ref={(el) => { confirmPinRefs.current[index] = el; }}
                          type="password"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handlePinChange(index, e.target.value, confirmPinRefs, confirmPin, setConfirmPin)}
                          onKeyDown={(e) => handlePinKeyDown(e, index, confirmPinRefs, confirmPin)}
                          aria-label={`Confirm PIN digit ${index + 1}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 + index * 0.05 }}
                          className={`w-14 h-16 sm:w-16 sm:h-[72px] text-center text-2xl font-bold rounded-2xl border-2 transition-all duration-300 focus:outline-none focus:ring-4 ${
                            digit ? 'border-emerald-500 bg-emerald-500/10 focus:ring-emerald-500/20 text-white' : 'border-white/10 bg-white/[0.03] focus:border-emerald-500 focus:bg-white/[0.05] focus:ring-emerald-500/10 text-white hover:border-white/20'
                          }`}
                        />
                      ))}
                    </div>
                  </motion.div>

                  <AnimatePresence mode="wait">
                    {error && (
                      <motion.div
                        className="flex items-center justify-center gap-3 text-red-400 text-sm bg-red-500/10 py-4 px-6 rounded-2xl border border-red-500/20"
                        role="alert"
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      >
                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                          <AlertCircle className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <span className="font-medium">{error}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    className="group relative w-full py-5 rounded-2xl font-semibold text-base overflow-hidden min-h-[60px] text-white disabled:opacity-50"
                    style={{
                      background: 'linear-gradient(135deg, var(--brand-sky) 0%, var(--brand-blue) 100%)',
                      boxShadow: '0 20px 40px -10px rgba(0,51,160,0.4)',
                    }}
                    whileHover={{ scale: 1.02, boxShadow: '0 25px 50px -10px rgba(0,51,160,0.5)' }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    {/* Shimmer effect */}
                    <motion.div
                      className="absolute inset-0"
                      style={{
                        background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%)',
                      }}
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
                    />
                    <span className="relative z-10 flex items-center justify-center gap-2.5">
                      {isSubmitting ? (
                        <>
                          <motion.div
                            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          />
                          Creating Account...
                        </>
                      ) : (
                        <>
                          Create Account
                          <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </span>
                  </motion.button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer branding */}
        <motion.div
          className="mt-10 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <p className="text-white/15 text-xs font-semibold tracking-[0.3em] uppercase">
            Bealer Agency
          </p>
        </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Refined user button component with staggered animation
function UserButton({ user, onSelect, delay = 0 }: { user: AuthUser; onSelect: (user: AuthUser) => void; delay?: number }) {
  return (
    <motion.button
      onClick={() => onSelect(user)}
      className="group w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/[0.06] active:bg-white/[0.08] transition-all duration-300 text-left min-h-[72px] border border-transparent hover:border-white/[0.1]"
      aria-label={`Sign in as ${user.name}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ x: 4 }}
    >
      {/* Avatar with glow on hover */}
      <div className="relative flex-shrink-0">
        <motion.div
          className="absolute inset-0 rounded-xl blur-lg opacity-0 group-hover:opacity-50 transition-all duration-500"
          style={{ backgroundColor: user.color }}
        />
        <div
          className="relative w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold shadow-lg text-sm ring-1 ring-white/10 group-hover:ring-white/20 transition-all duration-300"
          style={{
            backgroundColor: user.color,
            boxShadow: `0 8px 20px -8px ${user.color}60`,
          }}
          aria-hidden="true"
        >
          {getUserInitials(user.name)}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <span className="font-semibold text-white block truncate text-base group-hover:text-white transition-colors">{user.name}</span>
        {user.last_login && (
          <p className="text-xs text-white/30 mt-1 group-hover:text-white/40 transition-colors">
            Last login {new Date(user.last_login).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Lock icon with animated background - brand blue on hover */}
      <motion.div
        className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/[0.04] group-hover:bg-gradient-to-br group-hover:from-[var(--brand-sky-light)] group-hover:to-[var(--brand-sky)] flex items-center justify-center transition-all duration-300 border border-white/[0.06] group-hover:border-transparent group-hover:shadow-[0_0_15px_rgba(114,181,232,0.4)]"
        whileHover={{ scale: 1.05 }}
      >
        <Lock className="w-4 h-4 text-white/40 group-hover:text-[var(--brand-navy)] transition-colors duration-300" aria-hidden="true" />
      </motion.div>
    </motion.button>
  );
}
