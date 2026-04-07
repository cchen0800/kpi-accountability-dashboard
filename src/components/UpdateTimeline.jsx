import { useState } from 'react'

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

export default function UpdateTimeline({ updates }) {
  const [expanded, setExpanded] = useState(null)

  if (!updates || updates.length === 0) return null

  const sorted = [...updates].sort(
    (a, b) => DAY_ORDER.indexOf(a.day?.toLowerCase()) - DAY_ORDER.indexOf(b.day?.toLowerCase())
  )

  return (
    <div className="card-elevated animate-in" style={{ animationDelay: '0.3s' }}>
      <div className="section-header">Daily Updates</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sorted.map((update, i) => {
          const isOpen = expanded === i
          const dayLabel = (update.day || '').charAt(0).toUpperCase() + (update.day || '').slice(1)

          return (
            <div key={i}>
              <button
                onClick={() => setExpanded(isOpen ? null : i)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: isOpen ? 'var(--card-hover)' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'var(--font)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'var(--card-hover)' }}
                onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = '' }}
              >
                <span>{dayLabel}</span>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{
                    color: 'var(--text-ghost)',
                    transition: 'transform 0.2s ease',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                  }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {isOpen && (
                <div style={{
                  padding: '8px 12px 16px',
                  fontSize: 12.5,
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                  animation: 'fade-in 0.3s ease both',
                }}>
                  {update.content}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
