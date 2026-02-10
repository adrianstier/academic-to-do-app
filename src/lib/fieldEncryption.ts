/**
 * Field-Level Encryption for PII
 *
 * Provides AES-256-GCM encryption for sensitive fields like
 * transcriptions, notes, and messages that may contain customer PII.
 *
 * SECURITY REQUIREMENTS:
 * - Set FIELD_ENCRYPTION_KEY environment variable (32-byte hex string)
 * - Generate with: openssl rand -hex 32
 * - Store securely in Railway env vars
 * - Rotate annually or after potential compromise
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { logger } from './logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

// Encrypted field prefix for identification
const ENCRYPTED_PREFIX = 'enc:v1:';

interface EncryptionResult {
  success: boolean;
  data?: string;
  error?: string;
}

/**
 * Get encryption key from environment
 * Returns null if not configured (encryption disabled)
 */
function getEncryptionKey(): Buffer | null {
  const keyHex = process.env.FIELD_ENCRYPTION_KEY;

  if (!keyHex) {
    // Encryption not configured - this is acceptable for development
    return null;
  }

  if (keyHex.length !== 64) {
    logger.error('FIELD_ENCRYPTION_KEY must be 64 hex characters (32 bytes)', new Error('Invalid key length'), {
      component: 'fieldEncryption',
      action: 'getKey',
    });
    return null;
  }

  try {
    return Buffer.from(keyHex, 'hex');
  } catch {
    logger.error('Invalid FIELD_ENCRYPTION_KEY format', new Error('Invalid key format'), {
      component: 'fieldEncryption',
      action: 'getKey',
    });
    return null;
  }
}

/**
 * Derive a field-specific key using HKDF-like approach
 * This ensures different fields have different effective keys
 */
function deriveFieldKey(masterKey: Buffer, fieldName: string): Buffer {
  const info = `field:${fieldName}`;
  return createHash('sha256')
    .update(masterKey)
    .update(info)
    .digest();
}

/**
 * Encrypt a string value for storage
 * Returns the original value if encryption is not configured
 *
 * Format: enc:v1:{iv}:{authTag}:{ciphertext} (all base64)
 */
export function encryptField(plaintext: string | null | undefined, fieldName: string): string | null {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return plaintext as string | null;
  }

  // Already encrypted - return as-is
  if (plaintext.startsWith(ENCRYPTED_PREFIX)) {
    return plaintext;
  }

  const masterKey = getEncryptionKey();
  if (!masterKey) {
    // Encryption not configured - return plaintext
    return plaintext;
  }

  try {
    const fieldKey = deriveFieldKey(masterKey, fieldName);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, fieldKey, iv, { authTagLength: AUTH_TAG_LENGTH });

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    // Format: prefix + iv:authTag:ciphertext (all base64)
    const result = ENCRYPTED_PREFIX +
      iv.toString('base64') + ':' +
      authTag.toString('base64') + ':' +
      encrypted.toString('base64');

    return result;
  } catch (error) {
    logger.error('Field encryption failed', error as Error, {
      component: 'fieldEncryption',
      action: 'encrypt',
      fieldName,
    });
    // Return plaintext on error to avoid data loss
    return plaintext;
  }
}

/**
 * Decrypt an encrypted field value
 * Returns the original value if not encrypted or decryption fails
 */
