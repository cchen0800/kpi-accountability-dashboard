import { useNavigate } from 'react-router-dom'

const FLAG_STYLES = {
  none: { color: 'var(--success)', bg: 'var(--success-dim)', label: 'On Track' },
  optimism_gap: { color: 'var(--warning)', bg: 'var(--warning-dim)', label: 'Optimism Gap' },
  submission_gap: { color: 'var(--danger)', bg: 'var(--danger-dim)', label: 'Submission Gap' },
  vanity_metrics: { color: 'var(--purple)', bg: 'var(--purple-dim)', label: 'Vanity Metrics' },
  no_progress: { color: 'var(--danger)', bg: 'var(--danger-dim)', label: 'No Progress' },
  other: { color: 'var(--teal)', bg: 'var(--teal-dim)', label: 'Flagged' },
}

export default function EmployeeCard({ employee, index }) {
  const navigate = useNavigate()
  const analysis = employee.analysis
  const flagType = analysis?.flag_type || 'none'
  const flagStyle = FLAG_STYLES[flagType] || FLAG_STYLES.none
  const flagLabel = flagType === 'other' && analysis?.flag_label ? analysis.flag_label : flagStyle.label

  return (
    <div
      className="card card-interactive animate-in"
      style={{
        animationDelay: `${0.15 + index * 0.05}s`,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={() => navigate(`/employees/${employee.id}`)}
    >
      {/* Top accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: flagStyle.color,
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.2px' }}>
            {employee.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 2 }}>
            {employee.role}
          </div>
        </div>
        <span className="badge" style={{
          background: flagStyle.bg,
          color: flagStyle.color,
          border: `1px solid ${flagStyle.color}22`,
        }}>
          {flagLabel}
        </span>
      </div>

      {analysis && (
        <>
          {/* Submission rate */}
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.8px', color: 'var(--text-ghost)',
            }}>
              Submission
            </span>
            <span className="mono" style={{
              fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
            }}>
              {analysis.submission_rate} days
            </span>
          </div>

          {/* Summary */}
          <div style={{
            marginTop: 10,
            fontSize: 12.5,
            color: 'var(--text-secondary)',
            fontWeight: 500,
            lineHeight: 1.5,
          }}>
            {analysis.summary}
          </div>

          {/* Recommended action */}
          {analysis.recommended_action && (
            <div style={{
              marginTop: 12,
              padding: '8px 12px',
              background: 'var(--accent-glow)',
              borderRadius: 'var(--radius-sm)',
              borderLeft: '3px solid var(--accent)',
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.8px', color: 'var(--accent)',
              }}>
                Action
              </span>
              <div style={{
                fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginTop: 2,
              }}>
                {analysis.recommended_action}
              </div>
            </div>
          )}
        </>
      )}

      {!analysis && (
        <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-ghost)' }}>
          No analysis data yet. Run the pipeline to generate.
        </div>
      )}
    </div>
  )
}
