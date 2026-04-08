import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAtom } from 'jotai'
import { motion, AnimatePresence } from 'framer-motion'
import { pipelineStatusAtom, lastRunAtom } from '../lib/store/pipeline'
import { fetchStageOutput, fetchLastRun } from '../lib/api/pipeline'
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
  const [lastRun, setLastRun] = useAtom(lastRunAtom)
  const [generateOutput, setGenerateOutput] = useState(null)
  const [extractOutput, setExtractOutput] = useState(null)
  const [reasonOutput, setReasonOutput] = useState(null)
  const [activeTab, setActiveTab] = useState(null)
  const [direction, setDirection] = useState(0)
  const [sessionRuns, setSessionRuns] = useState(0)
  const lastRunIdRef = useRef(null)

  const TAB_INDEX = { generate: 0, extract: 1, reason: 2 }

  const switchTab = (key) => {
    if (key === activeTab) return
    setDirection(TAB_INDEX[key] > TAB_INDEX[activeTab] ? 1 : -1)
    setActiveTab(key)
  }

  const isGenerateDone = ['stage_generate_done', 'extracting', 'stage_extract_done', 'reasoning', 'complete'].includes(status.status)
  const isExtractDone = ['stage_extract_done', 'reasoning', 'complete'].includes(status.status)
  const isReasonDone = status.status === 'complete'

  // Auto-advance tab to most recently completed stage (always forward)
  useEffect(() => {
    if (isReasonDone) { setDirection(1); setActiveTab('reason') }
    else if (isExtractDone) { setDirection(1); setActiveTab('extract') }
    else if (isGenerateDone) { setDirection(1); setActiveTab('generate') }
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
    // Refresh lastRun when any stage completes
    try { setLastRun(await fetchLastRun()) } catch {}
  }, [isGenerateDone, isExtractDone, isReasonDone, generateOutput, extractOutput, reasonOutput, setLastRun])

  useEffect(() => { loadOutputs() }, [loadOutputs])

  // Track session run count
  useEffect(() => {
    if (lastRun?.has_run && lastRun.id && lastRun.id !== lastRunIdRef.current) {
      if (lastRunIdRef.current !== null) {
        setSessionRuns(prev => prev + 1)
      }
      lastRunIdRef.current = lastRun.id
    }
  }, [lastRun])

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
    <div style={{
      padding: '24px 28px var(--viewport-footer-gap)',
      width: '100%',
      maxWidth: 1200,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      height: 'calc(100vh - 48px - var(--viewport-footer-gap))',
    }}>
      {/* Pipeline control (stage cards) */}
      <PipelineControl onComplete={loadOutputs} onReset={() => {
        setGenerateOutput(null)
        setExtractOutput(null)
        setReasonOutput(null)
        setActiveTab(null)
      }} />

      {/* Output panel with tab bar */}
      {hasAnyOutput && (
        <div className="card animate-in" style={{
          marginTop: 24, animationDelay: '0.1s', padding: 0,
          flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
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
                  onClick={() => available && switchTab(tab.key)}
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
          <div style={{ padding: '18px 20px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div
              key={activeTab}
              custom={direction}
              variants={{
                initial: (d) => ({ x: d * 80, opacity: 0 }),
                animate: { x: 0, opacity: 1 },
                exit: (d) => ({ x: d * -80, opacity: 0 }),
              }}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.12, ease: [0.4, 0, 0.2, 1] }}
            >
            {/* Generate panel */}
            {activeTab === 'generate' && generateOutput && (
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}
                >
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
                </motion.div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {generateOutput.previews.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: 0.1 + i * 0.08, ease: [0.4, 0, 0.2, 1] }}
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
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Extract panel */}
            {activeTab === 'extract' && extractOutput && (
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}
                >
                  <div style={{ fontSize: 11, color: 'var(--text-ghost)', fontWeight: 500 }}>
                    All KPIs per employee (hidden truth NOT provided to this agent)
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--accent)',
                    background: 'var(--accent-glow)', padding: '3px 10px',
                    borderRadius: 20,
                  }}>
                    {extractOutput.total} KPIs extracted across {extractOutput.employee_count} employees
                  </span>
                </motion.div>
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
                      {(() => {
                        // Group rows by employee name for rowSpan
                        const rows = extractOutput.previews
                        const groupCounts = {}
                        const firstInGroup = {}
                        rows.forEach((row, i) => {
                          if (!(row.name in groupCounts)) {
                            groupCounts[row.name] = 0
                            firstInGroup[row.name] = i
                          }
                          groupCounts[row.name]++
                        })

                        // Track group index for alternating backgrounds
                        const groupNames = [...new Set(rows.map(r => r.name))]
                        const groupIndex = {}
                        groupNames.forEach((name, gi) => { groupIndex[name] = gi })

                        return rows.map((row, i) => {
                          const statusStyle = STATUS_STYLES[row.status] || STATUS_STYLES.missing
                          const isFirst = firstInGroup[row.name] === i
                          const isLast = firstInGroup[row.name] + groupCounts[row.name] - 1 === i
                          const span = groupCounts[row.name]
                          const isEvenGroup = groupIndex[row.name] % 2 === 0
                          return (
                            <motion.tr
                              key={i}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: 0.1 + i * 0.04, ease: [0.4, 0, 0.2, 1] }}
                              style={{
                                borderBottom: isLast ? '2px solid var(--border)' : '1px solid var(--border-subtle)',
                                background: isEvenGroup ? 'transparent' : 'var(--bg-raised)',
                              }}
                            >
                              {isFirst && (
                                <td rowSpan={span} style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text)', verticalAlign: 'top', borderRight: '1px solid var(--border-subtle)' }}>
                                  {row.name}
                                  <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-ghost)' }}>{row.role}</div>
                                </td>
                              )}
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
                              {isFirst && (
                                <td rowSpan={span} className="mono" style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontWeight: 600, verticalAlign: 'top', borderLeft: '1px solid var(--border-subtle)' }}>
                                  {row.submission_rate}
                                </td>
                              )}
                            </motion.tr>
                          )
                        })
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Reason panel */}
            {activeTab === 'reason' && reasonOutput && (
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}
                >
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
                </motion.div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {reasonOutput.previews.map((row, i) => {
                    const flagStyle = FLAG_STYLES[row.flag_type] || FLAG_STYLES.none
                    const flagLabel = row.flag_type === 'other' && row.flag_label ? row.flag_label : flagStyle.label
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.1 + i * 0.08, ease: [0.4, 0, 0.2, 1] }}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg)',
                          border: `1px solid ${flagStyle.color}22`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{row.name}</span>
                          <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-ghost)' }}>{row.role}</span>
                          <span className="badge" style={{
                            background: flagStyle.bg, color: flagStyle.color,
                            border: `1px solid ${flagStyle.color}22`,
                            fontSize: 10,
                          }}>
                            {flagLabel}
                          </span>
                        </div>
                        <div style={{
                          fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 400,
                          lineHeight: 1.55,
                        }}>
                          {row.summary}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>

                {/* View dashboard button */}
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 + reasonOutput.previews.length * 0.08 }}
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
                </motion.button>
              </div>
            )}
            </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Run metadata footer */}
      {lastRun?.has_run && (
        <div className="animate-in" style={{
          animationDelay: '0.3s',
          marginTop: 16,
          marginBottom: 12,
          padding: '12px 16px',
          flexShrink: 0,
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          justifyContent: 'center',
          gap: 32,
        }}>
          {[
            { label: 'Session Runs', value: sessionRuns.toString() },
            { label: 'Tokens Used', value: lastRun.total_tokens?.toLocaleString() },
            { label: 'Cost', value: `$${(lastRun.total_cost_cents / 100).toFixed(4)}` },
            { label: 'Duration', value: lastRun.duration_seconds ? `${lastRun.duration_seconds.toFixed(1)}s` : '—' },
          ].map(item => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.8px', color: 'var(--text-ghost)',
              }}>
                {item.label}
              </div>
              <div className="mono" style={{
                fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2,
              }}>
                {item.value || '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
