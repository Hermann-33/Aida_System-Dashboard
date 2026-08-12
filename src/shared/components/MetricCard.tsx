import { ArrowDown, ArrowUp, type LucideIcon } from 'lucide-react';

type Tone = 'success' | 'warning' | 'error' | 'gold' | 'pink';

interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  /** Illustrative only — there's no real prior-period dataset yet to compute
   * this from, so it's rendered dashed/muted rather than solid, with an
   * explicit note (visible on hover, and for screen readers) that it isn't
   * a real computed trend. Swap for a real value once historical data
   * exists; the badge itself doesn't need to change. */
  trendPct?: number;
}

export function MetricCard({ label, value, hint, icon: Icon, tone, trendPct }: MetricCardProps) {
  return (
    <article className={tone ? `metric-card metric-card--${tone}` : 'metric-card metric-card--brand'}>
      <svg className="metric-card__blob" viewBox="0 0 200 140" aria-hidden="true">
        <circle cx="150" cy="30" r="70" fill="currentColor" opacity="0.08" />
        <circle cx="180" cy="70" r="40" fill="currentColor" opacity="0.1" />
        <circle cx="140" cy="100" r="24" fill="currentColor" opacity="0.12" />
      </svg>

      <div className="metric-card__top">
        {Icon && (
          <span className={tone ? `metric-card__icon metric-card__icon--${tone}` : 'metric-card__icon'}>
            <Icon size={15} aria-hidden="true" />
          </span>
        )}
        <p className="metric-card__label">{label}</p>
      </div>

      <div className="metric-card__value-row">
        <p className="metric-card__value">{value}</p>
        {typeof trendPct === 'number' && (
          <span
            className="metric-card__trend"
            title="Illustrative sample trend — no real historical comparison exists yet"
          >
            {trendPct >= 0 ? <ArrowUp size={11} aria-hidden="true" /> : <ArrowDown size={11} aria-hidden="true" />}
            {Math.abs(trendPct).toFixed(1)}%
            <span className="visually-hidden"> (sample trend, not a real computed comparison)</span>
          </span>
        )}
      </div>

      {hint && <p className="metric-card__hint">{hint}</p>}
    </article>
  );
}
