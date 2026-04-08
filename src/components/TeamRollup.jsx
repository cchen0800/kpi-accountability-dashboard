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
    color: '#B45309',
    label: 'Submission Gap',
    description: 'Missing some standup submissions on expected days. A minor process issue - check if cadence needs adjustment.',
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

const ALL_FLAGS = ['none', 'no_progress', 'vanity_metrics', 'optimism_gap', 'submission_gap', 'other']

function getKpiCounts(employees) {
  let onTrack = 0, atRisk = 0, missing = 0
  for (const emp of employees) {
    for (const kpi of (emp.kpi_extractions || [])) {
      if (kpi.status === 'on_track') onTrack++
      else if (kpi.status === 'at_risk') atRisk++
      else missing++
    }
  }
  return { onTrack, atRisk, missing, total: onTrack + atRisk + missing }
}

function getBiggestGaps(employees) {
  const gaps = []
  for (const emp of employees) {
    for (const kpi of (emp.kpi_extractions || [])) {
      if (!kpi.delta || kpi.delta === '-') continue
      const num = parseFloat(kpi.delta)
      if (isNaN(num) || num >= 0) continue
      gaps.push({ name: emp.name, kpiName: kpi.kpi_name, delta: kpi.delta, numDelta: num })
    }
  }
  gaps.sort((a, b) => a.numDelta - b.numDelta)
  return gaps.slice(0, 3)
}

export default function TeamRollup({ employees }) {
  const [guideOpen, setGuideOpen] = useState(false)
  if (!employees || employees.length === 0) return null

  const hasAnalysis = employees.some(e => e.analysis)
  if (!hasAnalysis) return null

  const kpiCounts = getKpiCounts(employees)
  const biggestGaps = getBiggestGaps(employees)

  // Flag counts for compact legend
  const flagCounts = {}
  for (const emp of employees) {
    const flag = emp.analysis?.flag_type || 'none'
    flagCounts[flag] = (flagCounts[flag] || 0) + 1
  }
  const flagSegments = ALL_FLAGS.filter(f => flagCounts[f]).map(f => ({ type: f, count: flagCounts[f] }))

  // KPI health bar segments
  const kpiSegments = [
    { key: 'on_track', count: kpiCounts.onTrack, color: '#059669', label: 'On Track' },
    { key: 'at_risk', count: kpiCounts.atRisk, color: '#B45309', label: 'At Risk' },
    { key: 'missing', count: kpiCounts.missing, color: '#DC2626', label: 'Missing' },
  ].filter(s => s.count > 0)

  return (
    <div className="card animate-in" style={{ animationDelay: '0.12s' }}>
      {/* Top row: KPI health summary cards */}
      <div className="mobile-stack" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
        marginBottom: 20,
      }}>
        {/* KPIs On Track */}
        <div style={{
          padding: '14px 16px',
          background: 'var(--bg)',
          borderRadius: 'var(--radius-sm)',
          borderTop: '3px solid #059669',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.8px', color: 'var(--text-ghost)',
          }}>
            KPIs On Track
          </div>
          <div className="mono" style={{
            fontSize: 28, fontWeight: 700, color: '#059669',
            letterSpacing: '-1px', marginTop: 2,
          }}>
            {kpiCounts.onTrack}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 1 }}>
            of {kpiCounts.total} KPIs
          </div>
        </div>

        {/* KPIs At Risk */}
        <div style={{
          padding: '14px 16px',
          background: 'var(--bg)',
          borderRadius: 'var(--radius-sm)',
          borderTop: '3px solid #B45309',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.8px', color: 'var(--text-ghost)',
          }}>
            KPIs At Risk
          </div>
          <div className="mono" style={{
            fontSize: 28, fontWeight: 700, color: '#B45309',
            letterSpacing: '-1px', marginTop: 2,
          }}>
            {kpiCounts.atRisk}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 1 }}>
            need attention
          </div>
        </div>

        {/* KPIs Missing */}
        <div style={{
          padding: '14px 16px',
          background: 'var(--bg)',
          borderRadius: 'var(--radius-sm)',
          borderTop: '3px solid #DC2626',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.8px', color: 'var(--text-ghost)',
          }}>
            KPIs Missing
          </div>
          <div className="mono" style={{
            fontSize: 28, fontWeight: 700, color: '#DC2626',
            letterSpacing: '-1px', marginTop: 2,
          }}>
            {kpiCounts.missing}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 1 }}>
            no data
          </div>
        </div>
      </div>

      {/* KPI Health stacked bar */}
      <div>
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.8px', color: 'var(--text-ghost)',
          marginBottom: 8,
        }}>
          KPI Health
        </div>
        <div style={{
          display: 'flex',
          height: 28,
          borderRadius: 6,
          overflow: 'hidden',
          background: 'var(--bg)',
        }}>
          {kpiSegments.map((seg, i) => {
            const pct = kpiCounts.total > 0 ? (seg.count / kpiCounts.total) * 100 : 0
            return (
              <motion.div
                key={seg.key}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{
                  duration: 0.8,
                  delay: i * 0.15,
                  ease: [0.4, 0, 0.2, 1],
                }}
                style={{
                  background: seg.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRight: i < kpiSegments.length - 1 ? '2px solid var(--card)' : 'none',
                  minWidth: pct > 0 ? 24 : 0,
                  overflow: 'hidden',
                }}
              >
                <motion.span
                  className="mono"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.15 + 0.5 }}
                  style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}
                >
                  {seg.count}
                </motion.span>
              </motion.div>
            )
          })}
        </div>

        {/* KPI health legend */}
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          {kpiSegments.map(seg => (
            <div key={seg.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                {seg.label}
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-ghost)' }}>
                {seg.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Biggest Gaps mini-list */}
      {biggestGaps.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.8px', color: 'var(--text-ghost)',
            marginBottom: 8,
          }}>
            Biggest Gaps
          </div>
          {biggestGaps.map((gap, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '5px 0',
              borderBottom: i < biggestGaps.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                  {gap.name}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {gap.kpiName}
                </span>
              </div>
              <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', flexShrink: 0, marginLeft: 8 }}>
                {gap.delta}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Compact flag legend row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 16,
        paddingTop: 12,
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {flagSegments.map(seg => {
            const config = FLAG_CONFIG[seg.type] || FLAG_CONFIG.other
            return (
              <div key={seg.type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: config.color,
                }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-ghost)' }}>
                  {config.label}
                </span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-ghost)' }}>
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
  )
}
