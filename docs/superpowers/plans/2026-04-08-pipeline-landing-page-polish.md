# Pipeline Landing Page Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Pipeline landing page so the pipeline stages dominate on load — hero tagline on top, explainer collapsed by default, stats strip for visual density, and animated connectors between stage cards.

**Architecture:** All changes are in two files: `src/pages/Pipeline.jsx` (hero section, stats strip, collapsed accordion) and `src/components/PipelineControl.jsx` (connector arrows between stages, completed-stage green border). Plus a small CSS addition in `src/index.css` for the connector arrow animation.

**Tech Stack:** React, Framer Motion (already in use), CSS keyframes

---

### Task 1: Add connector arrow animation CSS

**Files:**
- Modify: `src/index.css` (append after line 120, before `.glow-btn`)

- [ ] **Step 1: Add CSS keyframes and connector styles**

Add the following CSS at the end of `src/index.css` (before the closing, after line 233):

```css
/* Pipeline connector arrows */
@keyframes connector-flow {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}

.pipeline-connector {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 2px;
}

.pipeline-connector svg {
  transition: color 0.4s ease, filter 0.4s ease;
  color: var(--border);
}

.pipeline-connector.active svg {
  color: var(--success);
  filter: drop-shadow(0 0 4px rgba(5, 150, 105, 0.3));
}

/* Vertical connectors for mobile */
@media (max-width: 900px) {
  .pipeline-connector {
    justify-content: center;
    padding: 4px 0;
  }
  .pipeline-connector svg {
    transform: rotate(90deg);
  }
}

/* Stats strip */
.stats-strip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 14px 20px;
  border-radius: var(--radius-sm);
  background: var(--bg-raised);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
}

.stats-strip .stat-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
  font-weight: 600;
}

.stats-strip .stat-number {
  font-size: 18px;
  font-weight: 800;
  color: var(--accent);
  letter-spacing: -0.5px;
}

.stats-strip .stat-dot {
  color: var(--border);
  font-size: 10px;
  user-select: none;
}

@media (max-width: 600px) {
  .stats-strip {
    gap: 16px;
    padding: 10px 14px;
  }
  .stats-strip .stat-number {
    font-size: 15px;
  }
  .stats-strip .stat-item {
    font-size: 11px;
  }
}
```

- [ ] **Step 2: Verify styles load**

