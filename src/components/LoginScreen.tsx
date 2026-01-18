'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ChevronLeft, Lock, CheckSquare, Search, Shield, Sparkles, Users, Zap } from 'lucide-react';
import { AuthUser } from '@/types/todo';
import {
  verifyPin,
  isValidPin,
  getUserInitials,
  isLockedOut,
  incrementLockout,
  clearLockout,
  setStoredSession,
  getLockoutState,
} from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { OAuthLoginButtons } from './OAuthLoginButtons';

interface LoginScreenProps {
  onLogin: (user: AuthUser) => void;
}

type Screen = 'users' | 'pin';

// Animated grid background
function AnimatedGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="rgba(114,181,232,0.08)"
              strokeWidth="1"
            />
          </pattern>
          <linearGradient id="gridFade" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="50%" stopColor="white" stopOpacity="0.5" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id="gridMask">
            <rect width="100%" height="100%" fill="url(#gridFade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" mask="url(#gridMask)" />
      </svg>
    </div>
  );
}

// Floating geometric shapes
function FloatingShapes() {
  const shapes = [
    { type: 'circle', size: 120, x: '15%', y: '20%', delay: 0, duration: 20 },
    { type: 'circle', size: 80, x: '80%', y: '15%', delay: 2, duration: 18 },
    { type: 'circle', size: 60, x: '70%', y: '70%', delay: 1, duration: 22 },
    { type: 'square', size: 40, x: '25%', y: '75%', delay: 3, duration: 25 },
    { type: 'square', size: 30, x: '85%', y: '45%', delay: 1.5, duration: 20 },
    { type: 'triangle', size: 50, x: '10%', y: '50%', delay: 2.5, duration: 23 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {shapes.map((shape, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: shape.x, top: shape.y }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 0.15, 0.1, 0.15, 0],
            scale: [0.8, 1, 0.9, 1, 0.8],
            y: [-30, 30, -20, 25, -30],
            x: [-20, 25, -15, 20, -20],
            rotate: shape.type === 'square' ? [0, 90, 180, 270, 360] : [0, 10, -10, 5, 0],
          }}
          transition={{
            duration: shape.duration,
            delay: shape.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {shape.type === 'circle' && (
            <div
              className="rounded-full border border-[var(--brand-sky)]/30"
              style={{ width: shape.size, height: shape.size }}
            />
          )}
          {shape.type === 'square' && (
            <div
              className="border border-[var(--brand-sky)]/20 rounded-lg"
              style={{ width: shape.size, height: shape.size }}
            />
          )}
          {shape.type === 'triangle' && (
            <svg width={shape.size} height={shape.size} viewBox="0 0 100 100">
              <polygon
                points="50,10 90,90 10,90"
                fill="none"
                stroke="rgba(114,181,232,0.2)"
                strokeWidth="2"
              />
            </svg>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// Enhanced 3D logo with depth
function Logo3D() {
  return (
    <motion.div
      className="relative"
      initial={{ scale: 0.5, opacity: 0, rotateY: -30 }}
      animate={{ scale: 1, opacity: 1, rotateY: 0 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      style={{ perspective: 1000 }}
    >
      {/* Multiple glow layers for depth */}
      <motion.div
        className="absolute -inset-12 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(114,181,232,0.3) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -inset-8 rounded-full blur-2xl"
        style={{ background: 'radial-gradient(circle, rgba(0,51,160,0.4) 0%, transparent 70%)' }}
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      />

      {/* Main logo with 3D transform */}
      <motion.div
        className="relative w-24 h-24 rounded-3xl flex items-center justify-center overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #A8D4F5 0%, #72B5E8 25%, #0033A0 60%, #00205B 100%)',
          boxShadow: `
            0 25px 80px -15px rgba(0,51,160,0.6),
            0 15px 40px -10px rgba(0,0,0,0.4),
            inset 0 -6px 30px rgba(0,0,0,0.2),
            inset 0 6px 30px rgba(255,255,255,0.25),
            0 0 0 1px rgba(255,255,255,0.1)
          `,
          transform: 'translateZ(0)',
        }}
        whileHover={{ scale: 1.08, rotateY: 10, rotateX: -5 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {/* Inner highlight */}
        <div
          className="absolute inset-[2px] rounded-[22px] pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%)',
          }}
        />

        {/* Animated shine sweep */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%)',
          }}
          animate={{ x: ['-150%', '150%'] }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
        />

        {/* Icon */}
        <CheckSquare className="w-12 h-12 text-white relative z-10 drop-shadow-lg" strokeWidth={2.5} />
      </motion.div>

      {/* Orbiting dot */}
      <motion.div
        className="absolute w-3 h-3 rounded-full bg-[var(--brand-sky)] shadow-[0_0_15px_rgba(114,181,232,0.8)]"
        style={{ top: '50%', left: '50%' }}
        animate={{
          x: [40, 0, -40, 0, 40],
          y: [0, -40, 0, 40, 0],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />
    </motion.div>
  );
}

// Animated stat counter
function AnimatedCounter({ value, duration = 1.5 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const increment = end / (duration * 60);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [value, duration]);

  return <span className="tabular-nums">{count}</span>;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [screen, setScreen] = useState<Screen>('users');
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState(3);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teamStats, setTeamStats] = useState<{ totalTasks: number; completedThisWeek: number; activeUsers: number } | null>(null);
  const [showStats, setShowStats] = useState(false);

  const features = [
    {
      Icon: Sparkles,
      title: 'AI-Powered Triage',
      description: 'Smart parsing turns messy notes into structured tasks instantly.',
      gradient: 'from-purple-500/20 to-pink-500/20',
    },
    {
      Icon: Zap,
      title: 'Real-Time Sync',
      description: 'Changes appear instantly across all devices and team members.',
      gradient: 'from-amber-500/20 to-orange-500/20',
    },
    {
      Icon: Shield,
      title: 'Secure & Simple',
      description: 'PIN-based login designed for shared devices without friction.',
      gradient: 'from-emerald-500/20 to-teal-500/20',
    },
  ];

  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);

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
    const checkAndFetchStats = async () => {
      const lastShownDate = localStorage.getItem('statsLastShown');
      const today = new Date().toDateString();

      if (lastShownDate !== today) {
        setShowStats(true);

        const { count: totalTasks } = await supabase
          .from('todos')
          .select('*', { count: 'exact', head: true });

        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
        startOfWeek.setHours(0, 0, 0, 0);

        const { count: completedThisWeek } = await supabase
          .from('todos')
          .select('*', { count: 'exact', head: true })
          .eq('completed', true)
          .gte('updated_at', startOfWeek.toISOString());

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

        localStorage.setItem('statsLastShown', today);
      } else {
        setShowStats(false);
      }
    };
    checkAndFetchStats();
  }, []);

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          setError('Incorrect PIN');
        }
        setPin(['', '', '', '']);
        pinRefs.current[0]?.focus();
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#00205B] via-[#0033A0] to-[#1E3A5F] relative overflow-hidden">
        <AnimatedGrid />
        <FloatingShapes />

        <motion.div
          className="relative z-10 flex flex-col items-center gap-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Logo3D />
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-3 h-3 rounded-full bg-gradient-to-r from-[var(--brand-sky-light)] to-[var(--brand-sky)]"
                animate={{ y: [-10, 10, -10], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
              />
            ))}
          </motion.div>
          <motion.p
            className="text-white/50 text-sm font-medium tracking-wider uppercase"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            Loading workspace...
          </motion.p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 overflow-hidden relative bg-gradient-to-br from-[#00205B] via-[#0033A0] to-[#1E3A5F]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:z-50">
        Skip to content
      </a>

      {/* Background layers */}
      <AnimatedGrid />
      <FloatingShapes />

      {/* Ambient light effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-1/4 -right-1/4 w-[800px] h-[800px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(114,181,232,0.15) 0%, transparent 60%)' }}
          animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(0,51,160,0.2) 0%, transparent 60%)' }}
          animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative z-10 w-full max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left side - Branding */}
          <motion.div
            className="hidden lg:block"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="max-w-lg">
              {/* Logo and badge */}
              <motion.div
                className="flex items-center gap-4 mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Logo3D />
                <div>
                  <motion.div
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--brand-sky-light)] mb-2"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Team Workspace
                  </motion.div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Bealer Agency</h2>
                </div>
              </motion.div>

              {/* Main headline */}
              <motion.h1
                className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] text-white mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                Your tasks,{' '}
                <span className="relative">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#A8D4F5] via-[#72B5E8] to-[#0033A0]">
                    organized
                  </span>
                  <motion.span
                    className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-[#A8D4F5] via-[#72B5E8] to-transparent"
                    initial={{ scaleX: 0, originX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.8, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  />
                </span>
              </motion.h1>

              <motion.p
                className="text-lg text-white/60 leading-relaxed mb-10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                The AI-powered task management platform built for insurance teams.
                Stay aligned, move faster, close more.
              </motion.p>

              {/* Feature cards */}
              <motion.div
                className="space-y-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                {features.map((feature, i) => (
                  <motion.div
                    key={feature.title}
                    className="group relative flex items-start gap-4 p-4 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + i * 0.1 }}
                    whileHover={{ scale: 1.02, borderColor: 'rgba(114,181,232,0.3)' }}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-r ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                    <div className="relative flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand-sky)]/20 to-[var(--brand-blue)]/20 flex items-center justify-center text-[var(--brand-sky)] border border-white/10">
                      <feature.Icon className="w-5 h-5" />
                    </div>
                    <div className="relative">
                      <h3 className="text-sm font-semibold text-white mb-1">{feature.title}</h3>
                      <p className="text-sm text-white/50">{feature.description}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              {/* Stats */}
              {showStats && teamStats && (
                <motion.div
                  className="mt-10 grid grid-cols-3 gap-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                >
                  <div className="text-center p-4 rounded-2xl border border-white/10 bg-white/[0.03]">
                    <p className="text-3xl font-bold text-white">
                      <AnimatedCounter value={teamStats.totalTasks} />
                    </p>
                    <p className="text-xs text-white/40 uppercase tracking-wider mt-1">Total Tasks</p>
                  </div>
                  <div className="text-center p-4 rounded-2xl border border-white/10 bg-white/[0.03]">
                    <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[var(--brand-sky-light)] to-[var(--brand-sky)]">
                      <AnimatedCounter value={teamStats.completedThisWeek} />
                    </p>
                    <p className="text-xs text-white/40 uppercase tracking-wider mt-1">This Week</p>
                  </div>
                  <div className="text-center p-4 rounded-2xl border border-white/10 bg-white/[0.03]">
                    <p className="text-3xl font-bold text-emerald-400">
                      <AnimatedCounter value={teamStats.activeUsers} />
                    </p>
                    <p className="text-xs text-white/40 uppercase tracking-wider mt-1">Active</p>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Right side - Login card */}
          <div id="main-content" className="w-full max-w-md lg:justify-self-end relative">
            <AnimatePresence mode="wait">
              {screen === 'users' && (
                <motion.div
                  key="users"
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  {/* Mobile header */}
                  <motion.div
                    className="mb-6 text-center lg:hidden"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <div className="inline-flex mb-4">
                      <Logo3D />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Bealer Agency</h1>
                    <p className="text-sm text-white/50 mt-1">Task Management Platform</p>
                  </motion.div>

                  {/* Card glow */}
                  <div className="absolute -inset-[1px] bg-gradient-to-b from-[var(--brand-sky)]/40 via-white/10 to-white/5 rounded-[28px] blur-sm" />

                  {/* Main card */}
                  <div className="relative bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-2xl rounded-[28px] border border-white/10 overflow-hidden shadow-2xl">
                    {/* Card header */}
                    <div className="relative px-6 pt-8 pb-6 text-center">
                      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent" />
                      <motion.div
                        className="relative"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        <h2 className="text-xl font-bold text-white">Welcome back</h2>
                        <p className="text-sm text-white/40 mt-1">Select your account to continue</p>
                      </motion.div>
                    </div>

                    {/* Search */}
                    {users.length > 5 && (
                      <motion.div
                        className="px-6 pb-4"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                      >
                        <div className="relative group">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[var(--brand-sky)] transition-colors" />
                          <input
                            type="text"
                            placeholder="Search team..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-sky)]/30 focus:border-[var(--brand-sky)]/40 transition-all"
                          />
                        </div>
                      </motion.div>
                    )}

                    {/* Users list */}
                    {filteredUsers.length > 0 && (
                      <motion.div
                        className="px-4 pb-4 max-h-[320px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                      >
                        <div className="space-y-2">
                          {filteredUsers.map((user, index) => (
                            <UserCard
                              key={user.id}
                              user={user}
                              onSelect={handleUserSelect}
                              delay={0.4 + index * 0.05}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Empty state */}
                    {filteredUsers.length === 0 && users.length > 0 && (
                      <motion.div
                        className="px-8 py-12 text-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <Search className="w-10 h-10 text-white/20 mx-auto mb-3" />
                        <p className="text-white/40 text-sm">No results for &ldquo;{searchQuery}&rdquo;</p>
                      </motion.div>
                    )}

                    {/* First user state */}
                    {users.length === 0 && (
                      <motion.div
                        className="px-8 py-12 text-center"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                      >
                        <motion.div
                          className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[var(--brand-sky)]/20 to-[var(--brand-blue)]/20 flex items-center justify-center border border-white/10"
                          animate={{ y: [-4, 4, -4] }}
                          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          <Users className="w-10 h-10 text-[var(--brand-sky)]" />
                        </motion.div>
                        <h3 className="text-xl font-bold text-white mb-2">Create your team</h3>
                        <p className="text-sm text-white/40 mb-6">Be the first to join the workspace</p>
                      </motion.div>
                    )}

                    {/* OAuth buttons */}
                    <div className="p-6 pt-2">
                      <OAuthLoginButtons />
                    </div>
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
                >
                  <div className="absolute -inset-[1px] bg-gradient-to-b from-[var(--brand-sky)]/40 via-white/10 to-white/5 rounded-[28px] blur-sm" />

                  <div className="relative bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-2xl rounded-[28px] border border-white/10 p-8 shadow-2xl">
                    <motion.button
                      onClick={() => { setScreen('users'); setSearchQuery(''); }}
                      className="flex items-center gap-2 text-sm text-white/40 hover:text-white mb-8 transition-colors -ml-2 px-3 py-2 rounded-lg hover:bg-white/5"
                      whileHover={{ x: -2 }}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </motion.button>

                    <div className="text-center mb-8">
                      <motion.div
                        className="relative inline-block mb-6"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5 }}
                      >
                        <motion.div
                          className="absolute inset-0 rounded-2xl blur-xl opacity-50"
                          style={{ backgroundColor: selectedUser.color }}
                          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                          transition={{ duration: 3, repeat: Infinity }}
                        />
                        <div
                          className="relative w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-2xl ring-2 ring-white/20"
                          style={{ backgroundColor: selectedUser.color }}
                        >
                          {getUserInitials(selectedUser.name)}
                        </div>
                      </motion.div>

                      <h2 className="text-xl font-bold text-white">{selectedUser.name}</h2>
                      <p className="text-sm text-white/40 mt-2 flex items-center justify-center gap-2">
                        <Lock className="w-3.5 h-3.5" />
                        Enter your 4-digit PIN
                      </p>

                      {lockoutSeconds === 0 && attemptsRemaining < 3 && (
                        <motion.div
                          className="mt-4 inline-flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 px-4 py-2 rounded-full border border-amber-500/20"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} left
                        </motion.div>
                      )}
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handlePinSubmit();
                      }}
                      aria-label="PIN entry form"
                    >
                      <div className="flex justify-center gap-3 mb-6" role="group" aria-label="Enter your 4-digit PIN">
                        {pin.map((digit, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 + index * 0.05 }}
                            className="relative"
                          >
                            {digit && (
                              <motion.div
                                className="absolute inset-0 rounded-xl bg-[var(--brand-sky)]/30 blur-md"
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
                              aria-label={`PIN digit ${index + 1} of 4`}
                              autoComplete="one-time-code"
                              className={`relative w-14 h-16 text-center text-2xl font-bold rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-[var(--brand-sky)]/50 focus:ring-offset-2 focus:ring-offset-transparent ${
                                lockoutSeconds > 0
                                  ? 'border-red-500/50 bg-red-500/10 text-red-400'
                                  : digit
                                    ? 'border-[var(--brand-sky)] bg-[var(--brand-sky)]/10 text-white'
                                    : 'border-white/10 bg-white/5 text-white focus:border-[var(--brand-sky)] focus:bg-white/10'
                              }`}
                            />
                          </motion.div>
                        ))}
                      </div>
                    </form>

                    <AnimatePresence mode="wait">
                      {(error || lockoutSeconds > 0) && (
                        <motion.div
                          className="flex items-center justify-center gap-2 text-red-400 text-sm bg-red-500/10 py-3 px-4 rounded-xl border border-red-500/20 mb-4"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                        >
                          <AlertCircle className="w-4 h-4" />
                          {lockoutSeconds > 0 ? `Locked. Wait ${lockoutSeconds}s` : error}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {isSubmitting && (
                      <motion.div
                        className="flex flex-col items-center gap-3"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        <div className="w-8 h-8 border-2 border-[var(--brand-sky)]/30 border-t-[var(--brand-sky)] rounded-full animate-spin" />
                        <span className="text-sm text-white/50">Verifying...</span>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}

            </AnimatePresence>

            {/* Footer */}
            <motion.p
              className="mt-8 text-center text-white/20 text-xs font-medium tracking-widest uppercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              Bealer Agency &copy; {new Date().getFullYear()}
            </motion.p>
          </div>
        </div>
      </div>
    </div>
  );
}

// User card component
function UserCard({ user, onSelect, delay = 0 }: { user: AuthUser; onSelect: (user: AuthUser) => void; delay?: number }) {
  return (
    <motion.button
      onClick={() => onSelect(user)}
      className="group w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.08] active:bg-white/10 transition-all text-left border border-transparent hover:border-white/10"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ x: 4 }}
    >
      <div className="relative flex-shrink-0">
        <motion.div
          className="absolute inset-0 rounded-xl blur-md opacity-0 group-hover:opacity-50 transition-all duration-300"
          style={{ backgroundColor: user.color }}
        />
        <div
          className="relative w-12 h-12 rounded-xl flex items-center justify-center text-white font-semibold text-sm shadow-lg ring-1 ring-white/10 group-hover:ring-white/20 transition-all"
          style={{ backgroundColor: user.color }}
        >
          {getUserInitials(user.name)}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white truncate text-sm">{user.name}</p>
        {user.last_login && (
          <p className="text-xs text-white/30 mt-0.5">
            {new Date(user.last_login).toLocaleDateString()}
          </p>
        )}
      </div>

      <motion.div
        className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 group-hover:bg-gradient-to-br group-hover:from-[var(--brand-sky-light)] group-hover:to-[var(--brand-sky)] flex items-center justify-center transition-all border border-white/5 group-hover:border-transparent"
        whileHover={{ scale: 1.1 }}
      >
        <Lock className="w-3.5 h-3.5 text-white/40 group-hover:text-[#00205B] transition-colors" />
      </motion.div>
    </motion.button>
  );
}
