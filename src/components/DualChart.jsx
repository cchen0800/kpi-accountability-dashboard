const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const DAY_MAP = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4 }

function extractDailyMetrics(updates) {
  if (!updates || updates.length === 0) return null

  // Try to find two numeric KPIs that have daily values
  const dailyData = {}
  const metricPatterns = [
    { pattern: /(\d+)\s*dials?/i, label: 'Dials' },
    { pattern: /(\d+)\s*meetings?\s*(?:booked|locked|qualified)/i, label: 'Meetings Booked' },
    { pattern: /(\d+)\s*creators?\s*(?:onboarded|added|brought)/i, label: 'Creators Onboarded' },
    { pattern: /ROAS\s*(?:of\s*)?(\d+\.?\d*)x/i, label: 'ROAS' },
    { pattern: /(\d+\.?\d*)%\s*CTR/i, label: 'CTR %' },
  ]

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

  // Prefer dials + meetings for the vanity metrics showcase
  const dialsEntry = viable.find(([label]) => label === 'Dials')
  const meetingsEntry = viable.find(([label]) => label === 'Meetings Booked')

  if (dialsEntry && meetingsEntry) {
    return { activity: { label: dialsEntry[0], values: dialsEntry[1] }, outcome: { label: meetingsEntry[0], values: meetingsEntry[1] } }
  }

  return { activity: { label: viable[0][0], values: viable[0][1] }, outcome: { label: viable[1][0], values: viable[1][1] } }
}

function normalize(values, height) {
  const nums = values.filter(v => v !== null)
  if (nums.length === 0) return values.map(() => height / 2)
  const min = Math.min(...nums) * 0.85
  const max = Math.max(...nums) * 1.05
  const range = max - min || 1
  return values.map(v => v !== null ? height - ((v - min) / range) * height : null)
}

export default function DualChart({ updates, kpis }) {
  const metrics = extractDailyMetrics(updates)
  if (!metrics) return null

  const W = 360
  const H = 140
  const PAD_L = 0
  const PAD_R = 0
  const xStep = (W - PAD_L - PAD_R) / 4

  const actNorm = normalize(metrics.activity.values, H)
  const outNorm = normalize(metrics.outcome.values, H)

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

      <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: '100%', height: 'auto' }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => (
          <line
            key={pct}
            x1={PAD_L} x2={W - PAD_R}
            y1={pct * H} y2={pct * H}
            stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="4,4"
          />
        ))}

        {/* Activity line (purple/blue — effort) */}
        {actPath && (
          <path d={actPath} fill="none" stroke="var(--purple)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Outcome line (danger — results declining) */}
        {outPath && (
          <path d={outPath} fill="none" stroke="var(--danger)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Data points */}
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
