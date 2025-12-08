'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, UserPlus, Lock, AlertCircle, ArrowLeft, Users } from 'lucide-react';
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
} from '@/lib/auth';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface LoginScreenProps {
  onLogin: (user: AuthUser) => void;
}

type Screen = 'select' | 'pin' | 'register';

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('select');
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const newPinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmPinRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Fetch users on mount
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, color, created_at, last_login')
        .order('name');

      if (!error && data) {
        setUsers(data);
      }
      setLoading(false);
    };

    fetchUsers();
  }, []);

  // Check lockout timer
  useEffect(() => {
    if (!selectedUser) return;

    const checkLockout = () => {
      const { locked, remainingSeconds } = isLockedOut(selectedUser.id);
      setLockoutSeconds(locked ? remainingSeconds : 0);
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
    setTimeout(() => pinInputRefs.current[0]?.focus(), 100);
  };

  const handlePinChange = (index: number, value: string, refs: React.MutableRefObject<(HTMLInputElement | null)[]>, pinState: string[], setPinState: (p: string[]) => void) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pinState];
    newPin[index] = value.slice(-1);
    setPinState(newPin);

    // Auto-focus next input
    if (value && index < 3) {
      refs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (e: React.KeyboardEvent, index: number, refs: React.MutableRefObject<(HTMLInputElement | null)[]>, pinState: string[], setPinState: (p: string[]) => void) => {
    if (e.key === 'Backspace' && !pinState[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePinSubmit = async () => {
    if (!selectedUser) return;
    if (lockoutSeconds > 0) return;

    const pinString = pin.join('');
    if (!isValidPin(pinString)) {
      setError('Please enter a 4-digit PIN');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Fetch user's pin_hash
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('pin_hash')
        .eq('id', selectedUser.id)
        .single();

      if (fetchError || !data) {
        setError('User not found');
        setIsSubmitting(false);
        return;
      }

      const isValid = await verifyPin(pinString, data.pin_hash);

      if (isValid) {
        clearLockout(selectedUser.id);

        // Update last_login
        await supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', selectedUser.id);

        onLogin(selectedUser);
      } else {
        const lockout = incrementLockout(selectedUser.id);
        if (lockout.lockedUntil) {
          setError('Too many attempts. Please wait 30 seconds.');
        } else {
          setError(`Incorrect PIN. ${3 - lockout.attempts} attempts remaining.`);
        }
        setPin(['', '', '', '']);
        pinInputRefs.current[0]?.focus();
      }
    } catch {
      setError('An error occurred. Please try again.');
    }

    setIsSubmitting(false);
  };

  const handleRegister = async () => {
    const name = newUserName.trim();
    if (!name) {
      setError('Please enter your name');
      return;
    }

    const pinString = newUserPin.join('');
    if (!isValidPin(pinString)) {
      setError('Please enter a 4-digit PIN');
      return;
    }

    const confirmString = confirmPin.join('');
    if (pinString !== confirmString) {
      setError('PINs do not match');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const pinHash = await hashPin(pinString);
      const color = getRandomUserColor();

      const { data, error: insertError } = await supabase
        .from('users')
        .insert({
          name,
          pin_hash: pinHash,
          color,
        })
        .select('id, name, color, created_at, last_login')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          setError('A user with this name already exists');
        } else {
          setError('Failed to create user. Please try again.');
        }
        setIsSubmitting(false);
        return;
      }

      if (data) {
        onLogin(data);
      }
    } catch {
      setError('An error occurred. Please try again.');
    }

    setIsSubmitting(false);
  };

  // Auto-submit when PIN is complete
  useEffect(() => {
    if (screen === 'pin' && pin.every(d => d !== '') && !isSubmitting) {
      handlePinSubmit();
    }
  }, [pin, screen]);

  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Configuration Required</h2>
          <p className="text-slate-600 dark:text-slate-400">Please configure Supabase credentials. See SETUP.md for instructions.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="text-slate-500 dark:text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-96 h-96 bg-[#0033A0]/5 dark:bg-[#0033A0]/10 rounded-full blur-3xl"
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.4, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#0033A0]/5 dark:bg-[#0033A0]/10 rounded-full blur-3xl"
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.4, 0.3, 0.4] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
          <div className="h-2 bg-[#0033A0]" />

          <AnimatePresence mode="wait">
            {screen === 'select' && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-8"
              >
                {/* Header */}
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                    className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-[#0033A0] shadow-lg shadow-[#0033A0]/20 mb-4"
                  >
                    <Shield className="w-8 h-8 text-white" />
                  </motion.div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Bealer Agency</h1>
                  <p className="text-sm text-[#0033A0] dark:text-blue-400 font-medium">Task Management System</p>
                </div>

                {/* User List */}
                {users.length > 0 ? (
                  <div className="space-y-3 mb-6">
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Select your account</p>
                    {users.map((user, index) => (
                      <motion.button
                        key={user.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => handleUserSelect(user)}
                        className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-[#0033A0] dark:hover:border-[#0033A0] transition-colors text-left"
                      >
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                          style={{ backgroundColor: user.color }}
                        >
                          {getUserInitials(user.name)}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900 dark:text-white">{user.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {user.last_login
                              ? `Last login: ${new Date(user.last_login).toLocaleDateString()}`
                              : 'Never logged in'}
                          </p>
                        </div>
                        <Lock className="w-5 h-5 text-slate-400" />
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 mb-6">
                    <Users className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 dark:text-slate-400">No users yet</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500">Create the first account to get started</p>
                  </div>
                )}

                {/* Add User Button */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    setScreen('register');
                    setNewUserName('');
                    setNewUserPin(['', '', '', '']);
                    setConfirmPin(['', '', '', '']);
                    setError('');
                  }}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#0033A0] hover:bg-[#002878] text-white font-semibold transition-colors shadow-lg shadow-[#0033A0]/20"
                >
                  <UserPlus className="w-5 h-5" />
                  Add New User
                </motion.button>
              </motion.div>
            )}

            {screen === 'pin' && selectedUser && (
              <motion.div
                key="pin"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-8"
              >
                <button
                  onClick={() => {
                    setScreen('select');
                    setSelectedUser(null);
                    setError('');
                  }}
                  className="flex items-center gap-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-6 text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>

                <div className="text-center mb-8">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg"
                    style={{ backgroundColor: selectedUser.color }}
                  >
                    {getUserInitials(selectedUser.name)}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedUser.name}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Enter your 4-digit PIN</p>
                </div>

                {/* PIN Input */}
                <div className="flex justify-center gap-3 mb-6">
                  {pin.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { pinInputRefs.current[index] = el; }}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(index, e.target.value, pinInputRefs, pin, setPin)}
                      onKeyDown={(e) => handlePinKeyDown(e, index, pinInputRefs, pin, setPin)}
                      disabled={lockoutSeconds > 0 || isSubmitting}
                      className={`w-14 h-16 text-center text-2xl font-bold rounded-xl border-2 transition-colors ${
                        lockoutSeconds > 0
                          ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                          : 'border-slate-200 dark:border-slate-700 focus:border-[#0033A0] dark:focus:border-[#0033A0]'
                      } bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none`}
                    />
                  ))}
                </div>

                {/* Error/Lockout Message */}
                {(error || lockoutSeconds > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center gap-2 text-red-500 dark:text-red-400 text-sm mb-4"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {lockoutSeconds > 0 ? `Locked. Try again in ${lockoutSeconds}s` : error}
                  </motion.div>
                )}

                {isSubmitting && (
                  <div className="text-center text-slate-500 dark:text-slate-400 text-sm">
                    Verifying...
                  </div>
                )}
              </motion.div>
            )}

            {screen === 'register' && (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-8"
              >
                <button
                  onClick={() => {
                    setScreen('select');
                    setError('');
                  }}
                  className="flex items-center gap-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-6 text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>

                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-[#0033A0]/10 dark:bg-[#0033A0]/20 mb-4">
                    <UserPlus className="w-8 h-8 text-[#0033A0] dark:text-blue-400" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Create Account</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Enter your name and choose a PIN</p>
                </div>

                {/* Name Input */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Enter your name"
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#0033A0] dark:focus:border-[#0033A0] transition-colors"
                  />
                </div>

                {/* New PIN */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Choose a 4-digit PIN
                  </label>
                  <div className="flex justify-center gap-3">
                    {newUserPin.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => { newPinRefs.current[index] = el; }}
                        type="password"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handlePinChange(index, e.target.value, newPinRefs, newUserPin, setNewUserPin)}
                        onKeyDown={(e) => handlePinKeyDown(e, index, newPinRefs, newUserPin, setNewUserPin)}
                        className="w-14 h-14 text-center text-2xl font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#0033A0] dark:focus:border-[#0033A0] transition-colors"
                      />
                    ))}
                  </div>
                </div>

                {/* Confirm PIN */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Confirm PIN
                  </label>
                  <div className="flex justify-center gap-3">
                    {confirmPin.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => { confirmPinRefs.current[index] = el; }}
                        type="password"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handlePinChange(index, e.target.value, confirmPinRefs, confirmPin, setConfirmPin)}
                        onKeyDown={(e) => handlePinKeyDown(e, index, confirmPinRefs, confirmPin, setConfirmPin)}
                        className="w-14 h-14 text-center text-2xl font-bold rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#0033A0] dark:focus:border-[#0033A0] transition-colors"
                      />
                    ))}
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center gap-2 text-red-500 dark:text-red-400 text-sm mb-4"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </motion.div>
                )}

                {/* Submit Button */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleRegister}
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-xl bg-[#0033A0] hover:bg-[#002878] text-white font-semibold transition-colors shadow-lg shadow-[#0033A0]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Creating Account...' : 'Create Account'}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center mt-6 text-sm text-slate-400 dark:text-slate-500">
          Powered by Allstate
        </p>
      </motion.div>
    </div>
  );
}
