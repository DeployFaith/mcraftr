'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Fetch CSRF token fresh on each submit
      const csrfRes = await fetch('/api/auth/csrf')
      const { csrfToken } = await csrfRes.json()

      const body = new URLSearchParams({
        username,
        password,
        csrfToken,
        callbackUrl: '/minecraft',
      })

      const res = await fetch('/api/auth/callback/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        redirect: 'follow',
      })

      // NextAuth redirects to callbackUrl on success and to /login?error=... on failure.
      // With redirect:'follow', res.url is the final URL after all redirects.
      if (res.ok && !res.url.includes('error=')) {
        window.location.href = '/minecraft'
      } else {
        setLoading(false)
        setError('Invalid username or password')
      }
    } catch {
      setLoading(false)
      setError('Something went wrong. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        {/* Logo / title */}
        <div className="text-center mb-8">
          <div className="text-2xl font-mono font-bold tracking-widest" style={{ color: 'var(--accent)' }}>
            MCRAFTR
          </div>
          <div className="text-xs font-mono mt-1" style={{ color: 'var(--text-dim)' }}>
            minecraft server admin
          </div>
        </div>

        {/* Card */}
        <div className="glass-card p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[9px] font-mono tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
                USERNAME
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                required
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm focus:outline-none transition-colors"
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: '16px',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-mid)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            <div>
              <label className="block text-[9px] font-mono tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full px-3 py-2.5 rounded-lg font-mono text-sm focus:outline-none transition-colors"
                style={{
                  background: 'var(--panel)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontSize: '16px',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-mid)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {error && (
              <div className="text-xs font-mono px-3 py-2 rounded-lg" style={{ background: '#2a0f0f', color: '#fca5a5', border: '1px solid #7f1d1d' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-mono text-xs tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
          <div className="text-center pt-1">
            <span className="text-xs font-mono" style={{ color: 'var(--text-dim)' }}>
              New to Mcraftr?{' '}
            </span>
            <Link href="/register" className="text-xs font-mono" style={{ color: 'var(--accent)' }}>
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
