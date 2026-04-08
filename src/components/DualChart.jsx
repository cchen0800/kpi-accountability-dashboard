const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const DAY_MAP = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4 }

function extractDailyMetrics(updates, kpis) {
  if (!updates || updates.length === 0) return null

  const metricPatterns = [
    { pattern: /(\d+)\s*dials?/i, label: 'Dials' },
    { pattern: /(\d+)\s*meetings?\s*(?:booked|locked|qualified|set)/i, label: 'Meetings Booked' },
    { pattern: /(\d+)\s*creators?\s*(?:onboarded|added|brought)/i, label: 'Creators Onboarded' },
    { pattern: /ROAS\s*(?:of\s*)?(\d+\.?\d*)x/i, label: 'ROAS' },
    { pattern: /(\d+\.?\d*)%\s*CTR/i, label: 'CTR %' },
  ]

  const dailyData = {}
  for (const update of updates) {
    const dayIdx = DAY_MAP[update.day?.toLowerCase()]
    if (dayIdx === undefined) continue

    for (const { pattern, label } of metricPatterns) {
      const match = update.content?.match(pattern)
      if (match) {
        if (!dailyData[label]) dailyData[label] = Array(5).fill(null)
        dailyData[label][dayIdx] = parseFloat(match[1])
      }
    }
  }

  // Find two metrics with enough daily data points (3+)
  const viable = Object.entries(dailyData)
    .filter(([, vals]) => vals.filter(v => v !== null).length >= 3)

  if (viable.length < 2) return null

  // Cross-check against structured KPI data to reject nonsensical regex extractions.
  if (kpis && kpis.length > 0) {
    for (const [label, vals] of viable) {
      const nums = vals.filter(v => v !== null)
      const sum = nums.reduce((a, b) => a + b, 0)
      const max = Math.max(...nums)

      const matchingKpi = kpis.find(k => {
        const name = (k.kpi_name || '').toLowerCase()
        return (label === 'Dials' && name.includes('dial')) ||
               (label === 'Meetings Booked' && name.includes('meeting')) ||
               (label === 'Creators Onboarded' && name.includes('creator') && name.includes('onboard'))
      })

      if (matchingKpi) {
        const actualNum = parseFloat((matchingKpi.actual || '').match(/(\d+(?:\.\d+)?)/)?.[1])
        const targetNum = parseFloat((matchingKpi.target || '').match(/(\d+(?:\.\d+)?)/)?.[1])
        if (!isNaN(actualNum) && actualNum > 0) {
          const ratio = sum / actualNum
          if (ratio < 0.3 || ratio > 3) return null
        }
        if (!isNaN(targetNum) && targetNum > 0 && max > targetNum * 1.5) return null
      }
    }
  }

  // Prefer dials + meetings for the vanity metrics showcase
  const dialsEntry = viable.find(([label]) => label === 'Dials')
  const meetingsEntry = viable.find(([label]) => label === 'Meetings Booked')

  if (dialsEntry && meetingsEntry) {
    return { activity: { label: dialsEntry[0], values: dialsEntry[1] }, outcome: { label: meetingsEntry[0], values: meetingsEntry[1] } }
  }

  return { activity: { label: viable[0][0], values: viable[0][1] }, outcome: { label: viable[1][0], values: viable[1][1] } }
}

// Normalize each series independently to fill the chart height.
// Uses a % change from baseline approach so trend direction is preserved.
function normalizeToHeight(values, height) {
  const nums = values.filter(v => v !== null)
  if (nums.length === 0) return values.map(() => height / 2)
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const range = max - min || 1
  // Add 15% padding top and bottom so points don't hit the edges
  return values.map(v =>
    v !== null ? height * 0.1 + ((max - v) / range) * height * 0.8 : null
  )
}

export default function DualChart({ updates, kpis }) {
  const metrics = extractDailyMetrics(updates, kpis)
  if (!metrics) return null

  const W = 360
  const H = 140
  const PAD_L = 28   // room for leftmost labels
  const PAD_R = 28   // room for rightmost labels
  const xStep = (W - PAD_L - PAD_R) / 4

  const actNorm = normalizeToHeight(metrics.activity.values, H)
  const outNorm = normalizeToHeight(metrics.outcome.values, H)

  function buildPath(normalized) {
    const points = normalized
      .map((y, i) => y !== null ? { x: PAD_L + i * xStep, y } : null)
      .filter(Boolean)
    if (points.length < 2) return ''
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  }

  const actPath = buildPath(actNorm)
  const outPath = buildPath(outNorm)

  return (
    <div className="card-elevated animate-in" style={{ animationDelay: '0.1s' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
        Activity vs Outcome Trend
      </div>

      <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => (
          <line
            key={pct}
            x1={PAD_L} x2={W - PAD_R}
            y1={pct * H} y2={pct * H}
            stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="4,4"
          />
        ))}

        {/* Activity line (purple - effort) */}
        {actPath && (
          <path d={actPath} fill="none" stroke="var(--purple)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Outcome line (danger - results) */}
        {outPath && (
          <path d={outPath} fill="none" stroke="var(--danger)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Data points + labels */}
        {actNorm.map((y, i) => y !== null && (
          <g key={`a${i}`}>
            <circle cx={PAD_L + i * xStep} cy={y} r="4" fill="var(--purple)" />
            <text
              x={PAD_L + i * xStep} y={y - 8}
              textAnchor="middle" fill="var(--purple)"
              fontSize="10" fontWeight="700" fontFamily="var(--font-mono)"
            >
              {metrics.activity.values[i]}
            </text>
          </g>
        ))}
        {outNorm.map((y, i) => y !== null && (
          <g key={`o${i}`}>
            <circle cx={PAD_L + i * xStep} cy={y} r="4" fill="var(--danger)" />
            <text
              x={PAD_L + i * xStep} y={y + 16}
              textAnchor="middle" fill="var(--danger)"
              fontSize="10" fontWeight="700" fontFamily="var(--font-mono)"
            >
              {metrics.outcome.values[i]}
            </text>
          </g>
        ))}

        {/* Day labels */}
        {DAYS.map((day, i) => (
          <text
            key={day}
            x={PAD_L + i * xStep} y={H + 16}
            textAnchor="middle" fill="var(--text-ghost)"
            fontSize="10" fontWeight="600" fontFamily="var(--font)"
          >
            {day}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 3, borderRadius: 2, background: 'var(--purple)' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {metrics.activity.label} (activity)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 3, borderRadius: 2, background: 'var(--danger)' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {metrics.outcome.label} (outcome)
          </span>
        </div>
      </div>
    </div>
  )
}
