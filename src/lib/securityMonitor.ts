/**
 * Security Monitoring & SIEM Integration
 *
 * Centralized security event monitoring with:
 * - Real-time alerting via webhooks (Slack, PagerDuty, email)
 * - Structured log shipping for SIEM ingestion
 * - Security event aggregation and thresholds
 * - Anomaly detection for suspicious patterns
 *
 * Environment Variables:
 * - SECURITY_WEBHOOK_URL: Slack/Discord webhook for alerts
 * - SIEM_ENDPOINT: External SIEM ingestion endpoint (optional)
 * - SIEM_API_KEY: API key for SIEM authentication (optional)
 * - ALERT_EMAIL: Email for critical alerts (optional)
 */

import { logger } from './logger';

// ============================================================================
// Types
// ============================================================================

export enum SecurityEventType {
  // Authentication Events
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILURE = 'auth_failure',
  AUTH_LOCKOUT = 'auth_lockout',
  SESSION_CREATED = 'session_created',
  SESSION_EXPIRED = 'session_expired',
  SESSION_INVALID = 'session_invalid',

  // Authorization Events
  ACCESS_DENIED = 'access_denied',
  PRIVILEGE_ESCALATION_ATTEMPT = 'privilege_escalation_attempt',
  UNAUTHORIZED_API_ACCESS = 'unauthorized_api_access',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  RATE_LIMIT_BLOCKED = 'rate_limit_blocked',

  // Data Security
  SENSITIVE_DATA_ACCESS = 'sensitive_data_access',
  DATA_EXPORT = 'data_export',
  BULK_DELETE = 'bulk_delete',

  // API Security
  INVALID_API_KEY = 'invalid_api_key',
  API_ABUSE = 'api_abuse',
  CSRF_VIOLATION = 'csrf_violation',

