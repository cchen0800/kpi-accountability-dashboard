import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAtom } from 'jotai'
import { lastRunAtom } from '../lib/store/pipeline'

const NAV_ITEMS = [
  { path: '/', label: 'KPI Accountability', shortLabel: 'Dashboard' },
  { path: '/pipeline', label: 'Agentic Pipeline', shortLabel: 'Pipeline' },
]

export default function NavBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [lastRun] = useAtom(lastRunAtom)
  const [infoOpen, setInfoOpen] = useState(false)
  const popoverRef = useRef(null)

  useEffect(() => {
    if (!infoOpen) return
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setInfoOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [infoOpen])

  const stats = lastRun?.has_run ? [
    { label: 'Tokens Used', value: lastRun.total_tokens?.toLocaleString() },
    { label: 'Cost', value: `$${(lastRun.total_cost_cents / 100).toFixed(4)}` },
    { label: 'Duration', value: lastRun.duration_seconds ? `${lastRun.duration_seconds.toFixed(1)}s` : '-' },
  ] : null

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      height: 48,
      borderBottom: '1px solid var(--border)',
      background: 'var(--card)',
      flexShrink: 0,
      gap: 8,
    }}>
      {/* Logo + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6,
          background: 'linear-gradient(135deg, var(--accent), var(--purple))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />
          </svg>
        </div>
        <span className="nav-title" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>
          KPI Accountability
        </span>
      </div>

      {/* Nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                background: 'none',
                border: 'none',
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                fontFamily: 'var(--font)',
                color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                cursor: 'pointer',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              <span className="mobile-hide">{item.label}</span>
              <span className="mobile-show">{item.shortLabel}</span>
            </button>
          )
        })}
      </div>

      {/* Info icon + popover */}
      {stats ? (
        <div ref={popoverRef} style={{ flexShrink: 0 }}>
          <button
            onClick={() => setInfoOpen(o => !o)}
            style={{
              width: 30, height: 30, borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: infoOpen ? 'var(--accent-glow)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              color: infoOpen ? 'var(--accent)' : 'var(--text-ghost)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-active)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = infoOpen ? 'var(--accent)' : 'var(--text-ghost)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>

          {infoOpen && (
            <div style={{
              position: 'absolute',
              top: 44,
              right: 12,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-elevated)',
              padding: '14px 18px',
              minWidth: 200,
              zIndex: 50,
              animation: 'fade-in 0.15s ease both',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.8px', color: 'var(--text-ghost)', marginBottom: 10,
              }}>
                Last Pipeline Run
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stats.map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {item.label}
                    </span>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                      {item.value || '-'}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border-subtle)',
                fontSize: 10, color: 'var(--text-ghost)',
              }}>
                {new Date(lastRun.started_at).toLocaleString()}
              </div>
            </div>
          )}
        </div>
      ) : <div style={{ width: 30 }} />}
    </nav>
  )
}
