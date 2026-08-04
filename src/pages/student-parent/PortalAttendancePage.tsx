import { useEffect, useMemo, useState } from "react";
import {
  AccessTimeRounded,
  CalendarMonthOutlined,
  CancelOutlined,
  CheckCircleOutlineRounded,
  EventAvailableOutlined,
  EventBusyOutlined,
} from "@mui/icons-material";
import { Link, Navigate } from "react-router-dom";
import { apiRequest } from "../../lib/api";
import { isProductBucketAllowed } from "../../lib/productMode";
import { usePortal } from "./PortalContext";
import type { PortalAttendanceRecord } from "./portalTypes";

const PRIMARY = "#534AB7";
const PRIMARY_SOFT = "#EEF0FD";
const BORDER = "#E5E7EB";

type AttendancePayload = {
  summary: {
    total: number;
    present: number;
    late: number;
    absent: number;
    halfDay: number;
    holiday: number;
    percentage: number;
  } | null;
  period?: { from: string; to: string; label: string | null };
  records: PortalAttendanceRecord[];
};

/** Stable YYYY-MM-DD for date-only API values (avoid UTC day-shift). */
function dayKey(value: string | Date) {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseLocalDate(value: string) {
  const key = dayKey(value);
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatShortDate(value: string) {
  return parseLocalDate(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDayName(value: string) {
  return parseLocalDate(value).toLocaleDateString(undefined, { weekday: "long" });
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  // Accept "08:45", "08:45:00", or already formatted
  if (/[ap]m/i.test(value)) return value;
  const [hRaw, mRaw = "00"] = value.split(":");
  const h = Number(hRaw);
  if (!Number.isFinite(h)) return value;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = ((h + 11) % 12) + 1;
  return `${String(hour12).padStart(2, "0")}:${mRaw.slice(0, 2)} ${suffix}`;
}

function statusMeta(status: string) {
  const key = status.toUpperCase();
  if (key === "PRESENT" || key === "HALF_DAY") {
    return { label: key === "HALF_DAY" ? "Half Day" : "Present", bg: "#ECFDF5", fg: "#059669", dot: "#10B981" };
  }
  if (key === "ABSENT") return { label: "Absent", bg: "#FEF2F2", fg: "#E11D48", dot: "#EF4444" };
  if (key === "LATE") return { label: "Late", bg: "#FFF7ED", fg: "#D97706", dot: "#F59E0B" };
  if (key === "HOLIDAY") return { label: "Holiday", bg: PRIMARY_SOFT, fg: PRIMARY, dot: PRIMARY };
  return { label: status.replaceAll("_", " "), bg: "#F3F4F6", fg: "#6B7280", dot: "#9CA3AF" };
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)] ${className}`}
      style={{ borderColor: BORDER }}
    >
      {children}
    </section>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  return (
    <div className="relative size-[92px] shrink-0">
      <svg className="size-full -rotate-90" viewBox="0 0 92 92" aria-hidden>
        <circle cx="46" cy="46" r={r} fill="none" stroke="#F1F2F6" strokeWidth="8" />
        <circle
          cx="46"
          cy="46"
          r={r}
          fill="none"
          stroke={PRIMARY}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-[18px] font-bold text-[#1A1A1A]">{clamped}%</span>
      </div>
    </div>
  );
}

function StatPill({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <Card className="flex min-h-[118px] min-w-0 flex-col justify-center gap-1.5 !px-4 !py-4">
      <p className="text-[30px] font-bold leading-none tracking-tight text-[#1A1A1A]">{value}</p>
      <p className="text-[13px] font-semibold text-[#1A1A1A]">{label}</p>
      <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#6B7280]">
        <span className="size-1.5 rounded-full" style={{ background: color }} />
        Days
      </p>
    </Card>
  );
}

function AttendanceCalendar({
  byDate,
  cursor,
  onCursorChange,
}: {
  byDate: Map<string, string>;
  cursor: Date;
  onCursorChange: (next: Date) => void;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const cells: Array<{ day: number | null; key?: string; status?: string }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, key, status: byDate.get(key) });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-[#1A1A1A]">Attendance Calendar</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-[13px] font-bold text-[#6B7280] hover:bg-[#F6F7F9]"
            onClick={() => onCursorChange(new Date(year, month - 1, 1))}
            aria-label="Previous month"
          >
            ‹
          </button>
          <span className="min-w-[120px] text-center text-[13px] font-bold text-[#1A1A1A]">{monthLabel}</span>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-[13px] font-bold text-[#6B7280] hover:bg-[#F6F7F9]"
            onClick={() => onCursorChange(new Date(year, month + 1, 1))}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[#9CA3AF]">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (cell.day == null) return <span key={`e-${idx}`} className="h-9" />;
          const isToday = cell.key === todayKey;
          const meta = cell.status ? statusMeta(cell.status) : null;
          return (
            <div key={cell.key} className="flex h-9 flex-col items-center justify-center gap-0.5">
              <span
                className={`grid size-7 place-items-center rounded-full text-[12px] font-semibold ${
                  isToday ? "text-white" : "text-[#1A1A1A]"
                }`}
                style={isToday ? { background: PRIMARY } : undefined}
              >
                {cell.day}
              </span>
              {meta ? <span className="size-1 rounded-full" style={{ background: meta.dot }} /> : <span className="size-1" />}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] font-medium text-[#6B7280]">
        {[
          { label: "Present", color: "#10B981" },
          { label: "Absent", color: "#EF4444" },
          { label: "Late", color: "#F59E0B" },
          { label: "Holiday", color: PRIMARY },
        ].map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ points }: { points: Array<{ label: string; pct: number }> }) {
  if (points.length === 0) {
    return <p className="py-10 text-center text-[12px] text-[#6B7280]">Not enough data for a trend yet.</p>;
  }

  const width = 320;
  const height = 180;
  const padX = 28;
  const padY = 24;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;
  const maxY = 100;
  const coords = points.map((p, i) => {
    const x = padX + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const y = padY + plotH - (Math.max(0, Math.min(100, p.pct)) / maxY) * plotH;
    return { ...p, x, y };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const area = `${path} L ${coords[coords.length - 1].x} ${padY + plotH} L ${coords[0].x} ${padY + plotH} Z`;
  const last = coords[coords.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[180px] w-full" role="img" aria-label="Attendance trend">
      {[0, 25, 50, 75, 100].map((tick) => {
        const y = padY + plotH - (tick / 100) * plotH;
        return (
          <g key={tick}>
            <line x1={padX} x2={width - padX} y1={y} y2={y} stroke="#F1F2F6" strokeWidth={1} />
            <text x={4} y={y + 3} className="fill-[#9CA3AF]" fontSize="9">
              {tick}
            </text>
          </g>
        );
      })}
      <path d={area} fill={PRIMARY} opacity={0.08} />
      <path d={path} fill="none" stroke={PRIMARY} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c) => (
        <circle key={c.label} cx={c.x} cy={c.y} r={c === last ? 5 : 3.5} fill={c === last ? PRIMARY : "#fff"} stroke={PRIMARY} strokeWidth={2} />
      ))}
      {last ? (
        <g>
          <rect x={last.x - 22} y={last.y - 28} width={44} height={20} rx={8} fill={PRIMARY} />
          <text x={last.x} y={last.y - 14} textAnchor="middle" className="fill-white" fontSize="10" fontWeight="700">
            {Math.round(last.pct)}%
          </text>
        </g>
      ) : null}
      {coords.map((c) => (
        <text key={`l-${c.label}`} x={c.x} y={height - 6} textAnchor="middle" className="fill-[#9CA3AF]" fontSize="9">
          {c.label}
        </text>
      ))}
    </svg>
  );
}

export function PortalAttendancePage() {
  const { accessToken, child, basePath, productMode } = usePortal();
  const [payload, setPayload] = useState<AttendancePayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAllRecords, setShowAllRecords] = useState(false);
  const showCms = isProductBucketAllowed(productMode, "CMS");
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    if (!child || !showCms) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiRequest<AttendancePayload>(`/portal/children/${child.student.id}/attendance`, accessToken)
      .then((data) => {
        setPayload(data);
        // Prefer latest record month for calendar
        const latest = data.records[0]?.date;
        if (latest) {
          const d = parseLocalDate(latest);
          setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
        } else {
          const now = new Date();
          setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
        }
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load attendance");
      })
      .finally(() => setLoading(false));
  }, [accessToken, child?.student.id, showCms]);

  const records = payload?.records ?? [];

  const byDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of records) {
      const key = dayKey(row.date);
      // Prefer full-day status over period fragments when colliding
      if (!map.has(key) || row.periodKey === "DAY") map.set(key, row.status);
    }
    return map;
  }, [records]);

  const summary = useMemo(() => {
    if (payload?.summary) return payload.summary;
    const counts = { present: 0, late: 0, absent: 0, halfDay: 0, holiday: 0, total: 0 };
    for (const record of records) {
      counts.total += 1;
      if (record.status === "PRESENT") counts.present += 1;
      if (record.status === "LATE") counts.late += 1;
      if (record.status === "ABSENT") counts.absent += 1;
      if (record.status === "HALF_DAY") counts.halfDay += 1;
      if (record.status === "HOLIDAY") counts.holiday += 1;
    }
    const counted = counts.total - counts.holiday;
    const attended = counts.present + counts.late + counts.halfDay * 0.5;
    const percentage = counted ? Number(((attended / counted) * 100).toFixed(1)) : 0;
    return { ...counts, percentage };
  }, [payload?.summary, records]);

  const monthSummary = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const counts = { present: 0, late: 0, absent: 0, holiday: 0, halfDay: 0 };
    for (const [key, status] of byDate) {
      if (!key.startsWith(prefix)) continue;
      if (status === "PRESENT") counts.present += 1;
      else if (status === "LATE") counts.late += 1;
      else if (status === "ABSENT") counts.absent += 1;
      else if (status === "HOLIDAY") counts.holiday += 1;
      else if (status === "HALF_DAY") counts.halfDay += 1;
    }
    const counted = counts.present + counts.late + counts.absent + counts.halfDay;
    const attended = counts.present + counts.late + counts.halfDay * 0.5;
    const percentage = counted ? Math.round((attended / counted) * 100) : 0;
    return { ...counts, percentage };
  }, [byDate, cursor]);

  const trendPoints = useMemo(() => {
    const buckets = new Map<string, { present: number; late: number; absent: number; halfDay: number; sort: number }>();
    for (const [key, status] of byDate) {
      const d = parseLocalDate(key);
      const label = d.toLocaleString(undefined, { month: "short", year: "2-digit" });
      const sort = d.getFullYear() * 100 + d.getMonth();
      const bucket = buckets.get(label) ?? { present: 0, late: 0, absent: 0, halfDay: 0, sort };
      if (status === "PRESENT") bucket.present += 1;
      else if (status === "LATE") bucket.late += 1;
      else if (status === "ABSENT") bucket.absent += 1;
      else if (status === "HALF_DAY") bucket.halfDay += 1;
      buckets.set(label, bucket);
    }
    return [...buckets.entries()]
      .map(([label, b]) => {
        const counted = b.present + b.late + b.absent + b.halfDay;
        const attended = b.present + b.late + b.halfDay * 0.5;
        return { label, pct: counted ? (attended / counted) * 100 : 0, sort: b.sort };
      })
      .sort((a, b) => a.sort - b.sort)
      .slice(-6)
      .map(({ label, pct }) => ({ label, pct }));
  }, [byDate]);

  const periodLabel = useMemo(() => {
    if (payload?.period?.from && payload?.period?.to) {
      return `${formatShortDate(payload.period.from)} - ${formatShortDate(payload.period.to)}`;
    }
    return child?.enrollment?.session ?? "This session";
  }, [payload?.period, child?.enrollment?.session]);

  const rating =
    summary.percentage >= 85 ? { label: "Good", bg: "#ECFDF5", fg: "#059669" } : summary.percentage >= 70 ? { label: "Fair", bg: "#FFF7ED", fg: "#D97706" } : { label: "Low", bg: "#FEF2F2", fg: "#E11D48" };

  // One row per day for the table (prefer DAY period)
  const tableRecords = useMemo(() => {
    const map = new Map<string, PortalAttendanceRecord>();
    for (const row of records) {
      const key = dayKey(row.date);
      const existing = map.get(key);
      if (!existing || row.periodKey === "DAY") map.set(key, row);
    }
    return [...map.values()].sort((a, b) => dayKey(b.date).localeCompare(dayKey(a.date)));
  }, [records]);

  const visibleRecords = showAllRecords ? tableRecords : tableRecords.slice(0, 5);
  const monthTitle = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });

  if (!showCms) {
    return <Navigate to={basePath} replace />;
  }

  if (!child) {
    return <p className="text-sm text-[#6B7280]">No student profile linked.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-[#1A1A1A]">Attendance</h1>
          <p className="mt-1 text-[12px] text-[#9CA3AF]">
            <Link to={basePath} className="hover:text-[#6B7280]">
              Dashboard
            </Link>
            <span className="mx-1.5">›</span>
            <span className="font-medium text-[#6B7280]">Attendance</span>
          </p>
        </div>
        <Link
          to={`${basePath}/leave`}
          className="rounded-xl px-4 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:opacity-95"
          style={{ background: PRIMARY }}
        >
          Apply Leave
        </Link>
      </div>

      {error && <p className="alert-error">{error}</p>}

      {loading ? (
        <p className="text-sm text-[#6B7280]">Loading attendance…</p>
      ) : (
        <>
          {/* Summary stats — matches mock: % · Present · Absent · Late · Holidays · Total */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-12">
            <Card className="flex min-h-[118px] items-center gap-4 xl:col-span-2">
              <ProgressRing pct={summary.percentage} />
              <div className="min-w-0">
                <p className="text-[12px] font-medium leading-snug text-[#6B7280]">Attendance This Session</p>
                <span
                  className="mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                  style={{ background: rating.bg, color: rating.fg }}
                >
                  {rating.label}
                </span>
              </div>
            </Card>

            <div className="xl:col-span-2">
              <StatPill value={summary.present} label="Present" color="#10B981" />
            </div>
            <div className="xl:col-span-2">
              <StatPill value={summary.absent} label="Absent" color="#EF4444" />
            </div>
            <div className="xl:col-span-2">
              <StatPill value={summary.late} label="Late" color="#F59E0B" />
            </div>
            <div className="xl:col-span-2">
              <StatPill value={summary.holiday} label="Holidays" color={PRIMARY} />
            </div>

            <Card className="flex min-h-[118px] flex-col justify-between !p-4 xl:col-span-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[30px] font-bold leading-none tracking-tight text-[#1A1A1A]">{summary.total}</p>
                  <p className="mt-2 text-[13px] font-semibold text-[#1A1A1A]">Total Working Days</p>
                </div>
                <span className="grid size-10 place-items-center rounded-xl" style={{ background: PRIMARY_SOFT, color: PRIMARY }}>
                  <CalendarMonthOutlined sx={{ fontSize: 20 }} />
                </span>
              </div>
              <p className="mt-3 text-[11px] leading-snug text-[#9CA3AF]">Attendance Period {periodLabel}</p>
            </Card>
          </div>

          {/* Calendar · Monthly · Trend */}
          <div className="grid gap-4 xl:grid-cols-3">
            <Card>
              <AttendanceCalendar byDate={byDate} cursor={cursor} onCursorChange={setCursor} />
            </Card>

            <Card>
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-bold text-[#1A1A1A]">Monthly Summary - {monthTitle}</h2>
                <button
                  type="button"
                  className="text-[12px] font-bold hover:underline"
                  style={{ color: PRIMARY }}
                  onClick={() => setShowAllRecords(true)}
                >
                  View All
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {[
                  {
                    label: "Present",
                    value: monthSummary.present,
                    Icon: CheckCircleOutlineRounded,
                    bg: "#ECFDF5",
                    fg: "#059669",
                  },
                  {
                    label: "Absent",
                    value: monthSummary.absent,
                    Icon: CancelOutlined,
                    bg: "#FEF2F2",
                    fg: "#E11D48",
                  },
                  {
                    label: "Late",
                    value: monthSummary.late,
                    Icon: AccessTimeRounded,
                    bg: "#FFF7ED",
                    fg: "#D97706",
                  },
                  {
                    label: "Holidays",
                    value: monthSummary.holiday,
                    Icon: EventAvailableOutlined,
                    bg: PRIMARY_SOFT,
                    fg: PRIMARY,
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-center gap-3 rounded-xl bg-[#F8F9FC] px-3 py-2.5">
                    <span className="grid size-9 place-items-center rounded-xl" style={{ background: row.bg, color: row.fg }}>
                      <row.Icon sx={{ fontSize: 18 }} />
                    </span>
                    <p className="flex-1 text-[13px] font-semibold text-[#1A1A1A]">{row.label}</p>
                    <p className="text-[13px] font-bold text-[#1A1A1A]">
                      {row.value} {row.value === 1 ? "Day" : "Days"}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-[#E5E7EB] pt-4">
                <p className="text-[13px] font-bold text-[#1A1A1A]">Attendance Percentage</p>
                <p className="text-[18px] font-bold" style={{ color: "#059669" }}>
                  {monthSummary.percentage}%
                </p>
              </div>
            </Card>

            <Card>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-bold text-[#1A1A1A]">Attendance Trend</h2>
                <select
                  className="rounded-full border-0 bg-[#F6F7F9] px-2.5 py-1 text-[11px] font-semibold text-[#6B7280] outline-none"
                  defaultValue="session"
                  aria-label="Trend range"
                >
                  <option value="session">This Session</option>
                </select>
              </div>
              <TrendChart points={trendPoints} />
            </Card>
          </div>

          {/* Recent records table */}
          <Card className="!p-0 overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] px-5 py-4">
              <h2 className="text-[15px] font-bold text-[#1A1A1A]">Recent Attendance Records</h2>
              <button
                type="button"
                className="text-[12px] font-bold hover:underline"
                style={{ color: PRIMARY }}
                onClick={() => setShowAllRecords((v) => !v)}
              >
                {showAllRecords ? "Show Less" : "View All"}
              </button>
            </div>

            {tableRecords.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
                <EventBusyOutlined sx={{ fontSize: 32, color: "#9CA3AF" }} />
                <p className="text-[13px] text-[#6B7280]">No attendance records yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                      <th className="px-5 py-3 font-semibold">Date</th>
                      <th className="px-5 py-3 font-semibold">Day</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Check In</th>
                      <th className="px-5 py-3 font-semibold">Check Out</th>
                      <th className="px-5 py-3 font-semibold">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRecords.map((record) => {
                      const meta = statusMeta(record.status);
                      return (
                        <tr key={record.id} className="border-b border-[#F1F2F6] last:border-0">
                          <td className="px-5 py-3.5 font-semibold text-[#1A1A1A]">{formatShortDate(record.date)}</td>
                          <td className="px-5 py-3.5 text-[#6B7280]">{formatDayName(record.date)}</td>
                          <td className="px-5 py-3.5">
                            <span
                              className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold"
                              style={{ background: meta.bg, color: meta.fg }}
                            >
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-[#6B7280]">{formatTime(record.inTime)}</td>
                          <td className="px-5 py-3.5 text-[#6B7280]">{formatTime(record.outTime)}</td>
                          <td className="px-5 py-3.5 text-[#6B7280]">{record.note?.trim() || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
