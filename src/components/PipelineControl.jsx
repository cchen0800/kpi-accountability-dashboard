import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAtom } from 'jotai'
import { pipelineStatusAtom, lastRunAtom } from '../lib/store/pipeline'
import { employeesAtom } from '../lib/store/employees'
import { triggerStage, fetchPipelineStatus, resetPipeline } from '../lib/api/pipeline'

const STAGES = [
  {
    key: 'generate',
    runningStatus: 'generating',
    doneStatus: 'stage_generate_done',
    label: 'Generate Standups',
    estimate: '~30s',
    description: 'GPT creates realistic daily standup updates for each employee using their writing style and hidden performance truth.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    key: 'extract',
    runningStatus: 'extracting',
    doneStatus: 'stage_extract_done',
    label: 'Extract KPIs',
    description: 'A second GPT agent reads the standups and extracts structured KPI data - targets, actuals, deltas - without seeing the hidden truth.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
  },
  {
    key: 'reason',
    runningStatus: 'reasoning',
    doneStatus: 'complete',
    label: 'Flag Accountability',
    description: 'A third GPT agent reasons over extracted data to identify accountability gaps, assign flags, and recommend CEO-level actions.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><circle cx="12" cy="12" r="10" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
]

function getStageState(stageIndex, pipelineStatus) {
  const stage = STAGES[stageIndex]

  // Currently running this stage
  if (pipelineStatus === stage.runningStatus) return 'running'

  // This stage is done
  if (pipelineStatus === stage.doneStatus) return 'done'

  // A later stage is running or done - this one must be done
  for (let i = stageIndex + 1; i < STAGES.length; i++) {
    if (pipelineStatus === STAGES[i].runningStatus ||
        pipelineStatus === STAGES[i].doneStatus) return 'done'
  }
  if (pipelineStatus === 'complete') return 'done'

  // Previous stage is done - this one is ready
  if (stageIndex === 0) return 'ready'
  const prev = STAGES[stageIndex - 1]
  if (pipelineStatus === prev.doneStatus) return 'ready'

  // A later previous stage is done
  for (let i = stageIndex; i < STAGES.length; i++) {
    if (pipelineStatus === STAGES[i].doneStatus) return 'done'
  }

  return 'locked'
}

export default function PipelineControl({ onComplete, onReset }) {
  const [status, setStatus] = useAtom(pipelineStatusAtom)
  const [, setLastRun] = useAtom(lastRunAtom)
  const [, setEmployees] = useAtom(employeesAtom)
  const pollRef = useRef(null)
  const [glowStage, setGlowStage] = useState(null)
  const glowTimerRef = useRef(null)

  const isRunning = ['pending', 'generating', 'extracting', 'reasoning'].includes(status.status)

  // Glow the first ready stage button — immediately for idle, 10s delay after a stage completes
  useEffect(() => {
    if (glowTimerRef.current) { clearTimeout(glowTimerRef.current); glowTimerRef.current = null }

    const s = status.status
    if (s === 'idle') {
      // First time user — glow stage 1 immediately
      setGlowStage('generate')
    } else if (s === 'stage_generate_done') {
      setGlowStage('extract')
    } else if (s === 'stage_extract_done') {
      setGlowStage('reason')
    } else {
      setGlowStage(null)
    }

    return () => { if (glowTimerRef.current) clearTimeout(glowTimerRef.current) }
  }, [status.status])

  const poll = useCallback(async () => {
    try {
      const data = await fetchPipelineStatus()
      setStatus(data)
      if (!['pending', 'generating', 'extracting', 'reasoning'].includes(data.status)) {
        clearInterval(pollRef.current)
        pollRef.current = null
        if (onComplete) onComplete()
      }
    } catch {
      // ignore
    }
  }, [setStatus, onComplete])

  useEffect(() => {
    fetchPipelineStatus().then(data => {
      setStatus(data)
      if (['pending', 'generating', 'extracting', 'reasoning'].includes(data.status)) {
        pollRef.current = setInterval(poll, 2000)
      }
    }).catch(() => {})
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const handleRunStage = async (stageKey) => {
    try {
      await triggerStage(stageKey)
      const runningStatus = STAGES.find(s => s.key === stageKey).runningStatus
      setStatus({ status: runningStatus, stage: stageKey, error: null })
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(poll, 2000)
    } catch (e) {
      if (e.status === 409) {
        if (!pollRef.current) pollRef.current = setInterval(poll, 2000)
        await poll()
        setStatus(prev => ({ ...prev, error: 'Pipeline already running - try again in a moment' }))
      } else {
        setStatus({ status: 'error', stage: null, error: e.message || 'Failed to start stage' })
      }
    }
  }

  return (
    <div className="card animate-in" style={{ animationDelay: '0.1s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>
            Agentic Analysis Pipeline
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 2 }}>
            Three independent GPT agents process data sequentially - each stage unlocks the next
          </div>
        </div>
      </div>

      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', gap: 0, alignItems: 'stretch' }}>
        {STAGES.map((stage, i) => {
          const state = getStageState(i, status.status)
          const isActive = state === 'running'
          const isDone = state === 'done'
          const isReady = state === 'ready'
          const isLocked = state === 'locked'

          const prevDone = i > 0 && (() => {
            const prevState = getStageState(i - 1, status.status)
            return prevState === 'done'
          })()

          return (
            <React.Fragment key={stage.key}>
              {i > 0 && (
                <div
                  className={`pipeline-connector${prevDone ? ' active' : ''}`}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="M12 5l7 7-7 7" />
                  </svg>
                </div>
              )}

              <div
                className="animate-in"
                style={{
                  animationDelay: `${0.15 + i * 0.08}s`,
                  padding: '16px 16px 20px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isActive ? 'var(--accent)' : isDone ? 'var(--success)' : 'var(--border)'}`,
                  background: isActive ? 'var(--accent-glow)' : isDone ? 'rgba(5, 150, 105, 0.04)' : 'var(--bg)',
                  opacity: isLocked ? 0.5 : 1,
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {/* Stage number + icon */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700,
                      background: isDone ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--bg-raised)',
                      color: isDone || isActive ? '#fff' : 'var(--text-tertiary)',
                      border: isDone || isActive ? 'none' : '1px solid var(--border)',
                      transition: 'all 0.3s ease',
                    }}>
                      {isDone ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span style={{
                      fontSize: 13, fontWeight: 700,
                      color: isDone ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--text)',
                    }}>
                      {stage.label}
                    </span>
                    {stage.estimate && !isDone && (
                      <span className="mono" style={{
                        fontSize: 11, fontWeight: 700,
                        color: 'var(--text-tertiary)',
                      }}>
                        {stage.estimate}
                      </span>
                    )}
                  </div>
                  <div style={{
                    color: isDone ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--text-ghost)',
                    transition: 'color 0.3s ease',
                  }}>
                    {stage.icon}
                  </div>
                </div>

                {/* Description */}
                <div style={{
                  fontSize: 11.5,
                  color: 'var(--text-tertiary)',
                  fontWeight: 500,
                  lineHeight: 1.5,
                  flex: 1,
                }}>
                  {stage.description}
                </div>

                {/* Action button */}
                <button
                  className={isReady && glowStage === stage.key ? 'glow-btn' : undefined}
                  onClick={() => { setGlowStage(null); handleRunStage(stage.key) }}
                  disabled={!isReady || isRunning}
                  style={{
                    width: '100%',
                    padding: '8px 0',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'var(--font)',
                    cursor: isReady && !isRunning ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    ...(isActive ? {
                      background: 'var(--accent)',
                      color: '#fff',
                      opacity: 0.8,
                    } : isDone ? {
                      background: 'rgba(5, 150, 105, 0.1)',
                      color: 'var(--success)',
                    } : isReady ? {
                      background: 'var(--accent)',
                      color: '#fff',
                    } : {
                      background: 'var(--bg-raised)',
                      color: 'var(--text-ghost)',
                    }),
                  }}
                >
                  {isActive ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Processing...
                    </>
                  ) : isDone ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Complete
                    </>
                  ) : isReady ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      Run
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      Locked
                    </>
                  )}
                </button>
              </div>
            </React.Fragment>
          )
        })}
      </div>
      {status.error && (
        <div style={{
          marginTop: 12,
          padding: '8px 12px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--danger-dim)',
          border: '1px solid var(--danger)',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--danger)',
        }}>
          Error: {status.error}
        </div>
      )}
    </div>
  )
}
