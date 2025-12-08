'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, ClipboardCheck, Users, ArrowRight } from 'lucide-react';

interface UserSetupProps {
  onSetUser: (name: string) => void;
}

const features = [
  { icon: Shield, text: 'Secure & Reliable' },
  { icon: ClipboardCheck, text: 'Task Management' },
  { icon: Users, text: 'Team Collaboration' },
];

export default function UserSetup({ onSetUser }: UserSetupProps) {
  const [name, setName] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSetUser(name.trim());
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
      {/* Subtle background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-96 h-96 bg-[#0033A0]/5 dark:bg-[#0033A0]/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.4, 0.3],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#0033A0]/5 dark:bg-[#0033A0]/10 rounded-full blur-3xl"
          animate={{
            scale: [1.1, 1, 1.1],
            opacity: [0.4, 0.3, 0.4],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
          {/* Allstate Blue Header Bar */}
          <div className="h-2 bg-[#0033A0]" />

          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-[#0033A0] shadow-lg shadow-[#0033A0]/20 mb-6"
            >
              <Shield className="w-8 h-8 text-white" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold text-slate-900 dark:text-white mb-1"
            >
              Bealer Agency
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="text-sm font-medium text-[#0033A0] dark:text-blue-400 mb-3"
            >
              Task Management System
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-slate-500 dark:text-slate-400 text-sm"
            >
              Streamline your workflow with professional task tracking
            </motion.p>
          </div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="px-8 pb-6"
          >
            <div className="flex justify-center gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.text}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="flex flex-col items-center gap-2"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#0033A0]/10 dark:bg-[#0033A0]/20 flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-[#0033A0] dark:text-blue-400" />
                  </div>
                  <span className="text-xs text-slate-600 dark:text-slate-400 text-center font-medium">
                    {feature.text}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="px-8 pb-8"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <motion.label
                  animate={{
                    top: isFocused || name ? '0px' : '50%',
                    fontSize: isFocused || name ? '12px' : '16px',
                    color: isFocused ? '#0033A0' : '#64748b',
                  }}
                  className="absolute left-4 -translate-y-1/2 px-1 bg-white dark:bg-slate-900 pointer-events-none transition-all z-10 font-medium"
                >
                  Your name
                </motion.label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className="w-full px-4 py-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-lg focus:outline-none focus:border-[#0033A0] dark:focus:border-[#0033A0] transition-colors"
                  autoFocus
                />
              </div>

              <motion.button
                type="submit"
                disabled={!name.trim()}
                whileHover={{ scale: name.trim() ? 1.01 : 1 }}
                whileTap={{ scale: name.trim() ? 0.99 : 1 }}
                className={`w-full py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 transition-all ${
                  name.trim()
                    ? 'bg-[#0033A0] hover:bg-[#002878] text-white shadow-lg shadow-[#0033A0]/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}
              >
                Get Started
                <ArrowRight className={`w-5 h-5 transition-transform ${name.trim() ? 'group-hover:translate-x-1' : ''}`} />
              </motion.button>
            </form>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-6 text-sm text-slate-400 dark:text-slate-500"
        >
          Powered by Allstate
        </motion.p>
      </motion.div>
    </div>
  );
}
