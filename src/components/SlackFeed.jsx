const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
const DAY_DATES = {
  monday: 'Mon, Mar 31',
  tuesday: 'Tue, Apr 1',
  wednesday: 'Wed, Apr 2',
  thursday: 'Thu, Apr 3',
  friday: 'Fri, Apr 4',
}

const AVATAR_COLORS = {
  emp_001: '#2EB67D',
  emp_002: '#E01E5A',
  emp_003: '#ECB22E',
  emp_004: '#36C5F0',
  emp_005: '#7C3AED',
}

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase()
}

function SlackMessage({ name, role, employeeId, day, content, time }) {
  const color = AVATAR_COLORS[employeeId] || '#4A154B'
  const dateLabel = DAY_DATES[day?.toLowerCase()] || day

  return (
    <div style={{
      display: 'flex',
      gap: 10,
      padding: '8px 16px',
      transition: 'background 0.1s ease',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
    onMouseLeave={e => e.currentTarget.style.background = ''}
    >
      {/* Avatar */}
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 13, fontWeight: 700,
        fontFamily: 'var(--font)',
      }}>
        {getInitials(name)}
      </div>

      {/* Message */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            {name}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-ghost)', fontWeight: 500, flexShrink: 0 }}>
            {dateLabel} {time || '5:47 PM'}
          </span>
        </div>
        {role && (
          <div style={{ fontSize: 11, color: 'var(--text-ghost)', fontWeight: 500, marginTop: 1 }}>
            {role}
          </div>
        )}
        <div style={{
          fontSize: 13.5,
          color: 'var(--text-secondary)',
          fontWeight: 400,
          lineHeight: 1.6,
          marginTop: 2,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {content}
        </div>
      </div>
    </div>
  )
}

function DateDivider({ label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px 4px',
    }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{
        fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
        padding: '2px 12px',
        border: '1px solid var(--border)',
        borderRadius: 20,
        background: 'var(--card)',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

export default function SlackFeed({ updates, employeeName, employeeRole, employeeId, allEmployees, fullHeight }) {
  // If allEmployees is provided, show combined feed; otherwise show single employee
  const isMultiUser = !!allEmployees

  // Build sorted messages
  let messages = []
  if (isMultiUser) {
    for (const emp of allEmployees) {
      if (!emp.updates) continue
      for (const u of emp.updates) {
        messages.push({
          name: emp.name,
          role: emp.role,
          employeeId: emp.id,
          day: u.day,
          content: u.content,
        })
      }
    }
  } else {
    messages = (updates || []).map(u => ({
      name: employeeName,
      role: employeeRole,
      employeeId: employeeId,
      day: u.day,
      content: u.content,
    }))
  }

  // Sort by day order
  messages.sort(
    (a, b) => DAY_ORDER.indexOf(a.day?.toLowerCase()) - DAY_ORDER.indexOf(b.day?.toLowerCase())
  )

  // Group by day
  const grouped = {}
  for (const msg of messages) {
    const day = msg.day?.toLowerCase() || 'unknown'
    if (!grouped[day]) grouped[day] = []
    grouped[day].push(msg)
  }

  const TIMES = ['5:12 PM', '5:27 PM', '5:34 PM', '5:47 PM', '5:58 PM']

  const wrapperStyle = fullHeight
    ? { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }
    : { padding: 0, animationDelay: '0.3s', overflow: 'hidden' }

  return (
    <div className={fullHeight ? '' : 'card-elevated animate-in'} style={wrapperStyle}>
      {/* Slack channel header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 16, color: 'var(--text-ghost)' }}>#</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          daily-standup
        </span>
        <span style={{
          fontSize: 12, color: 'var(--text-ghost)', fontWeight: 500,
          marginLeft: 8,
        }}>
          {isMultiUser ? 'All team updates' : `${employeeName}'s updates`}
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: fullHeight ? 1 : undefined, maxHeight: fullHeight ? undefined : 600, overflowY: 'auto', paddingBottom: 12 }}>
        {DAY_ORDER.map(day => {
          const dayMessages = grouped[day]
          if (!dayMessages || dayMessages.length === 0) return null
          const dateLabel = DAY_DATES[day] || day

          return (
            <div key={day}>
              <DateDivider label={dateLabel} />
              {dayMessages.map((msg, i) => (
                <SlackMessage
                  key={`${msg.employeeId}-${day}-${i}`}
                  name={msg.name}
                  role={msg.role}
                  employeeId={msg.employeeId}
                  day={msg.day}
                  content={msg.content}
                  time={TIMES[i % TIMES.length]}
                />
              ))}
            </div>
          )
        })}

        {messages.length === 0 && (
          <div style={{
            padding: '40px 16px',
            textAlign: 'center',
            color: 'var(--text-ghost)',
            fontSize: 13,
          }}>
            No updates yet. Run the pipeline to generate.
          </div>
        )}
      </div>
    </div>
  )
}
