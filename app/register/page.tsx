'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import BrandLockup from '@/app/components/BrandLockup'

export default function RegisterPage() {
  const router  = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (!data.ok) {
        setError(data.error || 'Registration failed')
        setLoading(false)
        return
      }

      // Auto sign-in after registration
      const signInRes = await signIn('credentials', {
        username: email,
        password,
        redirect: false,
      })

      if (signInRes?.ok) {
        router.push('/connect')
      } else {
        router.push('/login')
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <BrandLockup size="hero" className="justify-center" />
          <div className="text-xs font-mono mt-1" style={{ color: 'var(--text-dim)' }}>
            create your account
          </div>
        </div>

        <div className="glass-card p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[9px] font-mono tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="you@example.com"
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
                autoComplete="new-password"
                required
                placeholder="At least 8 characters"
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
                CONFIRM PASSWORD
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
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
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div className="text-center pt-1">
            <span className="text-xs font-mono" style={{ color: 'var(--text-dim)' }}>
              Already have an account?{' '}
            </span>
            <Link href="/login" className="text-xs font-mono" style={{ color: 'var(--accent)' }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
