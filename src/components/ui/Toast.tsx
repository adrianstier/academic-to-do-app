'use client';

import { useState, useEffect, createContext, useContext, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';

// Toast types
export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'loading';
export type ToastPosition = 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
  dismissible?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  updateToast: (id: string, toast: Partial<Toast>) => void;
  dismissToast: (id: string) => void;
  dismissAllToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Toast configuration by variant
const variantConfig: Record<ToastVariant, {
  icon: typeof CheckCircle2;
  bgClass: string;
  iconColor: string;
  progressColor: string;
}> = {
  success: {
    icon: CheckCircle2,
    bgClass: 'bg-[var(--surface)] border-[var(--success)]/30',
    iconColor: 'text-[var(--success)]',
    progressColor: 'var(--success)',
  },
  error: {
    icon: AlertCircle,
    bgClass: 'bg-[var(--surface)] border-[var(--danger)]/30',
    iconColor: 'text-[var(--danger)]',
    progressColor: 'var(--danger)',
  },
  warning: {
    icon: AlertTriangle,
    bgClass: 'bg-[var(--surface)] border-[var(--warning)]/30',
    iconColor: 'text-[var(--warning)]',
    progressColor: 'var(--warning)',
  },
  info: {
    icon: Info,
    bgClass: 'bg-[var(--surface)] border-[var(--accent)]/30',
    iconColor: 'text-[var(--accent)]',
    progressColor: 'var(--accent)',
  },
  loading: {
    icon: Loader2,
    bgClass: 'bg-[var(--surface)] border-[var(--accent)]/30',
    iconColor: 'text-[var(--accent)]',
    progressColor: 'var(--accent)',
  },
};

// Position configurations
const positionClasses: Record<ToastPosition, string> = {
  'top-right': 'top-4 right-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-4 right-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
};

const positionAnimations: Record<ToastPosition, { initial: { opacity: number; x: number; y: number }; animate: { opacity: number; x: number; y: number }; exit: { opacity: number; x: number; y: number } }> = {
  'top-right': {
    initial: { opacity: 0, x: 50, y: 0 },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: 50, y: 0 },
  },
  'top-center': {
    initial: { opacity: 0, x: 0, y: -20 },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: 0, y: -20 },
  },
  'bottom-right': {
    initial: { opacity: 0, x: 50, y: 0 },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: 50, y: 0 },
  },
  'bottom-center': {
    initial: { opacity: 0, x: 0, y: 20 },
    animate: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: 0, y: 20 },
  },
};

/**
 * Individual Toast Component
 */
interface ToastItemProps {
  toast: Toast;
  position: ToastPosition;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, position, onDismiss }: ToastItemProps) {
  const [progress, setProgress] = useState(100);
  const config = variantConfig[toast.variant];
  const Icon = config.icon;
  const isLoading = toast.variant === 'loading';
  const duration = toast.duration ?? (isLoading ? 0 : 5000);
  const dismissible = toast.dismissible ?? !isLoading;
  const animation = positionAnimations[position];

  // Auto-dismiss timer with progress
  useEffect(() => {
    if (duration === 0) return;

    const startTime = Date.now();
    const endTime = startTime + duration;

    const updateProgress = () => {
      const now = Date.now();
      const remaining = endTime - now;
      const newProgress = (remaining / duration) * 100;

      if (newProgress <= 0) {
        onDismiss(toast.id);
      } else {
        setProgress(newProgress);
        requestAnimationFrame(updateProgress);
      }
    };

    const animationId = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(animationId);
  }, [duration, toast.id, onDismiss]);

  return (
    <motion.div
      layout
      initial={animation.initial}
      animate={animation.animate}
      exit={animation.exit}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className={`
        relative overflow-hidden
        w-[360px] max-w-[calc(100vw-32px)]
        rounded-xl border shadow-lg
        ${config.bgClass}
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <div className={`flex-shrink-0 ${config.iconColor}`}>
          <Icon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--foreground)]">
            {toast.title}
          </p>
          {toast.description && (
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {toast.description}
            </p>
          )}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="mt-2 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>

        {/* Dismiss button */}
        {dismissible && (
          <button
            onClick={() => onDismiss(toast.id)}
            className="flex-shrink-0 p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--surface-2)]">
          <motion.div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              backgroundColor: config.progressColor,
            }}
            transition={{ duration: 0.1 }}
          />
        </div>
      )}
    </motion.div>
  );
}

/**
 * Toast Provider Component
 */
export interface ToastProviderProps {
  children: ReactNode;
  position?: ToastPosition;
  maxToasts?: number;
}

export function ToastProvider({
  children,
  position = 'top-right',
  maxToasts = 5,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    setToasts((prev) => {
      const newToasts = [{ ...toast, id }, ...prev];
      // Limit number of toasts
      return newToasts.slice(0, maxToasts);
    });

    return id;
  }, [maxToasts]);

  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts((prev) =>
      prev.map((toast) =>
        toast.id === id ? { ...toast, ...updates } : toast
      )
    );
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const dismissAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider
      value={{ toasts, addToast, updateToast, dismissToast, dismissAllToasts }}
    >
      {children}

      {/* Toast container */}
      <div
        className={`fixed z-[100] flex flex-col gap-3 pointer-events-none ${positionClasses[position]}`}
        aria-label="Notifications"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem
                toast={toast}
                position={position}
                onDismiss={dismissToast}
              />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Hook to use toast functionality
 */
export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  const { addToast, updateToast, dismissToast, dismissAllToasts } = context;

  // Convenience methods
  const toast = {
    success: (title: string, options?: Partial<Omit<Toast, 'id' | 'variant' | 'title'>>) =>
      addToast({ variant: 'success', title, ...options }),

    error: (title: string, options?: Partial<Omit<Toast, 'id' | 'variant' | 'title'>>) =>
      addToast({ variant: 'error', title, ...options }),

    warning: (title: string, options?: Partial<Omit<Toast, 'id' | 'variant' | 'title'>>) =>
      addToast({ variant: 'warning', title, ...options }),

    info: (title: string, options?: Partial<Omit<Toast, 'id' | 'variant' | 'title'>>) =>
      addToast({ variant: 'info', title, ...options }),

    loading: (title: string, options?: Partial<Omit<Toast, 'id' | 'variant' | 'title'>>) =>
      addToast({ variant: 'loading', title, duration: 0, dismissible: false, ...options }),

    promise: async <T,>(
      promise: Promise<T>,
      {
        loading,
        success,
        error,
      }: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((err: unknown) => string);
      }
    ): Promise<T> => {
      const id = addToast({ variant: 'loading', title: loading, duration: 0, dismissible: false });

      try {
        const result = await promise;
        updateToast(id, {
          variant: 'success',
          title: typeof success === 'function' ? success(result) : success,
          duration: 5000,
          dismissible: true,
        });
        return result;
      } catch (err) {
        updateToast(id, {
          variant: 'error',
          title: typeof error === 'function' ? error(err) : error,
          duration: 5000,
          dismissible: true,
        });
        throw err;
      }
    },

    dismiss: dismissToast,
    dismissAll: dismissAllToasts,
    update: updateToast,
    custom: addToast,
  };

  return toast;
}

export default ToastProvider;
