import { useNavigate } from 'react-router-dom'
import { FLAG_STYLES, DEPARTMENTS } from '../lib/flags'

export default function EmployeeCard({ employee, index, priorityRank }) {
  const navigate = useNavigate()
  const analysis = employee.analysis
  const kpis = employee.kpi_extractions || []
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
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          {priorityRank && (
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: flagStyle.color, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 1,
            }}>
              {priorityRank}
            </div>
          )}
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.2px' }}>
              {employee.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 2 }}>
              {employee.role}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-ghost)', fontWeight: 500, marginTop: 1 }}>
              {DEPARTMENTS[employee.role] || employee.department || ''}
            </div>
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
          <div style={{
            marginTop: 14, display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px',
            background: 'var(--bg-raised)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.8px', color: 'var(--text-ghost)',
            }}>
              Submission
            </span>
            <span className="mono" style={{
              fontSize: 13, fontWeight: 700, color: flagType === 'submission_gap' ? 'var(--danger)' : 'var(--text)',
            }}>
              {analysis.submission_rate} days
            </span>
          </div>

          {/* KPIs */}
          {kpis.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {kpis.map((kpi, i) => {
                const isRisk = kpi.status === 'at_risk'
                const isMissing = kpi.status === 'missing'
                const statusColor = isRisk ? 'var(--warning)' : isMissing ? 'var(--danger)' : 'var(--success)'
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '4px 0',
                    borderBottom: i < kpis.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {kpi.kpi_name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-ghost)' }}>
                        {kpi.actual || '—'}<span style={{ color: 'var(--text-ghost)', margin: '0 2px' }}>/</span>{kpi.target || '—'}
                      </span>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: statusColor,
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

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
              padding: '10px 14px',
              background: flagType !== 'none' ? `${flagStyle.color}08` : 'var(--accent-glow)',
              borderRadius: 'var(--radius-sm)',
              borderLeft: `3px solid ${flagType !== 'none' ? flagStyle.color : 'var(--accent)'}`,
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.8px', color: flagType !== 'none' ? flagStyle.color : 'var(--accent)',
              }}>
                Recommended Action
              </span>
              <div style={{
                fontSize: 13, color: 'var(--text)', fontWeight: 600, marginTop: 4, lineHeight: 1.45,
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
