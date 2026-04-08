import { useState } from 'react'

export default function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Invalid password')
        return
      }
      onLogin(data.token, data.expires_in)
    } catch {
      setError('Connection failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <form onSubmit={handleSubmit} style={{
        width: 'min(340px, calc(100vw - 32px))',
        padding: '32px 28px',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-elevated)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800,
          }}>
            Lc
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px' }}>
              KPI Accountability
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>
              Lumen Collective
            </div>
          </div>
        </div>

        <label style={{
          display: 'block', fontSize: 11, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.5px',
          color: 'var(--text-ghost)', marginBottom: 6,
        }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: 14,
            fontFamily: 'var(--font)',
            background: 'var(--bg)',
            border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text)',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s ease',
          }}
          onFocus={(e) => { if (!error) e.target.style.borderColor = 'var(--accent)' }}
          onBlur={(e) => { if (!error) e.target.style.borderColor = 'var(--border)' }}
        />

        {error && (
          <div style={{
            fontSize: 12, color: 'var(--danger)', fontWeight: 600, marginTop: 8,
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          style={{
            width: '100%',
            marginTop: 16,
            padding: '10px 0',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'var(--font)',
            background: loading || !password ? 'var(--border)' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: loading || !password ? 'default' : 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