Run: `npm run dev` and confirm no CSS errors in browser console.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: add pipeline connector and stats strip CSS"
```

---

### Task 2: Restructure Pipeline.jsx hero section

**Files:**
- Modify: `src/pages/Pipeline.jsx:36-208`

Replace the entire `{/* Context intro */}` section (lines 114–208) with a new hero layout:

- [ ] **Step 1: Change `introExpanded` default to `false`**

In `src/pages/Pipeline.jsx`, change line 45:
```jsx
// Before:
const [introExpanded, setIntroExpanded] = useState(true)
// After:
const [introExpanded, setIntroExpanded] = useState(false)
```

- [ ] **Step 2: Replace the intro section with hero tagline + collapsed accordion + stats strip**

Replace the entire `{/* Context intro */}` block (lines 114–208) with:

```jsx
      {/* Hero section */}
      <div className="animate-in" style={{ marginBottom: 20 }}>
        {/* Tagline */}
        <h1 style={{
          fontSize: 22,
          fontWeight: 800,
          color: 'var(--text)',
          letterSpacing: '-0.5px',
          margin: '0 0 6px',
        }}>
          Can AI catch what a CEO would miss?
        </h1>
        <p style={{
          fontSize: 13,
          color: 'var(--text-tertiary)',
          fontWeight: 500,
          lineHeight: 1.5,
          margin: '0 0 14px',
        }}>
          Watch three AI agents analyze a week of employee standups — blind to the truth hidden in each profile.
        </p>

        {/* Collapsible explainer */}
        <div className="card" style={{
          borderLeft: '3px solid var(--accent)',
          padding: 0,
          overflow: 'hidden',
          marginBottom: 14,
        }}>
          <button
            onClick={() => setIntroExpanded(prev => !prev)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font)',
            }}
          >
            <span style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--text-secondary)',
              letterSpacing: '-0.01em',
            }}>
              How the experiment works
            </span>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-ghost)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{
                transition: 'transform 0.2s ease',
                transform: introExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                flexShrink: 0,
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div style={{
            maxHeight: introExpanded ? 600 : 0,
            opacity: introExpanded ? 1 : 0,
            transition: 'max-height 0.3s ease, opacity 0.2s ease',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '0 16px 16px',
              fontSize: 12.5,
              lineHeight: 1.7,
              color: 'var(--text-secondary)',
            }}>
              <p style={{ margin: '0 0 10px' }}>
                <strong style={{ color: 'var(--text)' }}>The scenario:</strong> Lumen Collective is a Series C UGC marketplace (180 employees, Austin TX)
                where the CEO mandated daily Slack standups to drive execution velocity. Five employees across
                Creator Ops, Client Success, Marketing, Sales, and Product report daily — each with their own
                writing style, KPI targets, and hidden performance patterns.
              </p>
              <p style={{ margin: '0 0 10px' }}>
                <strong style={{ color: 'var(--text)' }}>The problem:</strong> Nobody reads 25+ updates a day.
                But nobody reads 25+ updates a day. People learn to write updates that <em>sound</em> productive
                without <em>being</em> productive — and the real issues hide in plain sight.
              </p>
              <p style={{ margin: '0 0 10px' }}>
                <strong style={{ color: 'var(--text)' }}>The experiment:</strong> Each of the 5 employees below has a hidden performance truth baked into
                their profile — an optimism gap, vanity metrics, missing submissions, or stalled progress. Three independent
                AI agents process their standups sequentially: one loads the updates, one extracts KPIs blind, and one reasons
                over the data to flag accountability gaps. No agent sees the full picture. Can the system still surface
                what a busy CEO would miss?
              </p>
              <p style={{ margin: 0 }}>
                <strong style={{ color: 'var(--text)' }}>Why this matters:</strong> This is what AI-first operations looks like — automation over headcount,
                real-time visibility into team performance, and surfacing insights that would otherwise require hours
                of manual review. The kind of operational backbone that scales.
              </p>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="stats-strip">
          <div className="stat-item">
            <span className="stat-number">5</span> Employees
          </div>
          <span className="stat-dot">·</span>
          <div className="stat-item">
            <span className="stat-number">25</span> Standups
          </div>
          <span className="stat-dot">·</span>
          <div className="stat-item">
            <span className="stat-number">15</span> KPIs
          </div>
          <span className="stat-dot">·</span>
          <div className="stat-item">
            <span className="stat-number">3</span> AI Agents
          </div>
        </div>
      </div>
```

- [ ] **Step 3: Verify the page renders**

Run dev server, navigate to `/`. Confirm:
- Tagline "Can AI catch what a CEO would miss?" is prominent at top
- Accordion is collapsed by default, expands on click
- Stats strip shows below with accent-colored numbers
- Pipeline stages are visible without scrolling

- [ ] **Step 4: Commit**

```bash
git add src/pages/Pipeline.jsx
git commit -m "feat: restructure pipeline hero with tagline, collapsed explainer, and stats strip"
```

---

### Task 3: Add connector arrows between pipeline stage cards

**Files:**
- Modify: `src/components/PipelineControl.jsx:147-308`

- [ ] **Step 1: Replace the stage cards grid with a grid that includes connector columns**

In `src/components/PipelineControl.jsx`, replace the grid `div` and its children (lines 161–308) — the `<div className="mobile-stack"` element — with a new layout that interleaves connector arrows between stage cards.

Replace `gridTemplateColumns: 'repeat(3, 1fr)'` with `gridTemplateColumns: '1fr auto 1fr auto 1fr'` and add connector elements between stage cards.

The full replacement for lines 161–308:

```jsx
      <div className="mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', gap: 0, alignItems: 'stretch' }}>
        {STAGES.map((stage, i) => {
          const state = getStageState(i, status.status)
          const isActive = state === 'running'
          const isDone = state === 'done'
          const isReady = state === 'ready'
          const isLocked = state === 'locked'

          // Determine if the connector BEFORE this stage should be active
          // (i.e., the previous stage is done)
          const prevDone = i > 0 && (() => {
            const prevState = getStageState(i - 1, status.status)
            return prevState === 'done'
          })()

          return (
            <>
              {/* Connector arrow before stages 2 and 3 */}
              {i > 0 && (
                <div
                  key={`connector-${i}`}
                  className={`pipeline-connector${prevDone ? ' active' : ''}`}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="M12 5l7 7-7 7" />
                  </svg>
                </div>
              )}

              {/* Stage card */}
              <div
                key={stage.key}
                className="animate-in"
                style={{
                  animationDelay: `${0.15 + i * 0.08}s`,
                  padding: '16px 16px 20px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isActive ? 'var(--accent)' : isDone ? 'var(--success)' : 'var(--border)'}`,
                  background: isActive ? 'var(--accent-glow)' : isDone ? 'rgba(5, 150, 105, 0.04)' : 'var(--bg)',
                  opacity: isLocked ? 0.5 : 1,
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {/* Stage number + icon */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700,
                      background: isDone ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--bg-raised)',
                      color: isDone || isActive ? '#fff' : 'var(--text-tertiary)',
                      border: isDone || isActive ? 'none' : '1px solid var(--border)',
                      transition: 'all 0.3s ease',
                    }}>
                      {isDone ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span style={{
                      fontSize: 13, fontWeight: 700,
                      color: isDone ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--text)',
                    }}>
                      {stage.label}
                    </span>
                    {stage.estimate && !isDone && (
                      <span className="mono" style={{
                        fontSize: 11, fontWeight: 700,
                        color: 'var(--text-tertiary)',
                      }}>
                        {stage.estimate}
                      </span>
                    )}
                  </div>
                  <div style={{
                    color: isDone ? 'var(--success)' : isActive ? 'var(--accent)' : 'var(--text-ghost)',
                    transition: 'color 0.3s ease',
                  }}>
                    {stage.icon}
                  </div>
                </div>

                {/* Description */}
                <div style={{
                  fontSize: 11.5,
                  color: 'var(--text-tertiary)',
                  fontWeight: 500,
                  lineHeight: 1.5,
                  flex: 1,
                }}>
                  {stage.description}
                </div>

                {/* Action button */}
                <button
                  className={isReady && glowStage === stage.key ? 'glow-btn' : undefined}
                  onClick={() => { setGlowStage(null); handleRunStage(stage.key) }}
                  disabled={!isReady || isRunning}
                  style={{
                    width: '100%',
                    padding: '8px 0',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'var(--font)',
                    cursor: isReady && !isRunning ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    ...(isActive ? {
                      background: 'var(--accent)',
                      color: '#fff',
                      opacity: 0.8,
                    } : isDone ? {
                      background: 'rgba(5, 150, 105, 0.1)',
                      color: 'var(--success)',
                    } : isReady ? {
                      background: 'var(--accent)',
                      color: '#fff',
                    } : {
                      background: 'var(--bg-raised)',
                      color: 'var(--text-ghost)',
                    }),
                  }}
                >
                  {isActive ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Processing...
                    </>
                  ) : isDone ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Complete
                    </>
                  ) : isReady ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      Run
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      Locked
                    </>
                  )}
                </button>
              </div>
            </>
          )
        })}
      </div>
