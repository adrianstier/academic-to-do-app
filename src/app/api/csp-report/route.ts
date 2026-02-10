import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/secureLogger';

/**
 * CSP Violation Report Endpoint
 *
 * Receives Content Security Policy violation reports from browsers.
 * Used to monitor and debug CSP issues without breaking functionality.
 */

// Old CSP report format
interface OldCspReport {
  'document-uri'?: string;
  'referrer'?: string;
  'violated-directive'?: string;
  'effective-directive'?: string;
  'original-policy'?: string;
  'blocked-uri'?: string;
  'status-code'?: number;
  'source-file'?: string;
  'line-number'?: number;
  'column-number'?: number;
}

// New reporting API format
interface NewCspReport {
  documentURL?: string;
  referrer?: string;
  violatedDirective?: string;
  effectiveDirective?: string;
  originalPolicy?: string;
  blockedURL?: string;
  statusCode?: number;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
}

interface CspViolationReport {
  'csp-report'?: OldCspReport;
  body?: NewCspReport;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // CSP reports can come as application/csp-report or application/reports+json
    if (!contentType.includes('csp-report') &&
        !contentType.includes('reports+json') &&
        !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      );
    }

    const report: CspViolationReport = await request.json();

    // Extract report data (handle both old and new formats)
    const oldReport = report['csp-report'];
    const newReport = report.body;

    const logData = {
      documentUri: oldReport?.['document-uri'] || newReport?.documentURL,
      referrer: oldReport?.['referrer'] || newReport?.referrer,
      violatedDirective: oldReport?.['violated-directive'] || newReport?.violatedDirective,
      effectiveDirective: oldReport?.['effective-directive'] || newReport?.effectiveDirective,
      blockedUri: oldReport?.['blocked-uri'] || newReport?.blockedURL,
      sourceFile: oldReport?.['source-file'] || newReport?.sourceFile,
      lineNumber: oldReport?.['line-number'] || newReport?.lineNumber,
      columnNumber: oldReport?.['column-number'] || newReport?.columnNumber,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    };

    // Log the violation
    logger.security('CSP Violation', {
      ...logData,
      type: 'csp_violation',
    });

    // In production, you might want to:
    // 1. Store in database for analysis
    // 2. Send alerts for certain violation types
    // 3. Aggregate similar violations

    // Return success - browsers expect 204 No Content
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error('Failed to process CSP report', error);

    // Still return success to avoid console errors in browser
    return new NextResponse(null, { status: 204 });
  }
}

// Also handle OPTIONS for preflight requests
export async function OPTIONS() {
  // BUG-API-14: Restrict CORS to the app's own origin instead of wildcard
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
