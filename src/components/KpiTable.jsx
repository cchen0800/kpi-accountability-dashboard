const STATUS_STYLES = {
  on_track: { color: 'var(--success)', bg: 'var(--success-dim)', label: 'On Track' },
  at_risk: { color: 'var(--warning)', bg: 'var(--warning-dim)', label: 'At Risk' },
  missing: { color: 'var(--danger)', bg: 'var(--danger-dim)', label: 'Missing' },
}

export default function KpiTable({ kpis }) {
  if (!kpis || kpis.length === 0) return null

  return (
    <div className="card-elevated animate-in" style={{ padding: 0, animationDelay: '0.15s' }}>
      <div className="section-header" style={{ padding: '16px 20px 12px', marginBottom: 0 }}>
        KPI Performance
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--bg-raised)' }}>
            {['KPI', 'Target', 'Actual', 'Delta', 'Status'].map(h => (
              <th key={h} style={{
                padding: '10px 16px',
                textAlign: 'left',
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: 'var(--text-ghost)',
                borderBottom: '1px solid var(--border)',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {kpis.map((kpi, i) => {
            const s = STATUS_STYLES[kpi.status] || STATUS_STYLES.missing
            return (
              <tr key={i} style={{
                borderBottom: '1px solid var(--border-subtle)',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--card-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>
                  {kpi.kpi_name}
                </td>
                <td className="mono" style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                  {kpi.target || '-'}
                </td>
                <td className="mono" style={{ padding: '12px 16px', color: kpi.status === 'missing' ? 'var(--text-ghost)' : 'var(--text-secondary)', fontStyle: kpi.status === 'missing' ? 'italic' : 'normal' }}>
                  {kpi.status === 'missing' ? 'not reported' : (kpi.actual || '-')}
                </td>
                <td className="mono" style={{ padding: '12px 16px', color: kpi.status === 'missing' ? 'var(--text-ghost)' : 'var(--text-secondary)', fontStyle: kpi.status === 'missing' ? 'italic' : 'normal' }}>
                  {kpi.status === 'missing' ? '' : (kpi.delta || '-')}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span className="badge" style={{
                    background: s.bg, color: s.color, border: `1px solid ${s.color}22`,
                  }}>
                    {s.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
