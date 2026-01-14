/**
 * Secure Structured Logger
 *
 * Provides structured logging with automatic sensitive data filtering
 * for production environments.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

// Log level hierarchy
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Get current log level from environment
const getCurrentLogLevel = (): LogLevel => {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel;
  }
  // Default to 'info' in production, 'debug' in development
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
};

// Sensitive field names to redact
const SENSITIVE_FIELDS = new Set([
  'password',
  'pin',
  'pin_hash',
  'token',
  'session_token',
  'api_key',
  'apikey',
  'secret',
  'authorization',
  'auth',
  'credentials',
  'credit_card',
  'ssn',
  'social_security',
  'cookie',
  'private_key',
  'secret_key',
]);

// Patterns to redact in values
const SENSITIVE_VALUE_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
  /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/gi, // Bearer tokens
  /\b[A-Za-z0-9]{32,}\b/g, // Long tokens/keys (32+ chars)
];

/**
 * Recursively sanitize an object, redacting sensitive fields
 */
function sanitizeLogData(data: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[MAX_DEPTH]';
  }

  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    let sanitized = data;
    for (const pattern of SENSITIVE_VALUE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    // Truncate very long strings
    if (sanitized.length > 1000) {
      return sanitized.substring(0, 1000) + '...[TRUNCATED]';
    }
    return sanitized;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (data instanceof Error) {
    return {
      name: data.name,
      message: sanitizeLogData(data.message, depth + 1),
      // Only include stack in development
      ...(process.env.NODE_ENV !== 'production' && { stack: data.stack }),
    };
  }

  if (Array.isArray(data)) {
    return data.slice(0, 100).map((item) => sanitizeLogData(item, depth + 1));
  }

  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.has(lowerKey)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeLogData(value, depth + 1);
      }
    }
    return sanitized;
  }

  return '[UNKNOWN_TYPE]';
}

/**
 * Format log entry for output
 */
function formatLogEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'production') {
    // JSON format for production (better for log aggregation)
    return JSON.stringify(entry);
  } else {
    // Human-readable format for development
    const { level, message, timestamp, ...rest } = entry;
    const extras = Object.keys(rest).length > 0
      ? '\n' + JSON.stringify(rest, null, 2)
      : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${extras}`;
  }
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  const currentLevel = getCurrentLogLevel();

  // Skip if log level is below threshold
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) {
    return;
  }

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(data && (sanitizeLogData(data) as Record<string, unknown>)),
  };

  const formatted = formatLogEntry(entry);

  switch (level) {
    case 'debug':
    case 'info':
      console.log(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
  }
}

/**
 * Secure logger instance
 */
export const logger = {
  /**
   * Debug level - development only
   */
  debug(message: string, data?: Record<string, unknown>): void {
    log('debug', message, data);
  },

  /**
   * Info level - general information
   */
  info(message: string, data?: Record<string, unknown>): void {
    log('info', message, data);
  },

  /**
   * Warning level - potential issues
   */
  warn(message: string, data?: Record<string, unknown>): void {
    log('warn', message, data);
  },

  /**
   * Error level - errors and exceptions
   */
  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    const errorData = error instanceof Error
      ? { error: sanitizeLogData(error) }
      : error
        ? { error: sanitizeLogData(error) }
        : {};

    log('error', message, { ...errorData, ...data });
  },

  /**
   * Log an API request (sanitized)
   */
  apiRequest(
    method: string,
    path: string,
    data?: {
      userId?: string;
      ip?: string;
      userAgent?: string;
      statusCode?: number;
      duration?: number;
    }
  ): void {
    log('info', `${method} ${path}`, {
      type: 'api_request',
      ...data,
    });
  },

  /**
   * Log a security event
   */
  security(
    event: string,
    data?: Record<string, unknown>
  ): void {
    log('warn', `Security: ${event}`, {
      type: 'security_event',
      ...data,
    });
  },

  /**
   * Log an AI API call
   */
  aiCall(
    endpoint: string,
    data?: {
      userId?: string;
      model?: string;
      inputTokens?: number;
      outputTokens?: number;
      duration?: number;
    }
  ): void {
    log('info', `AI Call: ${endpoint}`, {
      type: 'ai_call',
      ...data,
    });
  },
};

export default logger;
