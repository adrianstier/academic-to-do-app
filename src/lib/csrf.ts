/**
 * CSRF Protection Utility
 *
 * Implements double-submit cookie pattern for CSRF protection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('base64url');
}

/**
 * Hash a CSRF token for comparison (prevents timing attacks)
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Validate CSRF token from request
 *
 * Compares the token from the header/body with the token in the cookie.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function validateCsrfToken(request: NextRequest): boolean {
  // Get token from cookie
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (!cookieToken) {
    return false;
  }

  // Get token from header
  let headerToken = request.headers.get(CSRF_HEADER_NAME);

  // If not in header, try form data (for form submissions)
  // Note: We can't easily read form data in middleware, so header is preferred

  if (!headerToken) {
    return false;
  }

  // Constant-time comparison using hashes
  const cookieHash = hashToken(cookieToken);
  const headerHash = hashToken(headerToken);

  return cookieHash === headerHash;
}

/**
 * Set CSRF token cookie on response
 */
export function setCsrfCookie(response: NextResponse, token?: string): string {
  const csrfToken = token || generateCsrfToken();

  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // Must be readable by JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return csrfToken;
}

/**
 * Get or create CSRF token from request
 */
export function getOrCreateCsrfToken(request: NextRequest): string {
  const existingToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (existingToken) {
    return existingToken;
  }
  return generateCsrfToken();
}

/**
 * Routes that should be protected by CSRF
 * All state-changing operations (POST, PUT, PATCH, DELETE)
 */
const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Routes that are exempt from CSRF (e.g., public APIs, webhooks)
 */
const CSRF_EXEMPT_ROUTES = [
  '/api/outlook/', // Outlook add-in uses API key auth
  '/api/webhooks/', // Webhooks use signature verification
  '/api/csp-report', // CSP violation reports
];

/**
 * Check if a route should be CSRF protected
 */
export function shouldProtectRoute(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Only protect state-changing methods
  if (!CSRF_PROTECTED_METHODS.includes(method)) {
    return false;
  }

  // Check exemptions
  for (const exempt of CSRF_EXEMPT_ROUTES) {
    if (pathname.startsWith(exempt)) {
      return false;
    }
  }

  // Protect all other API routes
  return pathname.startsWith('/api/');
}

/**
 * CSRF middleware handler
 *
 * Returns null if CSRF validation passes, or an error response if it fails.
 */
export function csrfMiddleware(request: NextRequest): NextResponse | null {
  if (!shouldProtectRoute(request)) {
    return null; // Not protected, continue
  }

  if (!validateCsrfToken(request)) {
    return NextResponse.json(
      {
        error: 'CSRF validation failed',
        message: 'Invalid or missing CSRF token',
      },
      { status: 403 }
    );
  }

  return null; // Validation passed
}

/**
 * Client-side helper to get CSRF token from cookie
 */
export function getClientCsrfToken(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_COOKIE_NAME) {
      return value;
    }
  }
  return null;
}

/**
 * Client-side helper to add CSRF token to fetch headers
 */
export function addCsrfHeader(headers: HeadersInit = {}): HeadersInit {
  const token = getClientCsrfToken();
  if (token) {
    return {
      ...headers,
      [CSRF_HEADER_NAME]: token,
    };
  }
  return headers;
}
