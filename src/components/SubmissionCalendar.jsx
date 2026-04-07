const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export default function SubmissionCalendar({ updates }) {
  const submittedDays = new Set((updates || []).map(u => u.day?.toLowerCase()))

  return (
    <div className="card animate-in" style={{ animationDelay: '0.2s' }}>
      <div className="section-header" style={{ marginBottom: 12 }}>Submission Calendar</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {DAYS.map((day, i) => {
          const submitted = submittedDays.has(day)
          return (
            <div key={day} style={{
              flex: 1,
              textAlign: 'center',
              padding: '10px 0',
              borderRadius: 'var(--radius-sm)',
              background: submitted ? 'var(--success-dim)' : 'var(--bg)',
              border: `1px solid ${submitted ? 'var(--success)' : 'var(--border)'}22`,
              transition: 'all 0.2s ease',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.8px', color: 'var(--text-ghost)',
              }}>
                {DAY_LABELS[i]}
              </div>
              <div style={{
                marginTop: 4,
                fontSize: 16,
                color: submitted ? 'var(--success)' : 'var(--text-ghost)',
              }}>
                {submitted ? '●' : '○'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
