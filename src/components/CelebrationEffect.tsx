'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Star, Check, Heart } from 'lucide-react';

interface CelebrationEffectProps {
  show: boolean;
  onComplete: () => void;
  taskText?: string;
}

// Confetti particle component with warm colors
const ConfettiParticle = ({ delay, color }: { delay: number; color: string }) => {
  const randomX = Math.random() * 200 - 100;
  const randomRotation = Math.random() * 720 - 360;
  const size = Math.random() * 6 + 4;

  return (
    <motion.div
      initial={{ opacity: 1, y: 0, x: 0, rotate: 0, scale: 1 }}
      animate={{
        opacity: [1, 1, 0],
        y: [0, -100, 150],
        x: [0, randomX * 0.5, randomX],
        rotate: [0, randomRotation],
        scale: [1, 1.3, 0.3],
      }}
      transition={{
        duration: 1.5,
        delay,
        ease: 'easeOut',
      }}
      className="absolute rounded-full"
      style={{
        backgroundColor: color,
        width: size,
        height: size,
      }}
    />
  );
};

// Star burst component with golden warmth
const StarBurst = ({ delay, size = 24 }: { delay: number; size?: number }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0, rotate: 0 }}
    animate={{
      opacity: [0, 1, 0],
      scale: [0, 1.5, 0],
      rotate: [0, 180],
    }}
    transition={{
      duration: 0.8,
      delay,
      ease: 'easeOut',
    }}
    className="absolute"
  >
    <Star className="text-warm-gold fill-warm-gold" style={{ width: size, height: size }} />
  </motion.div>
);

// Floating heart for warmth
const FloatingHeart = ({ delay, x }: { delay: number; x: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 0, x, scale: 0 }}
    animate={{
      opacity: [0, 1, 1, 0],
      y: [0, -60, -120],
      scale: [0, 1, 1.2, 0.8],
    }}
    transition={{
      duration: 1.2,
      delay,
      ease: 'easeOut',
    }}
    className="absolute"
  >
    <Heart className="w-4 h-4 text-warm-amber fill-warm-amber" />
  </motion.div>
);

export default function CelebrationEffect({ show, onComplete, taskText }: CelebrationEffectProps) {
  const [particles, setParticles] = useState<{ id: number; delay: number; color: string }[]>([]);

  // Warm, friendly color palette
  const colors = ['#D4A853', '#F59E0B', '#059669', '#7c3aed', '#ec4899', '#3B82F6'];

  useEffect(() => {
    if (show) {
      // Generate particles
      const newParticles = Array.from({ length: 25 }, (_, i) => ({
        id: i,
        delay: Math.random() * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));
      setParticles(newParticles);

      // Auto-dismiss after animation
      const timer = setTimeout(() => {
        onComplete();
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
        >
          {/* Soft warm glow background */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute w-64 h-64 bg-gradient-to-br from-warm-gold/20 to-warm-amber/10 rounded-full blur-3xl"
          />

          {/* Center celebration badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            transition={{ type: 'spring', damping: 15, stiffness: 300 }}
            className="relative flex flex-col items-center"
          >
            {/* Confetti particles */}
            <div className="absolute inset-0 flex items-center justify-center">
              {particles.map((particle) => (
                <ConfettiParticle
                  key={particle.id}
                  delay={particle.delay}
                  color={particle.color}
                />
              ))}
            </div>

            {/* Star bursts */}
            <div className="absolute -top-6 -left-6">
              <StarBurst delay={0.1} size={28} />
            </div>
            <div className="absolute -top-4 -right-8">
              <StarBurst delay={0.2} size={24} />
            </div>
            <div className="absolute -bottom-6 left-2">
              <StarBurst delay={0.35} size={20} />
            </div>
            <div className="absolute -bottom-4 -right-4">
              <StarBurst delay={0.25} size={22} />
            </div>

            {/* Floating hearts */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2">
              <FloatingHeart delay={0.2} x={-30} />
              <FloatingHeart delay={0.4} x={30} />
              <FloatingHeart delay={0.6} x={0} />
            </div>

            {/* Main badge - warm and satisfying */}
            <motion.div
              initial={{ rotate: -10, scale: 0.8 }}
              animate={{
                rotate: [-10, 10, -5, 5, 0],
                scale: [0.8, 1.1, 1]
              }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="relative"
            >
              {/* Outer ring glow */}
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: 1 }}
                className="absolute inset-0 bg-gradient-to-br from-warm-gold to-warm-amber rounded-[24px] blur-md opacity-50"
              />

              {/* Main badge */}
              <div className="relative bg-gradient-to-br from-warm-gold to-warm-amber rounded-[24px] p-7 shadow-2xl shadow-warm-gold/40">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  transition={{
                    duration: 0.4,
                    delay: 0.3,
                    type: 'spring',
                    stiffness: 400,
                    damping: 15
                  }}
                >
                  <Check className="w-14 h-14 text-white" strokeWidth={3} />
                </motion.div>
              </div>
            </motion.div>

            {/* Text - warm and encouraging */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-5 text-center"
            >
              <div className="flex items-center gap-2 justify-center mb-2">
                <Sparkles className="w-5 h-5 text-warm-gold" />
                <span className="text-xl font-bold text-warm-brown dark:text-white">
                  You've got it covered!
                </span>
                <Sparkles className="w-5 h-5 text-warm-gold" />
              </div>
              {taskText && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm text-warm-brown/60 dark:text-slate-400 max-w-xs truncate bg-white/80 dark:bg-slate-800/80 px-4 py-1.5 rounded-full"
                >
                  {taskText}
                </motion.p>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
