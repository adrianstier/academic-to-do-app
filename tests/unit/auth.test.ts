import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin, isValidPin } from '@/lib/auth';

describe('Authentication', () => {
  describe('hashPin', () => {
    it('should hash a PIN consistently', async () => {
      const pin = '1234';
      const hash1 = await hashPin(pin);
      const hash2 = await hashPin(pin);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
    });

    it('should produce different hashes for different PINs', async () => {
      const hash1 = await hashPin('1234');
      const hash2 = await hashPin('5678');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPin', () => {
    it('should verify correct PIN', async () => {
      const pin = '1234';
      const hash = await hashPin(pin);

      const result = await verifyPin(pin, hash);

      expect(result).toBe(true);
    });

    it('should reject incorrect PIN', async () => {
      const correctPin = '1234';
      const wrongPin = '5678';
      const hash = await hashPin(correctPin);

      const result = await verifyPin(wrongPin, hash);

      expect(result).toBe(false);
    });
  });

  describe('isValidPin', () => {
    it('should accept valid 4-digit PIN', () => {
      expect(isValidPin('1234')).toBe(true);
      expect(isValidPin('0000')).toBe(true);
      expect(isValidPin('9999')).toBe(true);
    });

    it('should reject invalid PINs', () => {
      expect(isValidPin('123')).toBe(false);   // Too short
      expect(isValidPin('12345')).toBe(false); // Too long
      expect(isValidPin('abcd')).toBe(false);  // Non-numeric
      expect(isValidPin('12a4')).toBe(false);  // Contains letter
      expect(isValidPin('')).toBe(false);      // Empty
    });
  });
});
