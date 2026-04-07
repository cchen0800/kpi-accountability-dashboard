const FLAG_CONFIG = {
  none: { color: '#059669', label: 'On Track' },
  optimism_gap: { color: '#B45309', label: 'Optimism Gap' },
  submission_gap: { color: '#DC2626', label: 'Submission Gap' },
  vanity_metrics: { color: '#7C3AED', label: 'Vanity Metrics' },
  no_progress: { color: '#DC2626', label: 'No Progress' },
  other: { color: '#0D7490', label: 'Other' },
}

export default function TeamRollup({ employees }) {
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
              <div
                key={seg.type}
                style={{
                  width: `${pct}%`,
                  background: config.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  borderRight: i < segments.length - 1 ? '2px solid var(--card)' : 'none',
                  minWidth: pct > 0 ? 24 : 0,
                }}
              >
                <span className="mono" style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#fff',
                }}>
                  {seg.count}
                </span>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          marginTop: 10,
        }}>
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
      </div>
    </div>
  )
}
