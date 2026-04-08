// Shared flag constants — severity ordering, colors, labels
// Performance flags rank above process flags (CEO-focused)

export const FLAG_SEVERITY = {
  no_progress: 1,
  vanity_metrics: 2,
  optimism_gap: 3,
  submission_gap: 4,
  other: 5,
  none: 99,
}

export const FLAG_STYLES = {
  none: { color: 'var(--success)', bg: 'var(--success-dim)', label: 'On Track' },
  optimism_gap: { color: 'var(--warning)', bg: 'var(--warning-dim)', label: 'Optimism Gap' },
  submission_gap: { color: 'var(--warning)', bg: 'var(--warning-dim)', label: 'Submission Gap' },
  vanity_metrics: { color: 'var(--purple)', bg: 'var(--purple-dim)', label: 'Vanity Metrics' },
  no_progress: { color: 'var(--danger)', bg: 'var(--danger-dim)', label: 'No Progress' },
  other: { color: 'var(--teal)', bg: 'var(--teal-dim)', label: 'Flagged' },
}

export const DEPARTMENTS = {
  'Creator Operations Associate': 'Creator Ops',
  'Client Success Manager': 'Client Success',
  'Performance Marketing Analyst': 'Performance Marketing',
  'Sales Development Rep': 'Sales',
  'Product Manager': 'Product',
}

export function getFlagSeverity(flagType) {
  return FLAG_SEVERITY[flagType] ?? FLAG_SEVERITY.none
}

export function worstDelta(employee) {
  const kpis = employee.kpi_extractions || []
  let worst = 0
  for (const kpi of kpis) {
    if (!kpi.delta || kpi.delta === '—') continue
    const match = kpi.delta.match(/^[+-]?(\d+(?:\.\d+)?)/)
    if (!match) continue
    const num = parseFloat(kpi.delta)
    if (isNaN(num)) continue
    // More negative = further from target = worse
    if (num < worst) worst = num
  }
  return worst
}

export function sortBySeverity(employees) {
  return [...employees].sort((a, b) => {
    const aFlag = a.analysis?.flag_type || 'none'
    const bFlag = b.analysis?.flag_type || 'none'
    const sevDiff = getFlagSeverity(aFlag) - getFlagSeverity(bFlag)
    if (sevDiff !== 0) return sevDiff
    // Secondary sort: worst delta (most negative first)
    return worstDelta(a) - worstDelta(b)
  })
}
