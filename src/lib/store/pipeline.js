import { atom } from 'jotai'

// { status: 'idle'|'generating'|'extracting'|'reasoning'|'complete'|'error', stage: string|null, error: string|null }
export const pipelineStatusAtom = atom({ status: 'idle', stage: null, error: null })

// { has_run, started_at, completed_at, duration_seconds, total_tokens, total_cost_cents }
export const lastRunAtom = atom(null)
