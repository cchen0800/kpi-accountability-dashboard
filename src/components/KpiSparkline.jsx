const PATTERNS = {
  dial: /(\d+)\s*dials?/i,
  meeting: /(\d+)\s*meetings?\s*(?:booked|locked|qualified|set)/i,
  creator: /(\d+)\s*creators?\s*(?:onboarded|added|brought)/i,
  experiment: /(\d+)\s*experiments?\s*(?:launched|ran|started)/i,
  session: /(\d+)\s*(?:research\s*)?sessions?/i,
}

const DAY_MAP = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4 }

function getPattern(kpiName) {
  const lower = kpiName.toLowerCase()
  if (lower.includes('dial')) return PATTERNS.dial
  if (lower.includes('meeting')) return PATTERNS.meeting
  if (lower.includes('creator')) return PATTERNS.creator
  if (lower.includes('experiment')) return PATTERNS.experiment
  if (lower.includes('session')) return PATTERNS.session
  return null
}

export default function KpiSparkline({ kpiName, updates }) {
  if (!updates || !kpiName) return null

  const pattern = getPattern(kpiName)
  if (!pattern) return null

  const points = []
  for (const update of updates) {
    const dayIndex = DAY_MAP[update.day?.toLowerCase()]
    if (dayIndex == null) continue
    const match = update.content?.match(pattern)
    if (match) {
      points.push({ x: dayIndex, y: parseFloat(match[1]) })
    }
  }

  if (points.length < 3) return null

  points.sort((a, b) => a.x - b.x)

  const minY = Math.min(...points.map(p => p.y))
  const maxY = Math.max(...points.map(p => p.y))
  const rangeY = maxY - minY || 1

  const W = 60
  const H = 16
  const padY = 2

  const scaled = points.map(p => ({
    x: (p.x / 4) * (W - 2) + 1,
    y: padY + (1 - (p.y - minY) / rangeY) * (H - padY * 2),
  }))

  const trending = points[points.length - 1].y < points[0].y
  const color = trending ? 'var(--danger)' : 'var(--success)'

  const polylinePoints = scaled.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 6 }}
    >
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {scaled.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.5" fill={color} />
      ))}
    </svg>
  )
}
