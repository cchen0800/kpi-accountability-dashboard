import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAtom } from 'jotai'
import { employeesAtom } from '../lib/store/employees'
import { lastRunAtom } from '../lib/store/pipeline'
import { fetchEmployees, fetchAllUpdates } from '../lib/api/employees'
import { fetchLastRun } from '../lib/api/pipeline'
import { sortBySeverity, FLAG_STYLES, worstDelta } from '../lib/flags'
import EmployeeCard from '../components/EmployeeCard'
import SlackFeed from '../components/SlackFeed'
import TeamRollup from '../components/TeamRollup'
import SentimentScatter from '../components/SentimentScatter'

export default function Dashboard() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useAtom(employeesAtom)
  const [lastRun, setLastRun] = useAtom(lastRunAtom)
  const [allUpdates, setAllUpdates] = useState([])
  const [slackOpen, setSlackOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [emps, run, updates] = await Promise.all([fetchEmployees(), fetchLastRun(), fetchAllUpdates()])
      setEmployees(emps)
      setLastRun(run)
      setAllUpdates(updates)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [setEmployees, setLastRun])

  useEffect(() => { loadData() }, [loadData])

  const sorted = useMemo(() => sortBySeverity(employees), [employees])

  const updatesByEmpId = useMemo(() => {
    const map = {}
    for (const entry of allUpdates) {
      map[entry.id] = entry.updates || []
    }
    return map
  }, [allUpdates])

  const headline = useMemo(() => {
    const hasAnalysis = employees.some(e => e.analysis)
    if (!hasAnalysis || employees.length === 0) return null

    // Count KPIs at risk + missing across all employees
    let atRisk = 0, missing = 0, totalKpis = 0
    for (const emp of employees) {
      for (const kpi of (emp.kpi_extractions || [])) {
        totalKpis++
        if (kpi.status === 'at_risk') atRisk++
        else if (kpi.status === 'missing') missing++
      }
    }

    const troubled = atRisk + missing
    if (troubled === 0) return 'All KPIs are on track this week.'

    // Find employees furthest from targets (worst deltas)
    const withDeltas = employees
      .filter(e => (e.kpi_extractions || []).some(k => k.delta && k.delta !== '-' && parseFloat(k.delta) < 0))
      .sort((a, b) => worstDelta(a) - worstDelta(b))
      .slice(0, 2)
      .map(e => e.name)

    const namesStr = withDeltas.length > 0 ? ` ${withDeltas.join(' and ')} ${withDeltas.length === 1 ? 'is' : 'are'} furthest from targets.` : ''
    return `${troubled} of ${totalKpis} KPIs are at risk or missing data this week.${namesStr}`
  }, [employees])

  return (
    <>
      {/* Slack drawer - slides in from the left */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 'min(400px, 85vw)',
        height: '100vh',
        background: 'var(--card)',
        borderRight: '1px solid var(--border)',
        boxShadow: slackOpen ? 'var(--shadow-elevated)' : 'none',
        transform: slackOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Close button */}
        <button
          onClick={() => setSlackOpen(false)}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 10,
            width: 28, height: 28,
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            color: 'var(--text-ghost)',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-active)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-ghost)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {allUpdates.length > 0 ? (
          <SlackFeed allEmployees={allUpdates} fullHeight />
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-ghost)',
            fontSize: 13,
            gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>#</span>
            <span>daily-standup</span>
            <span style={{ fontSize: 12 }}>Run analysis to generate updates</span>
          </div>
        )}
      </div>

      {/* Backdrop */}
      {slackOpen && (
        <div
          onClick={() => setSlackOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.15)',
            zIndex: 99,
            transition: 'opacity 0.3s ease',
          }}
        />
      )}

      {/* Main dashboard */}
      <div className="dash-main" style={{ padding: '20px 16px 40px' }}>
        {/* Header */}
        <div className="animate-in" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Slack drawer toggle */}
            <button
              onClick={() => setSlackOpen(true)}
              style={{
                width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--bg-raised)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                color: 'var(--text-ghost)',
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-active)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-glow)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-ghost)'; e.currentTarget.style.background = 'var(--bg-raised)' }}
              title="Open #daily-standup feed"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px' }}>
                Team Performance
              </h1>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 1 }}>
                Lumen Collective - Agentic Performance Analysis
              </div>
            </div>
          </div>

          {lastRun?.has_run && (
            <div className="mobile-hide" style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--text-ghost)', fontWeight: 500 }}>
                Last analyzed
              </div>
              <div className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {new Date(lastRun.started_at).toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {/* Executive headline */}
        {!loading && headline && (
          <div className="animate-in" style={{
            padding: '12px 14px',
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            marginBottom: 0,
          }}>
            {headline}
          </div>
        )}

        {/* Team rollup + visualizations row */}
        {!loading && (() => {
          const showViz = allUpdates.length > 0 && employees.some(e => e.analysis)
          if (!showViz) return <div style={{ marginTop: 20 }}><TeamRollup employees={employees} allUpdates={allUpdates} /></div>
          return (
            <div className="mobile-stack" style={{
              display: 'grid',
              gridTemplateColumns: '55fr 45fr',
              gap: 14,
              marginTop: 20,
              gridTemplateRows: '1fr',
            }}>
              <TeamRollup employees={employees} allUpdates={allUpdates} />
              <div style={{ minHeight: 0, overflow: 'hidden' }}>
                <SentimentScatter employees={employees} allUpdates={allUpdates} />
              </div>
            </div>
          )
        })()}

        {/* Employee cards - full width */}
        <div style={{ marginTop: 24 }}>
          <div className="section-header">Team Performance</div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40, gap: 6 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--accent)',
                  animation: 'progress-pulse 1.2s ease-in-out infinite',
                  animationDelay: `${i * 0.15}s`,
                }} />
              ))}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${sorted.length || 5}, 1fr)`,
              gap: 14,
            }}>
              {sorted.map((emp, i) => {
                const flagType = emp.analysis?.flag_type || 'none'
                const flaggedIndex = flagType !== 'none'
                  ? sorted.filter(e => e.analysis?.flag_type && e.analysis.flag_type !== 'none').indexOf(emp)
                  : -1
                return (
                  <EmployeeCard
                    key={emp.id}
                    employee={emp}
                    index={i}
                    priorityRank={flaggedIndex >= 0 ? flaggedIndex + 1 : null}
                    updates={updatesByEmpId[emp.id]}
                  />
                )
              })}
            </div>
          )}
        </div>

      </div>
    </>
  )
}
