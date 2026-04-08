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
    <div className="card-elevated animate-in" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', boxSizing: 'border-box' }}>
      <div className="section-header" style={{ marginBottom: 10, alignSelf: 'flex-start' }}>Submission Cadence</div>
      <div
        style={{
          display: 'inline-grid',
          gridTemplateColumns: 'max-content repeat(5, 18px)',
          gap: '4px 6px',
          alignItems: 'center',
        }}
      >
        {/* Header row */}
        <div />
        {days.map((d) => (
          <div
            key={d.key}
            style={{
              fontSize: 9,
              textTransform: 'uppercase',
              color: 'var(--text-ghost)',
              textAlign: 'center',
              lineHeight: '18px',
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
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 80,
                lineHeight: '18px',
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
                    width: 18,
                    height: 18,
                    borderRadius: 3,
                    background: hasUpdate ? 'var(--success)' : 'transparent',
                    border: hasUpdate
                      ? 'none'
                      : '1.5px dashed var(--border)',
                    boxSizing: 'border-box',
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
