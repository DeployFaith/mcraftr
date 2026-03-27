import NextAuth, { type Session } from 'next-auth'
import type { JWT } from 'next-auth/jwt'

type McraftrJWT = JWT & {
  id?: string
  hasServer?: boolean
  role?: 'admin' | 'user'
  activeServerId?: string | null
  activeServerLabel?: string | null
}

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
        secure: process.env.NEXTAUTH_URL?.startsWith('https://') ?? false,
      },
    },
    csrfToken: {
      name: 'authjs.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NEXTAUTH_URL?.startsWith('https://') ?? false,
      },
    },
  },
  providers: [],  // No providers needed for Edge session checking
  callbacks: {
    async session({ session, token }: { session: Session; token: McraftrJWT }) {
      if (token?.id && session.user) {
        session.user.id = token.id as string
      }
      session.hasServer = token.hasServer ?? false
      session.role = token.role ?? 'user'
      session.activeServerId = token.activeServerId ?? null
      session.activeServerLabel = token.activeServerLabel ?? null
      return session
    },
    authorized({ auth }: { auth: Session | null }) {
      return !!auth?.user
    },
  },
}

export const { auth } = NextAuth(authConfig)
