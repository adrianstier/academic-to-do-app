'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, LogOut, Lock, AlertCircle, X } from 'lucide-react';
import { AuthUser } from '@/types/todo';
import {
  verifyPin,
  isValidPin,
  getUserInitials,
  isLockedOut,
  incrementLockout,
  clearLockout,
  clearStoredSession,
} from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';

interface UserSwitcherProps {
  currentUser: AuthUser;
  onUserChange: (user: AuthUser | null) => void;
}

type ModalState = 'closed' | 'pin';

export default function UserSwitcher({ currentUser, onUserChange }: UserSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [modalState, setModalState] = useState<ModalState>('closed');
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('users')
        .select('id, name, color, role, created_at, last_login')
        .order('name');
      if (data) {
        // Default role to 'member' if not set
        setUsers(data.map(u => ({ ...u, role: u.role || 'member' })));
      }
    };
    fetchUsers();
  }, [modalState]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handlePinKeyDown = (e: React.KeyboardEvent, index: number, refs: React.MutableRefObject<(HTMLInputElement | null)[]>, pinState: string[]) => {
    if (e.key === 'Backspace' && !pinState[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePinSubmit = async () => {
    if (!selectedUser || lockoutSeconds > 0) return;

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
          setError('Too many attempts. Please wait.');
        } else {
          setError(`Incorrect PIN. ${3 - lockout.attempts} attempts left.`);
        }
        setPin(['', '', '', '']);
        pinInputRefs.current[0]?.focus();
      }
    } catch {
      setError('An error occurred.');
    }

    setIsSubmitting(false);
  };

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
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px] touch-manipulation"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-semibold shadow-md"
            style={{ backgroundColor: currentUser.color }}
          >
            {getUserInitials(currentUser.name)}
          </div>
          <ChevronDown className={`w-4 h-4 text-white/70 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-64 max-w-[280px] bg-[var(--surface)] rounded-[var(--radius-xl)] shadow-[var(--shadow-xl)] border border-[var(--border)] overflow-hidden z-50 max-h-[70vh] sm:max-h-[80vh] overflow-y-auto">
            {/* Current user */}
            <div className="p-3 bg-[var(--surface-2)] border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold shadow-md"
                  style={{ backgroundColor: currentUser.color }}
                >
                  {getUserInitials(currentUser.name)}
                </div>
                <div>
                  <p className="font-semibold text-[var(--foreground)]">{currentUser.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">Signed in</p>
                </div>
              </div>
            </div>

            {/* Other users */}
            {users.filter(u => u.id !== currentUser.id).length > 0 && (
              <div className="py-2">
                <p className="px-3 pb-1 text-xs font-medium text-[var(--text-light)] uppercase tracking-wide">
                  Switch Account
                </p>
                {users
                  .filter(u => u.id !== currentUser.id)
                  .map(user => (
                    <button
                      key={user.id}
                      onClick={() => handleUserSelect(user)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 sm:py-2 hover:bg-[var(--surface-2)] active:bg-[var(--surface-3)] transition-colors text-left min-h-[44px] touch-manipulation"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                        style={{ backgroundColor: user.color }}
                      >
                        {getUserInitials(user.name)}
                      </div>
                      <span className="flex-1 text-[var(--foreground)] text-base sm:text-sm truncate">{user.name}</span>
                      <Lock className="w-3.5 h-3.5 text-[var(--text-light)] flex-shrink-0" />
                    </button>
                  ))}
              </div>
            )}

            {/* Actions */}
            <div className="border-t border-[var(--border-subtle)]">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-3 sm:py-2.5 hover:bg-[var(--danger-light)] active:bg-[var(--danger)]/15 text-[var(--danger)] font-medium transition-colors min-h-[44px] touch-manipulation text-base sm:text-sm"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalState !== 'closed' && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={closeModal}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-[calc(100vw-2rem)] sm:max-w-sm w-full overflow-hidden"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-100">
              <h3 className="text-base sm:text-lg font-semibold text-slate-900">
                Enter PIN
              </h3>
              <button
                onClick={closeModal}
                className="p-2 sm:p-1.5 rounded-lg hover:bg-slate-100 active:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center touch-manipulation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalState === 'pin' && selectedUser && (
              <div className="p-4 sm:p-6">
                <div className="text-center mb-4 sm:mb-6">
                  <div
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white text-lg sm:text-xl font-bold mx-auto mb-2 sm:mb-3 shadow-lg"
                    style={{ backgroundColor: selectedUser.color }}
                  >
                    {getUserInitials(selectedUser.name)}
                  </div>
                  <p className="font-medium text-slate-900">{selectedUser.name}</p>
                  <p className="text-sm text-slate-400">Enter 4-digit PIN</p>
                </div>

                <div className="flex justify-center gap-2 sm:gap-3 mb-4">
                  {pin.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { pinInputRefs.current[index] = el; }}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handlePinChange(index, e.target.value, pinInputRefs, pin, setPin)}
                      onKeyDown={(e) => handlePinKeyDown(e, index, pinInputRefs, pin)}
                      disabled={lockoutSeconds > 0 || isSubmitting}
                      className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold rounded-xl border-2 transition-all focus:outline-none touch-manipulation ${
                        lockoutSeconds > 0
                          ? 'border-red-200 bg-red-50'
                          : digit
                            ? 'border-[#0033A0] bg-[#0033A0]/5'
                            : 'border-slate-200 focus:border-[#0033A0]'
                      } text-slate-900`}
                    />
                  ))}
                </div>

                {(error || lockoutSeconds > 0) && (
                  <div className="flex items-center justify-center gap-2 text-red-500 text-sm bg-red-50 py-2 px-4 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    {lockoutSeconds > 0 ? `Wait ${lockoutSeconds}s` : error}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
