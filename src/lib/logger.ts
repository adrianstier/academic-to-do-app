/**
 * Centralized Logging System
 *
 * Provides structured logging with different severity levels
 * and automatic error tracking integration with Sentry.
 */

import * as Sentry from '@sentry/nextjs';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  userId?: string;
  action?: string;
  component?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  // Allow any additional fields for flexibility
  [key: string]: unknown;
}

class Logger {
  /**
   * Debug level logging - only in development
   */
  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, context);
    }
  }

  /**
   * Info level logging - general information
   */
  info(message: string, context?: LogContext): void {
    console.info(`[INFO] ${message}`, context);

    // Send to analytics if needed
    if (process.env.NODE_ENV === 'production') {
      // Could send to analytics service here
    }
  }

  /**
   * Warning level logging - potential issues
   */
  warn(message: string, context?: LogContext): void {
    console.warn(`[WARN] ${message}`, context);

    // Send to Sentry as breadcrumb
    Sentry.addBreadcrumb({
      category: 'warning',
      message,
      level: 'warning',
      data: context,
    });
  }

  /**
   * Error level logging - critical issues
   * Accepts Error object or any unknown error value
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorObj = error instanceof Error ? error : new Error(String(error ?? message));
    console.error(`[ERROR] ${message}`, errorObj, context);

    // Send to Sentry
    Sentry.captureException(errorObj, {
      extra: { message, ...context },
      tags: {
        component: context?.component,
        action: context?.action,
      },
    });
  }

  /**
   * Performance logging - track slow operations
   */
  performance(operation: string, duration: number, context?: LogContext): void {
    const logMessage = `[PERF] ${operation} took ${duration}ms`;

    if (duration > 1000) {
      // Log slow operations as warnings
      this.warn(logMessage, { ...context, duration });
    } else if (process.env.NODE_ENV === 'development') {
      this.debug(logMessage, { ...context, duration });
    }
  }

  /**
   * Start a performance timer
   */
  startTimer(): () => number {
    const start = performance.now();
    return () => performance.now() - start;
  }
}

export const logger = new Logger();

/**
 * Decorator for async functions to automatically log errors
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withErrorLogging<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: { component: string; action: string }
): T {
  return (async (...args: Parameters<T>) => {
    const timer = logger.startTimer();

    try {
      const result = await fn(...args);
      const duration = timer();

      logger.performance(
        `${context.component}.${context.action}`,
        duration,
        context
      );

      return result;
    } catch (error) {
      logger.error(
        `Error in ${context.component}.${context.action}`,
        error as Error,
        context
      );
      throw error;
    }
  }) as T;
}

/**
 * HOC for React components to catch and log errors
 * NOTE: Commented out due to JSX in .ts file - move to separate .tsx file if needed
 */
// export function withErrorBoundary<P extends object>(
//   Component: React.ComponentType<P>,
//   componentName: string
// ): React.ComponentType<P> {
//   return class ErrorBoundaryWrapper extends React.Component<
//     P,
//     { hasError: boolean }
//   > {
//     constructor(props: P) {
//       super(props);
//       this.state = { hasError: false };
//     }

//     static getDerivedStateFromError() {
//       return { hasError: true };
//     }

//     componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
//       logger.error(
//         `React component error in ${componentName}`,
//         error,
//         {
//           component: componentName,
//           componentStack: errorInfo.componentStack,
//         }
//       );
//     }

//     render() {
//       if (this.state.hasError) {
//         return null; // Would need JSX here
//       }

//       return <Component {...this.props} />;
//     }
//   };
// }
