/**
 * Minimal inline-SVG charts. Every series is passed in already computed from
 * authoritative records — these components do no aggregation, no smoothing and
 * no interpolation of missing points, so a chart can never imply data that
 * isn't there. An empty series renders an explicit empty state, never an
 * axis with invented numbers (blueprint Parts 97/112).
 */

export interface BarDatum {
  label: string;
  value: number;
  /** Optional second line under the label (e.g. "12 of 40"). */
  hint?: string;
  /** CSS color; defaults to the brand token. */
  color?: string;
}

export function BarChart({
  data,
  max,
  emptyText = 'No data for this period.',
  valueSuffix = '',
}: {
  data: BarDatum[];
  /** Force a scale ceiling; defaults to the largest value present. */
  max?: number;
  emptyText?: string;
  valueSuffix?: string;
}) {
  const ceiling = max ?? Math.max(...data.map((d) => d.value), 0);
  if (data.length === 0 || ceiling <= 0) {
    return <div className="chart-empty">{emptyText}</div>;
  }
  return (
    <div className="bar-chart">
      {data.map((d) => (
        <div className="bar-row" key={d.label}>
          <div className="bar-label">
            {d.label}
            {d.hint && <span className="bar-hint">{d.hint}</span>}
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${Math.round((d.value / ceiling) * 100)}%`,
                background: d.color ?? 'var(--brand)',
              }}
            />
          </div>
          <div className="bar-value mono">
            {d.value}
            {valueSuffix}
          </div>
        </div>
      ))}
    </div>
  );
}

export interface TrendPoint {
  label: string;
  value: number | null;
}

/**
 * Line chart over a fixed set of x positions. Points with a null value are
 * genuine gaps (no observations that day) and are drawn as breaks in the line
 * rather than being bridged — bridging would invent a day that never happened.
 */
export function TrendChart({
  points,
  height = 160,
  suffix = '%',
  emptyText = 'Not enough data to draw a trend yet.',
}: {
  points: TrendPoint[];
  height?: number;
  suffix?: string;
  emptyText?: string;
}) {
  const real = points.filter((p) => p.value !== null);
  if (real.length < 2) return <div className="chart-empty">{emptyText}</div>;

  const W = 600;
  const H = height;
  const padX = 8;
  const padY = 14;
  const stepX = points.length > 1 ? (W - padX * 2) / (points.length - 1) : 0;
  const toY = (v: number) => H - padY - (v / 100) * (H - padY * 2);

  // Break the polyline wherever a day has no observations.
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    current.push({ x: padX + i * stepX, y: toY(p.value) });
  });
  if (current.length) segments.push(current);

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
        {[0, 25, 50, 75, 100].map((g) => (
          <line
            key={g}
            x1={padX}
            x2={W - padX}
            y1={toY(g)}
            y2={toY(g)}
            stroke="var(--line)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {segments.map((seg, i) => (
          <polyline
            key={i}
            points={seg.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="var(--brand)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {segments.flat().map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--brand)" />
        ))}
      </svg>
      <div className="trend-axis">
        {points.map((p, i) => (
          <span key={i}>{p.label}</span>
        ))}
      </div>
      <div className="chart-note">
        0–100{suffix} scale · gaps are days with no recorded observations
      </div>
    </div>
  );
}

/**
 * A segmented donut.
 *
 * Presentation only: it draws the segments it is handed and computes nothing.
 * The centre carries one figure and its caption; the caller supplies both, so
 * this can never imply a total it has not been given. Segments with a zero
 * value are dropped rather than drawn as slivers, and an all-zero set renders
 * the empty track alone — which is the honest picture of "nothing recorded",
 * not a full circle in a default colour.
 */
export function DonutChart({
  segments,
  centreValue,
  centreLabel,
  size = 148,
  thickness = 20,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  centreValue: string;
  centreLabel?: string;
  size?: number;
  thickness?: number;
}) {
  const shown = segments.filter((s) => s.value > 0);
  const total = shown.reduce((n, s) => n + s.value, 0);
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  return (
    <div className="donut">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={shown.map((s) => `${s.label}: ${s.value}`).join(', ') || 'Nothing recorded yet'}
      >
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--slate-soft)"
            strokeWidth={thickness}
          />
          {total > 0 &&
            shown.map((s) => {
              const len = (s.value / total) * circumference;
              const dash = `${len} ${circumference - len}`;
              const el = (
                <circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
        </g>
      </svg>
      <div className="donut-centre">
        <b>{centreValue}</b>
        {centreLabel && <span>{centreLabel}</span>}
      </div>
    </div>
  );
}
