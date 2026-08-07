import { useEffect, useMemo, useState } from "react";
import { ChevronLeftRounded, ChevronRightRounded } from "@mui/icons-material";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import Swal from "sweetalert2";
import { apiRequest } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";
import type { PortalAttendanceRecord, PortalLeave } from "../student-parent/portalTypes";
import { PageHeader } from "./components/PageHeader";
import { StatusChip } from "./components/StatusChip";
import { useParentPortal } from "./ParentPortalContext";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_DARK } from "./ParentPortalLayout";

type DayStatus = "present" | "absent" | "late" | "holiday" | "half_day";
type LeaveStatus = "Pending" | "Approved" | "Rejected";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DAY_COLORS: Record<DayStatus, { bg: string; text: string; label: string }> = {
  present: { bg: "#DCFCE7", text: "#15803D", label: "Present" },
  absent: { bg: "#FEE2E2", text: "#DC2626", label: "Absent" },
  late: { bg: "#FFEDD5", text: "#EA580C", label: "Late" },
  holiday: { bg: "#EEF2FF", text: "#4F46E5", label: "Holiday" },
  half_day: { bg: "#FEF9C3", text: "#A16207", label: "Half Day" },
};

const LEAVE_TONE: Record<LeaveStatus, "orange" | "green" | "red"> = {
  Pending: "orange",
  Approved: "green",
  Rejected: "red",
};

