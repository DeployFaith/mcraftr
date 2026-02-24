import NextAuth from 'next-auth'

// NOTE: This file is imported by middleware.ts which runs in the Edge Runtime.
// It must NOT import anything that uses Node.js built-ins (fs, path, crypto, etc.).
// The Credentials provider and user lookups live in auth.node.ts — imported only
// by the Node.js API route handler, never by Edge-bundled code.
//
// This file only exports `auth` (used by middleware for session checks).
// The route handler at app/api/auth/[...nextauth]/route.ts imports from auth.node.ts.

export const authConfig = {
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt' as const,
  },
  cookies: {
    sessionToken: {
      name: 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: 'authjs.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  providers: [],  // No providers needed for Edge session checking
  callbacks: {
    async session({ session, token }: { session: any; token: any }) {
      if (token?.id && session.user) {
        session.user.id = token.id as string
      }
      session.hasServer = token.hasServer ?? false
      session.role = token.role ?? 'user'
      return session
    },
    authorized({ auth }: { auth: any }) {
      return !!auth?.user
    },
  },
}

export const { auth } = NextAuth(authConfig)
