import { useEffect, useRef, useCallback } from 'react'
import { useAtom } from 'jotai'
import { pipelineStatusAtom } from '../lib/store/pipeline'
import { triggerPipeline, fetchPipelineStatus } from '../lib/api/pipeline'

const STAGES = [
  { key: 'generating', label: 'Generating updates...' },
  { key: 'extracting', label: 'Extracting KPIs...' },
  { key: 'reasoning', label: 'Reasoning about accountability...' },
]

export default function PipelineControl({ onComplete }) {
  const [status, setStatus] = useAtom(pipelineStatusAtom)
  const pollRef = useRef(null)

  const isRunning = ['pending', 'generating', 'extracting', 'reasoning'].includes(status.status)

  const poll = useCallback(async () => {
    try {
      const data = await fetchPipelineStatus()
      setStatus(data)
      if (data.status === 'complete' || data.status === 'error') {
        clearInterval(pollRef.current)
        pollRef.current = null
        if (data.status === 'complete' && onComplete) onComplete()
      }
    } catch {
      // ignore poll errors
    }
  }, [setStatus, onComplete])

  useEffect(() => {
    // Check initial status
    fetchPipelineStatus().then(data => {
      setStatus(data)
      if (['pending', 'generating', 'extracting', 'reasoning'].includes(data.status)) {
        pollRef.current = setInterval(poll, 2000)
      }
    }).catch(() => {})
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const handleRun = async () => {
    try {
      await triggerPipeline()
      setStatus({ status: 'pending', stage: null, error: null })
      pollRef.current = setInterval(poll, 2000)
    } catch (e) {
      if (e.status === 409) {
        setStatus(prev => ({ ...prev, error: 'Pipeline already running' }))
      }
    }
  }

  const activeStageIndex = STAGES.findIndex(s => s.key === status.status)
  const activeLabel = activeStageIndex >= 0 ? STAGES[activeStageIndex].label : null

  return (
    <div className="animate-in" style={{ animationDelay: '0.1s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={handleRun}
          disabled={isRunning}
          style={{
            background: isRunning ? 'var(--text-ghost)' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 22px',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'var(--font)',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: isRunning ? 0.7 : 1,
          }}
        >
          {isRunning ? 'Running...' : 'Run Analysis'}
        </button>

        {isRunning && activeLabel && (
          <span style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--accent)',
            animation: 'progress-pulse 1.5s ease-in-out infinite',
          }}>
            {activeLabel}
          </span>
        )}

        {status.status === 'error' && (
          <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>
            Error: {status.error}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {isRunning && (
        <div style={{
          display: 'flex',
          gap: 4,
          marginTop: 12,
          height: 4,
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          {STAGES.map((stage, i) => {
            const isCurrent = stage.key === status.status
            const isDone = activeStageIndex > i
            return (
              <div
                key={stage.key}
                style={{
                  flex: 1,
                  borderRadius: 2,
                  background: isDone ? 'var(--success)' : isCurrent ? 'var(--accent)' : 'var(--border)',
                  transition: 'background 0.4s ease',
                  animation: isCurrent ? 'progress-pulse 1.5s ease-in-out infinite' : 'none',
                }}
              />
            )
          })}
        </div>
      )}

      {/* Stage labels under progress bar */}
      {isRunning && (
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          {STAGES.map((stage, i) => {
            const isCurrent = stage.key === status.status
            const isDone = activeStageIndex > i
            return (
              <div key={stage.key} style={{
                flex: 1,
                fontSize: 10,
                fontWeight: isDone || isCurrent ? 600 : 500,
                color: isDone ? 'var(--success)' : isCurrent ? 'var(--accent)' : 'var(--text-ghost)',
                textAlign: 'center',
              }}>
                {isDone ? '✓ ' : ''}{stage.label.replace('...', '')}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
