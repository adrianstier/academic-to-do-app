'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CelebrationProps {
  trigger: boolean;
  onComplete?: () => void;
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
const EMOJIS = ['✨', '🎉', '⭐', '🌟', '💫'];

export default function Celebration({ trigger, onComplete }: CelebrationProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showCheckmark, setShowCheckmark] = useState(false);
  const [emoji, setEmoji] = useState('');

  useEffect(() => {
    if (trigger) {
      // Generate confetti particles
      const newParticles: Particle[] = [];
      for (let i = 0; i < 20; i++) {
        newParticles.push({
          id: i,
          x: 50 + (Math.random() - 0.5) * 20,
          y: 50,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          size: 4 + Math.random() * 6,
          rotation: Math.random() * 360,
          velocityX: (Math.random() - 0.5) * 150,
          velocityY: -80 - Math.random() * 60,
          isCircle: Math.random() > 0.5,
        });
      }
      setParticles(newParticles);
      setShowCheckmark(true);
      setEmoji(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);

      // Clean up after animation
      const timer = setTimeout(() => {
        setParticles([]);
        setShowCheckmark(false);
        setEmoji('');
        onComplete?.();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [trigger, onComplete]);

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

      {/* Floating emoji */}
      <AnimatePresence>
        {emoji && (
          <motion.div
            initial={{ scale: 0, y: 0, opacity: 0 }}
            animate={{
              scale: [0, 1.5, 1],
              y: -40,
              opacity: [0, 1, 1, 0],
            }}
            transition={{ duration: 0.8 }}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 text-2xl"
          >
            {emoji}
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
