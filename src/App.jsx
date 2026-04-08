import React, { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import NavBar from './components/NavBar'
import LoginScreen from './components/LoginScreen'

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
  const [authed, setAuthed] = useState(null) // null = checking, true/false
  const [authRequired, setAuthRequired] = useState(null)
  const logoutTimerRef = useRef(null)

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_expires')
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
    setAuthed(false)
  }, [])

  const scheduleLogout = useCallback((expiresIn) => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
    if (expiresIn > 0) {
      logoutTimerRef.current = setTimeout(logout, expiresIn * 1000)
    }
  }, [logout])

  // Check auth on mount
  useEffect(() => {
    fetch('/api/auth/check', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}`,
      },
    })
      .then(r => r.json())
      .then(data => {
        setAuthRequired(data.auth_required)
        if (!data.auth_required) {
          setAuthed(true)
        } else if (data.authenticated) {
          setAuthed(true)
          // Calculate remaining time from stored expiry
          const expires = parseInt(localStorage.getItem('auth_expires') || '0')
          const remaining = Math.max(0, expires - Date.now()) / 1000
          if (remaining > 0) scheduleLogout(remaining)
          else logout()
        } else {
          setAuthed(false)
        }
      })
      .catch(() => setAuthed(false))
  }, [scheduleLogout, logout])

  // Listen for 401s from API calls
  useEffect(() => {
    const handler = () => { setAuthed(false) }
    window.addEventListener('auth-expired', handler)
    return () => window.removeEventListener('auth-expired', handler)
  }, [])

  const handleLogin = useCallback((token, expiresIn) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_expires', String(Date.now() + expiresIn * 1000))
    setAuthed(true)
    scheduleLogout(expiresIn)
  }, [scheduleLogout])

  // Track page views
  const location = useLocation()
  useEffect(() => {
    if (!authed) return
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: location.pathname }),
    }).catch(() => {})
  }, [location.pathname, authed])

  // Still checking
  if (authed === null) return <Loading />

  // Need to log in
  if (authRequired && !authed) return <LoginScreen onLogin={handleLogin} />

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <NavBar />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Pipeline />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/employees/:id" element={<EmployeeDetail />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  )
}
