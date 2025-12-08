// Auth utilities for PIN-based authentication

export interface AuthUser {
  id: string;
  name: string;
  color: string;
  created_at: string;
  last_login?: string;
}

export interface StoredSession {
  userId: string;
  userName: string;
  loginAt: string;
}

const SESSION_KEY = 'todoSession';
const LOCKOUT_KEY = 'authLockout';

// Hash PIN using SHA-256
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify PIN against hash
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const inputHash = await hashPin(pin);
  return inputHash === hash;
}

// Session management
export function getStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  const session = localStorage.getItem(SESSION_KEY);
  if (!session) return null;
  try {
    return JSON.parse(session);
  } catch {
    return null;
  }
}

export function setStoredSession(user: AuthUser): void {
  const session: StoredSession = {
    userId: user.id,
    userName: user.name,
    loginAt: new Date().toISOString(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  localStorage.removeItem(SESSION_KEY);
  // Also clear legacy key
  localStorage.removeItem('todoUserName');
  localStorage.removeItem('userName');
}

// Lockout management for rate limiting
interface LockoutState {
  attempts: number;
  lockedUntil?: string;
}

export function getLockoutState(userId: string): LockoutState {
  if (typeof window === 'undefined') return { attempts: 0 };
  const key = `${LOCKOUT_KEY}_${userId}`;
  const state = localStorage.getItem(key);
  if (!state) return { attempts: 0 };
  try {
    return JSON.parse(state);
  } catch {
    return { attempts: 0 };
  }
}

export function incrementLockout(userId: string): LockoutState {
  const state = getLockoutState(userId);
  state.attempts++;

  if (state.attempts >= 3) {
    // Lock for 30 seconds
    const lockUntil = new Date();
    lockUntil.setSeconds(lockUntil.getSeconds() + 30);
    state.lockedUntil = lockUntil.toISOString();
  }

  const key = `${LOCKOUT_KEY}_${userId}`;
  localStorage.setItem(key, JSON.stringify(state));
  return state;
}

export function clearLockout(userId: string): void {
  const key = `${LOCKOUT_KEY}_${userId}`;
  localStorage.removeItem(key);
}

export function isLockedOut(userId: string): { locked: boolean; remainingSeconds: number } {
  const state = getLockoutState(userId);
  if (!state.lockedUntil) return { locked: false, remainingSeconds: 0 };

  const lockUntil = new Date(state.lockedUntil);
  const now = new Date();

  if (now >= lockUntil) {
    clearLockout(userId);
    return { locked: false, remainingSeconds: 0 };
  }

  const remainingSeconds = Math.ceil((lockUntil.getTime() - now.getTime()) / 1000);
  return { locked: true, remainingSeconds };
}

// Generate a random color for new users
const USER_COLORS = [
  '#0033A0', // Allstate Blue
  '#059669', // Green
  '#7c3aed', // Purple
  '#dc2626', // Red
  '#ea580c', // Orange
  '#0891b2', // Cyan
  '#be185d', // Pink
  '#4f46e5', // Indigo
];

export function getRandomUserColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

// Get user initials for avatar
export function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Validate PIN format (4 digits)
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
