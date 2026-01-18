'use client';

import { motion } from 'framer-motion';
import { Search, CheckCircle2, Calendar, Rocket, Trophy, ClipboardList } from 'lucide-react';

type EmptyStateVariant = 'no-tasks' | 'no-results' | 'all-done' | 'no-due-today' | 'no-overdue' | 'first-time';

interface EmptyStateProps {
  variant: EmptyStateVariant;
  darkMode?: boolean;
  searchQuery?: string;
  onAddTask?: () => void;
  onClearSearch?: () => void;
  userName?: string;
}

const variants = {
  'no-tasks': {
    icon: ClipboardList,
    title: 'No tasks yet',
    description: 'Create your first task to get started',
    action: 'Add Task',
    color: 'var(--accent)',
    bgColor: 'var(--accent-light)',
    gradient: 'from-blue-500/20 to-indigo-500/20',
  },
  'no-results': {
    icon: Search,
    title: 'No matches found',
    description: 'Try a different search term',
    action: 'Clear Search',
    color: 'var(--text-muted)',
    bgColor: 'var(--surface-2)',
    gradient: 'from-slate-500/20 to-gray-500/20',
  },
  'all-done': {
    icon: Trophy,
    title: 'All caught up!',
    description: 'You\'ve completed all your tasks',
    action: 'Add More',
    color: 'var(--success)',
    bgColor: 'var(--success-light)',
    gradient: 'from-emerald-500/20 to-green-500/20',
  },
  'no-due-today': {
    icon: Calendar,
    title: 'Nothing due today',
    description: 'Enjoy your free time or plan ahead',
    action: null,
    color: 'var(--accent-gold)',
    bgColor: 'var(--accent-gold-light)',
    gradient: 'from-amber-500/20 to-yellow-500/20',
  },
  'no-overdue': {
    icon: CheckCircle2,
    title: 'No overdue tasks',
    description: 'You\'re on top of your deadlines',
    action: null,
    color: 'var(--success)',
    bgColor: 'var(--success-light)',
    gradient: 'from-emerald-500/20 to-teal-500/20',
  },
  'first-time': {
    icon: Rocket,
    title: 'Welcome!',
    description: 'Let\'s create your first task together',
    action: 'Get Started',
    color: 'var(--accent-gold)',
    bgColor: 'var(--accent-gold-light)',
    gradient: 'from-amber-500/20 to-orange-500/20',
  },
};

