import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { rateLimiters, withRateLimit, createRateLimitResponse } from '@/lib/rateLimit';

/**
 * Routes that require authentication
 */
const AUTHENTICATED_ROUTES = [
  '/api/ai/',
  '/api/goals/',
  '/api/templates/',
  '/api/attachments',
];

/**
 * Routes exempt from CSRF protection
 */
const CSRF_EXEMPT_ROUTES = [
  '/api/outlook/', // Uses API key auth
  '/api/digest/', // Uses API key auth (cron endpoints)
  '/api/reminders/', // Uses API key auth (cron endpoints)
  '/api/csp-report', // CSP violation reports
];

/**
 * CSRF protected methods
 */
const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Check if route requires authentication
 */
function requiresAuth(pathname: string): boolean {
  return AUTHENTICATED_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * Check if route needs CSRF protection
 */
function needsCsrfProtection(pathname: string, method: string): boolean {
  if (!CSRF_PROTECTED_METHODS.includes(method)) {
    return false;
  }

  if (!pathname.startsWith('/api/')) {
    return false;
  }

  return !CSRF_EXEMPT_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * Validate CSRF token
 */
function validateCsrfToken(request: NextRequest): boolean {
  const cookieToken = request.cookies.get('csrf_token')?.value;
  const headerToken = request.headers.get('X-CSRF-Token');

  if (!cookieToken || !headerToken) {
    return false;
  }

  return cookieToken === headerToken;
}

/**
 * Validate session from request headers/cookies
 */
async function validateSessionFromRequest(request: NextRequest): Promise<{
  valid: boolean;
  userId?: string;
  userName?: string;
  error?: string;
}> {
  // Check for session token in various places
  let sessionToken = request.headers.get('X-Session-Token');

  if (!sessionToken) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      sessionToken = authHeader.substring(7);
    }
  }

  if (!sessionToken) {
    sessionToken = request.cookies.get('session')?.value || null;
  }

  // Also check for legacy userName header (backward compatibility)
  const legacyUserName = request.headers.get('X-User-Name');

  if (!sessionToken && !legacyUserName) {
    return { valid: false, error: 'No session token provided' };
  }

  // Accept legacy auth during migration period
  // In production, this should validate against database
  if (!sessionToken && legacyUserName) {
    return {
      valid: true,
      userName: legacyUserName,
    };
  }

  // For now, accept session tokens (full validation would require DB call)
  // Real validation happens in individual API routes
  if (sessionToken) {
    return {
      valid: true,
    };
  }

  return { valid: false, error: 'Invalid session' };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|woff|woff2|ttf)$/)
  ) {
    return NextResponse.next();
  }

  // ============================================
  // CSRF PROTECTION
  // ============================================

  if (needsCsrfProtection(pathname, request.method)) {
    if (!validateCsrfToken(request)) {
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid or missing CSRF token',
        },
        { status: 403 }
      );
    }
  }

  // ============================================
  // AUTHENTICATION CHECK
  // ============================================

  if (requiresAuth(pathname)) {
    const session = await validateSessionFromRequest(request);

    if (!session.valid) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          message: session.error || 'Please log in to access this resource',
        },
        { status: 401 }
      );
    }
  }

  // ============================================
  // RATE LIMITING
  // ============================================

  let rateLimitResult;

  if (pathname.startsWith('/api/auth/')) {
    // Stricter limit for authentication endpoints
    rateLimitResult = await withRateLimit(request, rateLimiters.login);
  } else if (pathname.startsWith('/api/ai/')) {
    // AI endpoints have their own limit
    rateLimitResult = await withRateLimit(request, rateLimiters.ai);
  } else if (pathname.startsWith('/api/attachments')) {
    // File upload endpoints
    rateLimitResult = await withRateLimit(request, rateLimiters.upload);
  } else if (pathname.startsWith('/api/')) {
    // General API rate limit
    rateLimitResult = await withRateLimit(request, rateLimiters.api);
  } else {
    // No rate limit for other routes
    const response = NextResponse.next();

    // Set CSRF cookie on page loads
    if (!pathname.startsWith('/api/')) {
      const existingToken = request.cookies.get('csrf_token')?.value;
      if (!existingToken) {
        // Use Web Crypto API (Edge Runtime compatible)
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const newToken = btoa(String.fromCharCode(...array))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
        response.cookies.set('csrf_token', newToken, {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
          maxAge: 60 * 60 * 24, // 24 hours
        });
      }
    }

    return response;
  }

  // Check if rate limit exceeded
  if (rateLimitResult && !rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult);
  }

  // Continue with request
  const response = NextResponse.next();

  // Add rate limit headers to response
  if (rateLimitResult) {
    if (rateLimitResult.limit !== undefined) {
      response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
    }
    if (rateLimitResult.remaining !== undefined) {
      response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    }
    if (rateLimitResult.reset !== undefined) {
      response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString());
    }
  }

  // Set CSRF cookie on all responses if not present
  // This ensures the cookie is available for subsequent requests
  const existingCsrfToken = request.cookies.get('csrf_token')?.value;
  if (!existingCsrfToken) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const newToken = btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    response.cookies.set('csrf_token', newToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
