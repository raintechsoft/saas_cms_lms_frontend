import { useEffect, useMemo, useState } from "react";
import { ChevronLeftRounded, ChevronRightRounded, CloudUploadOutlined } from "@mui/icons-material";
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
import { notifySuccess } from "../../lib/notify";
import { PageHeader } from "./components/PageHeader";
import { StatusChip } from "./components/StatusChip";
import { useParentPortal } from "./ParentPortalContext";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_DARK, PARENT_PRIMARY_SUBTLE } from "./ParentPortalLayout";

type DayStatus = "present" | "absent" | "late" | "holiday";
type LeaveStatus = "Pending" | "Approved" | "Rejected";

interface LeaveRequest {
  id: string;
  from: string;
  to: string;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DAY_COLORS: Record<DayStatus, { bg: string; text: string; label: string }> = {
  present: { bg: "#DCFCE7", text: "#15803D", label: "Present" },
  absent: { bg: "#FEE2E2", text: "#DC2626", label: "Absent" },
  late: { bg: "#FFEDD5", text: "#EA580C", label: "Late" },
  holiday: { bg: "#EEF2FF", text: "#4F46E5", label: "Holiday" },
};

const LEAVE_TONE: Record<LeaveStatus, "orange" | "green" | "red"> = {
  Pending: "orange",
  Approved: "green",
  Rejected: "red",
};

/** Deterministic mock attendance for a given child + month. */
function buildMonthAttendance(childId: string, year: number, month: number): Map<number, DayStatus> {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const map = new Map<number, DayStatus>();
  const seed = childId === "child-2" ? 3 : 1;

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow === 0) {
      map.set(d, "holiday");
      continue;
    }
    const n = (d * 7 + seed * 11) % 23;
    if (n === 0) map.set(d, "absent");
    else if (n === 1 || n === 2) map.set(d, "late");
    else map.set(d, "present");
  }
  return map;
}

