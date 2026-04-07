import { useState } from 'react'
import { motion } from 'framer-motion'

const FLAG_CONFIG = {
  none: {
    color: '#059669',
    label: 'On Track',
    description: 'Meeting or exceeding KPI targets with consistent standup submissions. No accountability concerns detected.',
  },
  optimism_gap: {
    color: '#B45309',
    label: 'Optimism Gap',
    description: 'Updates use positive language ("feeling good," "great call") but underlying metrics are declining or stalled. The tone masks the reality.',
  },
  submission_gap: {
    color: '#DC2626',
    label: 'Submission Gap',
    description: 'Missing standup submissions on expected days. May submit catch-up updates covering multiple days, violating the daily accountability cadence.',
  },
  vanity_metrics: {
    color: '#7C3AED',
    label: 'Vanity Metrics',
    description: 'Activity metrics (e.g. calls made, emails sent) look strong, but outcome metrics (e.g. meetings booked, deals closed) are declining. Effort without results.',
  },
  no_progress: {
    color: '#DC2626',
    label: 'No Progress',
    description: 'The same blocker or task is repeated across multiple days with no escalation, resolution, or forward movement. Stuck without action.',
  },
  other: {
    color: '#0D7490',
    label: 'Other',
    description: 'An accountability pattern the AI identified that doesn\'t fit the standard categories. Check the employee detail for specifics.',
  },
}

const ALL_FLAGS = ['none', 'optimism_gap', 'submission_gap', 'vanity_metrics', 'no_progress', 'other']

export default function TeamRollup({ employees }) {
  const [guideOpen, setGuideOpen] = useState(false)
  if (!employees || employees.length === 0) return null

  // Count by flag type
  const counts = {}
  for (const emp of employees) {
    const flag = emp.analysis?.flag_type || 'none'
    counts[flag] = (counts[flag] || 0) + 1
  }

  const total = employees.length
  const onTrack = counts.none || 0
  const flagged = total - onTrack

  // Build segments ordered: on_track first, then flagged types
  const segments = []
  if (counts.none) segments.push({ type: 'none', count: counts.none })
  for (const [type, count] of Object.entries(counts)) {
    if (type !== 'none') segments.push({ type, count })
  }

  // Check if any employee has analysis
  const hasAnalysis = employees.some(e => e.analysis)
  if (!hasAnalysis) return null

  return (
    <div className="card animate-in" style={{ animationDelay: '0.12s', marginTop: 20 }}>
      {/* Top row: KPI summary cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
        marginBottom: 20,
      }}>
        {/* Total employees */}
        <div style={{
          padding: '14px 16px',
          background: 'var(--bg)',
          borderRadius: 'var(--radius-sm)',
          borderTop: '3px solid var(--accent)',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.8px', color: 'var(--text-ghost)',
          }}>
            Team Size
          </div>
          <div className="mono" style={{
            fontSize: 28, fontWeight: 700, color: 'var(--accent)',
            letterSpacing: '-1px', marginTop: 2,
          }}>
            {total}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 1 }}>
            employees analyzed
          </div>
        </div>

        {/* On track */}
        <div style={{
          padding: '14px 16px',
          background: 'var(--bg)',
          borderRadius: 'var(--radius-sm)',
          borderTop: '3px solid var(--success)',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.8px', color: 'var(--text-ghost)',
          }}>
            On Track
          </div>
          <div className="mono" style={{
            fontSize: 28, fontWeight: 700, color: 'var(--success)',
            letterSpacing: '-1px', marginTop: 2,
          }}>
            {onTrack}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 1 }}>
            meeting targets
          </div>
        </div>

        {/* Flagged */}
        <div style={{
          padding: '14px 16px',
          background: 'var(--bg)',
          borderRadius: 'var(--radius-sm)',
          borderTop: '3px solid var(--danger)',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.8px', color: 'var(--text-ghost)',
          }}>
            Flagged
          </div>
          <div className="mono" style={{
            fontSize: 28, fontWeight: 700, color: 'var(--danger)',
            letterSpacing: '-1px', marginTop: 2,
          }}>
            {flagged}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 1 }}>
            need attention
          </div>
        </div>
      </div>

      {/* Stacked bar */}
      <div>
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.8px', color: 'var(--text-ghost)',
          marginBottom: 8,
        }}>
          Team Health
        </div>
        <div style={{
          display: 'flex',
          height: 28,
          borderRadius: 6,
          overflow: 'hidden',
          background: 'var(--bg)',
        }}>
          {segments.map((seg, i) => {
            const pct = (seg.count / total) * 100
            const config = FLAG_CONFIG[seg.type] || FLAG_CONFIG.other
            return (
              <motion.div
                key={seg.type}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{
                  duration: 0.8,
                  delay: i * 0.15,
                  ease: [0.4, 0, 0.2, 1],
                }}
                style={{
                  background: config.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRight: i < segments.length - 1 ? '2px solid var(--card)' : 'none',
                  minWidth: pct > 0 ? 24 : 0,
                  overflow: 'hidden',
                }}
              >
                <motion.span
                  className="mono"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.15 + 0.5 }}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fff',
                  }}
                >
                  {seg.count}
                </motion.span>
              </motion.div>
            )
          })}
        </div>

        {/* Legend + guide toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 10,
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {segments.map(seg => {
              const config = FLAG_CONFIG[seg.type] || FLAG_CONFIG.other
              return (
                <div key={seg.type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: 2,
                    background: config.color,
                  }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {config.label}
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-ghost)' }}>
                    {seg.count}
                  </span>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => setGuideOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', padding: 0,
              fontSize: 11, fontWeight: 600, color: 'var(--text-ghost)',
              fontFamily: 'var(--font)', cursor: 'pointer',
              transition: 'color 0.2s ease',
              flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-ghost)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {guideOpen ? 'Hide guide' : 'What do these mean?'}
          </button>
        </div>

        {/* Expandable guide */}
        {guideOpen && (
          <div style={{
            marginTop: 14,
            padding: '16px 18px',
            background: 'var(--bg)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            animation: 'fade-in 0.3s ease both',
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: 'var(--text)',
              marginBottom: 12,
            }}>
              Accountability Flag Guide
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ALL_FLAGS.map(type => {
                const config = FLAG_CONFIG[type]
                return (
                  <div key={type} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: 3,
                      background: config.color,
                      flexShrink: 0,
                      marginTop: 3,
                    }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: config.color }}>
                        {config.label}
                      </div>
                      <div style={{
                        fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)',
                        lineHeight: 1.5, marginTop: 1,
                      }}>
                        {config.description}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
