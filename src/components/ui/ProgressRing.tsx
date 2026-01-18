'use client';

import { motion } from 'framer-motion';

export interface ProgressRingProps {
  /** Progress value from 0-100 */
  progress: number;
  /** Size of the ring in pixels */
  size?: number;
  /** Stroke width of the ring */
  strokeWidth?: number;
  /** Color of the progress arc */
  color?: string;
  /** Background track color */
  trackColor?: string;
  /** Show percentage text in center */
  showPercentage?: boolean;
  /** Animation duration in seconds */
  animationDuration?: number;
  /** Custom content in center (overrides percentage) */
  children?: React.ReactNode;
  /** Additional class name */
  className?: string;
}

/**
 * ProgressRing Component
 *
 * A circular progress indicator with smooth animation.
 * Perfect for completion rates, loading states, and goal progress.
 *
 * Features:
 * - Smooth animated transitions
 * - Customizable colors and sizes
 * - Optional center content
 * - Accessible with proper ARIA attributes
 */
export function ProgressRing({
  progress,
  size = 64,
  strokeWidth = 4,
  color = 'var(--accent)',
  trackColor = 'var(--surface-3)',
  showPercentage = true,
  animationDuration = 0.8,
  children,
  className = '',
}: ProgressRingProps) {
  // Ensure progress is within bounds
  const normalizedProgress = Math.min(100, Math.max(0, progress));

  // Calculate circle properties
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (normalizedProgress / 100) * circumference;

  // Center point
  const center = size / 2;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={normalizedProgress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          className="transition-colors duration-200"
        />

        {/* Progress arc */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{
            duration: animationDuration,
            ease: [0.4, 0, 0.2, 1],
          }}
        />
      </svg>

      {/* Center content */}
      {(showPercentage || children) && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children || (
            <motion.span
              key={normalizedProgress}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-sm font-semibold text-[var(--foreground)]"
            >
              {Math.round(normalizedProgress)}%
            </motion.span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Mini Progress Ring for inline use
 */
export interface MiniProgressRingProps {
  progress: number;
  color?: string;
  className?: string;
}

export function MiniProgressRing({
  progress,
  color = 'var(--accent)',
  className = '',
}: MiniProgressRingProps) {
  return (
    <ProgressRing
      progress={progress}
      size={24}
      strokeWidth={3}
      color={color}
      showPercentage={false}
      animationDuration={0.5}
      className={className}
    />
  );
}

/**
 * Progress Ring with Goal
 * Shows progress toward a goal with additional visual feedback
 */
export interface GoalProgressRingProps extends Omit<ProgressRingProps, 'children' | 'progress'> {
  /** Current value */
  current: number;
  /** Goal value */
  goal: number;
  /** Show fraction instead of percentage */
  showFraction?: boolean;
  /** Color when goal is reached */
  completedColor?: string;
}

export function GoalProgressRing({
  current,
  goal,
  showFraction = false,
  completedColor = 'var(--success)',
  color = 'var(--accent)',
  ...props
}: GoalProgressRingProps) {
  const progress = goal > 0 ? (current / goal) * 100 : 0;
  const isComplete = current >= goal;
  const displayColor = isComplete ? completedColor : color;

  return (
    <ProgressRing
      {...props}
      progress={Math.min(100, progress)}
      color={displayColor}
      showPercentage={false}
    >
      <div className="flex flex-col items-center justify-center">
        {showFraction ? (
          <>
            <span className="text-xs font-bold text-[var(--foreground)] leading-none">
              {current}
            </span>
            <span className="text-[10px] text-[var(--text-muted)] leading-none">
              /{goal}
            </span>
          </>
        ) : (
          <motion.span
            key={Math.round(progress)}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            className={`text-sm font-semibold ${isComplete ? 'text-[var(--success)]' : 'text-[var(--foreground)]'}`}
          >
            {Math.round(progress)}%
          </motion.span>
        )}
      </div>
    </ProgressRing>
  );
}

/**
 * Stacked Progress Rings for multiple metrics
 */
export interface StackedProgressProps {
  rings: Array<{
    progress: number;
    color: string;
    label?: string;
  }>;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function StackedProgressRings({
  rings,
  size = 80,
  strokeWidth = 6,
  className = '',
}: StackedProgressProps) {
  const gap = strokeWidth + 2;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {rings.map((ring, index) => {
        const ringSize = size - index * gap * 2;
        const ringRadius = (ringSize - strokeWidth) / 2;
        const circumference = ringRadius * 2 * Math.PI;
        const strokeDashoffset = circumference - (ring.progress / 100) * circumference;
        const center = size / 2;

        return (
          <svg
            key={index}
            width={size}
            height={size}
            className="absolute transform -rotate-90"
          >
            {/* Track */}
            <circle
              cx={center}
              cy={center}
              r={ringRadius}
              fill="none"
              stroke="var(--surface-3)"
              strokeWidth={strokeWidth}
              opacity={0.3}
            />
            {/* Progress */}
            <motion.circle
              cx={center}
              cy={center}
              r={ringRadius}
              fill="none"
              stroke={ring.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: index * 0.1 }}
            />
          </svg>
        );
      })}
    </div>
  );
}

export default ProgressRing;
