import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAtom } from 'jotai'
import { pipelineStatusAtom } from '../lib/store/pipeline'
import { fetchStageOutput } from '../lib/api/pipeline'
import PipelineControl from '../components/PipelineControl'

const FLAG_STYLES = {
  none: { color: 'var(--success)', bg: 'var(--success-dim)', label: 'On Track' },
  optimism_gap: { color: 'var(--warning)', bg: 'var(--warning-dim)', label: 'Optimism Gap' },
  submission_gap: { color: 'var(--danger)', bg: 'var(--danger-dim)', label: 'Submission Gap' },
  vanity_metrics: { color: 'var(--purple)', bg: 'var(--purple-dim)', label: 'Vanity Metrics' },
  no_progress: { color: 'var(--danger)', bg: 'var(--danger-dim)', label: 'No Progress' },
  other: { color: 'var(--teal)', bg: 'var(--teal-dim)', label: 'Flagged' },
}

const STATUS_STYLES = {
  on_track: { color: 'var(--success)', label: 'On Track' },
  at_risk: { color: 'var(--warning)', label: 'At Risk' },
  missing: { color: 'var(--danger)', label: 'Missing' },
}

const AVATAR_COLORS = ['#2EB67D', '#E01E5A', '#ECB22E', '#36C5F0', '#7C3AED']

const TABS = [
  { key: 'generate', label: 'Stage 1 — Generated Standups', shortLabel: 'Standups' },
  { key: 'extract', label: 'Stage 2 — Extracted KPIs', shortLabel: 'KPIs' },
  { key: 'reason', label: 'Stage 3 — Accountability Flags', shortLabel: 'Flags' },
]

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase()
}

