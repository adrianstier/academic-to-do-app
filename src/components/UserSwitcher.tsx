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
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: currentUser.color }}
          >
            {getUserInitials(currentUser.name)}
          </div>
          <span className="font-medium text-slate-700 dark:text-slate-200 hidden sm:inline">
            {currentUser.name}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50"
            >
              {/* Current User */}
              <div className="p-3 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: currentUser.color }}
                  >
                    {getUserInitials(currentUser.name)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{currentUser.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Currently signed in</p>
                  </div>
                  <Check className="w-5 h-5 text-green-500 ml-auto" />
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
                      className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: user.color }}
                      >
                        {getUserInitials(user.name)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-700 dark:text-slate-200">{user.name}</p>
                      </div>
                      <Lock className="w-4 h-4 text-slate-400" />
                    </button>
                  ))}
              </div>

              {/* Actions */}
              <div className="border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setModalState('register');
                    setNewUserName('');
                    setNewUserPin(['', '', '', '']);
                    setConfirmPin(['', '', '', '']);
                    setError('');
                  }}
                  className="w-full flex items-center gap-2 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-[#0033A0] dark:text-blue-400"
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="font-medium">Add New User</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 p-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-500"
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
            >
              <div className="h-1.5 bg-[#0033A0]" />

              {/* Close Button */}
              <div className="flex justify-end p-3">
                <button
                  onClick={closeModal}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {modalState === 'pin' && selectedUser && (
                <div className="px-6 pb-8">
                  <div className="text-center mb-6">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-3 shadow-lg"
                      style={{ backgroundColor: selectedUser.color }}
                    >
                      {getUserInitials(selectedUser.name)}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedUser.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Enter PIN to switch</p>
                  </div>

                  <div className="flex justify-center gap-3 mb-4">
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
                        className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-colors ${
                          lockoutSeconds > 0
                            ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                            : 'border-slate-200 dark:border-slate-600 focus:border-[#0033A0] dark:focus:border-[#0033A0]'
                        } bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none`}
                      />
                    ))}
                  </div>

                  {(error || lockoutSeconds > 0) && (
                    <div className="flex items-center justify-center gap-2 text-red-500 dark:text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      {lockoutSeconds > 0 ? `Locked. Try again in ${lockoutSeconds}s` : error}
                    </div>
                  )}

                  {isSubmitting && (
                    <div className="text-center text-slate-500 dark:text-slate-400 text-sm">
                      Verifying...
                    </div>
                  )}
                </div>
              )}

              {modalState === 'register' && (
                <div className="px-6 pb-8">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[#0033A0]/10 dark:bg-[#0033A0]/20 mb-3">
                      <UserPlus className="w-7 h-7 text-[#0033A0] dark:text-blue-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add New User</h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Name
                      </label>
                      <input
                        type="text"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="Enter name"
                        autoFocus
                        className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#0033A0] dark:focus:border-[#0033A0] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Choose PIN
                      </label>
                      <div className="flex justify-center gap-2">
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
                            className="w-11 h-12 text-center text-lg font-bold rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#0033A0] dark:focus:border-[#0033A0] transition-colors"
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Confirm PIN
                      </label>
                      <div className="flex justify-center gap-2">
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
                            className="w-11 h-12 text-center text-lg font-bold rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-[#0033A0] dark:focus:border-[#0033A0] transition-colors"
                          />
                        ))}
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-center justify-center gap-2 text-red-500 dark:text-red-400 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {error}
                      </div>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={handleRegister}
                      disabled={isSubmitting}
                      className="w-full py-3 rounded-xl bg-[#0033A0] hover:bg-[#002878] text-white font-semibold transition-colors shadow-lg shadow-[#0033A0]/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
