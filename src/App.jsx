import React, { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'

const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const EmployeeDetail = React.lazy(() => import('./pages/EmployeeDetail'))

function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 6 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--accent)',
          animation: 'progress-pulse 1.2s ease-in-out infinite',
          animationDelay: `${i * 0.15}s`,
        }} />
      ))}
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/employees/:id" element={<EmployeeDetail />} />
      </Routes>
    </Suspense>
  )
}