export default function Pipeline() {
  const navigate = useNavigate()
  const [status] = useAtom(pipelineStatusAtom)
  const [generateOutput, setGenerateOutput] = useState(null)
  const [extractOutput, setExtractOutput] = useState(null)
  const [reasonOutput, setReasonOutput] = useState(null)
  const [activeTab, setActiveTab] = useState(null)

  const isGenerateDone = ['stage_generate_done', 'extracting', 'stage_extract_done', 'reasoning', 'complete'].includes(status.status)
  const isExtractDone = ['stage_extract_done', 'reasoning', 'complete'].includes(status.status)
  const isReasonDone = status.status === 'complete'

  // Auto-advance tab to most recently completed stage
  useEffect(() => {
    if (isReasonDone) setActiveTab('reason')
    else if (isExtractDone) setActiveTab('extract')
    else if (isGenerateDone) setActiveTab('generate')
    else setActiveTab(null)
  }, [isGenerateDone, isExtractDone, isReasonDone])

  const loadOutputs = useCallback(async () => {
    if (isGenerateDone && !generateOutput) {
      try { setGenerateOutput(await fetchStageOutput('generate')) } catch {}
    }
    if (isExtractDone && !extractOutput) {
      try { setExtractOutput(await fetchStageOutput('extract')) } catch {}
    }
    if (isReasonDone && !reasonOutput) {
      try { setReasonOutput(await fetchStageOutput('reason')) } catch {}
    }
  }, [isGenerateDone, isExtractDone, isReasonDone, generateOutput, extractOutput, reasonOutput])

  useEffect(() => { loadOutputs() }, [loadOutputs])

  // Reset outputs when a new run starts
  useEffect(() => {
    if (status.status === 'generating') {
      setGenerateOutput(null)
      setExtractOutput(null)
      setReasonOutput(null)
      setActiveTab(null)
    }
  }, [status.status])

  const isTabAvailable = (key) => {
    if (key === 'generate') return isGenerateDone
    if (key === 'extract') return isExtractDone
    if (key === 'reason') return isReasonDone
    return false
  }

  const hasAnyOutput = isGenerateDone || isExtractDone || isReasonDone

  return (
    <div style={{ padding: '24px 28px 40px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div className="animate-in" style={{
        marginBottom: 24, paddingBottom: 18,
        borderBottom: '1px solid var(--border)',
      }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.3px' }}>
          Agentic Analysis Pipeline
        </h1>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 2 }}>
          Three independent GPT agents process data sequentially — generate synthetic standups, extract KPIs, and flag accountability gaps
        </div>
      </div>

      {/* Pipeline control (stage cards) */}
      <PipelineControl onComplete={loadOutputs} onReset={() => {
        setGenerateOutput(null)
        setExtractOutput(null)
        setReasonOutput(null)
        setActiveTab(null)
      }} />

      {/* Output panel with tab bar */}
      {hasAnyOutput && (
        <div className="card animate-in" style={{ marginTop: 24, animationDelay: '0.1s', padding: 0, overflow: 'hidden' }}>
          {/* Tab bar */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-raised)',
          }}>
            {TABS.map((tab, i) => {
              const available = isTabAvailable(tab.key)
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => available && setActiveTab(tab.key)}
                  disabled={!available}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 500,
                    fontFamily: 'var(--font)',
                    color: !available ? 'var(--text-ghost)' : isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: available ? 'pointer' : 'not-allowed',
                    opacity: available ? 1 : 0.4,
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700,
                    background: available ? (isActive ? 'var(--accent)' : 'var(--success)') : 'var(--bg)',
                    color: available ? '#fff' : 'var(--text-ghost)',
                    border: available ? 'none' : '1px solid var(--border)',
                  }}>
                    {available ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  {tab.shortLabel}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div style={{ padding: '18px 20px' }}>
            {/* Generate panel */}
            {activeTab === 'generate' && generateOutput && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-ghost)', fontWeight: 500 }}>
                    Sample: first standup from each employee
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--success)',
                    background: 'var(--success-dim)', padding: '3px 10px',
                    borderRadius: 20,
                  }}>
                    {generateOutput.employee_count} employees x 5 days = {generateOutput.total} standups
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {generateOutput.previews.map((msg, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex', gap: 10, padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        background: i % 2 === 0 ? 'var(--bg)' : 'transparent',
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font)',
                      }}>
                        {getInitials(msg.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{msg.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-ghost)', fontWeight: 500 }}>
                            {msg.day?.charAt(0).toUpperCase() + msg.day?.slice(1)}
                          </span>
                        </div>
                        <div style={{
                          fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 400,
                          lineHeight: 1.5, marginTop: 2,
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Extract panel */}
            {activeTab === 'extract' && extractOutput && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-ghost)', fontWeight: 500 }}>
                    Top KPI per employee (hidden truth NOT provided to this agent)
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--accent)',
                    background: 'var(--accent-glow)', padding: '3px 10px',
                    borderRadius: 20,
                  }}>
                    {extractOutput.total} KPIs extracted across {extractOutput.employee_count} employees
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Employee', 'KPI', 'Target', 'Actual', 'Delta', 'Status', 'Submissions'].map(h => (
                          <th key={h} style={{
                            padding: '8px 10px', textAlign: 'left',
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '0.8px', color: 'var(--text-ghost)',
                            background: 'var(--bg-raised)',
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {extractOutput.previews.map((row, i) => {
                        const statusStyle = STATUS_STYLES[row.status] || STATUS_STYLES.missing
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text)' }}>
                              {row.name}
                              <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-ghost)' }}>{row.role}</div>
                            </td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 500 }}>{row.kpi_name}</td>
                            <td className="mono" style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{row.target}</td>
                            <td className="mono" style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{row.actual}</td>
                            <td className="mono" style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{row.delta}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <span className="badge" style={{
                                background: statusStyle.color + '18',
                                color: statusStyle.color,
                                border: `1px solid ${statusStyle.color}22`,
                                fontSize: 10,
                              }}>
                                {statusStyle.label}
                              </span>
                            </td>
                            <td className="mono" style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                              {row.submission_rate}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Reason panel */}
            {activeTab === 'reason' && reasonOutput && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-ghost)', fontWeight: 500 }}>
                    Flags assigned independently by reasoning agent (hidden truth NOT provided)
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--purple)',
                    background: 'var(--purple-dim)', padding: '3px 10px',
                    borderRadius: 20,
                  }}>
                    {reasonOutput.employee_count} employees analyzed
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {reasonOutput.previews.map((row, i) => {
                    const flagStyle = FLAG_STYLES[row.flag_type] || FLAG_STYLES.none
                    const flagLabel = row.flag_type === 'other' && row.flag_label ? row.flag_label : flagStyle.label
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg)',
                        border: `1px solid ${flagStyle.color}22`,
                      }}>
                        <div style={{ flexShrink: 0, minWidth: 100 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{row.name}</div>
                          <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-ghost)', marginTop: 1 }}>{row.role}</div>
                        </div>
                        <span className="badge" style={{
                          background: flagStyle.bg, color: flagStyle.color,
                          border: `1px solid ${flagStyle.color}22`,
                          fontSize: 10, flexShrink: 0,
                        }}>
                          {flagLabel}
                        </span>
                        <div style={{
                          fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500,
                          lineHeight: 1.5, flex: 1,
                        }}>
                          {row.summary}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* View dashboard button */}
                <button
                  onClick={() => navigate('/')}
                  style={{
                    marginTop: 16,
                    width: '100%',
                    padding: '10px 0',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--accent)',
                    background: 'var(--accent-glow)',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'var(--font)',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-glow)'; e.currentTarget.style.color = 'var(--accent)' }}
                >
                  View Full Dashboard
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
