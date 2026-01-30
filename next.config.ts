import type { NextConfig } from "next";

// Allowed origins for Outlook add-in CORS
const OUTLOOK_ALLOWED_ORIGINS = [
  "https://outlook.office.com",
  "https://outlook.office365.com",
  "https://outlook.live.com",
  "https://outlook-sdf.office.com",
  "https://outlook-sdf.office365.com",
  // Add production domain for same-origin requests
  process.env.NEXT_PUBLIC_APP_URL || "https://shared-todo-list-production.up.railway.app",
].filter(Boolean).join(", ");

// Content Security Policy
// Note: Next.js requires 'unsafe-inline' for styles due to how Tailwind/CSS-in-JS works
// 'unsafe-eval' is removed in production for security
const isProduction = process.env.NODE_ENV === 'production';

const cspDirectives: Record<string, string[]> = {
  "default-src": ["'self'"],
  // In production, we try to avoid unsafe-eval
  // unsafe-inline is still needed for Next.js hydration scripts
  "script-src": isProduction
    ? ["'self'", "'unsafe-inline'"] // No unsafe-eval in production
    : ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Dev needs eval for hot reload
  "style-src": ["'self'", "'unsafe-inline'"], // Tailwind requires unsafe-inline
  "img-src": ["'self'", "data:", "https:", "blob:"],
  "font-src": ["'self'", "data:"],
  "media-src": ["'self'", "data:", "blob:"], // Allow audio/video from data URLs and blobs
  "connect-src": [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://api.anthropic.com",
    "https://api.openai.com",
    // Sentry for error reporting
    "https://*.sentry.io",
  ],
  "frame-ancestors": ["'none'"], // Clickjacking protection
  "base-uri": ["'self'"],
  "form-action": ["'self'", "https://accounts.google.com"],
  "object-src": ["'none'"], // Prevent plugins like Flash
  "worker-src": ["'self'", "blob:"], // Service workers
  "child-src": ["'self'", "blob:"], // iframes and workers
  "manifest-src": ["'self'"], // Web app manifest
  "upgrade-insecure-requests": [],
  // Report CSP violations for monitoring
  "report-uri": ["/api/csp-report"],
};

const cspString = Object.entries(cspDirectives)
  .map(([key, values]) => `${key} ${values.join(" ")}`.trim())
  .join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: false,
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        // Global security headers for all routes
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: cspString,
          },
        ],
      },
      {
        // Allow Office.js to load Outlook add-in files
        // Must be accessible for Office Add-in manifest loading
        source: "/outlook/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: OUTLOOK_ALLOWED_ORIGINS },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
        ],
      },
      {
        // CORS headers for Outlook API endpoints - restricted to Office domains
        source: "/api/outlook/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: OUTLOOK_ALLOWED_ORIGINS },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, X-API-Key, X-CSRF-Token" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
        ],
      },
    ];
  },
};

export default nextConfig;
