import { useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import {
  AccessTimeOutlined,
  EqualizerOutlined,
  DirectionsRunOutlined,
  ScheduleOutlined,
  SearchOutlined,
} from "@mui/icons-material";
import { InitialsAvatar } from "../../../components/InitialsAvatar";
import { apiRequest } from "../../../lib/api";
import { staffName, type HrSetup, type Staff } from "./types";

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 7)}-01`;
const STANDARD_START = 9 * 60;
const STANDARD_END = 17 * 60;
const PAGE_SIZE = 8;

interface SavedRecord {
  id: string;
  attendanceDate: string;
  status: string;
  inTime: string | null;
  outTime: string | null;
  note?: string | null;
  staff: Staff;
}

function minutesOf(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function formatClock(totalMinutes: number | null) {
  if (totalMinutes == null || Number.isNaN(totalMinutes)) return "—";
  const rounded = Math.round(totalMinutes);
  const hours24 = Math.floor(rounded / 60) % 24;
  const minutes = rounded % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatDuration(totalMinutes: number | null) {
  if (totalMinutes == null || Number.isNaN(totalMinutes) || totalMinutes <= 0) return "—";
  const rounded = Math.round(totalMinutes);
  return `${Math.floor(rounded / 60)}h ${String(rounded % 60).padStart(2, "0")}m`;
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

interface Metrics {
  avgIn: number | null;
  avgOut: number | null;
  onTimeRate: number | null;
  lateCount: number;
}

function computeMetrics(records: SavedRecord[]): Metrics {
  const ins: number[] = [];
  const outs: number[] = [];
  let lateCount = 0;
  for (const record of records) {
    if (record.inTime) {
      const minutes = minutesOf(record.inTime);
      ins.push(minutes);
      if (minutes > STANDARD_START) lateCount += 1;
    } else if (record.status === "LATE") {
      lateCount += 1;
    }
    if (record.outTime) outs.push(minutesOf(record.outTime));
  }
  const onTime = ins.filter((minutes) => minutes <= STANDARD_START).length;
  return {
    avgIn: average(ins),
    avgOut: average(outs),
    onTimeRate: ins.length ? (onTime / ins.length) * 100 : null,
    lateCount,
  };
}

export function InOutReportPanel({
  setup,
  token,
  onError,
}: {
  setup: HrSetup;
  token: string;
  onError: (message: string) => void;
}) {
  const [roleId, setRoleId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [applied, setApplied] = useState({ from: monthStart, to: today });
  const [rows, setRows] = useState<SavedRecord[]>([]);
  const [prevRows, setPrevRows] = useState<SavedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [grouping, setGrouping] = useState<"daily" | "weekly">("daily");

  useEffect(() => {
    let cancelled = false;
    async function loadRange() {
      setLoading(true);
      const days = Math.max(
        1,
        Math.round(
          (new Date(applied.to).getTime() - new Date(applied.from).getTime()) / 86_400_000,
        ) + 1,
      );
      const prevTo = shiftDate(applied.from, -1);
      const prevFrom = shiftDate(applied.from, -days);
      try {
        const [current, previous] = await Promise.all([
          apiRequest<SavedRecord[]>(
            `/hr/attendance?from=${applied.from}&to=${applied.to}`,
            token,
          ),
          apiRequest<SavedRecord[]>(`/hr/attendance?from=${prevFrom}&to=${prevTo}`, token).catch(
            () => [] as SavedRecord[],
          ),
        ]);
        if (!cancelled) {
          setRows(current);
          setPrevRows(previous);
          setPage(1);
        }
      } catch (cause) {
        if (!cancelled) {
          onError(cause instanceof Error ? cause.message : "Unable to load report");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadRange();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, token]);

  const matchesFilters = (record: SavedRecord) =>
    (!roleId || record.staff.designation?.id === roleId) &&
    (!departmentId || record.staff.department?.id === departmentId);

  const filtered = useMemo(() => rows.filter(matchesFilters), [rows, roleId, departmentId]);
  const prevFiltered = useMemo(
    () => prevRows.filter(matchesFilters),
    [prevRows, roleId, departmentId],
  );

  const metrics = useMemo(() => computeMetrics(filtered), [filtered]);
  const prevMetrics = useMemo(() => computeMetrics(prevFiltered), [prevFiltered]);

  const staffSummary = useMemo(() => {
    const map = new Map<
      string,
      { staff: Staff; ins: number[]; outs: number[]; durations: number[]; records: number }
    >();
    for (const record of filtered) {
      let entry = map.get(record.staff.id);
      if (!entry) {
        entry = { staff: record.staff, ins: [], outs: [], durations: [], records: 0 };
        map.set(record.staff.id, entry);
      }
      entry.records += 1;
      if (record.inTime) entry.ins.push(minutesOf(record.inTime));
      if (record.outTime) entry.outs.push(minutesOf(record.outTime));
      if (record.inTime && record.outTime) {
        entry.durations.push(minutesOf(record.outTime) - minutesOf(record.inTime));
      }
    }
    return [...map.values()]
      .map((entry) => {
        const avgIn = average(entry.ins);
        const avgOut = average(entry.outs);
        let status = "On-time";
        if (avgIn == null) status = "Absent";
        else if (avgIn > STANDARD_START) status = "Late";
        else if (avgOut != null && avgOut < STANDARD_END) status = "Early Departure";
        return {
          staff: entry.staff,
          avgIn,
          avgOut,
          avgDuration: average(entry.durations),
          status,
        };
      })
      .sort((a, b) => staffName(a.staff).localeCompare(staffName(b.staff)));
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(staffSummary.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = staffSummary.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showFrom = staffSummary.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const showTo = Math.min(safePage * PAGE_SIZE, staffSummary.length);

  const trend = useMemo(() => {
    const byBucket = new Map<string, number[]>();
    for (const record of filtered) {
      if (!record.inTime) continue;
      const date = record.attendanceDate.slice(0, 10);
      let bucket = date;
      if (grouping === "weekly") {
        const value = new Date(`${date}T00:00:00Z`);
        value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
        bucket = value.toISOString().slice(0, 10);
      }
      const list = byBucket.get(bucket) ?? [];
      list.push(minutesOf(record.inTime));
      byBucket.set(bucket, list);
    }
    return [...byBucket.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucket, values]) => ({
        label: new Date(`${bucket}T00:00:00Z`).toLocaleDateString(undefined, {
          month: "short",
          day: "2-digit",
        }),
        value: Math.round(average(values) ?? STANDARD_START),
      }));
  }, [filtered, grouping]);

  const chartOptions: ApexOptions = {
    chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: "inherit" },
    stroke: { curve: "straight", width: 2.5 },
    colors: ["#4f46e5"],
    markers: { size: 4, strokeWidth: 2, strokeColors: "#ffffff" },
    grid: { borderColor: "#f1f5f9" },
    dataLabels: { enabled: false },
    xaxis: {
      categories: trend.map((point) => point.label),
      labels: { style: { colors: "#94a3b8", fontSize: "11px" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      min: 8 * 60,
      max: 10 * 60,
      tickAmount: 4,
      labels: {
        style: { colors: "#94a3b8", fontSize: "11px" },
        formatter: (value: number) => formatClock(value),
      },
    },
    annotations: {
      yaxis: [
        {
          y: STANDARD_START,
          borderColor: "#94a3b8",
          strokeDashArray: 5,
        },
      ],
    },
    tooltip: {
      y: { formatter: (value: number) => formatClock(value) },
    },
    legend: { show: false },
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-4 py-4">
        <label className="block w-44">
          <span className="nx-label">Staff Role</span>
          <select
            className="nx-input mt-1 w-full"
            value={roleId}
            onChange={(e) => {
              setRoleId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Roles</option>
            {setup.designations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block w-48">
          <span className="nx-label">Department</span>
          <select
            className="nx-input mt-1 w-full"
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Departments</option>
            {setup.departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="nx-label">Date Range</span>
          <div className="mt-1 flex items-center gap-2">
            <input
              className="nx-input"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <span className="text-slate-400">–</span>
            <input
              className="nx-input"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <button
          type="button"
          className="nx-btn-primary"
          onClick={() => setApplied({ from, to })}
        >
          <SearchOutlined sx={{ fontSize: 16 }} /> Search
        </button>
      </div>

      <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<AccessTimeOutlined sx={{ fontSize: 20 }} />}
          tint="#6366f1"
          label="Avg Check-in Time"
          value={formatClock(metrics.avgIn)}
          delta={timeDelta(metrics.avgIn, prevMetrics.avgIn, "lower")}
        />
        <KpiCard
          icon={<ScheduleOutlined sx={{ fontSize: 20 }} />}
          tint="#10b981"
          label="Avg Check-out Time"
          value={formatClock(metrics.avgOut)}
          delta={timeDelta(metrics.avgOut, prevMetrics.avgOut, "higher")}
        />
        <KpiCard
          icon={<EqualizerOutlined sx={{ fontSize: 20 }} />}
          tint="#0ea5e9"
          label="On-time Rate %"
          value={metrics.onTimeRate == null ? "—" : `${metrics.onTimeRate.toFixed(1)}%`}
          delta={rateDelta(metrics.onTimeRate, prevMetrics.onTimeRate)}
        />
        <KpiCard
          icon={<DirectionsRunOutlined sx={{ fontSize: 20 }} />}
          tint="#f43f5e"
          label="Late Arrivals (this period)"
          value={String(metrics.lateCount)}
          delta={countDelta(metrics.lateCount, prevMetrics.lateCount)}
        />
      </div>

      <div className="overflow-x-auto border-t border-slate-100">
        <table className="nx-table min-w-[980px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 text-left">Staff Name</th>
              <th className="px-3 py-3 text-left">Role</th>
              <th className="px-3 py-3 text-left">Department</th>
              <th className="px-3 py-3 text-left">Check-in Time</th>
              <th className="px-3 py-3 text-left">Check-out Time</th>
              <th className="px-3 py-3 text-left">Total Duration</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageItems.map((row) => (
              <tr key={row.staff.id} className="transition hover:bg-indigo-50/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <InitialsAvatar
                      name={staffName(row.staff)}
                      photoUrl={row.staff.photoUrl ?? row.staff.user.avatarUrl}
                      size={30}
                    />
                    <span className="font-semibold text-slate-900">
                      {staffName(row.staff)}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {row.staff.designation?.name ?? "—"}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {row.staff.department?.name ?? "—"}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex items-center gap-1 ${
                      row.avgIn != null && row.avgIn > STANDARD_START
                        ? "font-semibold text-rose-600"
                        : "text-slate-600"
                    }`}
                  >
                    {row.avgIn != null && row.avgIn > STANDARD_START ? (
                      <AccessTimeOutlined sx={{ fontSize: 14 }} />
                    ) : null}
                    {formatClock(row.avgIn)}
                  </span>
                </td>
                <td className="px-3 py-3 text-slate-600">{formatClock(row.avgOut)}</td>
                <td className="px-3 py-3 text-slate-600">{formatDuration(row.avgDuration)}</td>
                <td className="px-4 py-3">
                  <StatusPill status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!pageItems.length ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            {loading ? "Loading report…" : "No attendance records in this range."}
          </p>
        ) : null}
      </div>

      {staffSummary.length ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <p className="text-[12px] text-slate-500">
            Showing {showFrom} to {showTo} of {staffSummary.length} entries
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
            >
              Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 3) }, (_, index) => index + 1).map(
              (pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setPage(pageNum)}
                  className={`grid size-8 place-items-center rounded-lg text-[12px] font-semibold ${
                    safePage === pageNum
                      ? "bg-indigo-600 text-white"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {pageNum}
                </button>
              ),
            )}
            {totalPages > 3 ? (
              <button
                type="button"
                onClick={() => setPage(totalPages)}
                className={`grid min-w-8 place-items-center rounded-lg px-2 text-[12px] font-semibold ${
                  safePage === totalPages
                    ? "bg-indigo-600 text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {totalPages}
              </button>
            ) : null}
            <button
              type="button"
              className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <div className="border-t border-slate-100 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-bold text-slate-900">Attendance trend</h3>
            <p className="text-[12px] text-slate-500">
              {grouping === "daily" ? "Daily" : "Weekly"} average check-in time consistency
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500">
              <span className="inline-block h-0.5 w-5 rounded bg-indigo-600" /> Avg Check-in Time
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-slate-500">
              <span className="inline-block w-5 border-t-2 border-dashed border-slate-400" />{" "}
              Standard start time (9:00 AM)
            </span>
            <select
              className="nx-input !py-1.5 text-[12px]"
              value={grouping}
              onChange={(e) => setGrouping(e.target.value as "daily" | "weekly")}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </div>
        {trend.length ? (
          <Chart
            type="line"
            height={220}
            options={chartOptions}
            series={[
              { name: "Avg Check-in Time", data: trend.map((point) => point.value) },
            ]}
          />
        ) : (
          <p className="py-10 text-center text-sm text-slate-500">
            No check-in times recorded in this range — the trend appears once in/out times
            exist.
          </p>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "On-time") return <span className="nx-pill nx-pill-success">On-time</span>;
  if (status === "Late") return <span className="nx-pill nx-pill-warning">Late</span>;
  if (status === "Absent") return <span className="nx-pill nx-pill-danger">Absent</span>;
  return (
    <span className="inline-flex rounded-full border border-sky-300 px-2.5 py-0.5 text-[11.5px] font-semibold text-sky-600">
      Early Departure
    </span>
  );
}

interface Delta {
  text: string;
  good: boolean;
  arrow: "up" | "down";
}

function timeDelta(
  current: number | null,
  previous: number | null,
  betterWhen: "lower" | "higher",
): Delta | null {
  if (current == null || previous == null) return null;
  const arrow = current >= previous ? "up" : "down";
  const good = betterWhen === "lower" ? current <= previous : current >= previous;
  return { text: `vs last period ${formatClock(previous)}`, good, arrow };
}

function rateDelta(current: number | null, previous: number | null): Delta | null {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  return {
    text: `vs last period ${previous.toFixed(1)}%  ${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`,
    good: diff >= 0,
    arrow: diff >= 0 ? "up" : "down",
  };
}

function countDelta(current: number, previous: number): Delta | null {
  const diff = current - previous;
  return {
    text: `vs last period ${previous}`,
    good: diff <= 0,
    arrow: diff >= 0 ? "up" : "down",
  };
}

function KpiCard({
  icon,
  tint,
  label,
  value,
  delta,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
  delta: Delta | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div
        className="grid size-11 shrink-0 place-items-center rounded-full"
        style={{ background: `${tint}1a`, color: tint }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11.5px] font-semibold text-slate-500">{label}</p>
        <p className="mt-0.5 text-[20px] font-bold leading-tight text-slate-900">{value}</p>
        {delta ? (
          <p className="mt-0.5 text-[11px] text-slate-400">
            {delta.text}{" "}
            <span className={delta.good ? "text-emerald-600" : "text-rose-500"}>
              {delta.arrow === "up" ? "↑" : "↓"}
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
