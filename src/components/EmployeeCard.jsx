import { useNavigate } from 'react-router-dom'
import { FLAG_STYLES, DEPARTMENTS } from '../lib/flags'

function parseKpiProgress(kpi) {
  const target = kpi.target || ''
  const actual = kpi.actual || ''

  // Extract numeric values
  const targetMatch = target.match(/(\d+(?:\.\d+)?)/)
  const actualMatch = actual.match(/(\d+(?:\.\d+)?)/)
  if (!targetMatch || !actualMatch) return null

  const targetNum = parseFloat(targetMatch[1])
  const actualNum = parseFloat(actualMatch[1])
  if (isNaN(targetNum) || targetNum === 0 || isNaN(actualNum)) return null

  // Detect inverted KPIs (lower is better): response time, duration thresholds
  const isInverted = /(<|response time|hr\b|hour)/i.test(target)

  let fillPct
  if (isInverted) {
    // For inverted: at target = 100%, above target = less fill
    fillPct = targetNum > 0 ? Math.min((targetNum / actualNum) * 100, 100) : 0
  } else {
    fillPct = Math.min((actualNum / targetNum) * 100, 100)
  }

  return { targetNum, actualNum, fillPct: Math.max(0, fillPct), isInverted }
}

function KpiProgressBar({ kpi }) {
  const isRisk = kpi.status === 'at_risk'
  const isMissing = kpi.status === 'missing'
  const isOnTrack = kpi.status === 'on_track'
  const barColor = isOnTrack ? 'var(--success)' : isRisk ? 'var(--warning)' : 'var(--danger)'
  const deltaColor = isOnTrack ? 'var(--success)' : isRisk ? 'var(--warning)' : 'var(--danger)'

  const progress = parseKpiProgress(kpi)
  const isQualitative = !progress && kpi.status !== 'missing'

  return (
    <div style={{ padding: '6px 0' }}>
      {/* KPI name + delta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {kpi.kpi_name}
        </span>
        {kpi.delta && kpi.delta !== '-' && (
          <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: deltaColor, marginLeft: 8, flexShrink: 0 }}>
            {kpi.delta}
          </span>
        )}
      </div>

      {/* Progress bar or qualitative status */}
      {progress ? (
        <>
          <div style={{
            height: 6, borderRadius: 3,
            background: 'var(--bg)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${progress.fillPct}%`,
              background: barColor,
              transition: 'width 0.6s ease',
            }} />
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-ghost)', marginTop: 2 }}>
            {kpi.actual} / {kpi.target}{progress.isInverted ? ' (lower is better)' : ''}
          </div>
        </>
      ) : isMissing ? (
        <>
          <div style={{
            height: 6, borderRadius: 3,
            background: 'var(--bg)',
            border: '1px dashed var(--border)',
          }} />
          <div style={{ fontSize: 10, color: 'var(--text-ghost)', marginTop: 2, fontStyle: 'italic' }}>
            not reported
          </div>
        </>
      ) : isQualitative ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: barColor }} />
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-ghost)' }}>
            {kpi.actual || kpi.target}
          </span>
        </div>
      ) : null}
    </div>
  )
}

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

      {/* 1. Header - name, role, department, flag badge */}
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
          {/* 2. KPI Progress Bars (centerpiece) */}
          {kpis.length > 0 && (
            <div style={{
              marginTop: 14,
              padding: '8px 10px',
              background: 'var(--bg)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
            }}>
              {kpis.map((kpi, i) => (
                <div key={i} style={{
                  borderBottom: i < kpis.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <KpiProgressBar kpi={kpi} />
                </div>
              ))}
            </div>
          )}

          {/* 3. Summary - AI analysis text */}
          <div style={{
            marginTop: 12,
            fontSize: 13,
            color: 'var(--text)',
            fontWeight: 500,
            lineHeight: 1.55,
          }}>
            {analysis.summary}
          </div>

          {/* 4. Submission Rate (demoted - ghost text) */}
          <div style={{
            marginTop: 8,
            fontSize: 11,
            color: 'var(--text-ghost)',
            fontWeight: 500,
          }}>
            Submissions: {analysis.submission_rate} days
          </div>

          {/* 5. Recommended action */}
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