const INITIAL_LEAVES: Record<string, LeaveRequest[]> = {
  "child-1": [
    {
      id: "lv1",
      from: "12 May 2025",
      to: "13 May 2025",
      reason: "Family function",
      status: "Approved",
      appliedOn: "08 May 2025",
    },
    {
      id: "lv2",
      from: "22 May 2025",
      to: "22 May 2025",
      reason: "Medical appointment",
      status: "Pending",
      appliedOn: "18 May 2025",
    },
    {
      id: "lv3",
      from: "03 Apr 2025",
      to: "04 Apr 2025",
      reason: "Fever",
      status: "Rejected",
      appliedOn: "02 Apr 2025",
    },
  ],
  "child-2": [
    {
      id: "lv4",
      from: "10 May 2025",
      to: "10 May 2025",
      reason: "Wedding in family",
      status: "Approved",
      appliedOn: "06 May 2025",
    },
    {
      id: "lv5",
      from: "28 May 2025",
      to: "29 May 2025",
      reason: "Travel",
      status: "Pending",
      appliedOn: "20 May 2025",
    },
  ],
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
  const { activeChild } = useParentPortal();
  const [cursor, setCursor] = useState(() => new Date(2025, 4, 1)); // May 2025
  const [leaves, setLeaves] = useState(() => INITIAL_LEAVES[activeChild.id] ?? INITIAL_LEAVES["child-1"]);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    setLeaves(INITIAL_LEAVES[activeChild.id] ?? INITIAL_LEAVES["child-1"]);
  }, [activeChild.id]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleString("en-IN", { month: "long", year: "numeric" });
  const attendance = useMemo(
    () => buildMonthAttendance(activeChild.id, year, month),
    [activeChild.id, year, month],
  );

  const summary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let counted = 0;
    attendance.forEach((status) => {
      if (status === "holiday") return;
      counted += 1;
      if (status === "present") present += 1;
      else if (status === "absent") absent += 1;
      else if (status === "late") {
        late += 1;
        present += 1; // late still counts toward present %
      }
    });
    const pct = counted ? Math.round((present / counted) * 100) : 0;
    return { pct, absent, late };
  }, [attendance]);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const openLeave = () => {
    setFromDate("");
    setToDate("");
    setReason("");
    setFileName("");
    setLeaveOpen(true);
  };

  const submitLeave = async () => {
    if (!fromDate || !toDate || reason.trim().length < 3) return;
    const fmt = (iso: string) =>
      new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    const next: LeaveRequest = {
      id: `lv-${Date.now()}`,
      from: fmt(fromDate),
      to: fmt(toDate),
      reason: reason.trim(),
      status: "Pending",
      appliedOn: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    };
    setLeaves((prev) => [next, ...prev]);
    setLeaveOpen(false);
    notifySuccess("Leave request submitted");
    await Swal.fire({
      title: "Leave applied",
      text: `Request for ${activeChild.name} from ${next.from} to ${next.to} is pending review.`,
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
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Attendance"
        subtitle={`Daily attendance for ${activeChild.name}.`}
        action={
          <Button variant="contained" disableElevation sx={primaryBtnSx} onClick={openLeave}>
            Apply Leave
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div
          className="rounded-[20px] border bg-white p-4 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
          style={{ borderColor: PARENT_BORDER }}
        >
          <p className="text-[12px] font-semibold text-[#6B7280]">Present %</p>
          <p className="mt-1 text-[28px] font-extrabold text-[#16A34A]">{summary.pct}%</p>
        </div>
        <div
          className="rounded-[20px] border bg-white p-4 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
          style={{ borderColor: PARENT_BORDER }}
        >
          <p className="text-[12px] font-semibold text-[#6B7280]">Absent days</p>
          <p className="mt-1 text-[28px] font-extrabold text-[#DC2626]">{summary.absent}</p>
        </div>
        <div
          className="rounded-[20px] border bg-white p-4 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
          style={{ borderColor: PARENT_BORDER }}
        >
          <p className="text-[12px] font-semibold text-[#6B7280]">Late days</p>
          <p className="mt-1 text-[28px] font-extrabold text-[#EA580C]">{summary.late}</p>
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
            <span className="min-w-[140px] text-center text-[13px] font-bold text-[#1A1A2E]">{monthLabel}</span>
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

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t pt-3" style={{ borderColor: PARENT_BORDER }}>
          {(Object.keys(DAY_COLORS) as DayStatus[]).map((key) => (
            <span key={key} className="flex items-center gap-1.5 text-[11px] font-medium text-[#6B7280]">
              <span className="size-2.5 rounded-full" style={{ background: DAY_COLORS[key].bg, outline: `1px solid ${DAY_COLORS[key].text}` }} />
              {DAY_COLORS[key].label}
            </span>
          ))}
        </div>
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
              {leaves.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.from}</TableCell>
                  <TableCell>{row.to}</TableCell>
                  <TableCell>{row.reason}</TableCell>
                  <TableCell>{row.appliedOn}</TableCell>
                  <TableCell>
                    <StatusChip label={row.status} tone={LEAVE_TONE[row.status]} />
                  </TableCell>
                </TableRow>
              ))}
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
          <label
            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-5 text-center transition hover:bg-[#F5F6FA]"
            style={{ borderColor: PARENT_BORDER, background: PARENT_PRIMARY_SUBTLE }}
          >
            <CloudUploadOutlined sx={{ fontSize: 28, color: PARENT_PRIMARY }} />
            <span className="text-[13px] font-semibold text-[#1A1A2E]">
              {fileName || "Upload supporting document (optional)"}
            </span>
            <span className="text-[11px] text-[#6B7280]">PDF, JPG or PNG up to 5MB</span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,image/jpeg,image/png"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            />
          </label>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setLeaveOpen(false)} sx={{ textTransform: "none", fontWeight: 600, color: "#6B7280" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            sx={primaryBtnSx}
            onClick={() => void submitLeave()}
            disabled={!fromDate || !toDate || reason.trim().length < 3}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
