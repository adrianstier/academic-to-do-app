'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Loader2 } from 'lucide-react';
import {
  isPushSupported,
  getNotificationPermission,
  enablePushNotifications,
  getCurrentSubscription,
} from '@/lib/webPushService';
import type { AuthUser } from '@/types/todo';

interface NotificationPermissionBannerProps {
  currentUser: AuthUser;
}

export default function NotificationPermissionBanner({
  currentUser,
}: NotificationPermissionBannerProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if we should show the banner
    const checkPermissionStatus = async () => {
      // Don't show if push not supported
      if (!isPushSupported()) {
        return;
      }

      // Don't show if permission already decided
      const permission = getNotificationPermission();
      if (permission !== 'default') {
        return;
      }

      // Don't show if user has dismissed the banner recently
      const dismissedAt = localStorage.getItem('notificationBannerDismissed');
      if (dismissedAt) {
        const dismissedDate = new Date(dismissedAt);
        const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
        // Show again after 7 days
        if (daysSinceDismissed < 7) {
          return;
        }
      }

      // Check if already subscribed
      const subscription = await getCurrentSubscription();
      if (subscription) {
        return;
      }

      // Show the banner after a short delay
      setTimeout(() => setVisible(true), 2000);
    };

    checkPermissionStatus();
  }, []);

  const handleEnable = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await enablePushNotifications(currentUser.id, currentUser.name);

      if (result.success) {
        setVisible(false);
      } else {
        setError(result.error || 'Failed to enable notifications');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error enabling notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser.id, currentUser.name]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem('notificationBannerDismissed', new Date().toISOString());
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50"
        >
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xl">
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-[var(--brand-blue)]/10 flex items-center justify-center flex-shrink-0">
                <Bell className="w-5 h-5 text-[var(--brand-blue)]" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-[var(--foreground)] text-sm">
                  Enable Notifications
                </h4>
                <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                  Get reminded about upcoming task deadlines so you never miss important work.
                </p>

                {/* Error message */}
                {error && (
                  <p className="text-xs text-red-500 mt-2">{error}</p>
                )}

                {/* Buttons */}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={handleEnable}
                    disabled={loading}
                    className="px-4 py-2 bg-[var(--brand-blue)] text-white rounded-lg text-sm font-medium hover:bg-[var(--brand-blue)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enabling...
                      </>
                    ) : (
                      'Enable'
                    )}
                  </button>
                  <button
                    onClick={handleDismiss}
                    disabled={loading}
                    className="px-4 py-2 text-[var(--text-muted)] text-sm hover:text-[var(--foreground)] transition-colors"
                  >
                    Not now
                  </button>
                </div>
              </div>

              {/* Close button */}
              <button
                onClick={handleDismiss}
                disabled={loading}
                className="p-1.5 hover:bg-[var(--surface-2)] rounded-lg transition-colors flex-shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
