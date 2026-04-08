import { useRef, useState, useEffect } from 'react';

const POSITIVE_WORDS = [
  'great', 'good', 'positive', 'strong', 'solid', 'confident', 'excited',
  'love', 'crushing', 'crushed', 'amazing', 'excellent', 'fantastic',
  'momentum', 'optimistic', 'encouraging', 'productive', 'progressing',
];

const NEGATIVE_WORDS = [
  'blocked', 'stalled', 'delayed', 'behind', 'missed', 'struggling',
  'concerned', 'issue', 'problem', 'slipping', 'frustrated', 'stuck',
  'paused', 'reschedule', 'pushed',
];

const FLAG_COLORS = {
  none: '#059669',
  optimism_gap: '#B45309',
  submission_gap: '#B45309',
  vanity_metrics: '#7C3AED',
  no_progress: '#DC2626',
  other: '#0D7490',
};

function computeLanguagePositivity(updates) {
  let positive = 0;
  let negative = 0;

  for (const update of updates) {
    const text = (update.content || '').toLowerCase();
    for (const word of POSITIVE_WORDS) {
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      const matches = text.match(regex);
      if (matches) positive += matches.length;
    }
    for (const word of NEGATIVE_WORDS) {
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      const matches = text.match(regex);
      if (matches) negative += matches.length;
    }
  }

  const total = positive + negative;
  if (total === 0) return 50;
  return (positive / total) * 100;
}

function parseFirstNumber(str) {
  if (!str && str !== 0) return null;
  const s = String(str);
  const match = s.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : null;
}

function computeKpiPerformance(employee) {
  const extractions = employee.kpi_extractions;
  if (!extractions || extractions.length === 0) return 0;

  let total = 0;
  let count = extractions.length;

  for (const kpi of extractions) {
    const actual = parseFirstNumber(kpi.actual);
    const target = parseFirstNumber(kpi.target);
    if (actual != null && target != null && target > 0) {
      total += Math.min((actual / target) * 100, 100);
    }
  }

  return count > 0 ? total / count : 0;
}

export default function SentimentScatter({ employees, allUpdates }) {
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 300, h: 200 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!employees || employees.length === 0) return null;

  const margin = { top: 8, right: 14, bottom: 32, left: 36 };
  const plotW = dims.w - margin.left - margin.right;
  const plotH = dims.h - margin.top - margin.bottom;

  const updatesById = {};
  if (allUpdates) {
    for (const entry of allUpdates) {
      updatesById[entry.id] = entry.updates || [];
    }
  }

  const points = employees.map((emp) => {
    const updates = updatesById[emp.id] || [];
    const x = computeLanguagePositivity(updates);
    const y = computeKpiPerformance(emp);
    const flag = emp.analysis?.flag_type || 'none';
    const color = FLAG_COLORS[flag] || FLAG_COLORS.none;
    const firstName = (emp.name || '').split(' ')[0];
    return { x, y, color, firstName, id: emp.id };
  });

  const toX = (val) => margin.left + (val / 100) * plotW;
  const toY = (val) => margin.top + ((100 - val) / 100) * plotH;

  const axisTicks = [0, 25, 50, 75, 100];

  return (
    <div className="card-elevated animate-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
      <div className="section-header" style={{ marginBottom: 4, flexShrink: 0 }}>Sentiment vs. Reality</div>
      <div ref={containerRef} style={{ flex: '1 1 0', minHeight: 0, position: 'relative' }}>
        <svg
          width={dims.w}
          height={dims.h}
          style={{ display: 'block', position: 'absolute', top: 0, left: 0 }}
        >
          {/* Plot background */}
          <rect
            x={margin.left}
            y={margin.top}
            width={Math.max(plotW, 0)}
            height={Math.max(plotH, 0)}
            fill="var(--card)"
            stroke="var(--border-subtle)"
            strokeWidth={1}
          />

          {/* Quadrant lines */}
          <line
            x1={toX(50)} y1={margin.top}
            x2={toX(50)} y2={margin.top + plotH}
            stroke="var(--border-subtle)" strokeWidth={1} strokeDasharray="4 4"
          />
          <line
            x1={margin.left} y1={toY(50)}
            x2={margin.left + plotW} y2={toY(50)}
            stroke="var(--border-subtle)" strokeWidth={1} strokeDasharray="4 4"
          />

          {/* Quadrant labels */}
          <text x={toX(25)} y={toY(75)} textAnchor="middle" fill="var(--text-ghost)" fontSize={10} fontFamily="var(--font)">
            Silent Struggle
          </text>
          <text x={toX(75)} y={toY(75)} textAnchor="middle" fill="var(--text-ghost)" fontSize={10} fontFamily="var(--font)">
            Executing
          </text>
          <text x={toX(25)} y={toY(25)} textAnchor="middle" fill="var(--text-ghost)" fontSize={10} fontFamily="var(--font)">
            Aware &amp; Struggling
          </text>
          <text x={toX(75)} y={toY(25)} textAnchor="middle" fill="var(--text-ghost)" fontSize={10} fontFamily="var(--font)">
            Optimism Gap
          </text>

          {/* X-axis ticks and labels */}
          {axisTicks.map((tick) => (
            <g key={`x-${tick}`}>
              <line
                x1={toX(tick)} y1={margin.top + plotH}
                x2={toX(tick)} y2={margin.top + plotH + 4}
                stroke="var(--text-ghost)" strokeWidth={1}
              />
              <text
                x={toX(tick)} y={margin.top + plotH + 16}
                textAnchor="middle" fill="var(--text-ghost)" fontSize={10} fontFamily="var(--font-mono)"
              >
                {tick}
              </text>
            </g>
          ))}

          {/* Y-axis ticks and labels */}
          {axisTicks.map((tick) => (
            <g key={`y-${tick}`}>
              <line
                x1={margin.left - 4} y1={toY(tick)}
                x2={margin.left} y2={toY(tick)}
                stroke="var(--text-ghost)" strokeWidth={1}
              />
              <text
                x={margin.left - 7} y={toY(tick) + 3}
                textAnchor="end" fill="var(--text-ghost)" fontSize={10} fontFamily="var(--font-mono)"
              >
                {tick}
              </text>
            </g>
          ))}

          {/* Axis labels */}
          <text
            x={margin.left + plotW / 2} y={dims.h - 4}
            textAnchor="middle" fill="var(--text-tertiary)" fontSize={10} fontFamily="var(--font-mono)"
          >
            Language Positivity
          </text>
          <text
            x={10} y={margin.top + plotH / 2}
            textAnchor="middle" fill="var(--text-tertiary)" fontSize={10} fontFamily="var(--font-mono)"
            transform={`rotate(-90, 10, ${margin.top + plotH / 2})`}
          >
            KPI Performance
          </text>

          {/* Data points */}
          {points.map((pt) => (
            <g key={pt.id}>
              <circle
                cx={toX(pt.x)}
                cy={toY(pt.y)}
                r={5}
                fill={pt.color}
                opacity={0.85}
              />
              <text
                x={toX(pt.x)}
                y={toY(pt.y) - 8}
                textAnchor="middle"
                fill="var(--text)"
                fontSize={10}
                fontWeight={600}
                fontFamily="var(--font)"
              >
                {pt.firstName}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
