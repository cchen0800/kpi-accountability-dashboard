// Shared flag constants — severity ordering, colors, labels

export const FLAG_SEVERITY = {
  submission_gap: 1,
  no_progress: 2,
  vanity_metrics: 3,
  optimism_gap: 4,
  other: 5,
  none: 99,
}

export const FLAG_STYLES = {
  none: { color: 'var(--success)', bg: 'var(--success-dim)', label: 'On Track' },
  optimism_gap: { color: 'var(--warning)', bg: 'var(--warning-dim)', label: 'Optimism Gap' },
  submission_gap: { color: 'var(--danger)', bg: 'var(--danger-dim)', label: 'Submission Gap' },
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

export function sortBySeverity(employees) {
  return [...employees].sort((a, b) => {
    const aFlag = a.analysis?.flag_type || 'none'
    const bFlag = b.analysis?.flag_type || 'none'
    return getFlagSeverity(aFlag) - getFlagSeverity(bFlag)
  })
}