function dayKey(value: string | Date) {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mapStatus(status: string): DayStatus {
  const key = status.toUpperCase();
  if (key === "PRESENT") return "present";
  if (key === "ABSENT") return "absent";
  if (key === "LATE") return "late";
  if (key === "HOLIDAY") return "holiday";
  if (key === "HALF_DAY") return "half_day";
  return "present";
}

function mapLeaveStatus(status: string): LeaveStatus {
  const key = status.toUpperCase();
  if (key === "APPROVED") return "Approved";
  if (key === "REJECTED") return "Rejected";
  return "Pending";
}

function formatShort(value: string) {
  const key = dayKey(value);
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

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
  records: PortalAttendanceRecord[];
};

const tableSx = {
  "& th": {
    fontWeight: 700,
    fontSize: 12,
    color: "#6B7280",
    background: "#F9FAFB",
    borderBottom: `1px solid ${PARENT_BORDER}`,
    whiteSpace: "nowrap" as const,
  },
  "& td": {
    fontSize: 13,
    color: "#1A1A2E",
    borderBottom: `1px solid ${PARENT_BORDER}`,
  },
};

const primaryBtnSx = {
  textTransform: "none" as const,
  fontWeight: 700,
  borderRadius: "12px",
  bgcolor: PARENT_PRIMARY,
  "&:hover": { bgcolor: PARENT_PRIMARY_DARK },
};

export function ParentAttendancePage() {
  const { activeChild, portalChild, accessToken } = useParentPortal();
  const studentId = portalChild?.student.id;
  const [cursor, setCursor] = useState(() => new Date());
  const [records, setRecords] = useState<PortalAttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendancePayload["summary"]>(null);
  const [leaves, setLeaves] = useState<PortalLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleString("en-IN", { month: "long", year: "numeric" });

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    Promise.all([
      apiRequest<AttendancePayload>(`/portal/children/${studentId}/attendance`, accessToken),
      apiRequest<PortalLeave[]>(`/portal/children/${studentId}/leaves`, accessToken),
    ])
      .then(([attendance, leaveRows]) => {
        setRecords(attendance.records ?? []);
        setSummary(attendance.summary);
        setLeaves(leaveRows);
        const latest = attendance.records?.[0]?.date;
        if (latest) {
          const key = dayKey(latest);
          const [y, m] = key.split("-").map(Number);
          setCursor((current) => {
            if (current.getFullYear() === y && current.getMonth() === m - 1) return current;
            return new Date(y, m - 1, 1);
          });
        }
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load attendance");
      })
      .finally(() => setLoading(false));
  }, [accessToken, studentId]);

  const attendance = useMemo(() => {
    const map = new Map<number, DayStatus>();
    for (const row of records) {
      const key = dayKey(row.date);
      const [y, m, d] = key.split("-").map(Number);
      if (y !== year || m - 1 !== month) continue;
      map.set(d, mapStatus(row.status));
    }
    return map;
  }, [records, year, month]);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const submitLeave = async () => {
    if (!studentId || !fromDate || !toDate || reason.trim().length < 3) return;
    setSubmitting(true);
    try {
      await apiRequest(`/portal/children/${studentId}/leaves`, accessToken, {
        method: "POST",
        body: JSON.stringify({ fromDate, toDate, reason: reason.trim() }),
      });
      const leaveRows = await apiRequest<PortalLeave[]>(
        `/portal/children/${studentId}/leaves`,
        accessToken,
      );
      setLeaves(leaveRows);
      setLeaveOpen(false);
      notifySuccess("Leave request submitted");
      await Swal.fire({
        title: "Leave applied",
        text: `Request for ${activeChild.name} is pending review.`,
        icon: "success",
        confirmButtonText: "OK",
        buttonsStyling: false,
        customClass: {
          popup: "swal-popup",
          title: "swal-title",
          htmlContainer: "swal-text",
          actions: "swal-actions",
          confirmButton: "swal-confirm",
        },
      });
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to submit leave");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Attendance"
        subtitle={`${activeChild.name} · ${activeChild.className} - ${activeChild.section}`}
        action={
          <Button
            variant="contained"
            disableElevation
            sx={primaryBtnSx}
            onClick={() => {
              setFromDate("");
              setToDate("");
              setReason("");
              setLeaveOpen(true);
            }}
          >
            Apply Leave
          </Button>
        }
      />

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div
          className="rounded-[20px] border bg-white p-4 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
          style={{ borderColor: PARENT_BORDER }}
        >
          <p className="text-[12px] font-semibold text-[#6B7280]">Present %</p>
          <p className="mt-1 text-[28px] font-extrabold text-[#16A34A]">
            {Math.round(summary?.percentage ?? 0)}%
          </p>
        </div>
        <div
          className="rounded-[20px] border bg-white p-4 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
          style={{ borderColor: PARENT_BORDER }}
        >
          <p className="text-[12px] font-semibold text-[#6B7280]">Absent days</p>
          <p className="mt-1 text-[28px] font-extrabold text-[#DC2626]">{summary?.absent ?? 0}</p>
        </div>
        <div
          className="rounded-[20px] border bg-white p-4 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
          style={{ borderColor: PARENT_BORDER }}
        >
          <p className="text-[12px] font-semibold text-[#6B7280]">Late days</p>
          <p className="mt-1 text-[28px] font-extrabold text-[#EA580C]">{summary?.late ?? 0}</p>
        </div>
      </div>

      <section
        className="rounded-[20px] border bg-white p-4 shadow-[0_4px_18px_rgba(28,27,60,0.04)] sm:p-5"
        style={{ borderColor: PARENT_BORDER }}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-[#1A1A2E]">Attendance Calendar</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              className="grid size-8 place-items-center rounded-lg text-[#6B7280] hover:bg-[#F5F6FA]"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
            >
              <ChevronLeftRounded sx={{ fontSize: 20 }} />
            </button>
            <span className="min-w-[140px] text-center text-[13px] font-bold text-[#1A1A2E]">
              {monthLabel}
            </span>
            <button
              type="button"
              aria-label="Next month"
              className="grid size-8 place-items-center rounded-lg text-[#6B7280] hover:bg-[#F5F6FA]"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
            >
              <ChevronRightRounded sx={{ fontSize: 20 }} />
            </button>
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-[13px] text-[#6B7280]">Loading calendar…</p>
        ) : (
          <>
            <div className="mb-2 grid grid-cols-7 gap-1.5 text-center">
              {WEEKDAYS.map((d) => (
                <span key={d} className="text-[11px] font-semibold text-[#9CA3AF]">
                  {d}
                </span>
              ))}
              {cells.map((day, index) => {
                if (day == null) return <div key={`e-${index}`} />;
                const status = attendance.get(day);
                const colors = status ? DAY_COLORS[status] : null;
                return (
                  <div
                    key={day}
                    className="grid aspect-square place-items-center rounded-xl text-[12px] font-bold"
                    style={{
                      background: colors?.bg ?? "#F9FAFB",
                      color: colors?.text ?? "#9CA3AF",
                    }}
                    title={colors?.label}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
            <div
              className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t pt-3"
              style={{ borderColor: PARENT_BORDER }}
            >
              {(Object.keys(DAY_COLORS) as DayStatus[]).map((key) => (
                <span
                  key={key}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B7280]"
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{
                      background: DAY_COLORS[key].bg,
                      outline: `1px solid ${DAY_COLORS[key].text}`,
                    }}
                  />
                  {DAY_COLORS[key].label}
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      <section
        className="overflow-hidden rounded-[20px] border bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
        style={{ borderColor: PARENT_BORDER }}
      >
        <div className="border-b px-5 py-4" style={{ borderColor: PARENT_BORDER }}>
          <h2 className="text-[15px] font-bold text-[#1A1A2E]">Leave Requests</h2>
        </div>
        <div className="overflow-x-auto">
          <Table size="small" sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell>From</TableCell>
                <TableCell>To</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Applied</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {leaves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ color: "#6B7280", py: 4 }}>
                    No leave requests yet.
                  </TableCell>
                </TableRow>
              ) : (
                leaves.map((row) => {
                  const status = mapLeaveStatus(row.status);
                  return (
                    <TableRow key={row.id} hover>
                      <TableCell>{formatShort(row.fromDate)}</TableCell>
                      <TableCell>{formatShort(row.toDate)}</TableCell>
                      <TableCell>{row.reason}</TableCell>
                      <TableCell>{formatShort(row.createdAt)}</TableCell>
                      <TableCell>
                        <StatusChip label={status} tone={LEAVE_TONE[status]} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog open={leaveOpen} onClose={() => setLeaveOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 800, fontSize: 18 }}>Apply Leave</DialogTitle>
        <DialogContent className="flex flex-col gap-4 !pt-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="From date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="To date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </div>
          <TextField
            label="Reason"
            multiline
            minRows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            fullWidth
            size="small"
            placeholder="Brief reason for leave"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setLeaveOpen(false)}
            sx={{ textTransform: "none", fontWeight: 600, color: "#6B7280" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            sx={primaryBtnSx}
            disabled={submitting || !fromDate || !toDate || reason.trim().length < 3}
            onClick={() => void submitLeave()}
          >
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
