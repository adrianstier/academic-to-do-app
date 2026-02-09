/**
 * Security Events API
 *
 * Provides access to security event data for monitoring dashboard.
 * Restricted to owner/admin users only via withTeamAdminAuth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { withTeamAdminAuth, TeamAuthContext } from '@/lib/teamAuth';
import { securityMonitor } from '@/lib/securityMonitor';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/security/events - Get security event summary and recent events
 */
export const GET = withTeamAdminAuth(async (request: NextRequest, _context: TeamAuthContext) => {
  try {
    const { searchParams } = new URL(request.url);
    const hours = Math.min(parseInt(searchParams.get('hours') || '24', 10) || 24, 168);

    // Get in-memory event summary
    const eventSummary = securityMonitor.getRecentEventsSummary();

    // Get recent events from database
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    // Fetch from security_audit_log
    const { data: auditLogs, error: auditError } = await supabase
      .from('security_audit_log')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100);

    if (auditError) {
      logger.error('Failed to fetch audit logs', auditError, {
        component: 'api/security/events',
      });
    }

    // Fetch from auth_failure_log
    const { data: authFailures, error: authError } = await supabase
      .from('auth_failure_log')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50);

    if (authError) {
      logger.error('Failed to fetch auth failure logs', authError, {
        component: 'api/security/events',
      });
    }

    // Calculate statistics
    const stats = {
      totalEvents: (auditLogs?.length || 0) + (authFailures?.length || 0),
      authFailures: authFailures?.length || 0,
      uniqueIPs: new Set([
        ...(auditLogs || []).map(l => l.ip_address).filter(Boolean),
        ...(authFailures || []).map(l => l.ip_address).filter(Boolean),
      ]).size,
      timeRange: `${hours} hours`,
    };

    // Group auth failures by user
    const failuresByUser: Record<string, number> = {};
    (authFailures || []).forEach(f => {
      const key = f.attempted_user || 'unknown';
      failuresByUser[key] = (failuresByUser[key] || 0) + 1;
    });

    // Group events by type
    const eventsByType: Record<string, number> = {};
    (auditLogs || []).forEach(l => {
      const key = l.event_type || 'unknown';
      eventsByType[key] = (eventsByType[key] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      data: {
        summary: eventSummary,
        stats,
        failuresByUser,
        eventsByType,
        recentAuditLogs: auditLogs?.slice(0, 20) || [],
        recentAuthFailures: authFailures?.slice(0, 20) || [],
      },
    });
  } catch (error) {
    logger.error('Error fetching security events', error as Error, {
      component: 'api/security/events',
    });
    return NextResponse.json(
      { error: 'Failed to fetch security events' },
      { status: 500 }
    );
  }
});
