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

/**
 * Sensitive data patterns to filter from logs
 */
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // SSN patterns (with optional hyphens, e.g. 123-45-6789 or 123456789)
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN REDACTED]' },
  { pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g, replacement: '[POSSIBLE SSN REDACTED]' },
  // Credit card patterns
  { pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, replacement: '[CARD REDACTED]' },
  // PIN patterns (4-6 digits that look like PINs)
  { pattern: /\bpin[_\s]*[:=]\s*['"]?\d{4,6}['"]?/gi, replacement: 'pin=[PIN REDACTED]' },
  { pattern: /pin_hash['"]*\s*[:=]\s*['"][^'"]+['"]/gi, replacement: 'pin_hash=[HASH REDACTED]' },
  // Session tokens
  { pattern: /session[_\s]*token['"]*\s*[:=]\s*['"][^'"]+['"]/gi, replacement: 'session_token=[TOKEN REDACTED]' },
  { pattern: /bearer\s+[a-zA-Z0-9_\-\.]+/gi, replacement: 'Bearer [TOKEN REDACTED]' },
  // API keys
  { pattern: /api[_\s]*key['"]*\s*[:=]\s*['"][^'"]+['"]/gi, replacement: 'api_key=[KEY REDACTED]' },
  { pattern: /x-api-key['"]*\s*[:=]\s*['"][^'"]+['"]/gi, replacement: 'x-api-key=[KEY REDACTED]' },
  // Passwords
  { pattern: /password['"]*\s*[:=]\s*['"][^'"]+['"]/gi, replacement: 'password=[REDACTED]' },
  // Email addresses (partial redaction)
  { pattern: /\b([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g, replacement: '[EMAIL REDACTED]' },
  // Policy numbers (common insurance format)
  { pattern: /\b[A-Z]{2,3}\d{6,10}\b/g, replacement: '[POLICY# REDACTED]' },
  // Account numbers
  { pattern: /account[_\s]*(?:number|num|#)?['"]*\s*[:=]\s*['"]?\d{6,}['"]?/gi, replacement: 'account=[ACCT REDACTED]' },
];

/**
 * Sanitize sensitive data from log messages and context
 */
function sanitizeSensitiveData(input: unknown): unknown {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    let sanitized = input;
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, replacement);
    }
    return sanitized;
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeSensitiveData);
  }

  if (typeof input === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      // Redact known sensitive field names entirely
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('pin_hash') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') && !lowerKey.includes('csrf') ||
        lowerKey.includes('api_key') ||
        lowerKey.includes('apikey') ||
        lowerKey === 'ssn' ||
        lowerKey === 'creditcard' ||
        lowerKey === 'cardnumber'
      ) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeSensitiveData(value);
      }
    }
    return sanitized;
  }

  return input;
}

class Logger {
  /**
   * Debug level logging - only in development
   * Automatically sanitizes sensitive data
   */
  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      const sanitizedMessage = sanitizeSensitiveData(message) as string;
      const sanitizedContext = sanitizeSensitiveData(context) as LogContext | undefined;
      console.debug(`[DEBUG] ${sanitizedMessage}`, sanitizedContext);
    }
  }

  /**
   * Info level logging - general information
   * Automatically sanitizes sensitive data
   */
  info(message: string, context?: LogContext): void {
    const sanitizedMessage = sanitizeSensitiveData(message) as string;
    const sanitizedContext = sanitizeSensitiveData(context) as LogContext | undefined;
    console.info(`[INFO] ${sanitizedMessage}`, sanitizedContext);

    // Send to analytics if needed
    if (process.env.NODE_ENV === 'production') {
      // Could send to analytics service here
    }
  }

  /**
   * Warning level logging - potential issues
   * Automatically sanitizes sensitive data
   */
  warn(message: string, context?: LogContext): void {
    const sanitizedMessage = sanitizeSensitiveData(message) as string;
    const sanitizedContext = sanitizeSensitiveData(context) as LogContext | undefined;
    console.warn(`[WARN] ${sanitizedMessage}`, sanitizedContext);

    // Send to Sentry as breadcrumb
    Sentry.addBreadcrumb({
      category: 'warning',
      message: sanitizedMessage,
      level: 'warning',
      data: sanitizedContext,
    });
  }

  /**
   * Error level logging - critical issues
   * Accepts Error object or any unknown error value
   * Automatically sanitizes sensitive data
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const sanitizedMessage = sanitizeSensitiveData(message) as string;
    const sanitizedContext = sanitizeSensitiveData(context) as LogContext | undefined;

    // Sanitize error message but preserve stack trace structure
    const errorObj = error instanceof Error ? error : new Error(String(error ?? message));
    const sanitizedErrorMessage = sanitizeSensitiveData(errorObj.message) as string;
    const sanitizedError = new Error(sanitizedErrorMessage);
    sanitizedError.stack = errorObj.stack;

    console.error(`[ERROR] ${sanitizedMessage}`, sanitizedError, sanitizedContext);

    // Send to Sentry
    Sentry.captureException(sanitizedError, {
      extra: { message: sanitizedMessage, ...sanitizedContext },
      tags: {
        component: sanitizedContext?.component,
        action: sanitizedContext?.action,
      },
    });
  }

  /**
   * Security event logging - for auth failures and security incidents
   * Always logs regardless of environment
   */
  security(event: string, context?: LogContext & { ip?: string; endpoint?: string }): void {
    const sanitizedContext = sanitizeSensitiveData(context) as LogContext | undefined;
    const timestamp = new Date().toISOString();
    console.warn(`[SECURITY] ${timestamp} ${event}`, sanitizedContext);

    // Always send security events to Sentry
    Sentry.addBreadcrumb({
      category: 'security',
      message: event,
      level: 'warning',
      data: sanitizedContext,
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
