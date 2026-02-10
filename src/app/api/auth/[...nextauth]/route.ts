import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
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

export const authOptions: NextAuthOptions = {
  // No adapter - we use JWT sessions and manage users in our own database
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],

  // Use default NextAuth pages to see errors (can customize later)
  // pages: {
  //   signIn: '/',
  //   error: '/',
  // },

  callbacks: {
    async session({ session, token }) {
      // Add user ID and role to session from JWT token
      if (session.user && token) {
        session.user.id = token.sub || token.id || '';
        session.user.role = (token.role as string) || 'member';
      }

      logger.info('Session created', {
        userId: token?.sub || token?.id,
        action: 'session_created',
      });

      return session;
    },

    async signIn({ user, account }) {
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
