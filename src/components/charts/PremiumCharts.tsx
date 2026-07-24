import { useId, type ReactNode } from "react";

interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  slices: DonutSlice[];
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Chart.js-style donut segment (filled ring wedge). */
function donutSegment(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
) {
  const sweep = Math.min(Math.max(endAngle - startAngle, 0.01), 359.999);
  const end = startAngle + sweep;
  const large = sweep > 180 ? 1 : 0;
  const o1 = polar(cx, cy, outerR, startAngle);
  const o2 = polar(cx, cy, outerR, end);
  const i1 = polar(cx, cy, innerR, end);
  const i2 = polar(cx, cy, innerR, startAngle);

  return [
    `M ${o1.x} ${o1.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${i2.x} ${i2.y}`,
    "Z",
  ].join(" ");
}

export function DonutChart({ slices, centerLabel, centerValue, size = 280 }: DonutChartProps) {
  const filterId = `donut-shadow-${useId().replace(/:/g, "")}`;
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.38;
  const innerR = size * 0.22;
  const activeCount = slices.filter((s) => s.value > 0).length;
  const gapDeg = activeCount > 1 ? 3 : 0;

  let cursor = 0;
  const segments =
    total <= 0
      ? []
      : slices
          .filter((slice) => slice.value > 0)
          .map((slice) => {
            const portion = (slice.value / total) * 360;
            const start = cursor + gapDeg / 2;
            const end = cursor + portion - gapDeg / 2;
            cursor += portion;
            return {
              label: slice.label,
              color: slice.color,
              path: donutSegment(cx, cy, outerR, innerR, start, end),
            };
          });

  return (
    <div className="flex flex-col items-center gap-5 py-2 sm:flex-row sm:justify-center sm:gap-10">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="overflow-visible"
          role="img"
          aria-label="Attendance chart"
        >
          <defs>
            <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#0f172a" floodOpacity="0.1" />
            </filter>
          </defs>
          <circle
            cx={cx}
            cy={cy}
            r={(outerR + innerR) / 2}
            fill="none"
            stroke="#eef2f7"
            strokeWidth={outerR - innerR}
          />
          <g filter={`url(#${filterId})`}>
            {segments.length === 0 ? (
              <circle
                cx={cx}
                cy={cy}
                r={(outerR + innerR) / 2}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth={outerR - innerR}
              />
            ) : (
              segments.map((segment) => (
                <path
                  key={segment.label}
                  d={segment.path}
                  fill={segment.color}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
              ))
            )}
          </g>
          <circle cx={cx} cy={cy} r={innerR - 0.5} fill="#ffffff" />
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center select-none">
          {centerValue && (
            <span className="block text-[2.25rem] font-extrabold leading-none tracking-tight text-slate-900">
              {centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="mt-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {centerLabel}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        {slices.map((slice) => {
          const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
          return (
            <div key={slice.label} className="flex items-center gap-3">
              <span className="size-3.5 shrink-0 rounded-[3px]" style={{ background: slice.color }} />
              <div>
                <p className="text-sm font-semibold text-slate-800">{slice.label}</p>
                <p className="text-xs text-slate-500">
                  {slice.value} · {pct}%
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface BarSeries {
  label: string;
  color: string;
  values: number[];
}

interface BarChartProps {
  categories: string[];
  series: BarSeries[];
  height?: number;
}

export function BarChart({ categories, series, height = 240 }: BarChartProps) {
  const maxValue = Math.max(1, ...series.flatMap((item) => item.values));
  const groupCount = Math.max(categories.length, 1);
  const barWidth = 26;
  const gap = 18;
  const groupWidth = series.length * barWidth + gap;
  const width = Math.max(320, groupCount * groupWidth + 48);
  const chartHeight = height - 40;
  const paddingLeft = 8;

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} className="mx-auto block">
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = chartHeight - tick * (chartHeight - 10) + 4;
          return (
            <g key={tick}>
              <line x1={0} x2={width} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={0} y={y - 4} className="fill-slate-400 text-[10px]">
                {Math.round(tick * maxValue * 10) / 10}
              </text>
            </g>
          );
        })}
        {categories.map((category, index) => {
          const groupX = paddingLeft + 24 + index * groupWidth;
          return (
            <g key={category}>
              {series.map((item, seriesIndex) => {
                const value = item.values[index] ?? 0;
                const barH = (value / maxValue) * (chartHeight - 20);
                const x = groupX + seriesIndex * barWidth;
                const y = chartHeight - barH + 4;
                return (
                  <rect
                    key={item.label}
                    x={x}
                    y={y}
                    width={barWidth - 4}
                    height={Math.max(barH, 0)}
                    rx={6}
                    fill={item.color}
                    className="transition-all duration-500"
                  >
                    <title>
                      {category}: {item.label} = {value}
                    </title>
                  </rect>
                );
              })}
              <text
                x={groupX + (series.length * barWidth) / 2 - 2}
                y={height - 8}
                textAnchor="middle"
                className="fill-slate-600 text-[11px] font-medium"
              >
                {category.length > 10 ? `${category.slice(0, 9)}…` : category}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="mt-3 flex flex-wrap justify-center gap-4">
        {series.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm text-slate-600">
            <span className="size-3 rounded-sm" style={{ background: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  tone: "teal" | "green" | "rose" | "blue" | "amber" | "violet";
  icon?: string;
}

const toneClasses: Record<MetricCardProps["tone"], string> = {
  teal: "border-l-blue-600",
  green: "border-l-emerald-600",
  rose: "border-l-rose-600",
  blue: "border-l-blue-600",
  amber: "border-l-amber-500",
  violet: "border-l-indigo-600",
};

export function MetricCard({ label, value, tone, icon }: MetricCardProps) {
  return (
    <article
      className={`rounded border border-slate-200 border-l-4 bg-white px-3 py-2.5 ${toneClasses[tone]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium text-slate-500">{label}</p>
          <p className="mt-0.5 text-xl font-semibold tracking-tight text-slate-900">{value}</p>
        </div>
        {icon && (
          <span className="grid size-7 place-items-center rounded bg-slate-100 text-[10px] font-bold text-slate-600">
            {icon}
          </span>
        )}
      </div>
    </article>
  );
}

export function PanelCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
        <h2 className="text-[13px] font-semibold text-slate-800">{title}</h2>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}
