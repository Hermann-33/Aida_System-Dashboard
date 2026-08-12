import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSyncExternalStore } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Banknote,
  Clock,
  CreditCard,
  Receipt,
  RotateCcw,
  ShoppingBag,
  Tag,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { getEmployeeSession, subscribeEmployeeSession } from '../../auth/employeeSession';
import { hasGlobalManagerCapability } from '../../auth/permissions';
import {
  FIXTURE_MONTH,
  FIXTURE_TODAY,
  FIXTURE_WEEK,
  overviewKpis,
  PREVIEW_HOURLY_SALES,
  PREVIEW_SALES_BY_POINT,
  PREVIEW_SALES_BY_STAFF,
  PREVIEW_SHIFT_ROWS,
  PREVIEW_TERMINALS,
} from '../../preview/fixtures/catalog';
import { GaugeChart } from '../../shared/components/GaugeChart';
import { MetricCard } from '../../shared/components/MetricCard';
import { formatRmFromSen } from '../../shared/formatting/money';
import { AdminPageShell } from './AdminPageShell';
import { AlertsPanel, type AdminAlert } from './AlertsPanel';
import './admin.css';

type Period = 'today' | 'week' | 'month';

interface Point {
  x: number;
  y: number;
}

/** Catmull-Rom-to-Bezier smoothing so the hourly pattern reads as a curve,
 * not the jagged connect-the-dots look of straight segments between hour
 * buckets. */
