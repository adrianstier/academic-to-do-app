'use client';

/**
 * SSO Login Button
 *
 * A login button for the sign-in page that initiates institutional
 * SSO (SAML) authentication. Shows the configured university name
 * and redirects to the IdP when clicked.
 *
 * Props:
 *   - provider: The configured SSO provider (optional — shows generic
 *     "Sign in with SSO" if not provided)
 *   - onLogin: Callback when login is initiated
 */

import { useState } from 'react';
import { Shield, Loader2 } from 'lucide-react';
import type { SSOProvider } from '@/types/sso';

// ============================================
// Types
// ============================================

interface SSOLoginButtonProps {
  /** The configured SSO provider. If not provided, shows a generic SSO button. */
  provider?: SSOProvider;
  /** Callback invoked when the user clicks the button to initiate SSO login. */
  onLogin: () => void;
}

// ============================================
// Component
// ============================================

export default function SSOLoginButton({ provider, onLogin }: SSOLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (isLoading) return;

    setIsLoading(true);

    try {
      if (!provider) {
        setIsLoading(false);
        return;
      }

      // Call the onLogin callback before redirecting
      onLogin();

      // Redirect to the SSO initiation endpoint
      window.location.href = `/api/auth/sso?provider=${encodeURIComponent(provider.id)}`;
    } catch {
      setIsLoading(false);
    }

    // Don't reset loading — the browser will navigate away.
    // If navigation fails, reset after a timeout.
    setTimeout(() => setIsLoading(false), 10000);
  };

  const buttonLabel = provider
    ? `Sign in with ${provider.name}`
    : 'Sign in with SSO';

  const isDisabled = isLoading || (!provider);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        className={`
          w-full flex items-center justify-center gap-2.5
          px-4 py-3 rounded-lg
          font-medium text-sm
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-navy)]
          ${isDisabled
            ? 'bg-[var(--surface-3)] text-[var(--text-muted)] cursor-not-allowed'
            : 'bg-[var(--brand-navy)] hover:bg-[var(--brand-blue)] active:bg-[var(--accent-dark)] text-white shadow-sm hover:shadow'
          }
        `}
        aria-label={buttonLabel}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Redirecting to {provider?.name || 'SSO'}...</span>
          </>
        ) : (
          <>
            <Shield className="w-4 h-4" />
            <span>{buttonLabel}</span>
          </>
        )}
      </button>

      {/* Subtitle */}
      <p className="mt-1.5 text-center text-xs text-[var(--text-muted)]">
        {provider
          ? 'Institutional single sign-on'
          : 'SSO is not configured for this team'
        }
      </p>
    </div>
  );
}
