'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, LogOut, UserPlus, Lock, AlertCircle, X, Check } from 'lucide-react';
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
  clearStoredSession,
} from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface UserSwitcherProps {
  currentUser: AuthUser;
  onUserChange: (user: AuthUser | null) => void;
}

type ModalState = 'closed' | 'select' | 'pin' | 'register';

export default function UserSwitcher({ currentUser, onUserChange }: UserSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [modalState, setModalState] = useState<ModalState>('closed');
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const newPinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmPinRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('users')
        .select('id, name, color, created_at, last_login')
        .order('name');

      if (data) {
        setUsers(data);
      }
    };

    fetchUsers();
  }, [modalState]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const handleLogout = () => {
    clearStoredSession();
    onUserChange(null);
  };

  const handleUserSelect = (user: AuthUser) => {
    if (user.id === currentUser.id) {
      setIsOpen(false);
      return;
    }
    setSelectedUser(user);
    setModalState('pin');
    setPin(['', '', '', '']);
    setError('');
    setIsOpen(false);
    setTimeout(() => pinInputRefs.current[0]?.focus(), 100);
  };

  const handlePinChange = (index: number, value: string, refs: React.MutableRefObject<(HTMLInputElement | null)[]>, pinState: string[], setPinState: (p: string[]) => void) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pinState];
    newPin[index] = value.slice(-1);
    setPinState(newPin);

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

        onUserChange(selectedUser);
        setModalState('closed');
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
        onUserChange(data);
        setModalState('closed');
      }
    } catch {
      setError('An error occurred. Please try again.');
    }

    setIsSubmitting(false);
  };

  // Auto-submit when PIN is complete
  useEffect(() => {
    if (modalState === 'pin' && pin.every(d => d !== '') && !isSubmitting) {
      handlePinSubmit();
    }
  }, [pin, modalState]);

  const closeModal = () => {
    setModalState('closed');
    setSelectedUser(null);
    setError('');
  };

  return (
    <>
      {/* User Dropdown */}
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-[12px] hover:bg-warm-cream dark:hover:bg-slate-800 transition-colors"
        >
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: currentUser.color }}
          >
            {getUserInitials(currentUser.name)}
          </div>
          <span className="font-medium text-warm-brown dark:text-slate-200 hidden sm:inline">
            {currentUser.name}
          </span>
          <ChevronDown className={`w-4 h-4 text-warm-brown/50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-[16px] shadow-xl border border-warm-gold/20 dark:border-slate-700 overflow-hidden z-50"
            >
              {/* Current User */}
              <div className="p-4 border-b border-warm-gold/10 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-[12px] flex items-center justify-center text-white font-bold shadow-md"
                    style={{ backgroundColor: currentUser.color }}
                  >
                    {getUserInitials(currentUser.name)}
                  </div>
                  <div>
                    <p className="font-semibold text-warm-brown dark:text-white">{currentUser.name}</p>
                    <p className="text-xs text-warm-brown/50 dark:text-slate-400">Currently signed in</p>
                  </div>
                  <Check className="w-5 h-5 text-emerald-500 ml-auto" />
                </div>
              </div>

              {/* Other Users */}
              <div className="max-h-48 overflow-y-auto">
                {users
                  .filter(u => u.id !== currentUser.id)
                  .map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleUserSelect(user)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-warm-cream dark:hover:bg-slate-800 transition-colors text-left"
                    >
                      <div
                        className="w-10 h-10 rounded-[10px] flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: user.color }}
                      >
                        {getUserInitials(user.name)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-warm-brown dark:text-slate-200">{user.name}</p>
                      </div>
                      <Lock className="w-4 h-4 text-warm-gold/50" />
                    </button>
                  ))}
              </div>

              {/* Actions */}
              <div className="border-t border-warm-gold/10 dark:border-slate-800">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setModalState('register');
                    setNewUserName('');
                    setNewUserPin(['', '', '', '']);
                    setConfirmPin(['', '', '', '']);
                    setError('');
                  }}
                  className="w-full flex items-center gap-2 p-4 hover:bg-warm-cream dark:hover:bg-slate-800 transition-colors text-warm-gold"
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="font-medium">Add New User</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 p-4 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-500"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* PIN Entry Modal */}
      <AnimatePresence>
        {modalState !== 'closed' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4"
            style={{ zIndex: 9999 }}
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl max-w-sm w-full overflow-hidden border border-warm-gold/20 dark:border-slate-700"
            >
              <div className="h-2 bg-gradient-to-r from-warm-gold via-warm-amber to-warm-gold" />

              {/* Close Button */}
              <div className="flex justify-end p-3">
                <button
                  onClick={closeModal}
                  className="p-2 rounded-[12px] hover:bg-warm-cream dark:hover:bg-slate-800 text-warm-brown/40 hover:text-warm-brown dark:text-slate-400 dark:hover:text-slate-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {modalState === 'pin' && selectedUser && (
                <div className="px-6 pb-8">
                  <div className="text-center mb-6">
                    <div
                      className="w-20 h-20 rounded-[16px] flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg"
                      style={{ backgroundColor: selectedUser.color }}
                    >
                      {getUserInitials(selectedUser.name)}
                    </div>
                    <h3 className="text-xl font-bold text-warm-brown dark:text-white">{selectedUser.name}</h3>
                    <p className="text-sm text-warm-brown/60 dark:text-slate-400 mt-1">Enter PIN to switch</p>
                  </div>

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
                        className={`w-14 h-16 text-center text-2xl font-bold rounded-[12px] border-2 transition-colors ${
                          lockoutSeconds > 0
                            ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                            : 'border-warm-gold/30 dark:border-slate-700 focus:border-warm-gold dark:focus:border-warm-gold'
                        } bg-white dark:bg-slate-800 text-warm-brown dark:text-white focus:outline-none`}
                      />
                    ))}
                  </div>

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
                    <div className="text-center text-warm-gold text-sm">
                      Verifying...
                    </div>
                  )}
                </div>
              )}

              {modalState === 'register' && (
                <div className="px-6 pb-8">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-[16px] bg-warm-gold/10 dark:bg-warm-gold/20 mb-4">
                      <UserPlus className="w-8 h-8 text-warm-gold dark:text-amber-400" />
                    </div>
                    <h3 className="text-xl font-bold text-warm-brown dark:text-white">Add New User</h3>
                    <p className="text-sm text-warm-brown/60 dark:text-slate-400 mt-1">Enter name and choose a PIN</p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-warm-brown/70 dark:text-slate-300 mb-2">
                        Name
                      </label>
                      <input
                        type="text"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="Enter name"
                        autoFocus
                        className="w-full px-4 py-3 rounded-[12px] border-2 border-warm-gold/30 dark:border-slate-700 bg-white dark:bg-slate-800 text-warm-brown dark:text-white focus:outline-none focus:border-warm-gold dark:focus:border-warm-gold transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-warm-brown/70 dark:text-slate-300 mb-2">
                        Choose PIN
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
                            className="w-14 h-14 text-center text-2xl font-bold rounded-[12px] border-2 border-warm-gold/30 dark:border-slate-700 bg-white dark:bg-slate-800 text-warm-brown dark:text-white focus:outline-none focus:border-warm-gold dark:focus:border-warm-gold transition-colors"
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-warm-brown/70 dark:text-slate-300 mb-2">
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
                            className="w-14 h-14 text-center text-2xl font-bold rounded-[12px] border-2 border-warm-gold/30 dark:border-slate-700 bg-white dark:bg-slate-800 text-warm-brown dark:text-white focus:outline-none focus:border-warm-gold dark:focus:border-warm-gold transition-colors"
                          />
                        ))}
                      </div>
                    </div>

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-center gap-2 text-red-500 dark:text-red-400 text-sm"
                      >
                        <AlertCircle className="w-4 h-4" />
                        {error}
                      </motion.div>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={handleRegister}
                      disabled={isSubmitting}
                      className="w-full py-4 rounded-[16px] bg-gradient-to-r from-warm-gold to-warm-amber hover:from-warm-amber hover:to-warm-gold text-white font-semibold transition-all shadow-lg shadow-warm-gold/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Creating...' : 'Create Account'}
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
