import React, { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'

const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const EmployeeDetail = React.lazy(() => import('./pages/EmployeeDetail'))
const Pipeline = React.lazy(() => import('./pages/Pipeline'))

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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <NavBar />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/employees/:id" element={<EmployeeDetail />} />
            <Route path="/pipeline" element={<Pipeline />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  )
}
