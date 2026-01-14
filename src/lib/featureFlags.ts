/**
 * Feature Flags System
 *
 * Enables gradual rollout of new features without breaking existing functionality.
 * All flags default to FALSE (old system) for safety.
 */

export type FeatureFlag =
  | 'new_auth_system'
  | 'oauth_login'
  | 'normalized_schema'
  | 'refactored_components'
  | 'new_state_management'
  | 'server_rate_limiting';

interface FeatureFlagConfig {
  enabled: boolean;
  description: string;
  rolloutPercentage?: number; // For A/B testing (0-100)
}

/**
 * Feature flag configuration
 * Control via environment variables for easy deployment configuration
 */
const FEATURE_FLAGS: Record<FeatureFlag, () => FeatureFlagConfig> = {
  new_auth_system: () => ({
    enabled: process.env.NEXT_PUBLIC_ENABLE_NEW_AUTH === 'true',
    description: 'Enhanced authentication with Argon2 hashing',
  }),

  oauth_login: () => ({
    enabled: process.env.NEXT_PUBLIC_ENABLE_OAUTH === 'true' || process.env.NEXT_PUBLIC_USE_OAUTH === 'true',
    description: 'OAuth 2.0 login (Google/Apple)',
  }),

  normalized_schema: () => ({
    enabled: process.env.NEXT_PUBLIC_ENABLE_NORMALIZED_SCHEMA === 'true',
    description: 'Normalized database schema (subtasks/attachments in separate tables)',
  }),

  refactored_components: () => ({
    enabled: process.env.NEXT_PUBLIC_USE_NEW_COMPONENTS === 'true',
    description: 'Refactored modular components',
    rolloutPercentage: parseInt(process.env.NEXT_PUBLIC_NEW_COMPONENTS_ROLLOUT_PERCENT || '0', 10),
  }),

  new_state_management: () => ({
    enabled: process.env.NEXT_PUBLIC_USE_ZUSTAND === 'true',
    description: 'Zustand state management',
  }),

  server_rate_limiting: () => ({
    // SECURITY: Rate limiting is now ENABLED by default
    // Set DISABLE_RATE_LIMITING=true to disable (not recommended)
    enabled: process.env.DISABLE_RATE_LIMITING !== 'true',
    description: 'Server-side rate limiting with Upstash Redis (enabled by default)',
  }),
};

/**
 * Check if a feature flag is enabled
 *
 * @param flag - The feature flag to check
 * @param userId - Optional user ID for A/B testing
 * @returns Whether the feature is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag, userId?: string): boolean {
  const config = FEATURE_FLAGS[flag]();

  if (!config.enabled) {
    return false;
  }

  // If rollout percentage is set, use it for A/B testing
  if (config.rolloutPercentage !== undefined && userId) {
    const hash = simpleHash(userId);
    const bucket = hash % 100;
    return bucket < config.rolloutPercentage;
  }

  return true;
}

/**
 * Get all feature flags and their states
 * Useful for debugging and admin dashboards
 */
export function getAllFeatureFlags(): Record<FeatureFlag, FeatureFlagConfig> {
  const result = {} as Record<FeatureFlag, FeatureFlagConfig>;

  for (const [key, getValue] of Object.entries(FEATURE_FLAGS)) {
    result[key as FeatureFlag] = getValue();
  }

  return result;
}

/**
 * Simple hash function for A/B testing bucketing
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Hook for using feature flags in React components
 */
export function useFeatureFlag(flag: FeatureFlag, userId?: string): boolean {
  return isFeatureEnabled(flag, userId);
}
