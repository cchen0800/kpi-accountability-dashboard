import { get, post } from './core'

export const triggerPipeline = () => post('/pipeline/run')
export const fetchPipelineStatus = () => get('/pipeline/status', { retries: 0 })
export const fetchLastRun = () => get('/pipeline/last-run', { retries: 0 })
