import NextAuth, { NextAuthOptions, Session, User } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import AppleProvider from 'next-auth/providers/apple';
import { SupabaseAdapter } from '@auth/supabase-adapter';
import { isFeatureEnabled } from '@/lib/featureFlags';
import { logger } from '@/lib/logger';

// Extend NextAuth types to include our custom fields
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
    };
  }

  interface User {
    id: string;
    role?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
  }
}

// Email whitelist - only these emails can sign up with OAuth
const ALLOWED_EMAILS = (process.env.ALLOWED_OAUTH_EMAILS || '')
  .split(',')
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

// Check if OAuth is configured
const isOAuthConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY &&
  (process.env.GOOGLE_CLIENT_ID || process.env.APPLE_CLIENT_ID);

export const authOptions: NextAuthOptions = {
  adapter: isOAuthConfigured ? SupabaseAdapter({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }) : undefined,

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true, // Allow linking with existing PIN accounts
    }),
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID || '',
      clientSecret: process.env.APPLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),
  ],

  pages: {
    signIn: '/', // Custom sign-in page
    error: '/', // Error page
  },

  callbacks: {
    async session({ session, user }) {
      // Add user ID and role to session
      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role || 'member';
      }

      logger.info('Session created', {
        userId: user.id,
        action: 'session_created',
      });

      return session;
    },

    async signIn({ user, account, profile }) {
      // Check email whitelist for OAuth providers
      if (account?.provider === 'google' || account?.provider === 'apple') {
        const userEmail = user.email?.toLowerCase();

        // If whitelist is configured and email is not allowed, reject sign-in
        if (ALLOWED_EMAILS.length > 0 && userEmail && !ALLOWED_EMAILS.includes(userEmail)) {
          logger.warn('Unauthorized OAuth sign-in attempt', {
            email: userEmail,
            provider: account.provider,
            action: 'sign_in_rejected',
          });

          // Return false to reject sign-in
          return false;
        }
      }

      // Log successful sign-in
      logger.info('User signed in', {
        userId: user.id,
        email: user.email,
        provider: account?.provider,
        action: 'sign_in',
      });

      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role || 'member';
      }
      return token;
    },
  },

  events: {
    async signOut({ session, token }) {
      logger.info('User signed out', {
        userId: token?.sub || session?.user?.id,
        action: 'sign_out',
      });
    },
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