  // Anomalies
  UNUSUAL_ACTIVITY = 'unusual_activity',
  GEOGRAPHIC_ANOMALY = 'geographic_anomaly',
  TIME_ANOMALY = 'time_anomaly',
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface SecurityEvent {
  type: SecurityEventType;
  severity: AlertSeverity;
  timestamp: string;
  userId?: string;
  userName?: string;
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

interface AlertThreshold {
  eventType: SecurityEventType;
  count: number;
  windowMs: number;
  severity: AlertSeverity;
}

// ============================================================================
// Configuration
// ============================================================================

// Alert thresholds - when these are exceeded, send immediate alerts
const ALERT_THRESHOLDS: AlertThreshold[] = [
  { eventType: SecurityEventType.AUTH_FAILURE, count: 5, windowMs: 300000, severity: AlertSeverity.HIGH },
  { eventType: SecurityEventType.AUTH_LOCKOUT, count: 1, windowMs: 60000, severity: AlertSeverity.HIGH },
  { eventType: SecurityEventType.RATE_LIMIT_EXCEEDED, count: 10, windowMs: 60000, severity: AlertSeverity.MEDIUM },
  { eventType: SecurityEventType.ACCESS_DENIED, count: 5, windowMs: 300000, severity: AlertSeverity.MEDIUM },
  { eventType: SecurityEventType.INVALID_API_KEY, count: 3, windowMs: 300000, severity: AlertSeverity.HIGH },
  { eventType: SecurityEventType.CSRF_VIOLATION, count: 1, windowMs: 60000, severity: AlertSeverity.CRITICAL },
  { eventType: SecurityEventType.PRIVILEGE_ESCALATION_ATTEMPT, count: 1, windowMs: 60000, severity: AlertSeverity.CRITICAL },
];

// Severity colors for Slack
const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  [AlertSeverity.LOW]: '#36a64f',      // Green
  [AlertSeverity.MEDIUM]: '#ff9800',   // Orange
  [AlertSeverity.HIGH]: '#f44336',     // Red
  [AlertSeverity.CRITICAL]: '#9c27b0', // Purple
};

// ============================================================================
// Event Storage (In-Memory with TTL)
// ============================================================================

interface StoredEvent {
  event: SecurityEvent;
  expiresAt: number;
}

// In-memory event store for threshold checking
// In production, this should use Redis for multi-instance support
const eventStore: Map<string, StoredEvent[]> = new Map();

function getEventKey(type: SecurityEventType, identifier?: string): string {
  return identifier ? `${type}:${identifier}` : type;
}

function storeEvent(event: SecurityEvent, identifier?: string): void {
  const key = getEventKey(event.type, identifier);
  const stored = eventStore.get(key) || [];

  // Add event with expiration
  stored.push({
    event,
    expiresAt: Date.now() + 3600000, // 1 hour TTL
  });

  // Clean expired events
  const now = Date.now();
  const active = stored.filter(e => e.expiresAt > now);

  eventStore.set(key, active);
}

function countRecentEvents(
  type: SecurityEventType,
  windowMs: number,
  identifier?: string
): number {
  const key = getEventKey(type, identifier);
  const stored = eventStore.get(key) || [];
  const cutoff = Date.now() - windowMs;

  return stored.filter(e =>
    new Date(e.event.timestamp).getTime() > cutoff
  ).length;
}

// ============================================================================
// Alerting
// ============================================================================

async function sendWebhookAlert(event: SecurityEvent, message: string): Promise<void> {
  const webhookUrl = process.env.SECURITY_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    // Format for Slack webhook
    const payload = {
      attachments: [
        {
          color: SEVERITY_COLORS[event.severity],
          title: `🚨 Security Alert: ${event.type}`,
          text: message,
          fields: [
            { title: 'Severity', value: event.severity.toUpperCase(), short: true },
            { title: 'Timestamp', value: event.timestamp, short: true },
            { title: 'User', value: event.userName || event.userId || 'Unknown', short: true },
            { title: 'IP Address', value: event.ip || 'Unknown', short: true },
            { title: 'Endpoint', value: event.endpoint || 'N/A', short: true },
          ],
          footer: 'Academic Project Manager Security Monitor',
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    logger.info('Security alert sent to webhook', {
      component: 'securityMonitor',
      action: 'sendWebhookAlert',
      eventType: event.type,
    });
  } catch (error) {
    logger.error('Failed to send webhook alert', error as Error, {
      component: 'securityMonitor',
      action: 'sendWebhookAlert',
    });
  }
}

async function sendToSIEM(event: SecurityEvent): Promise<void> {
  const siemEndpoint = process.env.SIEM_ENDPOINT;
  const siemApiKey = process.env.SIEM_API_KEY;

  if (!siemEndpoint) return;

  try {
    // Format as Common Event Format (CEF) style JSON
    const cefEvent = {
      version: '1.0',
      deviceVendor: 'AcademicProjectManager',
      deviceProduct: 'TodoList',
      deviceVersion: '1.0',
      signatureId: event.type,
      name: event.type,
      severity: severityToNumber(event.severity),
      timestamp: event.timestamp,
      src: event.ip,
      suser: event.userName || event.userId,
      requestUrl: event.endpoint,
      msg: JSON.stringify(event.details),
      cs1: event.userAgent,
      cs1Label: 'UserAgent',
      requestId: event.requestId,
    };

    await fetch(siemEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(siemApiKey && { 'Authorization': `Bearer ${siemApiKey}` }),
      },
      body: JSON.stringify(cefEvent),
    });
  } catch (error) {
    logger.error('Failed to send event to SIEM', error as Error, {
      component: 'securityMonitor',
      action: 'sendToSIEM',
    });
  }
}

function severityToNumber(severity: AlertSeverity): number {
  const mapping: Record<AlertSeverity, number> = {
    [AlertSeverity.LOW]: 3,
    [AlertSeverity.MEDIUM]: 5,
    [AlertSeverity.HIGH]: 8,
    [AlertSeverity.CRITICAL]: 10,
  };
  return mapping[severity];
}

// ============================================================================
// Main API
// ============================================================================

class SecurityMonitor {
  /**
   * Record a security event and check thresholds
   */
  async recordEvent(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    // Store event for threshold checking
    const identifier = event.userId || event.ip;
    storeEvent(fullEvent, identifier);

    // Log the event
    logger.security(`Security event: ${event.type}`, {
      ...event.details,
      severity: event.severity,
      ip: event.ip,
      endpoint: event.endpoint,
      userId: event.userId,
    });

    // Ship to SIEM
    await sendToSIEM(fullEvent);

    // Check thresholds and alert if needed
    await this.checkThresholds(fullEvent, identifier);
  }

  /**
   * Check if any alert thresholds have been exceeded
   */
  private async checkThresholds(
    event: SecurityEvent,
    identifier?: string
  ): Promise<void> {
    for (const threshold of ALERT_THRESHOLDS) {
      if (threshold.eventType !== event.type) continue;

      const count = countRecentEvents(
        event.type,
        threshold.windowMs,
        identifier
      );

      if (count >= threshold.count) {
        const message = this.formatAlertMessage(event, count, threshold);

        // Upgrade severity if threshold exceeded by large margin
        const escalatedSeverity = count >= threshold.count * 2
          ? this.escalateSeverity(threshold.severity)
          : threshold.severity;

        const alertEvent = { ...event, severity: escalatedSeverity };
        await sendWebhookAlert(alertEvent, message);

        // Log threshold exceeded
        logger.warn('Security threshold exceeded', {
          component: 'securityMonitor',
          eventType: event.type,
          count,
          threshold: threshold.count,
          windowMs: threshold.windowMs,
          identifier,
        });
      }
    }
  }

