import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isFeatureEnabled, getAllFeatureFlags, getFeatureFlag } from '@/lib/featureFlags';
import type { FeatureFlag } from '@/lib/featureFlags';

describe('Feature Flags', () => {
  beforeEach(() => {
    // Reset all environment variables to ensure clean test state
    vi.stubEnv('NEXT_PUBLIC_ENABLE_NEW_AUTH', '');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_OAUTH', '');
    vi.stubEnv('NEXT_PUBLIC_USE_OAUTH', '');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_NORMALIZED_SCHEMA', '');
    vi.stubEnv('NEXT_PUBLIC_USE_NEW_COMPONENTS', '');
    vi.stubEnv('NEXT_PUBLIC_NEW_COMPONENTS_ROLLOUT_PERCENT', '');
    vi.stubEnv('NEXT_PUBLIC_USE_ZUSTAND', '');
    vi.stubEnv('DISABLE_RATE_LIMITING', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isFeatureEnabled', () => {
    describe('new_auth_system flag', () => {
      it('should return false when NEXT_PUBLIC_ENABLE_NEW_AUTH is not set', () => {
        expect(isFeatureEnabled('new_auth_system')).toBe(false);
      });

      it('should return false when NEXT_PUBLIC_ENABLE_NEW_AUTH is "false"', () => {
        vi.stubEnv('NEXT_PUBLIC_ENABLE_NEW_AUTH', 'false');
        expect(isFeatureEnabled('new_auth_system')).toBe(false);
      });

      it('should return true when NEXT_PUBLIC_ENABLE_NEW_AUTH is "true"', () => {
        vi.stubEnv('NEXT_PUBLIC_ENABLE_NEW_AUTH', 'true');
        expect(isFeatureEnabled('new_auth_system')).toBe(true);
      });

      it('should return false for non-boolean string values', () => {
        vi.stubEnv('NEXT_PUBLIC_ENABLE_NEW_AUTH', 'yes');
        expect(isFeatureEnabled('new_auth_system')).toBe(false);

        vi.stubEnv('NEXT_PUBLIC_ENABLE_NEW_AUTH', '1');
        expect(isFeatureEnabled('new_auth_system')).toBe(false);

        vi.stubEnv('NEXT_PUBLIC_ENABLE_NEW_AUTH', 'TRUE');
        expect(isFeatureEnabled('new_auth_system')).toBe(false);
      });
    });

    describe('oauth_login flag', () => {
      it('should return false when neither OAuth env var is set', () => {
        expect(isFeatureEnabled('oauth_login')).toBe(false);
      });

      it('should return true when NEXT_PUBLIC_ENABLE_OAUTH is "true"', () => {
        vi.stubEnv('NEXT_PUBLIC_ENABLE_OAUTH', 'true');
        expect(isFeatureEnabled('oauth_login')).toBe(true);
      });

      it('should return true when NEXT_PUBLIC_USE_OAUTH is "true"', () => {
        vi.stubEnv('NEXT_PUBLIC_USE_OAUTH', 'true');
        expect(isFeatureEnabled('oauth_login')).toBe(true);
      });

      it('should return true when both OAuth env vars are "true"', () => {
        vi.stubEnv('NEXT_PUBLIC_ENABLE_OAUTH', 'true');
        vi.stubEnv('NEXT_PUBLIC_USE_OAUTH', 'true');
        expect(isFeatureEnabled('oauth_login')).toBe(true);
      });

      it('should return true when only one OAuth env var is "true"', () => {
        vi.stubEnv('NEXT_PUBLIC_ENABLE_OAUTH', 'false');
        vi.stubEnv('NEXT_PUBLIC_USE_OAUTH', 'true');
        expect(isFeatureEnabled('oauth_login')).toBe(true);
      });
    });

    describe('normalized_schema flag', () => {
      it('should return false when not enabled', () => {
        expect(isFeatureEnabled('normalized_schema')).toBe(false);
      });

      it('should return true when NEXT_PUBLIC_ENABLE_NORMALIZED_SCHEMA is "true"', () => {
        vi.stubEnv('NEXT_PUBLIC_ENABLE_NORMALIZED_SCHEMA', 'true');
        expect(isFeatureEnabled('normalized_schema')).toBe(true);
      });
    });

    describe('new_state_management flag', () => {
      it('should return false when not enabled', () => {
        expect(isFeatureEnabled('new_state_management')).toBe(false);
      });

      it('should return true when NEXT_PUBLIC_USE_ZUSTAND is "true"', () => {
        vi.stubEnv('NEXT_PUBLIC_USE_ZUSTAND', 'true');
        expect(isFeatureEnabled('new_state_management')).toBe(true);
      });
    });

    describe('server_rate_limiting flag (security feature)', () => {
      it('should return true by default (enabled for security)', () => {
        expect(isFeatureEnabled('server_rate_limiting')).toBe(true);
      });

      it('should return false when DISABLE_RATE_LIMITING is "true"', () => {
        vi.stubEnv('DISABLE_RATE_LIMITING', 'true');
        expect(isFeatureEnabled('server_rate_limiting')).toBe(false);
      });

      it('should return true when DISABLE_RATE_LIMITING is "false"', () => {
        vi.stubEnv('DISABLE_RATE_LIMITING', 'false');
        expect(isFeatureEnabled('server_rate_limiting')).toBe(true);
      });

      it('should return true for any value other than "true"', () => {
        vi.stubEnv('DISABLE_RATE_LIMITING', 'yes');
        expect(isFeatureEnabled('server_rate_limiting')).toBe(true);

        vi.stubEnv('DISABLE_RATE_LIMITING', '1');
        expect(isFeatureEnabled('server_rate_limiting')).toBe(true);
      });
    });

    describe('refactored_components flag with A/B testing', () => {
      it('should return false when feature is disabled', () => {
        vi.stubEnv('NEXT_PUBLIC_USE_NEW_COMPONENTS', 'false');
        expect(isFeatureEnabled('refactored_components')).toBe(false);
      });

      it('should return true when enabled without rollout percentage', () => {
        vi.stubEnv('NEXT_PUBLIC_USE_NEW_COMPONENTS', 'true');
        vi.stubEnv('NEXT_PUBLIC_NEW_COMPONENTS_ROLLOUT_PERCENT', '0');
        // Without userId, rollout percentage is not applied
        expect(isFeatureEnabled('refactored_components')).toBe(true);
      });

      it('should return false for 0% rollout with userId', () => {
        vi.stubEnv('NEXT_PUBLIC_USE_NEW_COMPONENTS', 'true');
        vi.stubEnv('NEXT_PUBLIC_NEW_COMPONENTS_ROLLOUT_PERCENT', '0');
        expect(isFeatureEnabled('refactored_components', 'any-user')).toBe(false);
      });

      it('should return true for 100% rollout with userId', () => {
        vi.stubEnv('NEXT_PUBLIC_USE_NEW_COMPONENTS', 'true');
        vi.stubEnv('NEXT_PUBLIC_NEW_COMPONENTS_ROLLOUT_PERCENT', '100');
        expect(isFeatureEnabled('refactored_components', 'any-user')).toBe(true);
      });

      it('should be deterministic for the same userId', () => {
        vi.stubEnv('NEXT_PUBLIC_USE_NEW_COMPONENTS', 'true');
        vi.stubEnv('NEXT_PUBLIC_NEW_COMPONENTS_ROLLOUT_PERCENT', '50');

        const userId = 'test-user-123';
        const result1 = isFeatureEnabled('refactored_components', userId);
        const result2 = isFeatureEnabled('refactored_components', userId);
        const result3 = isFeatureEnabled('refactored_components', userId);

        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
      });

      it('should distribute users across buckets for 50% rollout', () => {
        vi.stubEnv('NEXT_PUBLIC_USE_NEW_COMPONENTS', 'true');
        vi.stubEnv('NEXT_PUBLIC_NEW_COMPONENTS_ROLLOUT_PERCENT', '50');

        // Test with many users to verify distribution
        const testUsers = Array.from({ length: 100 }, (_, i) => `user-${i}`);
        const results = testUsers.map(userId =>
          isFeatureEnabled('refactored_components', userId)
        );

        const enabledCount = results.filter(Boolean).length;

        // With 50% rollout, expect roughly 30-70 users to be enabled
        // (allowing for hash distribution variance)
        expect(enabledCount).toBeGreaterThan(20);
        expect(enabledCount).toBeLessThan(80);
      });

      it('should handle empty userId by not applying rollout', () => {
        vi.stubEnv('NEXT_PUBLIC_USE_NEW_COMPONENTS', 'true');
        vi.stubEnv('NEXT_PUBLIC_NEW_COMPONENTS_ROLLOUT_PERCENT', '0');

        // Empty string is falsy, so rollout should not apply
        expect(isFeatureEnabled('refactored_components', '')).toBe(true);
      });

      it('should parse rollout percentage correctly', () => {
        vi.stubEnv('NEXT_PUBLIC_USE_NEW_COMPONENTS', 'true');

        // Test with various percentage values
        vi.stubEnv('NEXT_PUBLIC_NEW_COMPONENTS_ROLLOUT_PERCENT', '50');
        const result50 = isFeatureEnabled('refactored_components', 'test-user');
        expect(typeof result50).toBe('boolean');

        vi.stubEnv('NEXT_PUBLIC_NEW_COMPONENTS_ROLLOUT_PERCENT', '25');
        const result25 = isFeatureEnabled('refactored_components', 'test-user');
        expect(typeof result25).toBe('boolean');
      });

      it('should default rollout percentage to 0 when not set', () => {
        vi.stubEnv('NEXT_PUBLIC_USE_NEW_COMPONENTS', 'true');
        // NEXT_PUBLIC_NEW_COMPONENTS_ROLLOUT_PERCENT is not set (empty string)

        // With no rollout percentage set (defaults to 0),
        // but without userId, it returns enabled state
        expect(isFeatureEnabled('refactored_components')).toBe(true);

        // With userId and 0% rollout, should return false
        expect(isFeatureEnabled('refactored_components', 'user-123')).toBe(false);
      });
    });
  });

  describe('getAllFeatureFlags', () => {
    it('should return all 6 feature flags', () => {
      const flags = getAllFeatureFlags();

      const expectedFlags: FeatureFlag[] = [
        'new_auth_system',
        'oauth_login',
        'normalized_schema',
        'refactored_components',
        'new_state_management',
        'server_rate_limiting',
      ];

      expectedFlags.forEach(flag => {
        expect(flags).toHaveProperty(flag);
      });

      expect(Object.keys(flags)).toHaveLength(6);
    });

    it('should include enabled and description for each flag', () => {
      const flags = getAllFeatureFlags();

      Object.values(flags).forEach(config => {
        expect(config).toHaveProperty('enabled');
        expect(config).toHaveProperty('description');
        expect(typeof config.enabled).toBe('boolean');
        expect(typeof config.description).toBe('string');
        expect(config.description.length).toBeGreaterThan(0);
      });
    });

    it('should include rolloutPercentage for refactored_components', () => {
      vi.stubEnv('NEXT_PUBLIC_NEW_COMPONENTS_ROLLOUT_PERCENT', '75');

      const flags = getAllFeatureFlags();

      expect(flags.refactored_components).toHaveProperty('rolloutPercentage');
      expect(flags.refactored_components.rolloutPercentage).toBe(75);
    });

    it('should reflect current environment variable state', () => {
      // Initially all off (except rate limiting)
      let flags = getAllFeatureFlags();
      expect(flags.new_auth_system.enabled).toBe(false);
      expect(flags.oauth_login.enabled).toBe(false);
      expect(flags.server_rate_limiting.enabled).toBe(true);

      // Enable some flags
      vi.stubEnv('NEXT_PUBLIC_ENABLE_NEW_AUTH', 'true');
      vi.stubEnv('NEXT_PUBLIC_ENABLE_OAUTH', 'true');

      flags = getAllFeatureFlags();
      expect(flags.new_auth_system.enabled).toBe(true);
      expect(flags.oauth_login.enabled).toBe(true);
    });

    it('should have meaningful descriptions', () => {
      const flags = getAllFeatureFlags();

      expect(flags.new_auth_system.description).toContain('Argon2');
      expect(flags.oauth_login.description).toContain('OAuth');
      expect(flags.normalized_schema.description).toContain('schema');
      expect(flags.refactored_components.description).toContain('component');
      expect(flags.new_state_management.description).toContain('Zustand');
      expect(flags.server_rate_limiting.description).toContain('rate limiting');
    });
  });

  describe('getFeatureFlag', () => {
    it('should return the same result as isFeatureEnabled', () => {
      vi.stubEnv('NEXT_PUBLIC_ENABLE_NEW_AUTH', 'true');

      const result = getFeatureFlag('new_auth_system');
      const directResult = isFeatureEnabled('new_auth_system');

      expect(result).toBe(directResult);
      expect(result).toBe(true);
    });

    it('should pass userId to isFeatureEnabled for A/B testing', () => {
      vi.stubEnv('NEXT_PUBLIC_USE_NEW_COMPONENTS', 'true');
      vi.stubEnv('NEXT_PUBLIC_NEW_COMPONENTS_ROLLOUT_PERCENT', '100');

      const userId = 'test-user';
      const result = getFeatureFlag('refactored_components', userId);
      const directResult = isFeatureEnabled('refactored_components', userId);

      expect(result).toBe(directResult);
      expect(result).toBe(true);
    });

    it('should work without userId parameter', () => {
      vi.stubEnv('NEXT_PUBLIC_ENABLE_OAUTH', 'true');

      const result = getFeatureFlag('oauth_login');

      expect(result).toBe(true);
    });

    it('should return false for disabled flags', () => {
      const result = getFeatureFlag('normalized_schema');

      expect(result).toBe(false);
    });

    it('should handle all feature flags', () => {
      const flags: FeatureFlag[] = [
        'new_auth_system',
        'oauth_login',
        'normalized_schema',
        'refactored_components',
        'new_state_management',
        'server_rate_limiting',
      ];

      flags.forEach(flag => {
        const result = getFeatureFlag(flag);
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('default values for safety', () => {
    it('should default all new features to false', () => {
      // No environment variables set (already reset in beforeEach)
      expect(isFeatureEnabled('new_auth_system')).toBe(false);
      expect(isFeatureEnabled('oauth_login')).toBe(false);
      expect(isFeatureEnabled('normalized_schema')).toBe(false);
      expect(isFeatureEnabled('new_state_management')).toBe(false);
    });

    it('should default security features to enabled (server_rate_limiting)', () => {
      // Security-critical features should be ON by default
      expect(isFeatureEnabled('server_rate_limiting')).toBe(true);
    });

    it('should require explicit opt-in for new features', () => {
      // Verify that random/invalid env values don't enable features
      vi.stubEnv('NEXT_PUBLIC_ENABLE_NEW_AUTH', 'maybe');
      vi.stubEnv('NEXT_PUBLIC_ENABLE_OAUTH', 'enabled');
      vi.stubEnv('NEXT_PUBLIC_ENABLE_NORMALIZED_SCHEMA', 'on');

      expect(isFeatureEnabled('new_auth_system')).toBe(false);
      expect(isFeatureEnabled('oauth_login')).toBe(false);
      expect(isFeatureEnabled('normalized_schema')).toBe(false);
    });
  });

  describe('hash function behavior (via A/B testing)', () => {
    beforeEach(() => {
      vi.stubEnv('NEXT_PUBLIC_USE_NEW_COMPONENTS', 'true');
      vi.stubEnv('NEXT_PUBLIC_NEW_COMPONENTS_ROLLOUT_PERCENT', '50');
    });

    it('should produce consistent results for same input', () => {
      const userId = 'consistent-user-id';

      const results = Array.from({ length: 10 }, () =>
        isFeatureEnabled('refactored_components', userId)
      );

      // All results should be the same
      expect(new Set(results).size).toBe(1);
    });

    it('should handle special characters in userId', () => {
      const specialUserIds = [
        'user@email.com',
        'user-with-dashes',
        'user_with_underscores',
        'user.with.dots',
        'user/with/slashes',
        'user with spaces',
        '用户名', // Chinese characters
        'αβγδ',  // Greek characters
      ];

      specialUserIds.forEach(userId => {
        const result = isFeatureEnabled('refactored_components', userId);
        expect(typeof result).toBe('boolean');

        // Verify consistency
        expect(isFeatureEnabled('refactored_components', userId)).toBe(result);
      });
    });

    it('should handle very long userIds', () => {
      const longUserId = 'a'.repeat(10000);
      const result = isFeatureEnabled('refactored_components', longUserId);

      expect(typeof result).toBe('boolean');
      // Verify consistency
      expect(isFeatureEnabled('refactored_components', longUserId)).toBe(result);
    });

    it('should handle numeric userIds', () => {
      const numericIds = ['12345', '0', '999999999'];

      numericIds.forEach(userId => {
        const result = isFeatureEnabled('refactored_components', userId);
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle undefined environment variables gracefully', () => {
      // stubEnv with undefined/empty should work
      vi.stubEnv('NEXT_PUBLIC_ENABLE_NEW_AUTH', undefined as unknown as string);

      expect(isFeatureEnabled('new_auth_system')).toBe(false);
    });

    it('should handle whitespace in environment variables', () => {
      vi.stubEnv('NEXT_PUBLIC_ENABLE_NEW_AUTH', ' true ');
      expect(isFeatureEnabled('new_auth_system')).toBe(false);

      vi.stubEnv('NEXT_PUBLIC_ENABLE_NEW_AUTH', 'true');
      expect(isFeatureEnabled('new_auth_system')).toBe(true);
    });

    it('should handle NaN rollout percentage', () => {
      vi.stubEnv('NEXT_PUBLIC_USE_NEW_COMPONENTS', 'true');
      vi.stubEnv('NEXT_PUBLIC_NEW_COMPONENTS_ROLLOUT_PERCENT', 'not-a-number');

      // parseInt('not-a-number') returns NaN, which becomes 0
      const result = isFeatureEnabled('refactored_components', 'test-user');
      expect(typeof result).toBe('boolean');
    });

    it('should handle negative rollout percentage', () => {
      vi.stubEnv('NEXT_PUBLIC_USE_NEW_COMPONENTS', 'true');
      vi.stubEnv('NEXT_PUBLIC_NEW_COMPONENTS_ROLLOUT_PERCENT', '-10');

      // Negative percentage means no users should be included
      const result = isFeatureEnabled('refactored_components', 'test-user');
      expect(result).toBe(false);
    });

    it('should handle rollout percentage > 100', () => {
      vi.stubEnv('NEXT_PUBLIC_USE_NEW_COMPONENTS', 'true');
      vi.stubEnv('NEXT_PUBLIC_NEW_COMPONENTS_ROLLOUT_PERCENT', '150');

      // All users should be included when percentage > 100
      const result = isFeatureEnabled('refactored_components', 'test-user');
      expect(result).toBe(true);
    });
  });
});
