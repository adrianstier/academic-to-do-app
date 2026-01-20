'use client';

import { motion } from 'framer-motion';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import CountUp from '@/components/ui/CountUp';

export type StatCardVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  variant?: StatCardVariant;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  suffix?: string;
  darkMode?: boolean;
  delay?: number;
}

const variantStyles: Record<StatCardVariant, { iconBg: string; iconColor: string; trendPositive: string; trendNegative: string }> = {
  default: {
    iconBg: 'bg-blue-500/10 dark:bg-blue-400/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    trendPositive: 'text-emerald-600 dark:text-emerald-400',
    trendNegative: 'text-red-500 dark:text-red-400',
  },
  success: {
    iconBg: 'bg-emerald-500/10 dark:bg-emerald-400/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    trendPositive: 'text-emerald-600 dark:text-emerald-400',
    trendNegative: 'text-red-500 dark:text-red-400',
  },
  warning: {
    iconBg: 'bg-amber-500/10 dark:bg-amber-400/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    trendPositive: 'text-emerald-600 dark:text-emerald-400',
    trendNegative: 'text-red-500 dark:text-red-400',
  },
  danger: {
    iconBg: 'bg-red-500/10 dark:bg-red-400/20',
    iconColor: 'text-red-600 dark:text-red-400',
    trendPositive: 'text-emerald-600 dark:text-emerald-400',
    trendNegative: 'text-red-500 dark:text-red-400',
  },
  info: {
    iconBg: 'bg-purple-500/10 dark:bg-purple-400/20',
    iconColor: 'text-purple-600 dark:text-purple-400',
    trendPositive: 'text-emerald-600 dark:text-emerald-400',
    trendNegative: 'text-red-500 dark:text-red-400',
  },
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
  trend,
  suffix = '',
  darkMode = false,
  delay = 0,
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={`
        relative p-4 rounded-xl
        ${darkMode
          ? 'bg-[var(--surface-2)] border border-white/5'
          : 'bg-white border border-[var(--border)]'
        }
        shadow-sm hover:shadow-md
        transition-shadow duration-200
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`
            text-sm font-medium mb-1
            ${darkMode ? 'text-white/60' : 'text-[var(--text-muted)]'}
          `}>
            {label}
          </p>
          <div className="flex items-baseline gap-1">
            <span className={`
              text-3xl font-bold tracking-tight
              ${darkMode ? 'text-white' : 'text-[var(--foreground)]'}
            `}>
              <CountUp end={value} duration={800} />
            </span>
            {suffix && (
              <span className={`
                text-lg font-medium
                ${darkMode ? 'text-white/60' : 'text-[var(--text-muted)]'}
              `}>
                {suffix}
              </span>
            )}
          </div>
          {trend && (
            <div className={`
              flex items-center gap-1 mt-2 text-xs font-medium
              ${trend.isPositive ? styles.trendPositive : styles.trendNegative}
            `}>
              {trend.isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{trend.isPositive ? '+' : ''}{trend.value}% from last week</span>
            </div>
          )}
        </div>
        <div className={`
          p-2.5 rounded-lg
          ${darkMode ? styles.iconBg.replace('dark:', '') : styles.iconBg.split(' ')[0]}
        `}>
          <Icon className={`w-5 h-5 ${darkMode ? styles.iconColor.split(' ')[1]?.replace('dark:', '') : styles.iconColor.split(' ')[0]}`} />
        </div>
      </div>
    </motion.div>
  );
}
