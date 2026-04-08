export default function AnalysisDetail({ analysis }) {
  if (!analysis) return null

  return (
    <div className="card-elevated animate-in" style={{ animationDelay: '0.25s' }}>
      <div className="section-header">AI Analysis</div>

      {/* Detail bullets */}
      <ul style={{
        fontSize: 13,
        color: 'var(--text-secondary)',
        fontWeight: 500,
        lineHeight: 1.7,
        margin: 0,
        paddingLeft: 18,
        listStyle: 'disc',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}>
        {(analysis.detail || '').split(/\n|•/).filter(line => line.trim()).map((line, i) => (
          <li key={i} style={{ paddingLeft: 2 }}>
            {line.replace(/^[•\-]\s*/, '').trim()}
          </li>
        ))}
      </ul>

      {/* Recommended action */}
      {analysis.recommended_action && (
        <div style={{
          marginTop: 16,
          padding: '12px 16px',
          background: 'var(--accent-glow)',
          borderRadius: 'var(--radius-sm)',
          borderLeft: '3px solid var(--accent)',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.8px', color: 'var(--accent)',
          }}>
            Recommended Action
          </div>
          <div style={{
            fontSize: 13, color: 'var(--text)', fontWeight: 600, marginTop: 4,
          }}>
            {analysis.recommended_action}
          </div>
        </div>
      )}
    </div>
  )
}