// Refined SVG illustrations
function TaskIllustration({ color }: { color: string }) {
  return (
    <svg width="140" height="120" viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Clipboard body */}
      <motion.rect
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        x="35" y="20" width="70" height="85" rx="8"
        fill="currentColor"
        className="text-[var(--surface-2)]"
        stroke={color}
        strokeWidth="2"
      />

      {/* Clipboard clip */}
      <motion.rect
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        x="52" y="12" width="36" height="16" rx="4"
        fill={color}
        opacity="0.2"
      />
      <motion.circle
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3, delay: 0.2, type: "spring" }}
        cx="70" cy="20" r="4" fill={color}
      />

      {/* Task lines with stagger animation */}
      {[42, 58, 74, 90].map((y, i) => (
        <motion.rect
          key={y}
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 0.3 - i * 0.05, width: 44 - i * 6 }}
          transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
          x="48" y={y} height="6" rx="3"
          fill={color}
        />
      ))}

      {/* Floating plus icon */}
      <motion.g
        animate={{
          y: [0, -8, 0],
          rotate: [0, 5, 0]
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <circle cx="108" cy="32" r="16" fill={color} />
        <path d="M108 24V40M100 32H116" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      </motion.g>

      {/* Decorative sparkle */}
      <motion.circle
        animate={{ opacity: [0.2, 0.8, 0.2], scale: [0.8, 1.2, 0.8] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        cx="32" cy="45" r="3" fill={color}
      />
    </svg>
  );
}

function SearchIllustration({ color }: { color: string }) {
  return (
    <svg width="140" height="120" viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Magnifying glass */}
      <motion.circle
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        cx="60" cy="50" r="30"
        fill="none"
        stroke={color}
        strokeWidth="4"
        opacity="0.3"
      />
      <motion.circle
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        cx="60" cy="50" r="22"
        fill="currentColor"
        className="text-[var(--surface-2)]"
      />

      {/* Handle */}
      <motion.line
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        x1="82" y1="72" x2="105" y2="95"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Question mark */}
      <motion.text
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.4, type: "spring" }}
        x="52"
        y="58"
        fill={color}
        fontSize="28"
        fontWeight="bold"
        fontFamily="system-ui"
      >
        ?
      </motion.text>

      {/* Decorative dots */}
      <motion.circle
        animate={{ opacity: [0.2, 0.6, 0.2] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        cx="95" cy="35" r="4" fill={color}
      />
      <motion.circle
        animate={{ opacity: [0.2, 0.6, 0.2] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
        cx="110" cy="50" r="3" fill={color}
      />
    </svg>
  );
}

function CelebrationIllustration({ color }: { color: string }) {
  return (
    <svg width="140" height="120" viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Trophy */}
      <motion.path
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        d="M50 35H90V60C90 75 80 85 70 85C60 85 50 75 50 60V35Z"
        fill={color}
        opacity="0.2"
      />
      <motion.path
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        d="M50 35H40C40 35 38 55 50 55"
        stroke={color}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <motion.path
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        d="M90 35H100C100 35 102 55 90 55"
        stroke={color}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      {/* Base */}
      <motion.rect
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        x="62" y="85" width="16" height="10" fill={color} opacity="0.3"
      />
      <motion.rect
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.3, delay: 0.35 }}
        x="52" y="95" width="36" height="8" rx="2" fill={color} opacity="0.4"
      />

      {/* Stars */}
      {[
        { x: 28, y: 28, delay: 0, size: 1 },
        { x: 112, y: 25, delay: 0.2, size: 0.9 },
        { x: 118, y: 60, delay: 0.4, size: 0.7 },
        { x: 22, y: 55, delay: 0.3, size: 0.8 },
      ].map((star, i) => (
        <motion.g
          key={i}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 1, 0.5],
            rotate: [0, 15, 0]
          }}
          transition={{ duration: 1.5, repeat: Infinity, delay: star.delay }}
          style={{ originX: `${star.x}px`, originY: `${star.y}px` }}
        >
          <polygon
            points={`${star.x},${star.y - 8 * star.size} ${star.x + 3 * star.size},${star.y - 3 * star.size} ${star.x + 8 * star.size},${star.y - 3 * star.size} ${star.x + 4 * star.size},${star.y + 2 * star.size} ${star.x + 6 * star.size},${star.y + 8 * star.size} ${star.x},${star.y + 4 * star.size} ${star.x - 6 * star.size},${star.y + 8 * star.size} ${star.x - 4 * star.size},${star.y + 2 * star.size} ${star.x - 8 * star.size},${star.y - 3 * star.size} ${star.x - 3 * star.size},${star.y - 3 * star.size}`}
            fill={color}
          />
        </motion.g>
      ))}
    </svg>
  );
}

function WelcomeIllustration({ color }: { color: string }) {
  return (
    <svg width="140" height="120" viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Rocket */}
      <motion.g
        animate={{
          y: [0, -10, 0],
          rotate: [0, 3, 0]
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Rocket body */}
        <motion.ellipse
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          cx="70" cy="50" rx="18" ry="32"
          fill={color}
        />

        {/* Rocket window */}
        <motion.ellipse
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          cx="70" cy="40" rx="10" ry="12"
          fill="white"
          opacity="0.3"
        />
        <motion.circle
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, delay: 0.3, type: "spring" }}
          cx="70" cy="42" r="6"
          fill="white"
          opacity="0.5"
        />

        {/* Rocket fins */}
        <motion.path
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          d="M52 65L42 85L60 75Z"
          fill={color}
          opacity="0.7"
        />
        <motion.path
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          d="M88 65L98 85L80 75Z"
          fill={color}
          opacity="0.7"
        />
      </motion.g>

      {/* Flame */}
      <motion.path
        animate={{
          d: [
            "M60 82 Q70 100 80 82 Q75 95 70 100 Q65 95 60 82",
            "M58 82 Q70 105 82 82 Q75 98 70 105 Q65 98 58 82",
            "M60 82 Q70 100 80 82 Q75 95 70 100 Q65 95 60 82"
          ],
          opacity: [0.6, 0.9, 0.6]
        }}
        transition={{ duration: 0.5, repeat: Infinity }}
        fill="url(#flameGradient)"
      />

      <defs>
        <linearGradient id="flameGradient" x1="70" y1="82" x2="70" y2="105" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FCD34D" />
          <stop offset="1" stopColor="#F97316" stopOpacity="0.5" />
        </linearGradient>
      </defs>

      {/* Stars */}
      {[
        { x: 30, y: 30, delay: 0 },
        { x: 108, y: 28, delay: 0.3 },
        { x: 115, y: 55, delay: 0.6 },
        { x: 25, y: 60, delay: 0.9 },
      ].map((star, i) => (
        <motion.circle
          key={i}
          animate={{ opacity: [0.2, 0.8, 0.2], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, delay: star.delay }}
          cx={star.x}
          cy={star.y}
          r="3"
          fill={color}
        />
      ))}
    </svg>
  );
}