export function decryptField(ciphertext: string | null | undefined, fieldName: string): string | null {
  if (ciphertext === null || ciphertext === undefined || ciphertext === '') {
    return ciphertext as string | null;
  }

  // Not encrypted - return as-is
  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) {
    return ciphertext;
  }

  const masterKey = getEncryptionKey();
  if (!masterKey) {
    logger.warn('Cannot decrypt field - FIELD_ENCRYPTION_KEY not configured', {
      component: 'fieldEncryption',
      action: 'decrypt',
      fieldName,
    });
    // Return ciphertext as-is (will show as encrypted string)
    return ciphertext;
  }

  try {
    // Parse: enc:v1:{iv}:{authTag}:{ciphertext}
    const data = ciphertext.substring(ENCRYPTED_PREFIX.length);
    const parts = data.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted field format');
    }

    const [ivB64, authTagB64, encryptedB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');

    const fieldKey = deriveFieldKey(masterKey, fieldName);
    const decipher = createDecipheriv(ALGORITHM, fieldKey, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    logger.error('Field decryption failed', error as Error, {
      component: 'fieldEncryption',
      action: 'decrypt',
      fieldName,
    });
    // Return ciphertext on error
    return ciphertext;
  }
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Encrypt multiple fields in an object
 * Only encrypts specified field names
 */
export function encryptFields<T extends Record<string, unknown>>(
  obj: T,
  fieldNames: (keyof T)[]
): T {
  const result = { ...obj };

  for (const fieldName of fieldNames) {
    const value = obj[fieldName];
    if (typeof value === 'string') {
      (result[fieldName] as unknown) = encryptField(value, String(fieldName));
    }
  }

  return result;
}

/**
 * Decrypt multiple fields in an object
 * Only decrypts specified field names
 */
export function decryptFields<T extends Record<string, unknown>>(
  obj: T,
  fieldNames: (keyof T)[]
): T {
  const result = { ...obj };

  for (const fieldName of fieldNames) {
    const value = obj[fieldName];
    if (typeof value === 'string') {
      (result[fieldName] as unknown) = decryptField(value, String(fieldName));
    }
  }

  return result;
}

/**
 * Fields that contain PII and should be encrypted
 */
export const PII_FIELDS = {
  todos: ['transcription', 'notes'] as const,
  messages: ['text'] as const,
} as const;

/**
 * Encrypt PII fields in a todo object before storage
 */
export function encryptTodoPII<T extends { transcription?: string | null; notes?: string | null }>(
  todo: T
): T {
  return {
    ...todo,
    transcription: encryptField(todo.transcription, 'todos.transcription'),
    notes: encryptField(todo.notes, 'todos.notes'),
  };
}

/**
 * Decrypt PII fields in a todo object after retrieval
 */
export function decryptTodoPII<T extends { transcription?: string | null; notes?: string | null }>(
  todo: T
): T {
  return {
    ...todo,
    transcription: decryptField(todo.transcription, 'todos.transcription'),
    notes: decryptField(todo.notes, 'todos.notes'),
  };
}

/**
 * Encrypt PII fields in a message object before storage
 */
export function encryptMessagePII<T extends { text?: string | null }>(
  message: T
): T {
  return {
    ...message,
    text: encryptField(message.text, 'messages.text'),
  };
}

/**
 * Decrypt PII fields in a message object after retrieval
 */
export function decryptMessagePII<T extends { text?: string | null }>(
  message: T
): T {
  return {
    ...message,
    text: decryptField(message.text, 'messages.text'),
  };
}

/**
 * Re-encrypt all data with a new key (for key rotation)
 * This is a helper that should be called from a migration script
 */
export async function reEncryptField(
  oldValue: string | null,
  fieldName: string,
  newKey: Buffer
): Promise<string | null> {
  if (!oldValue) return oldValue;

  // First decrypt with current key
  const decrypted = decryptField(oldValue, fieldName);
  if (decrypted === oldValue && isEncrypted(oldValue)) {
    // Decryption failed - can't re-encrypt
    throw new Error(`Failed to decrypt field ${fieldName} for re-encryption`);
  }

  // BUG-API-31: Actually re-encrypt with the new key
  try {
    const fieldKey = deriveFieldKey(newKey, fieldName);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, fieldKey, iv, { authTagLength: AUTH_TAG_LENGTH });

    const encrypted = Buffer.concat([
      cipher.update(decrypted!, 'utf8'),
      cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    return ENCRYPTED_PREFIX +
      iv.toString('base64') + ':' +
      authTag.toString('base64') + ':' +
      encrypted.toString('base64');
  } catch (error) {
    logger.error('Re-encryption failed', error as Error, {
      component: 'fieldEncryption',
      action: 'reEncrypt',
      fieldName,
    });
    throw new Error(`Failed to re-encrypt field ${fieldName}`);
  }
}
