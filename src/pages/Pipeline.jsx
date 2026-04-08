import { useState, useEffect, useCallback } from 'react'
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
  { key: 'generate', label: 'Stage 1: Generated Standups', shortLabel: 'Standups' },
  { key: 'extract', label: 'Stage 2: Extracted KPIs', shortLabel: 'KPIs' },
  { key: 'reason', label: 'Stage 3: Accountability Flags', shortLabel: 'Flags' },
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
  const [introExpanded, setIntroExpanded] = useState(false)

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
      padding: '20px 16px var(--viewport-footer-gap)',
      width: '100%',
      maxWidth: 1200,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      minHeight: 'calc(100vh - 48px - var(--viewport-footer-gap))',
    }}>
      {/* Hero section */}
      <div className="animate-in" style={{ marginBottom: 20 }}>
        {/* Tagline */}
        <h1 style={{
          fontSize: 22,
          fontWeight: 800,
          color: 'var(--text)',
          letterSpacing: '-0.5px',
          margin: '0 0 6px',
        }}>
          Can AI catch what a CEO would miss?
        </h1>
        <p style={{
          fontSize: 13,
          color: 'var(--text-tertiary)',
          fontWeight: 500,
          lineHeight: 1.5,
          margin: '0 0 14px',
        }}>
          Watch three AI agents analyze a week of employee standups, blind to the truth hidden in each profile.
        </p>

        {/* Collapsible explainer */}
        <div className="card" style={{
          borderLeft: '3px solid var(--accent)',
          padding: 0,
          overflow: 'hidden',
          marginBottom: 14,
        }}>
          <button
            onClick={() => setIntroExpanded(prev => !prev)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font)',
            }}
          >
            <span style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text-secondary)',
              letterSpacing: '-0.01em',
            }}>
              How the experiment works
            </span>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-ghost)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{
                transition: 'transform 0.2s ease',
                transform: introExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                flexShrink: 0,
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div style={{
            maxHeight: introExpanded ? 600 : 0,
            opacity: introExpanded ? 1 : 0,
            transition: 'max-height 0.3s ease, opacity 0.2s ease',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '0 16px 16px',
              fontSize: 12.5,
              lineHeight: 1.7,
              color: 'var(--text-secondary)',
            }}>
              <p style={{ margin: '0 0 10px' }}>
                <strong style={{ color: 'var(--text)' }}>The scenario:</strong> Lumen Collective is a Series C UGC marketplace (180 employees, Austin TX)
                where the CEO mandated daily Slack standups to drive execution velocity. Five employees across
                Creator Ops, Client Success, Marketing, Sales, and Product report daily, each with their own
                writing style, KPI targets, and hidden performance patterns.
              </p>
              <p style={{ margin: '0 0 10px' }}>
                <strong style={{ color: 'var(--text)' }}>The problem:</strong> Nobody reads 25+ updates a day.
                But everyone writes them. People learn to write updates that <em>sound</em> productive
                without <em>being</em> productive. The real issues hide in plain sight.
              </p>
              <p style={{ margin: '0 0 10px' }}>
                <strong style={{ color: 'var(--text)' }}>The experiment:</strong> Each of the 5 employees below has a hidden performance truth baked into
                their profile: an optimism gap, vanity metrics, missing submissions, or stalled progress. Three independent
                AI agents process their standups sequentially: one loads the updates, one extracts KPIs blind, and one reasons
                over the data to flag accountability gaps. No agent sees the full picture. Can the system still surface
                what a busy CEO would miss?
              </p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: 'var(--text)' }}>Why this matters:</strong> This is what AI-first operations looks like. Automation over headcount,
                real-time visibility into team performance, and surfacing insights that would otherwise require hours
                of manual review. The kind of operational backbone that scales.
              </p>
            </div>
          </div>
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
                  <span className="mobile-hide">{tab.label}</span>
                  <span className="mobile-show">{tab.shortLabel}</span>
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div style={{ padding: '18px 20px', flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
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
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
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
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, fontStyle: 'italic' }}>
                    Sample: first standup from each employee
                  </div>
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
                              <td className="mono" style={{ padding: '8px 10px', color: row.status === 'missing' ? 'var(--text-ghost)' : 'var(--text-secondary)', fontStyle: row.status === 'missing' ? 'italic' : 'normal' }}>{row.status === 'missing' ? 'not reported' : row.actual}</td>
                              <td className="mono" style={{ padding: '8px 10px', color: row.status === 'missing' ? 'var(--text-ghost)' : 'var(--text-secondary)', fontStyle: row.status === 'missing' ? 'italic' : 'normal' }}>{row.status === 'missing' ? '' : row.delta}</td>
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 0 }}>
                <div style={{ maxWidth: 400, width: '100%' }}>
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ textAlign: 'center', marginBottom: 16 }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>
                      Accountability Flags
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-ghost)', fontWeight: 500, marginTop: 4 }}>
                      {reasonOutput.employee_count} employees analyzed independently by reasoning agent
                    </div>
                  </motion.div>
                  {reasonOutput.previews.map((row, i) => {
                    const flagStyle = FLAG_STYLES[row.flag_type] || FLAG_STYLES.none
                    const flagLabel = row.flag_type === 'other' && row.flag_label ? row.flag_label : flagStyle.label
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 + i * 0.06, ease: [0.4, 0, 0.2, 1] }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 0',
                          borderBottom: i < reasonOutput.previews.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{row.name}</div>
                          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-ghost)', marginTop: 1 }}>{row.role}</div>
                        </div>
                        <span className="badge" style={{
                          background: flagStyle.bg, color: flagStyle.color,
                          border: `1px solid ${flagStyle.color}22`,
                          fontSize: 10, flexShrink: 0,
                        }}>
                          {flagLabel}
                        </span>
                      </motion.div>
                    )
                  })}

                  {/* View dashboard button - glowing CTA */}
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 + reasonOutput.previews.length * 0.06 }}
                    onClick={() => navigate('/dashboard')}
                    className="glow-btn"
                    style={{
                      marginTop: 24,
                      width: '100%',
                      padding: '12px 0',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: '#4A72F5',
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'var(--font)',
                    color: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px) scale(1.03)'; e.currentTarget.style.animationPlayState = 'paused'; e.currentTarget.style.boxShadow = '0 0 28px rgba(74, 114, 245, 0.8), 0 0 56px rgba(74, 114, 245, 0.4), 0 0 84px rgba(74, 114, 245, 0.2)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.animationPlayState = 'running'; e.currentTarget.style.boxShadow = '' }}
                >
                  View Dashboard & Recommended Actions
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                  </svg>
                  </motion.button>
                </div>
              </div>
            )}
            </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}

    </div>
  )
}