function smoothLinePath(points: Point[]): string {
  const first = points[0];
  if (!first) return '';
  if (points.length === 1) return `M ${first.x},${first.y}`;
  let d = `M ${first.x},${first.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (!p1 || !p2) continue;
    const p0 = points[i - 1] ?? p1;
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

type Tone = 'success' | 'warning' | 'error' | 'gold' | 'pink';

// trendPct is illustrative only (see MetricCard's doc comment) — omitted
// entirely for Open shifts / Variance alerts, since those are point-in-time
// counts, not something "trending up or down" means anything for.
const KPI_META: Record<string, { icon: LucideIcon; tone?: Tone; trendPct?: number }> = {
  'Gross sales': { icon: Wallet, trendPct: 4.2 },
  'Discounts / rewards': { icon: Tag, tone: 'gold', trendPct: 1.8 },
  'Refunds / voids': { icon: RotateCcw, tone: 'error', trendPct: -3.5 },
  'Net sales': { icon: TrendingUp, tone: 'success', trendPct: 5.1 },
  Orders: { icon: ShoppingBag, tone: 'pink', trendPct: 2.9 },
  'Avg order value': { icon: Receipt, trendPct: 0.8 },
  'Cash sales': { icon: Banknote, tone: 'gold', trendPct: -2.1 },
  'Non-cash sales': { icon: CreditCard, tone: 'pink', trendPct: 6.4 },
  'Open shifts': { icon: Clock, tone: 'warning' },
  'Variance alerts': { icon: AlertTriangle, tone: 'warning' },
};

const CHART_VIEWBOX_WIDTH = 340;
const CHART_LEFT = 28;
const CHART_RIGHT = 332;

const PERIOD_HEADER_NOTE: Record<Period, string> = {
  today: 'Today',
  week: 'This week (sample scale ×7)',
  month: 'This month (sample scale ×25)',
};

const PERIOD_SHORT_LABEL: Record<Period, string> = {
  today: 'today',
  week: 'this week',
  month: 'this month',
};

const STAFF_COLORS = [
  'var(--aida-burgundy)',
  'var(--aida-gold)',
  'var(--aida-floral-pink)',
  'var(--aida-success)',
];

const LIVE_POINTS = [
  { key: 'cafe', title: 'Main Café', subtitle: 'Branch BR-MAIN · shared INV-MAIN' },
  { key: 'main', title: 'Main Counter', subtitle: 'SP-MAIN' },
  { key: 'snack', title: 'Snack Station', subtitle: 'SP-SNACK' },
] as const;

export function AdminOverviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const periodParam = searchParams.get('period');
  const period: Period = periodParam === 'week' || periodParam === 'month' ? periodParam : 'today';
  const session = useSyncExternalStore(subscribeEmployeeSession, getEmployeeSession, getEmployeeSession);
  const identity = session.identity;
  const global = hasGlobalManagerCapability(identity);
  const kpis = useMemo(() => overviewKpis(period), [period]);
  const periodTotals = period === 'today' ? FIXTURE_TODAY : period === 'week' ? FIXTURE_WEEK : FIXTURE_MONTH;

  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);

  const [animateBars, setAnimateBars] = useState(false);
  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => setAnimateBars(true));
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
  }, []);

  const maxHourly = Math.max(...PREVIEW_HOURLY_SALES);
  const hourlySeries = PREVIEW_HOURLY_SALES.map((value, i) => {
    const step = (CHART_RIGHT - CHART_LEFT) / (PREVIEW_HOURLY_SALES.length - 1);
    return {
      hour: 7 + i,
      value,
      x: CHART_LEFT + i * step,
      y: 100 - (value / maxHourly) * 80,
    };
  });
  const peakHourIndex = PREVIEW_HOURLY_SALES.indexOf(maxHourly);
  const peakHourLabel = `${7 + peakHourIndex}:00`;
  const linePath = smoothLinePath(hourlySeries);
  const firstX = hourlySeries[0]?.x ?? 0;
  const lastX = hourlySeries[hourlySeries.length - 1]?.x ?? 0;
  const areaPath = `${linePath} L ${lastX},100 L ${firstX},100 Z`;
  const hoverPoint = hoverIndex !== null ? hourlySeries[hoverIndex] : undefined;

  function handleChartMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = chartWrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const fraction = (e.clientX - rect.left) / rect.width;
    const svgX = fraction * CHART_VIEWBOX_WIDTH;
    let nearest = 0;
    let nearestDist = Infinity;
    hourlySeries.forEach((p, i) => {
      const dist = Math.abs(p.x - svgX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const HERO_LABELS = new Set(['Orders', 'Avg order value', 'Cash sales', 'Non-cash sales']);
  const heroStats = kpis.filter((k) => HERO_LABELS.has(k.label));
  const gridStats = kpis.filter((k) => k.label !== 'Net sales' && !HERO_LABELS.has(k.label));
  const netSalesKpi = kpis.find((k) => k.label === 'Net sales');
  const netSalesTrendPct = KPI_META['Net sales']?.trendPct;

  const salesByCounterSegments = PREVIEW_SALES_BY_POINT.map((row, i) => ({
    label: row.point,
    sen: row.sen,
    color: i === 0 ? 'var(--aida-burgundy)' : 'var(--aida-floral-pink)',
  }));

  const paymentMethodSegments = [
    { label: 'Cash', sen: periodTotals.cashSalesSen, color: 'var(--aida-gold)' },
    { label: 'Non-cash', sen: periodTotals.nonCashSalesSen, color: 'var(--aida-burgundy)' },
  ];

  const maxStaffSen = Math.max(...PREVIEW_SALES_BY_STAFF.map((row) => row.sen), 1);

  const mainTerminals = PREVIEW_TERMINALS.filter((t) => t.salesPoint === 'Main Counter');
  const snackTerminals = PREVIEW_TERMINALS.filter((t) => t.salesPoint === 'Snack Station');
  const mainShifts = PREVIEW_SHIFT_ROWS.filter((s) => s.salesPoint === 'Main Counter');
  const snackShifts = PREVIEW_SHIFT_ROWS.filter((s) => s.salesPoint === 'Snack Station');

  const alerts: AdminAlert[] = [
    { id: 'variance-s3', tag: 'Variance', tone: 'warn', text: 'Shift s3 closed with RM 35.00 short' },
    { id: 'terminal-pos-main-02', tag: 'Terminal', tone: 'info', text: 'POS-MAIN-02 enrolment pending' },
    {
      id: 'rewards-redemptions',
      tag: 'Rewards',
      tone: 'warn',
      text: `${FIXTURE_TODAY.rewardRedemptions} redemptions today — review discount reasons`,
    },
  ];

  function setPeriod(next: Period) {
    if (next === 'today') {
      searchParams.delete('period');
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ period: next }, { replace: true });
    }
  }

  return (
    <AdminPageShell
      pageId="admin-dashboard"
      title="Executive Dashboard"
      hint={`${identity?.fullName ?? 'Admin'}${global ? ' · Global manager' : ' · Branch-scoped'} · ${PERIOD_HEADER_NOTE[period]}`}
    >
      <div className="admin-period-toggle" role="group" aria-label="Dashboard period">
        <button
          type="button"
          className={`menu-tab ${period === 'today' ? 'menu-tab--active' : ''}`}
          onClick={() => setPeriod('today')}
        >
          Today
        </button>
        <button
          type="button"
          className={`menu-tab ${period === 'week' ? 'menu-tab--active' : ''}`}
          onClick={() => setPeriod('week')}
        >
          This week
        </button>
        <button
          type="button"
          className={`menu-tab ${period === 'month' ? 'menu-tab--active' : ''}`}
          onClick={() => setPeriod('month')}
        >
          This month
        </button>

        <div className="admin-period-toggle__bell">
          <AlertsPanel alerts={alerts} />
        </div>
      </div>

      <div className="dashboard-hero">
        <article className="chart-card chart-card--hero">
          <p className="chart-card__hero-label">
            Net sales {PERIOD_SHORT_LABEL[period]}
          </p>
          <div className="metric-card__value-row">
            <p className="chart-card__hero-value">{netSalesKpi?.value}</p>
            {typeof netSalesTrendPct === 'number' && (
              <span
                className="metric-card__trend"
                title="Illustrative sample trend — no real historical comparison exists yet"
              >
                {netSalesTrendPct >= 0 ? (
                  <ArrowUp size={11} aria-hidden="true" />
                ) : (
                  <ArrowDown size={11} aria-hidden="true" />
                )}
                {Math.abs(netSalesTrendPct).toFixed(1)}%
                <span className="visually-hidden"> (sample trend, not a real computed comparison)</span>
              </span>
            )}
          </div>

          <div
            className="area-chart__wrap"
            ref={chartWrapRef}
            onMouseMove={handleChartMouseMove}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <svg className="area-chart" viewBox="0 0 340 108" role="img" aria-label="Sales by hour, area chart">
              <defs>
                <linearGradient id="hourlyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--aida-burgundy)" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="var(--aida-burgundy)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 0.5, 1].map((f) => {
                const y = 100 - f * 80;
                return (
                  <line
                    key={f}
                    x1={CHART_LEFT}
                    x2={CHART_RIGHT}
                    y1={y}
                    y2={y}
                    stroke="var(--aida-outline)"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                  />
                );
              })}
              <text x="0" y="24" fontSize="8" fill="var(--aida-taupe)">
                {maxHourly}
              </text>
              <text x="0" y="64" fontSize="8" fill="var(--aida-taupe)">
                {Math.round(maxHourly / 2)}
              </text>
              <text x="0" y="103" fontSize="8" fill="var(--aida-taupe)">
                0
              </text>
              <path d={areaPath} fill="url(#hourlyFill)" />
              <path d={linePath} fill="none" stroke="var(--aida-burgundy)" strokeWidth="2.5" strokeLinecap="round" />
              {hoverPoint && (
                <>
                  <line
                    x1={hoverPoint.x}
                    x2={hoverPoint.x}
                    y1={20}
                    y2={100}
                    stroke="var(--aida-burgundy)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.5"
                  />
                  <circle
                    cx={hoverPoint.x}
                    cy={hoverPoint.y}
                    r={4}
                    fill="var(--aida-burgundy)"
                    stroke="var(--aida-surface)"
                    strokeWidth="2"
                  />
                </>
              )}
            </svg>
            {hoverPoint && (
              <div
                className="area-chart__tooltip"
                style={{ left: `${(hoverPoint.x / CHART_VIEWBOX_WIDTH) * 100}%` }}
              >
                <strong>{hoverPoint.hour}:00</strong>
                <span>index {hoverPoint.value}</span>
              </div>
            )}
          </div>
          <div className="area-chart__ticks">
            {PREVIEW_HOURLY_SALES.map((_, i) =>
              i % 2 === 0 ? <span key={i}>{7 + i}:00</span> : null,
            )}
          </div>
          <p className="chart-card__insight">
            Busiest around <strong>{peakHourLabel}</strong> — staff the counter for it.
          </p>
        </article>

        <div className="dashboard-hero__stats">
          {heroStats.map((kpi) => (
            <MetricCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              hint={kpi.hint}
              icon={KPI_META[kpi.label]?.icon}
              tone={KPI_META[kpi.label]?.tone}
              trendPct={KPI_META[kpi.label]?.trendPct}
            />
          ))}
        </div>
      </div>

      <div className="metric-grid">
        {gridStats.map((kpi) => (
          <MetricCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
            icon={KPI_META[kpi.label]?.icon}
            tone={KPI_META[kpi.label]?.tone}
            trendPct={KPI_META[kpi.label]?.trendPct}
          />
        ))}
      </div>

      <div className="admin-charts">
        <article className="chart-card">
          <h2 className="admin-section-title">Payment methods</h2>
          <GaugeChart
            segments={paymentMethodSegments}
            caption={`${formatRmFromSen(periodTotals.cashSalesSen + periodTotals.nonCashSalesSen)} collected`}
          />
        </article>

        <article className="chart-card">
          <h2 className="admin-section-title">Sales by counter</h2>
          <GaugeChart
            segments={salesByCounterSegments}
            caption={`${formatRmFromSen(
              salesByCounterSegments.reduce((s, seg) => s + seg.sen, 0),
            )} today`}
          />
        </article>

        <article className="chart-card">
          <h2 className="admin-section-title">Sales by staff</h2>
          <ul className="staff-leaderboard">
            {PREVIEW_SALES_BY_STAFF.map((row, i) => {
              const color = STAFF_COLORS[i % STAFF_COLORS.length];
              const pct = Math.round((row.sen / maxStaffSen) * 100);
              return (
                <li key={row.staff} className="staff-leaderboard__row">
                  <span className="staff-leaderboard__avatar" style={{ background: color }}>
                    {row.staff.charAt(0).toUpperCase()}
                  </span>
                  <div className="staff-leaderboard__info">
                    <div className="staff-leaderboard__name-line">
                      <span className="staff-leaderboard__name">
                        {row.staff}
                        {i === 0 && <span className="staff-leaderboard__badge">Top today</span>}
                      </span>
                      <span className="staff-leaderboard__amount">{formatRmFromSen(row.sen)}</span>
                    </div>
                    <div className="staff-leaderboard__bar">
                      <div
                        className="staff-leaderboard__bar-fill"
                        style={{ width: `${animateBars ? pct : 0}%`, background: color }}
                      />
                    </div>
                    <span className="staff-leaderboard__meta">{row.orders} orders</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </article>
      </div>

      <h2 className="admin-section-title admin-section-title--spaced">Live operations</h2>
      <p className="form-hint">Real-time health cards — heartbeat and peripheral status from preview fixtures.</p>
      <div className="live-ops-grid">
        {LIVE_POINTS.map((card) => {
          const terminals = card.key === 'snack' ? snackTerminals : card.key === 'main' ? mainTerminals : PREVIEW_TERMINALS;
          const shifts = card.key === 'snack' ? snackShifts : card.key === 'main' ? mainShifts : PREVIEW_SHIFT_ROWS;
          return (
            <article key={card.key} className="live-ops-card">
              <header>
                <h3 className="admin-section-title">{card.title}</h3>
                <p className="form-hint">{card.subtitle}</p>
              </header>
              <section>
                <h4 className="live-ops-card__label">Open shifts</h4>
                {shifts.length === 0 ? (
                  <p className="empty-state">No shifts in sample.</p>
                ) : (
                  <ul className="live-ops-list">
                    {shifts.map((s) => (
                      <li key={s.id}>
                        <strong>{s.staff}</strong> · {s.terminal} ·{' '}
                        <span
                          className={`status-pill status-pill--${s.status === 'open' ? 'ok' : s.status === 'locked' ? 'warn' : 'info'}`}
                        >
                          {s.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {card.key !== 'cafe' && (
                <section>
                  <h4 className="live-ops-card__label">Terminals</h4>
                  <ul className="live-ops-list">
                    {terminals.map((t) => (
                      <li key={t.id}>
                        <strong>{t.code}</strong>
                        <span className="live-ops-meta">Heartbeat {t.heartbeat ?? '—'}</span>
                        <span className="live-ops-meta">Printer {t.printer ?? '—'}</span>
                        <span className="live-ops-meta">KDS {t.kds ?? '—'}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {card.key === 'cafe' && (
                <p className="form-hint">Organisation rollup — drill into sales points for device detail.</p>
              )}
            </article>
          );
        })}
      </div>
    </AdminPageShell>
  );
}
