export default function SubmissionHeatmap({ employees, allUpdates }) {
  const days = [
    { key: 'monday', label: 'Mon' },
    { key: 'tuesday', label: 'Tue' },
    { key: 'wednesday', label: 'Wed' },
    { key: 'thursday', label: 'Thu' },
    { key: 'friday', label: 'Fri' },
  ];

  const updatesById = {};
  if (allUpdates) {
    for (const entry of allUpdates) {
      const daySet = new Set();
      if (entry.updates) {
        for (const u of entry.updates) {
          daySet.add(u.day?.toLowerCase());
        }
      }
      updatesById[entry.id] = daySet;
    }
  }

  const employeeList = employees || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.8px', color: 'var(--text-ghost)',
        marginBottom: 8,
      }}>Submission Cadence</div>
      <div
        style={{
          display: 'inline-grid',
          gridTemplateColumns: 'max-content repeat(5, 1fr)',
          gap: '8px 5px',
          alignItems: 'center',
          width: '75%',
        }}
      >
        {/* Header row */}
        <div />
        {days.map((d) => (
          <div
            key={d.key}
            style={{
              fontSize: 9,
              fontWeight: 600,
              textTransform: 'uppercase',
              color: 'var(--text-ghost)',
              textAlign: 'center',
              letterSpacing: '0.3px',
            }}
          >
            {d.label}
          </div>
        ))}

        {/* Employee rows */}
        {employeeList.map((emp) => {
          const submitted = updatesById[emp.id] || new Set();
          const firstName = (emp.name || '').split(' ')[0];
          return [
            <div
              key={`name-${emp.id}`}
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 80,
                paddingRight: 8,
              }}
            >
              {firstName}
            </div>,
            ...days.map((d) => {
              const hasUpdate = submitted.has(d.key);
              return (
                <div
                  key={`${emp.id}-${d.key}`}
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: hasUpdate ? 'var(--success)' : 'var(--border)',
                    opacity: hasUpdate ? 0.8 : 0.2,
                  }}
                />
              );
            }),
          ];
        })}
      </div>
    </div>
  );
}
