import { useEffect, useState } from 'react';

export interface GaugeSegment {
  label: string;
  sen: number;
  color: string;
}

interface GaugeChartProps {
  segments: GaugeSegment[];
  /** e.g. "RM 123,325.00 collected" — shown as a caption, not crammed into
   * the arc's center, since a long formatted amount doesn't fit there. */
  caption?: string;
}

const CX = 100;
const CY = 95;
const RADIUS = 75;
const STROKE_WIDTH = 18;
const START_ANGLE = 180;
const END_ANGLE = 360;

function polarToCartesian(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + RADIUS * Math.cos(rad), y: CY + RADIUS * Math.sin(rad) };
}

function describeArc(startAngle: number, endAngle: number): string {
  if (endAngle <= startAngle) return '';
  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

/** A half-circle "gauge" split into 2–3 colored arcs by share of the total —
 * rounded ends, sweeps in from zero on mount, with a track arc showing the
 * unfilled portion. The category names sit at the arc's own ends rather
 * than a separate legend doing the naming. */
export function GaugeChart({ segments, caption }: GaugeChartProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => setAnimated(true));
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, []);

  const total = segments.reduce((sum, seg) => sum + seg.sen, 0);
  const dominant = [...segments].sort((a, b) => b.sen - a.sen)[0];
  const dominantPct = total > 0 && dominant ? Math.round((dominant.sen / total) * 100) : 0;

  let cumulative = 0;
  const arcs = segments.map((seg) => {
    const fraction = total > 0 ? seg.sen / total : 0;
    const startAngle = START_ANGLE + cumulative * (END_ANGLE - START_ANGLE);
    cumulative += fraction;
    const endAngle = START_ANGLE + cumulative * (END_ANGLE - START_ANGLE);
    return { ...seg, startAngle, endAngle, fraction };
  });

  const first = segments[0];
  const last = segments[segments.length - 1];

  return (
    <div className="gauge-chart">
      {caption && <p className="gauge-chart__caption">{caption}</p>}
      <svg viewBox="0 0 200 122" role="img" aria-label="Breakdown gauge" className="gauge-chart__svg">
        <path
          d={describeArc(START_ANGLE, END_ANGLE)}
          fill="none"
          stroke="var(--aida-cream)"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
        />
        {total > 0 &&
          arcs.map((seg) => (
            <path
              key={seg.label}
              className="gauge-chart__segment"
              d={animated ? describeArc(seg.startAngle, seg.endAngle) : describeArc(seg.startAngle, seg.startAngle + 0.001)}
              fill="none"
              stroke={seg.color}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
            />
          ))}
        <text x={CX} y={80} textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--aida-espresso)">
          {dominantPct}%
        </text>
        <text x={CX} y={97} textAnchor="middle" fontSize="9" fill="var(--aida-taupe)">
          {dominant?.label}
        </text>
        {first && (
          <text x={CX - RADIUS} y={CY + 18} textAnchor="start" fontSize="8" fill="var(--aida-taupe)">
            {first.label}
          </text>
        )}
        {last && last !== first && (
          <text x={CX + RADIUS} y={CY + 18} textAnchor="end" fontSize="8" fill="var(--aida-taupe)">
            {last.label}
          </text>
        )}
      </svg>
      <ul className="gauge-chart__legend">
        {segments.map((seg) => (
          <li key={seg.label}>
            <span className="gauge-chart__swatch" style={{ background: seg.color }} aria-hidden="true" />
            <span className="gauge-chart__legend-label">{seg.label}</span>
            <span className="gauge-chart__legend-value">
              {total > 0 ? `${Math.round((seg.sen / total) * 100)}%` : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
