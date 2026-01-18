'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, PartyPopper, Star, Zap, Award, LucideIcon } from 'lucide-react';

import { CelebrationIntensity } from '@/types/todo';

interface CelebrationProps {
  trigger: boolean;
  onComplete?: () => void;
  intensity?: CelebrationIntensity;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  velocityX: number;
  velocityY: number;
  isCircle: boolean;
}

const COLORS = ['#0033A0', '#D4A853', '#059669', '#f59e0b', '#ec4899', '#8b5cf6'];
const ICONS: { Icon: LucideIcon; color: string }[] = [
  { Icon: Sparkles, color: '#D4A853' },
  { Icon: PartyPopper, color: '#ec4899' },
  { Icon: Star, color: '#f59e0b' },
  { Icon: Zap, color: '#8b5cf6' },
  { Icon: Award, color: '#0033A0' },
];

// Intensity configuration
const INTENSITY_CONFIG: Record<CelebrationIntensity, { particleCount: number; velocityMultiplier: number; duration: number }> = {
  light: { particleCount: 12, velocityMultiplier: 0.8, duration: 800 },
  medium: { particleCount: 20, velocityMultiplier: 1.0, duration: 1000 },
  high: { particleCount: 35, velocityMultiplier: 1.3, duration: 1200 },
};

export function Celebration({ trigger, onComplete, intensity = 'medium' }: CelebrationProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [celebrationIcon, setCelebrationIcon] = useState<{ Icon: LucideIcon; color: string } | null>(null);

  // This effect intentionally sets state in response to trigger prop changes
  // to start the celebration animation - this is the correct pattern for animations
  useEffect(() => {
    if (trigger) {
      const config = INTENSITY_CONFIG[intensity];

      // Generate confetti particles based on intensity
      const newParticles: Particle[] = [];
      for (let i = 0; i < config.particleCount; i++) {
        newParticles.push({
          id: i,
          x: 50 + (Math.random() - 0.5) * 30,
          y: 50,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          size: (4 + Math.random() * 6) * (intensity === 'high' ? 1.2 : 1),
          rotation: Math.random() * 360,
          velocityX: (Math.random() - 0.5) * 150 * config.velocityMultiplier,
          velocityY: (-80 - Math.random() * 60) * config.velocityMultiplier,
          isCircle: Math.random() > 0.5,
        });
      }
      setParticles(newParticles);
      setShowCheckmark(true);
      setCelebrationIcon(ICONS[Math.floor(Math.random() * ICONS.length)]);

      // Clean up after animation (duration based on intensity)
      const timer = setTimeout(() => {
        setParticles([]);
        setShowCheckmark(false);
        setCelebrationIcon(null);
        onComplete?.();
      }, config.duration);

      return () => clearTimeout(timer);
    }
  }, [trigger, onComplete, intensity]);

  if (!trigger && particles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
      {/* Confetti particles */}
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{
              x: `${particle.x}%`,
              y: `${particle.y}%`,
              scale: 0,
              rotate: 0,
            }}
            animate={{
              x: `calc(${particle.x}% + ${particle.velocityX}px)`,
              y: `calc(${particle.y}% + ${particle.velocityY + 200}px)`,
              scale: [0, 1, 1, 0.5],
              rotate: particle.rotation + 360,
              opacity: [1, 1, 1, 0],
            }}
            transition={{
              duration: 0.8,
              ease: 'easeOut',
            }}
            style={{
              position: 'absolute',
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color,
              borderRadius: particle.isCircle ? '50%' : '2px',
            }}
          />
        ))}
      </AnimatePresence>

      {/* Success checkmark with emoji */}
      <AnimatePresence>
        {showCheckmark && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.3, 1], opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: 'backOut' }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <motion.svg
                viewBox="0 0 24 24"
                className="w-7 h-7 text-white"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <motion.path
                  d="M5 13l4 4L19 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                />
              </motion.svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating icon */}
      <AnimatePresence>
        {celebrationIcon && (
          <motion.div
            initial={{ scale: 0, y: 0, opacity: 0 }}
            animate={{
              scale: [0, 1.5, 1],
              y: -40,
              opacity: [0, 1, 1, 0],
            }}
            transition={{ duration: 0.8 }}
            className="absolute top-1/3 left-1/2 -translate-x-1/2"
          >
            <celebrationIcon.Icon className="w-8 h-8" style={{ color: celebrationIcon.color }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Hook for easy celebration triggering
export function useCelebration() {
  const [celebrating, setCelebrating] = useState(false);

  const celebrate = () => {
    setCelebrating(true);
  };

  const onCelebrationComplete = () => {
    setCelebrating(false);
  };

  return { celebrating, celebrate, onCelebrationComplete };
}

// Default export for backward compatibility
export default Celebration;