  private formatAlertMessage(
    event: SecurityEvent,
    count: number,
    threshold: AlertThreshold
  ): string {
    const windowMinutes = Math.round(threshold.windowMs / 60000);

    const messages: Record<SecurityEventType, string> = {
      [SecurityEventType.AUTH_FAILURE]: `${count} failed login attempts in ${windowMinutes} minutes`,
      [SecurityEventType.AUTH_LOCKOUT]: `Account locked due to repeated failures`,
      [SecurityEventType.AUTH_SUCCESS]: `Successful authentication`,
      [SecurityEventType.SESSION_CREATED]: `New session created`,
      [SecurityEventType.SESSION_EXPIRED]: `Session expired`,
      [SecurityEventType.SESSION_INVALID]: `Invalid session detected`,
      [SecurityEventType.ACCESS_DENIED]: `${count} access denied events in ${windowMinutes} minutes`,
      [SecurityEventType.PRIVILEGE_ESCALATION_ATTEMPT]: `Privilege escalation attempt detected!`,
      [SecurityEventType.UNAUTHORIZED_API_ACCESS]: `Unauthorized API access attempt`,
      [SecurityEventType.RATE_LIMIT_EXCEEDED]: `${count} rate limit violations in ${windowMinutes} minutes`,
      [SecurityEventType.RATE_LIMIT_BLOCKED]: `Request blocked due to rate limiting`,
      [SecurityEventType.SENSITIVE_DATA_ACCESS]: `Sensitive data accessed`,
      [SecurityEventType.DATA_EXPORT]: `Data export initiated`,
      [SecurityEventType.BULK_DELETE]: `Bulk delete operation performed`,
      [SecurityEventType.INVALID_API_KEY]: `${count} invalid API key attempts in ${windowMinutes} minutes`,
      [SecurityEventType.API_ABUSE]: `Potential API abuse detected`,
      [SecurityEventType.CSRF_VIOLATION]: `CSRF token validation failed - possible attack`,
      [SecurityEventType.UNUSUAL_ACTIVITY]: `Unusual activity pattern detected`,
      [SecurityEventType.GEOGRAPHIC_ANOMALY]: `Login from unusual geographic location`,
      [SecurityEventType.TIME_ANOMALY]: `Activity at unusual time`,
    };

    return messages[event.type] || `Security event: ${event.type}`;
  }

  private escalateSeverity(current: AlertSeverity): AlertSeverity {
    const order = [AlertSeverity.LOW, AlertSeverity.MEDIUM, AlertSeverity.HIGH, AlertSeverity.CRITICAL];
    const currentIndex = order.indexOf(current);
    return order[Math.min(currentIndex + 1, order.length - 1)];
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  async authSuccess(userId: string, userName: string, ip?: string): Promise<void> {
    await this.recordEvent({
      type: SecurityEventType.AUTH_SUCCESS,
      severity: AlertSeverity.LOW,
      userId,
      userName,
      ip,
    });
  }

  async authFailure(userName: string, ip?: string, reason?: string): Promise<void> {
    await this.recordEvent({
      type: SecurityEventType.AUTH_FAILURE,
      severity: AlertSeverity.MEDIUM,
      userName,
      ip,
      details: { reason },
    });
  }

  async authLockout(userName: string, ip?: string, attempts?: number): Promise<void> {
    await this.recordEvent({
      type: SecurityEventType.AUTH_LOCKOUT,
      severity: AlertSeverity.HIGH,
      userName,
      ip,
      details: { attempts },
    });
  }

  async accessDenied(
    userId: string,
    userName: string,
    endpoint: string,
    ip?: string
  ): Promise<void> {
    await this.recordEvent({
      type: SecurityEventType.ACCESS_DENIED,
      severity: AlertSeverity.MEDIUM,
      userId,
      userName,
      endpoint,
      ip,
    });
  }

  async rateLimitExceeded(
    identifier: string,
    endpoint: string,
    ip?: string
  ): Promise<void> {
    await this.recordEvent({
      type: SecurityEventType.RATE_LIMIT_EXCEEDED,
      severity: AlertSeverity.MEDIUM,
      userId: identifier,
      endpoint,
      ip,
    });
  }

  async invalidApiKey(endpoint: string, ip?: string): Promise<void> {
    await this.recordEvent({
      type: SecurityEventType.INVALID_API_KEY,
      severity: AlertSeverity.HIGH,
      endpoint,
      ip,
    });
  }

  async csrfViolation(
    endpoint: string,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    await this.recordEvent({
      type: SecurityEventType.CSRF_VIOLATION,
      severity: AlertSeverity.CRITICAL,
      endpoint,
      ip,
      userAgent,
    });
  }

  async privilegeEscalation(
    userId: string,
    userName: string,
    attemptedAction: string,
    ip?: string
  ): Promise<void> {
    await this.recordEvent({
      type: SecurityEventType.PRIVILEGE_ESCALATION_ATTEMPT,
      severity: AlertSeverity.CRITICAL,
      userId,
      userName,
      ip,
      details: { attemptedAction },
    });
  }

  /**
   * Get recent security events summary (for dashboard)
   */
  getRecentEventsSummary(): Record<SecurityEventType, number> {
    const summary: Partial<Record<SecurityEventType, number>> = {};
    const windowMs = 3600000; // Last hour

    for (const type of Object.values(SecurityEventType)) {
      const count = countRecentEvents(type, windowMs);
      if (count > 0) {
        summary[type] = count;
      }
    }

    return summary as Record<SecurityEventType, number>;
  }
}

export const securityMonitor = new SecurityMonitor();