```

- [ ] **Step 2: Update the mobile-stack CSS for the new 5-column grid**

In `src/index.css`, update the `.mobile-stack` rule inside the `@media (max-width: 900px)` block. Change:
```css
.mobile-stack { grid-template-columns: 1fr !important; }
```
to:
```css
.mobile-stack { grid-template-columns: 1fr !important; display: grid !important; }
```

This ensures on mobile the 5-column grid collapses to single-column, and the connector elements (which use the `.pipeline-connector` CSS) will rotate their arrows 90 degrees via the media query added in Task 1.

- [ ] **Step 3: Verify connectors render and animate**

Run dev server, navigate to `/`:
- Confirm horizontal arrows appear between stage cards on desktop
- Confirm arrows are gray when stages are locked
- Run stage 1 — after it completes, confirm the first connector turns green with a subtle glow
- Resize browser to mobile width — confirm arrows rotate to vertical between stacked cards

- [ ] **Step 4: Commit**

```bash
git add src/components/PipelineControl.jsx src/index.css
git commit -m "feat: add animated connector arrows between pipeline stages"
```

---

### Task 4: Final visual QA and polish

**Files:**
- Potentially modify: `src/pages/Pipeline.jsx`, `src/components/PipelineControl.jsx`, `src/index.css`

- [ ] **Step 1: Visual review at desktop width**

Open `http://localhost:3100` at full desktop width. Verify:
- Hero tagline is the dominant element on load
- Accordion is collapsed, pipeline stages + stats strip visible without scrolling
- Connector arrows are properly centered between stage cards
- Stats strip numbers use accent blue color

- [ ] **Step 2: Visual review at mobile width**

Resize to ~375px width. Verify:
- Stage cards stack vertically
- Connector arrows appear between cards pointing downward
- Stats strip wraps gracefully or stays on one line with smaller text
- Nothing overflows the viewport

- [ ] **Step 3: Run a full pipeline to test state transitions**

Click Run on stage 1, wait for completion, then stages 2 and 3. Verify:
- Connector arrows turn green as each stage completes
- Completed stage cards get green border
- Output tabs still appear and animate correctly
- "View Dashboard" CTA still works after stage 3

- [ ] **Step 4: Fix any issues found**

Address any visual glitches, spacing issues, or transition problems found in steps 1-3.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "polish: pipeline landing page visual QA fixes"
```