function CalendarIllustration({ color }: { color: string }) {
  return (
    <svg width="140" height="120" viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Calendar body */}
      <motion.rect
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        x="35" y="28" width="70" height="72" rx="8"
        fill="currentColor"
        className="text-[var(--surface-2)]"
        stroke={color}
        strokeWidth="2"
      />

      {/* Calendar header */}
      <motion.rect
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        x="35" y="28" width="70" height="18" rx="8"
        fill={color}
        opacity="0.2"
      />

      {/* Calendar rings */}
      <motion.rect
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        x="50" y="20" width="6" height="16" rx="3" fill={color}
      />
      <motion.rect
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        x="84" y="20" width="6" height="16" rx="3" fill={color}
      />

      {/* Calendar days grid */}
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3].map((col) => (
          <motion.rect
            key={`${row}-${col}`}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 0.15, scale: 1 }}
            transition={{ duration: 0.2, delay: 0.3 + row * 0.1 + col * 0.05 }}
            x={45 + col * 14}
            y={54 + row * 14}
            width="10"
            height="10"
            rx="2"
            fill={color}
          />
        ))
      )}

      {/* Checkmark overlay */}
      <motion.path
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        d="M55 70 L65 80 L85 55"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export default function EmptyState({
  variant,
  searchQuery,
  onAddTask,
  onClearSearch,
  userName,
}: EmptyStateProps) {
  const config = variants[variant];
  const Icon = config.icon;

  const handleAction = () => {
    if (variant === 'no-results' && onClearSearch) {
      onClearSearch();
    } else if (onAddTask) {
      onAddTask();
    }
  };

  const renderIllustration = () => {
    switch (variant) {
      case 'no-tasks':
        return <TaskIllustration color={config.color} />;
      case 'no-results':
        return <SearchIllustration color={config.color} />;
      case 'all-done':
      case 'no-overdue':
        return <CelebrationIllustration color={config.color} />;
      case 'first-time':
        return <WelcomeIllustration color={config.color} />;
      case 'no-due-today':
        return <CalendarIllustration color={config.color} />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col items-center justify-center py-16 px-6"
    >
      {/* Background glow */}
      <div className={`absolute inset-0 bg-gradient-radial ${config.gradient} opacity-30 blur-3xl pointer-events-none`} />

      {/* Illustration */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="relative mb-2"
      >
        {renderIllustration()}
      </motion.div>

      {/* Icon badge */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 20 }}
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 relative"
        style={{ backgroundColor: config.bgColor }}
      >
        <div
          className="absolute inset-0 rounded-2xl blur-xl opacity-50"
          style={{ backgroundColor: config.color }}
        />
        <Icon className="w-7 h-7 relative z-10" style={{ color: config.color }} />
      </motion.div>

      {/* Title */}
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="text-xl font-semibold mb-2 text-[var(--foreground)]"
      >
        {variant === 'first-time' && userName ? `Welcome, ${userName}!` : config.title}
      </motion.h3>

      {/* Description */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="text-sm text-center max-w-xs text-[var(--text-muted)]"
      >
        {variant === 'no-results' && searchQuery
          ? `No tasks match "${searchQuery}"`
          : config.description}
      </motion.p>

      {/* Action button */}
      {config.action && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleAction}
          className="mt-6 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg"
          style={{
            backgroundColor: config.color,
            color: 'white',
            boxShadow: `0 4px 16px ${config.color}40`,
          }}
        >
          {config.action}
        </motion.button>
      )}
    </motion.div>
  );
}
