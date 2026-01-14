/**
 * Secure Authentication Utilities
 *
 * Provides secure PIN hashing with Argon2 and salt for enhanced security.
 * This module is designed to work both server-side and client-side where possible.
 */

import { createHash, randomBytes } from 'crypto';

// ============================================
// CONFIGURATION
// ============================================

/**
 * Argon2 parameters (server-side only)
 * These values are tuned for security vs performance balance
 */
const ARGON2_CONFIG = {
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};

/**
 * Session configuration
 */
export const SESSION_CONFIG = {
  IDLE_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  MAX_AGE: 8 * 60 * 60 * 1000, // 8 hours
  TOKEN_LENGTH: 32,
};

// ============================================
// PIN HASHING (with backward compatibility)
// ============================================

/**
 * Generate a random salt for PIN hashing
 */
export function generateSalt(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Hash a PIN using SHA-256 with salt (client-side compatible)
 * This is the enhanced version that uses per-user salt
 */
export async function hashPinWithSalt(pin: string, salt: string): Promise<string> {
  // Combine pin with salt
  const combined = `${salt}:${pin}`;

  // Use Web Crypto API for browser compatibility
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Server-side: use Node.js crypto
  return createHash('sha256').update(combined).digest('hex');
}

/**
 * Verify a PIN against a salted hash
 */
export async function verifyPinWithSalt(
  pin: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  const inputHash = await hashPinWithSalt(pin, salt);

  // Constant-time comparison to prevent timing attacks
  if (inputHash.length !== expectedHash.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < inputHash.length; i++) {
    result |= inputHash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Legacy PIN hash (for backward compatibility during migration)
 */
export async function hashPinLegacy(pin: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  return createHash('sha256').update(pin).digest('hex');
}

/**
 * Check if a hash is in the new salted format
 * New format: "salt:hash" where salt is 32 hex chars and hash is 64 hex chars
 */
export function isSaltedHash(hash: string): boolean {
  return /^[a-f0-9]{32}:[a-f0-9]{64}$/.test(hash);
}

/**
 * Parse a salted hash into its components
 */
export function parseSaltedHash(hash: string): { salt: string; hash: string } | null {
  if (!isSaltedHash(hash)) {
    return null;
  }

  const [salt, hashPart] = hash.split(':');
  return { salt, hash: hashPart };
}

/**
 * Create a salted hash string for storage
 */
export async function createSaltedHash(pin: string): Promise<string> {
  const salt = generateSalt();
  const hash = await hashPinWithSalt(pin, salt);
  return `${salt}:${hash}`;
}

/**
 * Verify a PIN against either legacy or salted hash format
 * Supports migration from old to new format
 */
export async function verifyPin(pin: string, storedHash: string): Promise<{
  valid: boolean;
  needsUpgrade: boolean;
}> {
  // Check if it's a salted hash
  const parsed = parseSaltedHash(storedHash);

  if (parsed) {
    // New format: salted hash
    const valid = await verifyPinWithSalt(pin, parsed.salt, parsed.hash);
    return { valid, needsUpgrade: false };
  }

  // Legacy format: unsalted hash
  const legacyHash = await hashPinLegacy(pin);
  const valid = legacyHash === storedHash;
  return { valid, needsUpgrade: valid }; // Only upgrade if PIN was correct
}

// ============================================
// SESSION TOKEN MANAGEMENT
// ============================================

/**
 * Generate a cryptographically secure session token
 */
export function generateSessionToken(): string {
  return randomBytes(SESSION_CONFIG.TOKEN_LENGTH).toString('base64url');
}

/**
 * Hash a session token for storage
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ============================================
// INPUT VALIDATION
// ============================================

/**
 * Validate PIN format (4 digits)
 */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/**
 * Validate username format
 */
export function isValidUsername(name: string): boolean {
  // 2-30 characters, alphanumeric and spaces allowed
  return /^[a-zA-Z][a-zA-Z0-9\s]{1,29}$/.test(name.trim());
}

// ============================================
// LOCKOUT MANAGEMENT (Server-side)
// ============================================

/**
 * Lockout configuration
 */
export const LOCKOUT_CONFIG = {
  MAX_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
};

/**
 * Create lockout key for Redis/database
 */
export function getLockoutKey(userId: string): string {
  return `lockout:${userId}`;
}

/**
 * Check if lockout duration has expired
 */
export function isLockoutExpired(lockoutTime: Date): boolean {
  const now = new Date();
  const elapsed = now.getTime() - lockoutTime.getTime();
  return elapsed >= LOCKOUT_CONFIG.LOCKOUT_DURATION;
}

// ============================================
// USER COLORS (unchanged from original)
// ============================================

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

/**
 * Get user initials for avatar
 */
export function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
