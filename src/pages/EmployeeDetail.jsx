import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchEmployee } from '../lib/api/employees'
import KpiTable from '../components/KpiTable'
import SubmissionCalendar from '../components/SubmissionCalendar'
import AnalysisDetail from '../components/AnalysisDetail'
import SlackFeed from '../components/SlackFeed'

const FLAG_STYLES = {
  none: { color: 'var(--success)', bg: 'var(--success-dim)', label: 'On Track' },
  optimism_gap: { color: 'var(--warning)', bg: 'var(--warning-dim)', label: 'Optimism Gap' },
  submission_gap: { color: 'var(--danger)', bg: 'var(--danger-dim)', label: 'Submission Gap' },
  vanity_metrics: { color: 'var(--purple)', bg: 'var(--purple-dim)', label: 'Vanity Metrics' },
  no_progress: { color: 'var(--danger)', bg: 'var(--danger-dim)', label: 'No Progress' },
  other: { color: 'var(--teal)', bg: 'var(--teal-dim)', label: 'Flagged' },
}

export default function EmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchEmployee(id)
      .then(setEmployee)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--accent)',
            animation: 'progress-pulse 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.15}s`,
          }} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>
        <div className="card-elevated" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--danger)' }}>Error</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>{error}</div>
        </div>
      </div>
    )
  }

  if (!employee) return null

  const analysis = employee.analysis
  const flagType = analysis?.flag_type || 'none'
  const flagStyle = FLAG_STYLES[flagType] || FLAG_STYLES.none
  const flagLabel = flagType === 'other' && analysis?.flag_label ? analysis.flag_label : flagStyle.label

  return (
    <div style={{ padding: '24px 28px 40px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Back button */}
      <button
        className="animate-in"
        onClick={() => navigate('/')}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', padding: 0,
          fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)',
          fontFamily: 'var(--font)', cursor: 'pointer',
          marginBottom: 20,
          transition: 'color 0.2s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </button>

      {/* Employee header */}
      <div className="animate-in" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 24, paddingBottom: 18, borderBottom: '1px solid var(--border)',
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px' }}>
            {employee.name}
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 2 }}>
            {employee.role} · Reports to {employee.manager}
          </div>
        </div>
        <span className="badge" style={{
          background: flagStyle.bg,
          color: flagStyle.color,
          border: `1px solid ${flagStyle.color}22`,
          fontSize: 13,
          padding: '5px 14px',
        }}>
          {flagLabel}
        </span>
      </div>

      {/* Content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <KpiTable kpis={employee.kpi_extractions} />
          <AnalysisDetail analysis={analysis} />
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SubmissionCalendar updates={employee.updates} />
          <SlackFeed
            updates={employee.updates}
            employeeName={employee.name}
            employeeId={employee.id}
          />
        </div>
      </div>
    </div>
  )
}
