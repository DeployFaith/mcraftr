'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import BrandLockup from '@/app/components/BrandLockup'

type TestState = 'idle' | 'testing' | 'success' | 'fail'

function ConnectForm() {
  const searchParams = useSearchParams()
  const isEdit = searchParams.get('edit') === '1'
  const { update: updateSession } = useSession()
  const [host, setHost]         = useState('')
  const [port, setPort]         = useState('25575')
  const [password, setPassword] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const [testState, setTestState] = useState<TestState>('idle')
  const [testMsg, setTestMsg]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  // Pre-populate fields when editing
  useEffect(() => {
    if (!isEdit) return
    fetch('/api/server').then(r => r.json()).then(d => {
      if (d.ok && d.host) {
        setHost(d.host)
        setPort(String(d.port ?? 25575))
      }
    }).catch(() => {})
  }, [isEdit])

  const handleTest = async () => {
    if (!host || !password) {
      setTestMsg('Enter your server address and RCON password first')
      setTestState('fail')
      return
    }
    setTestState('testing')
    setTestMsg('')
    try {
      const res = await fetch('/api/server', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, port: parseInt(port) || 25575, password }),
      })
      const data = await res.json()
      if (data.ok) {
        setTestState('success')
        setTestMsg(data.message || 'Connection successful!')
      } else {
        setTestState('fail')
        setTestMsg(data.error || 'Could not connect to your server')
      }
    } catch {
      setTestState('fail')
      setTestMsg('Something went wrong. Check your connection.')
    }
  }

  const handleSave = async () => {
    if (!host || !password) {
      setError('Server address and RCON password are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host, port: parseInt(port) || 25575, password }),
      })
      const data = await res.json()
      if (data.ok) {
        // Refresh the JWT so hasServer=true is reflected before navigating.
        // Without this, middleware would see the stale hasServer=false and
        // redirect back to /connect immediately.
        await updateSession()
        window.location.href = '/minecraft'
      } else {
        setError(data.error || 'Failed to save server')
        setSaving(false)
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <BrandLockup size="hero" className="justify-center" />
          <div className="text-xs font-mono mt-1" style={{ color: 'var(--text-dim)' }}>
            {isEdit ? 'update server connection' : 'connect your minecraft server'}
          </div>
        </div>

        <div className="glass-card p-6 space-y-5">

          {/* Intro */}
          <p className="text-sm font-mono" style={{ color: 'var(--text-dim)' }}>
            {isEdit
              ? 'Update your server address or RCON password below.'
              : 'To get started, enter your Minecraft server\'s address and RCON password. You only need to do this once.'}
          </p>

          {/* Server address */}
          <div>
            <label className="block text-[9px] font-mono tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
              SERVER ADDRESS
            </label>
            <input
              type="text"
              value={host}
              onChange={e => { setHost(e.target.value); setTestState('idle'); setTestMsg('') }}
              placeholder="play.yourserver.com or 192.168.1.100"
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
            <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-dim)' }}>
              The same address your kids use to join the server
            </p>
          </div>

          {/* RCON port — collapsed by default, most users don't need it */}
          <div>
            <label className="block text-[9px] font-mono tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
              RCON PORT <span style={{ color: 'var(--text-dim)', fontWeight: 'normal' }}>(default: 25575 — leave this alone unless your host says otherwise)</span>
            </label>
            <input
              type="number"
              value={port}
              onChange={e => { setPort(e.target.value); setTestState('idle'); setTestMsg('') }}
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

          {/* RCON password */}
          <div>
            <label className="block text-[9px] font-mono tracking-widest mb-1.5" style={{ color: 'var(--text-dim)' }}>
              RCON PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setTestState('idle'); setTestMsg('') }}
              placeholder="Found in your server control panel"
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

            {/* Help toggle */}
            <button
              type="button"
              onClick={() => setShowHelp(h => !h)}
              className="text-[10px] font-mono mt-1.5 underline"
              style={{ color: 'var(--accent)' }}
            >
              {showHelp ? 'Hide help' : 'Where do I find this?'}
            </button>

            {showHelp && (
              <div className="mt-3 p-3 rounded-lg space-y-2 text-[11px] font-mono" style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                <p className="font-bold" style={{ color: 'var(--text)' }}>Finding your RCON password:</p>
                <ul className="space-y-1.5 list-none">
                  <li><span style={{ color: 'var(--accent)' }}>Apex Hosting</span> — Game Panel → Config Files → server.properties → look for <code>rcon.password</code></li>
                  <li><span style={{ color: 'var(--accent)' }}>Shockbyte</span> — Multicraft panel → Files → Config Files → server.properties</li>
                  <li><span style={{ color: 'var(--accent)' }}>Bisect Hosting</span> — Game Panel → Configuration → server.properties</li>
                  <li><span style={{ color: 'var(--accent)' }}>Nodecraft</span> — Game panel → Configuration → server.properties</li>
                  <li><span style={{ color: 'var(--accent)' }}>Self-hosted</span> — Open <code>server.properties</code> in your server folder. Set <code>enable-rcon=true</code> and set <code>rcon.password</code> to anything you like, then restart your server.</li>
                </ul>
                <p className="pt-1" style={{ color: 'var(--text-dim)' }}>
                  Make sure <code>enable-rcon=true</code> is also set. Most hosting providers have this on by default.
                </p>
              </div>
            )}
          </div>

          {/* Test connection feedback */}
          {testState !== 'idle' && (
            <div
              className="text-xs font-mono px-3 py-2 rounded-lg"
              style={{
                background: testState === 'success' ? '#0f2a0f' : testState === 'fail' ? '#2a0f0f' : 'var(--panel)',
                color: testState === 'success' ? '#86efac' : testState === 'fail' ? '#fca5a5' : 'var(--text-dim)',
                border: `1px solid ${testState === 'success' ? '#166534' : testState === 'fail' ? '#7f1d1d' : 'var(--border)'}`,
              }}
            >
              {testState === 'testing' ? 'Testing connection…' : testMsg}
            </div>
          )}

          {error && (
            <div className="text-xs font-mono px-3 py-2 rounded-lg" style={{ background: '#2a0f0f', color: '#fca5a5', border: '1px solid #7f1d1d' }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            {isEdit && (
              <a
                href="/minecraft"
                className="flex-1 py-3 rounded-lg font-mono text-xs tracking-widest transition-all text-center"
                style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}
              >
                Cancel
              </a>
            )}
            <button
              type="button"
              onClick={handleTest}
              disabled={testState === 'testing'}
              className="flex-1 py-3 rounded-lg font-mono text-xs tracking-widest transition-all disabled:opacity-50"
              style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              {testState === 'testing' ? 'Testing…' : 'Test Connection'}
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 rounded-lg font-mono text-xs tracking-widest transition-all disabled:opacity-50"
              style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-mid)', color: 'var(--accent)' }}
            >
              {saving ? 'Saving…' : testState === 'success' ? 'Connect Server →' : 'Save & Continue →'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

export default function ConnectPage() {
  return (
    <Suspense>
      <ConnectForm />
    </Suspense>
  )
}
