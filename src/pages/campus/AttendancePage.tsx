import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AccessTimeOutlined,
  AddOutlined,
  BadgeOutlined,
  CalendarMonthOutlined,
  CheckCircleOutline,
  CheckOutlined,
  ChevronLeftOutlined,
  ChevronRightOutlined,
  CloseOutlined,
  CloudUploadOutlined,
  DonutLargeOutlined,
  EventBusyOutlined,
  FileDownloadOutlined,
  FormatListBulletedOutlined,
  GroupsOutlined,
  InfoOutlined,
  PersonOffOutlined,
  PersonOutlined,
  SaveOutlined,
  SearchOutlined,
  SendOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import { CmsFooter, CmsPage, CmsPageHeader, CmsScrollBody, CmsTab, CmsTabs } from "../../components/cms/CmsLayout";
import { InitialsAvatar } from "../../components/InitialsAvatar";
import { apiRequest, assetUrl } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";

type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "HALF_DAY" | "HOLIDAY";
type PageTab = "mark" | "inout" | "leave" | "points" | "reports";

interface Named {
  id: string;
  name: string;
}
interface ClassSection {
  id: string;
  academicClass: Named;
  section: Named;
}
interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
  photoUrl?: string | null;
}
interface RosterItem {
  id: string;
  rollNumber: string | null;
  student: Student;
  attendanceRecords: Array<{
    status: AttendanceStatus;
    inTime: string | null;
    outTime: string | null;
    note?: string | null;
  }>;
  leaveRequests: Array<{ id: string }>;
}
interface Leave {
  id: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
  createdAt?: string;
  reviewNote?: string | null;
  studentEnrollment: {
    id?: string;
    rollNumber?: string | null;
    student: Student;
    classSection: ClassSection;
  };
}
interface Setup {
  attendanceType: "DAY_WISE" | "PERIOD_WISE" | "BIOMETRIC";
  currentSession: Named | null;
  classSections: ClassSection[];
  roster: RosterItem[];
  pendingLeaves: Leave[];
}
interface Report {
  summaries: Array<{
    student: Student;
    present: number;
    late: number;
    absent: number;
    halfDay: number;
    total: number;
    percentage: number;
  }>;
}

const today = new Date().toISOString().slice(0, 10);

const STATUS_OPTIONS: Array<{ value: AttendanceStatus; label: string }> = [
  { value: "PRESENT", label: "Present" },
  { value: "LATE", label: "Late" },
  { value: "ABSENT", label: "Absent" },
  { value: "HALF_DAY", label: "Half-day" },
];

function statusBtnClass(value: AttendanceStatus, active: boolean) {
  if (!active) {
    return "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-500 hover:border-slate-300";
  }
  if (value === "PRESENT") return "rounded-lg border border-emerald-500 bg-emerald-500 px-2.5 py-1.5 text-[12px] font-semibold text-white";
  if (value === "LATE") return "rounded-lg border border-amber-500 bg-amber-500 px-2.5 py-1.5 text-[12px] font-semibold text-white";
  if (value === "ABSENT") return "rounded-lg border border-rose-500 bg-rose-500 px-2.5 py-1.5 text-[12px] font-semibold text-white";
  return "rounded-lg border border-slate-600 bg-slate-700 px-2.5 py-1.5 text-[12px] font-semibold text-white";
}

function studentName(student: Student) {
  return `${student.firstName} ${student.lastName ?? ""}`.trim();
}

export function AttendancePage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<PageTab>("mark");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [classSectionId, setClassSectionId] = useState("");
  const [date, setDate] = useState(today);
  const [periodKey, setPeriodKey] = useState("PERIOD-1");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [markHoliday, setMarkHoliday] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searched, setSearched] = useState(false);

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of setup?.classSections ?? []) {
      map.set(item.academicClass.id, item.academicClass.name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [setup?.classSections]);

  const sections = useMemo(() => {
    if (!classId) return [];
    return (setup?.classSections ?? [])
      .filter((item) => item.academicClass.id === classId)
      .map((item) => ({ id: item.section.id, name: item.section.name, classSectionId: item.id }));
  }, [setup?.classSections, classId]);

  async function load(sectionClassId = classSectionId, selectedDate = date, period = periodKey) {
    try {
      const params = new URLSearchParams({ date: selectedDate, periodKey: period });
      if (sectionClassId) params.set("classSectionId", sectionClassId);
      const next = await apiRequest<Setup>(`/attendance/setup?${params}`, accessToken);
      setSetup(next);
      setStatuses(
        Object.fromEntries(
          next.roster.map((item) => [
            item.id,
            item.attendanceRecords[0]?.status ?? (item.leaveRequests.length ? "ABSENT" : "PRESENT"),
          ]),
        ),
      );
      setNotes(
        Object.fromEntries(next.roster.map((item) => [item.id, item.attendanceRecords[0]?.note ?? ""])),
      );
      setSelected(Object.fromEntries(next.roster.map((item) => [item.id, false])));
      const allHoliday =
        next.roster.length > 0 &&
        next.roster.every((item) => item.attendanceRecords[0]?.status === "HOLIDAY");
      setMarkHoliday(allHoliday);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load attendance");
    }
  }

  useEffect(() => {
    void load("", today);
  }, [accessToken]);

  function resolveClassSection(nextClassId: string, nextSectionId: string) {
    if (!nextClassId || !nextSectionId || !setup) return "";
    return (
      setup.classSections.find(
        (item) => item.academicClass.id === nextClassId && item.section.id === nextSectionId,
      )?.id ?? ""
    );
  }

  function searchRoster() {
    const resolved = resolveClassSection(classId, sectionId);
    if (!resolved) {
      notifyError("Select class and section");
      return;
    }
    setClassSectionId(resolved);
    setSearched(true);
    void load(resolved, date, periodKey);
  }

  const summary = useMemo(() => {
    const roster = setup?.roster ?? [];
    const total = roster.length || 1;
    let present = 0;
    let absent = 0;
    let late = 0;
    for (const item of roster) {
      const status = markHoliday ? "HOLIDAY" : (statuses[item.id] ?? "PRESENT");
      if (status === "PRESENT" || status === "HALF_DAY") present += 1;
      if (status === "ABSENT") absent += 1;
      if (status === "LATE") late += 1;
    }
    return {
      present,
      absent,
      late,
      presentPct: Math.round((present / total) * 100),
      absentPct: Math.round((absent / total) * 100),
      latePct: Math.round((late / total) * 100),
    };
  }, [setup?.roster, statuses, markHoliday]);

  const allSelected = (setup?.roster.length ?? 0) > 0 && setup?.roster.every((item) => selected[item.id]);

  function markAllPresent() {
    if (!setup?.roster.length) return;
    setMarkHoliday(false);
    setStatuses(Object.fromEntries(setup.roster.map((item) => [item.id, "PRESENT" as AttendanceStatus])));
  }

  function toggleSelectAll(checked: boolean) {
    if (!setup) return;
    setSelected(Object.fromEntries(setup.roster.map((item) => [item.id, checked])));
  }

  async function submitAttendance() {
    if (!classSectionId || !setup?.roster.length) {
      notifyError("Search a class section first");
      return;
    }
    setSaving(true);
    try {
      const result = await apiRequest<{ marked: number }>("/attendance/records", accessToken, {
        method: "POST",
        body: JSON.stringify({
          classSectionId,
          attendanceDate: date,
          periodKey,
          records: setup.roster.map((item) => ({
            studentEnrollmentId: item.id,
            status: markHoliday ? "HOLIDAY" : (statuses[item.id] ?? "PRESENT"),
            note: notes[item.id]?.trim() || null,
          })),
        }),
      });
      notifySuccess(
        markHoliday
          ? `Marked ${result.marked} students as holiday`
          : `${result.marked} attendance records saved`,
      );
      await load(classSectionId, date, periodKey);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to mark attendance");
    } finally {
      setSaving(false);
    }
  }

  return (
    <CmsPage>
      <CmsPageHeader
        title="Attendance"
        description="Mark, review, and manage student attendance records."
        actions={
          setup ? (
            <span className="nx-pill nx-pill-success">{setup.attendanceType.replaceAll("_", " ")}</span>
          ) : null
        }
      />

      <CmsTabs>
        {(
          [
            ["mark", "Mark Attendance"],
            ["inout", "In/Out Time Report"],
            ["leave", "Approve Leave"],
            ["points", "Attendance Points"],
            ["reports", "Reports"],
          ] as const
        ).map(([key, label]) => (
          <CmsTab key={key} active={tab === key} onClick={() => setTab(key)}>
            {label}
          </CmsTab>
        ))}
      </CmsTabs>

      <CmsScrollBody>
        {tab === "mark" && (
          <section className="space-y-4">
            <div className="nx-card p-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end">
                <label>
                  <span className="nx-label">Class</span>
                  <select
                    className="nx-input"
                    value={classId}
                    onChange={(e) => {
                      setClassId(e.target.value);
                      setSectionId("");
                      setClassSectionId("");
                      setSearched(false);
                    }}
                  >
                    <option value="">Select class</option>
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="nx-label">Section</span>
                  <select
                    className="nx-input"
                    value={sectionId}
                    disabled={!classId}
                    onChange={(e) => {
                      setSectionId(e.target.value);
                      setClassSectionId("");
                      setSearched(false);
                    }}
                  >
                    <option value="">Select section</option>
                    {sections.map((item) => (
                      <option key={item.classSectionId} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="nx-label">Date</span>
                  <input
                    className="nx-input"
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setSearched(false);
                    }}
                  />
                </label>
                <button type="button" className="nx-btn-primary h-[42px]" onClick={searchRoster}>
                  Search
                </button>
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-800">Mark as holiday</p>
                    <p className="text-[11px] text-slate-500">This date will be marked as a school holiday</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={markHoliday}
                    onClick={() => setMarkHoliday((v) => !v)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      markHoliday ? "bg-indigo-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition ${
                        markHoliday ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>
              </div>

              {setup?.attendanceType === "PERIOD_WISE" && (
                <label className="mt-3 block max-w-xs">
                  <span className="nx-label">Period</span>
                  <input
                    className="nx-input"
                    value={periodKey}
                    onChange={(e) => setPeriodKey(e.target.value)}
                    placeholder="PERIOD-1"
                  />
                </label>
              )}
            </div>

            {searched && classSectionId ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <SummaryCard
                    label="Present"
                    value={summary.present}
                    pct={summary.presentPct}
                    tint="#10b981"
                    icon={<GroupsOutlined sx={{ fontSize: 22 }} />}
                  />
                  <SummaryCard
                    label="Absent"
                    value={summary.absent}
                    pct={summary.absentPct}
                    tint="#ef4444"
                    icon={<PersonOffOutlined sx={{ fontSize: 22 }} />}
                  />
                  <SummaryCard
                    label="Late"
                    value={summary.late}
                    pct={summary.latePct}
                    tint="#f59e0b"
                    icon={<AccessTimeOutlined sx={{ fontSize: 22 }} />}
                  />
                </div>

                <div className="nx-card overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                    <button
                      type="button"
                      className="text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-40"
                      disabled={markHoliday || !setup?.roster.length}
                      onClick={markAllPresent}
                    >
                      Mark all present
                    </button>
                    <label className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-600">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-slate-300"
                        checked={Boolean(allSelected)}
                        onChange={(e) => toggleSelectAll(e.target.checked)}
                      />
                      Select all
                    </label>
                  </div>

                  {markHoliday ? (
                    <div className="flex items-center gap-3 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
                      <EventBusyOutlined sx={{ fontSize: 18 }} />
                      Holiday mode on — all students will be saved as holiday for this date.
                    </div>
                  ) : null}

                  <div className="overflow-x-auto">
                    <table className="nx-table min-w-[860px]">
                      <thead>
                        <tr>
                          <th className="w-10">#</th>
                          <th>Student</th>
                          <th>Roll No</th>
                          <th>Attendance</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(setup?.roster ?? []).map((item, index) => {
                          const name = studentName(item.student);
                          const status = statuses[item.id] ?? "PRESENT";
                          const photo = item.student.photoUrl
                            ? item.student.photoUrl.startsWith("http")
                              ? item.student.photoUrl
                              : assetUrl(item.student.photoUrl)
                            : undefined;
                          return (
                            <tr key={item.id} className={selected[item.id] ? "bg-indigo-50/40" : undefined}>
                              <td className="text-slate-500">{index + 1}</td>
                              <td>
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    className="size-4 rounded border-slate-300"
                                    checked={Boolean(selected[item.id])}
                                    onChange={(e) =>
                                      setSelected((prev) => ({ ...prev, [item.id]: e.target.checked }))
                                    }
                                  />
                                  <InitialsAvatar name={name} photoUrl={photo} size={36} />
                                  <div>
                                    <p className="font-semibold text-slate-900">{name}</p>
                                    {item.leaveRequests.length ? (
                                      <p className="text-[11px] font-medium text-amber-700">Approved leave</p>
                                    ) : null}
                                  </div>
                                </div>
                              </td>
                              <td className="font-mono text-[13px] text-slate-600">
                                {item.rollNumber || item.student.admissionNumber}
                              </td>
                              <td>
                                <div className="flex flex-wrap gap-1.5">
                                  {STATUS_OPTIONS.map((option) => (
                                    <button
                                      key={option.value}
                                      type="button"
                                      disabled={markHoliday}
                                      className={statusBtnClass(option.value, !markHoliday && status === option.value)}
                                      onClick={() =>
                                        setStatuses((prev) => ({ ...prev, [item.id]: option.value }))
                                      }
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                              </td>
                              <td>
                                <input
                                  className="nx-input min-w-[180px]"
                                  placeholder="Add note (optional)"
                                  value={notes[item.id] ?? ""}
                                  disabled={markHoliday}
                                  onChange={(e) =>
                                    setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                                  }
                                />
                              </td>
                            </tr>
                          );
                        })}
                        {!setup?.roster.length ? (
                          <tr>
                            <td colSpan={5} className="py-10 text-center text-sm text-slate-500">
                              No active students in this class section.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 bg-slate-50/80 px-4 py-3">
                    <button
                      type="button"
                      className="nx-btn-primary"
                      disabled={saving || !setup?.roster.length}
                      onClick={() => void submitAttendance()}
                    >
                      <SendOutlined sx={{ fontSize: 16 }} />
                      {saving ? "Saving…" : "Submit attendance"}
                    </button>
                    <p className="text-[12px] text-slate-500">
                      If already submitted for this date, you can only edit it.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="nx-card px-6 py-12 text-center">
                <CheckCircleOutline sx={{ fontSize: 36, color: "#94a3b8" }} />
                <p className="mt-3 text-[15px] font-semibold text-slate-800">Select class, section and date</p>
                <p className="mt-1 text-[13px] text-slate-500">
                  Then click Search to load the roster and mark attendance.
                </p>
              </div>
            )}
          </section>
        )}

        {tab === "inout" && setup && (
          <InOutPanel setup={setup} token={accessToken} date={date} />
        )}

        {tab === "leave" && setup && (
          <LeavePanel
            setup={setup}
            token={accessToken}
            onSaved={() => load(classSectionId, date)}
            onError={notifyError}
          />
        )}

        {tab === "points" && setup && (
          <PointsPanel token={accessToken} onError={notifyError} />
        )}

        {tab === "reports" && setup && (
          <AttendanceReportPanel setup={setup} token={accessToken} onError={notifyError} />
        )}
      </CmsScrollBody>

      <CmsFooter />
    </CmsPage>
  );
}

function SummaryCard({
  label,
  value,
  pct,
  tint,
  icon,
}: {
  label: string;
  value: number;
  pct: number;
  tint: string;
  icon: ReactNode;
}) {
  return (
    <div className="nx-card flex items-center gap-3 px-4 py-3.5">
      <span
        className="grid size-11 place-items-center rounded-xl"
        style={{ background: `${tint}1a`, color: tint }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-slate-500">{label}</p>
        <p className="text-[26px] font-extrabold leading-none text-slate-900">{value}</p>
      </div>
      <span
        className="rounded-full px-2.5 py-1 text-[12px] font-bold"
        style={{ background: `${tint}1a`, color: tint }}
      >
        {pct}%
      </span>
    </div>
  );
}

type InOutRow = {
  id: string;
  student: Student;
  rollNumber: string | null;
  inTime: string | null;
  outTime: string | null;
  status: AttendanceStatus;
};

const INOUT_PAGE_SIZE = 10;

function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  const ampm = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampm) {
    let hours = Number(ampm[1]);
    const minutes = Number(ampm[2]);
    const period = ampm[3].toUpperCase();
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  const twentyFour = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (twentyFour) {
    return Number(twentyFour[1]) * 60 + Number(twentyFour[2]);
  }
  return null;
}

function formatDisplayTime(value: string | null | undefined): string {
  if (!value?.trim()) return "--";
  const minutes = parseTimeToMinutes(value);
  if (minutes == null) return value;
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${String(hours12).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${period}`;
}

function formatDuration(inTime: string | null, outTime: string | null, status: AttendanceStatus): string {
  if (status === "ABSENT" || status === "HOLIDAY") return "--";
  const start = parseTimeToMinutes(inTime);
  const end = parseTimeToMinutes(outTime);
  if (start == null || end == null || end < start) return "--";
  const diff = end - start;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return `${String(hours).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m`;
}

function inOutStatusLabel(status: AttendanceStatus): "On-time" | "Late" | "Absent" | "Half-day" | "Holiday" {
  if (status === "LATE") return "Late";
  if (status === "ABSENT") return "Absent";
  if (status === "HALF_DAY") return "Half-day";
  if (status === "HOLIDAY") return "Holiday";
  return "On-time";
}

function inOutStatusClass(status: AttendanceStatus) {
  const label = inOutStatusLabel(status);
  if (label === "On-time") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (label === "Late") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (label === "Absent") return "bg-rose-50 text-rose-700 ring-rose-200";
  if (label === "Half-day") return "bg-slate-100 text-slate-700 ring-slate-200";
  return "bg-violet-50 text-violet-700 ring-violet-200";
}

function exportInOutCsv(rows: InOutRow[], dateLabel: string) {
  const header = ["#", "Student Name", "Roll No", "Check-in Time", "Check-out Time", "Total Duration", "Status"];
  const body = rows.map((row, index) => [
    String(index + 1),
    studentName(row.student),
    row.rollNumber || row.student.admissionNumber,
    formatDisplayTime(row.inTime),
    formatDisplayTime(row.outTime),
    formatDuration(row.inTime, row.outTime, row.status),
    inOutStatusLabel(row.status),
  ]);
  const csv = [header, ...body]
    .map((cols) => cols.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `inout-attendance-${dateLabel}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function InOutPanel({
  setup,
  token,
  date,
}: {
  setup: Setup;
  token: string;
  date: string;
}) {
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [selectedDate, setSelectedDate] = useState(date);
  const [rows, setRows] = useState<InOutRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of setup.classSections) {
      map.set(item.academicClass.id, item.academicClass.name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [setup.classSections]);

  const sections = useMemo(() => {
    if (!classId) return [];
    return setup.classSections
      .filter((item) => item.academicClass.id === classId)
      .map((item) => ({ id: item.section.id, name: item.section.name, classSectionId: item.id }));
  }, [setup.classSections, classId]);

  const totalPages = Math.max(1, Math.ceil(rows.length / INOUT_PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = rows.slice((pageSafe - 1) * INOUT_PAGE_SIZE, pageSafe * INOUT_PAGE_SIZE);
  const from = rows.length ? (pageSafe - 1) * INOUT_PAGE_SIZE + 1 : 0;
  const to = Math.min(pageSafe * INOUT_PAGE_SIZE, rows.length);

  async function search() {
    if (!classId || !sectionId) {
      notifyError("Select class and section");
      return;
    }
    const classSectionId =
      setup.classSections.find(
        (item) => item.academicClass.id === classId && item.section.id === sectionId,
      )?.id ?? "";
    if (!classSectionId) {
      notifyError("Invalid class section");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        date: selectedDate,
        classSectionId,
        periodKey: setup.attendanceType === "PERIOD_WISE" ? "PERIOD-1" : "DAY",
      });
      const next = await apiRequest<Setup>(`/attendance/setup?${params}`, token);
      setRows(
        next.roster.map((item) => ({
          id: item.id,
          student: item.student,
          rollNumber: item.rollNumber,
          inTime: item.attendanceRecords[0]?.inTime ?? null,
          outTime: item.attendanceRecords[0]?.outTime ?? null,
          status: item.attendanceRecords[0]?.status ?? "ABSENT",
        })),
      );
      setPage(1);
      setSearched(true);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load in/out report");
    } finally {
      setLoading(false);
    }
  }

  const pageButtons = useMemo(() => {
    const maxButtons = Math.min(totalPages, 4);
    const start = Math.min(Math.max(1, pageSafe - 1), Math.max(1, totalPages - maxButtons + 1));
    return Array.from({ length: maxButtons }, (_, i) => start + i);
  }, [pageSafe, totalPages]);

  return (
    <section className="space-y-4">
      <div className="nx-card p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end">
          <label>
            <span className="nx-label">Class</span>
            <select
              className="nx-input"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setSectionId("");
                setSearched(false);
                setRows([]);
              }}
            >
              <option value="">Select class</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="nx-label">Section</span>
            <select
              className="nx-input"
              value={sectionId}
              disabled={!classId}
              onChange={(e) => {
                setSectionId(e.target.value);
                setSearched(false);
                setRows([]);
              }}
            >
              <option value="">Select section</option>
              {sections.map((item) => (
                <option key={item.classSectionId} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="nx-label">Date</span>
            <input
              className="nx-input"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSearched(false);
              }}
            />
          </label>
          <button
            type="button"
            className="nx-btn-primary h-[42px]"
            onClick={() => void search()}
            disabled={loading}
          >
            <SearchOutlined sx={{ fontSize: 18 }} />
            {loading ? "Searching…" : "Search"}
          </button>
          <button
            type="button"
            className="nx-btn-secondary h-[42px]"
            disabled={!rows.length}
            onClick={() => exportInOutCsv(rows, selectedDate)}
          >
            <FileDownloadOutlined sx={{ fontSize: 18 }} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="nx-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="nx-table min-w-[920px]">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th>Student Name</th>
                <th>Roll No</th>
                <th>Check-in Time</th>
                <th>Check-out Time</th>
                <th>Total Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, index) => {
                const name = studentName(row.student);
                const photo = row.student.photoUrl
                  ? row.student.photoUrl.startsWith("http")
                    ? row.student.photoUrl
                    : assetUrl(row.student.photoUrl)
                  : undefined;
                const isAbsent = row.status === "ABSENT" || row.status === "HOLIDAY";
                return (
                  <tr key={row.id}>
                    <td className="text-slate-500">{(pageSafe - 1) * INOUT_PAGE_SIZE + index + 1}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={name} photoUrl={photo} size={36} />
                        <span className="font-semibold text-slate-900">{name}</span>
                      </div>
                    </td>
                    <td className="font-mono text-[13px] text-slate-600">
                      {row.rollNumber || row.student.admissionNumber}
                    </td>
                    <td>{isAbsent ? "--" : formatDisplayTime(row.inTime)}</td>
                    <td>{isAbsent ? "--" : formatDisplayTime(row.outTime)}</td>
                    <td>{formatDuration(row.inTime, row.outTime, row.status)}</td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1 ring-inset ${inOutStatusClass(row.status)}`}
                      >
                        {inOutStatusLabel(row.status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!pageRows.length ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-slate-500">
                    {searched
                      ? "No attendance records found for this class section."
                      : "Select class, section and date, then click Search."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <p className="text-[13px] text-slate-500">
            {rows.length
              ? `Showing ${from} to ${to} of ${rows.length} entries.`
              : "Showing 0 entries."}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40"
              disabled={pageSafe <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeftOutlined sx={{ fontSize: 18 }} />
            </button>
            {pageButtons.map((num) => (
              <button
                key={num}
                type="button"
                className={`grid size-8 place-items-center rounded-lg text-[13px] font-semibold ${
                  num === pageSafe
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => setPage(num)}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40"
              disabled={pageSafe >= totalPages || !rows.length}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              <ChevronRightOutlined sx={{ fontSize: 18 }} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

const POINTS_PAGE_SIZE = 6;

function scorePctClass(pct: number) {
  if (pct >= 80) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (pct >= 60) return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-rose-200";
}

function PointsPanel({
  token,
  onError,
}: {
  token: string;
  onError: (message: string) => void;
}) {
  const [presentPoints, setPresentPoints] = useState(2);
  const [halfDayPoints, setHalfDayPoints] = useState(1);
  const [latePoints, setLatePoints] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [scores, setScores] = useState<
    Array<{
      enrollmentId: string;
      student: Student;
      rollNumber: string | null;
      classSection: ClassSection;
      present: number;
      late: number;
      absent: number;
      halfDay: number;
      pointsEarned: number;
      maxPossible: number;
      scorePct: number;
    }>
  >([]);

  const example = useMemo(() => {
    const presentDays = 20;
    const halfDays = 4;
    const lateDays = 2;
    const openDays = presentDays + halfDays + lateDays;
    const presentTotal = presentDays * presentPoints;
    const halfTotal = halfDays * halfDayPoints;
    const lateTotal = lateDays * latePoints;
    const earned = presentTotal + halfTotal + lateTotal;
    const max = openDays * Math.max(presentPoints, 0);
    const pct = max > 0 ? ((earned / max) * 100).toFixed(2) : "0.00";
    return { presentDays, halfDays, lateDays, openDays, presentTotal, halfTotal, lateTotal, earned, max, pct };
  }, [presentPoints, halfDayPoints, latePoints]);

  const totalPages = Math.max(1, Math.ceil(scores.length / POINTS_PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = scores.slice((pageSafe - 1) * POINTS_PAGE_SIZE, pageSafe * POINTS_PAGE_SIZE);
  const from = scores.length ? (pageSafe - 1) * POINTS_PAGE_SIZE + 1 : 0;
  const to = Math.min(pageSafe * POINTS_PAGE_SIZE, scores.length);
  const pageButtons = useMemo(() => {
    const maxButtons = Math.min(totalPages, 5);
    const start = Math.min(Math.max(1, pageSafe - 1), Math.max(1, totalPages - maxButtons + 1));
    return Array.from({ length: maxButtons }, (_, i) => start + i);
  }, [pageSafe, totalPages]);

  async function loadScores() {
    setLoading(true);
    try {
      const data = await apiRequest<{
        config: { presentPoints: number; halfDayPoints: number; latePoints: number };
        scores: typeof scores;
      }>("/attendance/points/scores", token);
      setPresentPoints(data.config.presentPoints);
      setHalfDayPoints(data.config.halfDayPoints);
      setLatePoints(data.config.latePoints);
      setScores(data.scores);
      setPage(1);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load attendance points");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadScores();
  }, [token]);

  async function saveConfig() {
    setSaving(true);
    try {
      await apiRequest("/attendance/points/config", token, {
        method: "PUT",
        body: JSON.stringify({
          presentPoints,
          halfDayPoints,
          latePoints,
        }),
      });
      notifySuccess("Attendance points configuration saved");
      await loadScores();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save points configuration");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="nx-card p-5">
          <h2 className="text-[15px] font-bold text-slate-900">Configure points</h2>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="nx-label inline-flex items-center gap-1">
                Present Points
                <InfoOutlined sx={{ fontSize: 14, color: "#94a3b8" }} />
              </span>
              <input
                className="nx-input"
                type="number"
                value={presentPoints}
                onChange={(e) => setPresentPoints(Number(e.target.value))}
              />
            </label>
            <label className="block">
              <span className="nx-label inline-flex items-center gap-1">
                Half-day Points
                <InfoOutlined sx={{ fontSize: 14, color: "#94a3b8" }} />
              </span>
              <input
                className="nx-input"
                type="number"
                value={halfDayPoints}
                onChange={(e) => setHalfDayPoints(Number(e.target.value))}
              />
            </label>
            <label className="block">
              <span className="nx-label inline-flex items-center gap-1">
                Late Points (Deduction)
                <InfoOutlined sx={{ fontSize: 14, color: "#94a3b8" }} />
              </span>
              <input
                className="nx-input"
                type="number"
                value={latePoints}
                onChange={(e) => setLatePoints(Number(e.target.value))}
              />
            </label>
          </div>
          <button
            type="button"
            className="nx-btn-primary mt-5 w-full"
            disabled={saving}
            onClick={() => void saveConfig()}
          >
            <SaveOutlined sx={{ fontSize: 16 }} />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="nx-card p-5">
          <h2 className="text-[15px] font-bold text-slate-900">How it works</h2>
          <div className="mt-4 flex flex-wrap gap-4 text-[13px]">
            <span className="inline-flex items-center gap-2 font-medium text-slate-700">
              <span className="size-2.5 rounded-full bg-emerald-500" /> Present day: +{presentPoints} points
            </span>
            <span className="inline-flex items-center gap-2 font-medium text-slate-700">
              <span className="size-2.5 rounded-full bg-slate-500" /> Half-day: {halfDayPoints >= 0 ? "+" : ""}
              {halfDayPoints} point{Math.abs(halfDayPoints) === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-2 font-medium text-slate-700">
              <span className="size-2.5 rounded-full bg-amber-500" /> Late: {latePoints} point
              {Math.abs(latePoints) === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-2 font-medium text-slate-700">
              <span className="size-2.5 rounded-full bg-rose-500" /> Absent: 0 points
            </span>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] text-slate-700">
            <p>
              {example.presentDays} Present days × {presentPoints} points ={" "}
              <strong>{example.presentTotal} points</strong>
            </p>
            <p className="mt-1">
              {example.halfDays} Half-days × {halfDayPoints} point
              {Math.abs(halfDayPoints) === 1 ? "" : "s"} = <strong>{example.halfTotal} points</strong>
            </p>
            <p className="mt-1">
              {example.lateDays} Late days × {latePoints} point
              {Math.abs(latePoints) === 1 ? "" : "s"} = <strong>{example.lateTotal} points</strong>
            </p>
            <div className="mt-3 space-y-1 border-t border-slate-200 pt-3 font-semibold text-slate-900">
              <p>Total Points Earned = {example.earned} points</p>
              <p>
                Max Possible (e.g., {example.openDays} days × {Math.max(presentPoints, 0)} points) ={" "}
                {example.max} points
              </p>
              <p>Score Percentage = {example.pct}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="nx-card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-[15px] font-bold text-slate-900">Student attendance scores</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="nx-table min-w-[860px]">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th>Student Name</th>
                <th>Class/Section</th>
                <th>Points Earned</th>
                <th>Max Possible</th>
                <th>Score %</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, index) => {
                const name = studentName(row.student);
                const photo = row.student.photoUrl
                  ? row.student.photoUrl.startsWith("http")
                    ? row.student.photoUrl
                    : assetUrl(row.student.photoUrl)
                  : undefined;
                return (
                  <tr key={row.enrollmentId}>
                    <td className="text-slate-500">{(pageSafe - 1) * POINTS_PAGE_SIZE + index + 1}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={name} photoUrl={photo} size={36} />
                        <span className="font-semibold text-slate-900">{name}</span>
                      </div>
                    </td>
                    <td>
                      {row.classSection.academicClass.name} {row.classSection.section.name}
                    </td>
                    <td className="font-semibold text-slate-800">{row.pointsEarned}</td>
                    <td className="text-slate-600">{row.maxPossible}</td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-bold ring-1 ring-inset ${scorePctClass(row.scorePct)}`}
                      >
                        {row.scorePct.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!pageRows.length ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-slate-500">
                    {loading
                      ? "Loading scores…"
                      : "No attendance scores yet. Mark attendance to generate scores."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <p className="text-[13px] text-slate-500">
            {scores.length ? `Showing ${from} to ${to} of ${scores.length} entries.` : "Showing 0 entries."}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40"
              disabled={pageSafe <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeftOutlined sx={{ fontSize: 18 }} />
            </button>
            {pageButtons.map((num) => (
              <button
                key={num}
                type="button"
                className={`grid size-8 place-items-center rounded-lg text-[13px] font-semibold ${
                  num === pageSafe
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => setPage(num)}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40"
              disabled={pageSafe >= totalPages || !scores.length}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRightOutlined sx={{ fontSize: 18 }} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

type LeaveStatusFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

const LEAVE_PAGE_SIZE = 8;

function formatLeaveDates(fromDate: string, toDate: string) {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const sameDay = from.toDateString() === to.toDateString();
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  if (sameDay) return from.toLocaleDateString(undefined, opts);
  return `${from.toLocaleDateString(undefined, opts)} – ${to.toLocaleDateString(undefined, opts)}`;
}

function formatAppliedOn(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return `${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} · ${date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
}

function leaveStatusClass(status: string) {
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "REJECTED") return "bg-rose-50 text-rose-700 ring-rose-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function LeavePanel({
  setup,
  token,
  onSaved,
  onError,
}: {
  setup: Setup;
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<LeaveStatusFilter>("ALL");
  const [classFilter, setClassFilter] = useState("");
  const [appliedStatus, setAppliedStatus] = useState<LeaveStatusFilter>("ALL");
  const [appliedClass, setAppliedClass] = useState("");
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewLeave, setViewLeave] = useState<Leave | null>(null);
  const [saving, setSaving] = useState(false);
  const [studentQuery, setStudentQuery] = useState("");
  const [studentResults, setStudentResults] = useState<
    Array<{
      enrollmentId: string;
      label: string;
      roll: string;
      photoUrl?: string | null;
    }>
  >([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [form, setForm] = useState({
    studentEnrollmentId: "",
    studentLabel: "",
    fromDate: today,
    toDate: today,
    reason: "",
    status: "PENDING" as "PENDING" | "APPROVED" | "REJECTED",
    fileName: "",
  });

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of setup.classSections) {
      map.set(item.academicClass.id, item.academicClass.name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [setup.classSections]);

  const filteredLeaves = useMemo(() => {
    if (!appliedClass) return leaves;
    return leaves.filter(
      (leave) => leave.studentEnrollment.classSection.academicClass.id === appliedClass,
    );
  }, [leaves, appliedClass]);

  const totalPages = Math.max(1, Math.ceil(filteredLeaves.length / LEAVE_PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filteredLeaves.slice((pageSafe - 1) * LEAVE_PAGE_SIZE, pageSafe * LEAVE_PAGE_SIZE);
  const from = filteredLeaves.length ? (pageSafe - 1) * LEAVE_PAGE_SIZE + 1 : 0;
  const to = Math.min(pageSafe * LEAVE_PAGE_SIZE, filteredLeaves.length);

  const pageButtons = useMemo(() => {
    const maxButtons = Math.min(totalPages, 3);
    const start = Math.min(Math.max(1, pageSafe - 1), Math.max(1, totalPages - maxButtons + 1));
    return Array.from({ length: maxButtons }, (_, i) => start + i);
  }, [pageSafe, totalPages]);

  async function loadLeaves(status = appliedStatus) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "ALL") params.set("status", status);
      const data = await apiRequest<Leave[]>(
        `/attendance/leaves${params.toString() ? `?${params}` : ""}`,
        token,
      );
      setLeaves(data);
      setPage(1);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load leave requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLeaves("ALL");
  }, [token]);

  function searchLeaves() {
    setAppliedStatus(statusFilter);
    setAppliedClass(classFilter);
    void loadLeaves(statusFilter);
  }

  async function review(id: string, status: "APPROVED" | "REJECTED") {
    try {
      await apiRequest(`/attendance/leaves/${id}/review`, token, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      notifySuccess(`Leave ${status.toLowerCase()}`);
      setViewLeave(null);
      // Keep full history visible after review (unless user filtered to Pending only)
      const nextStatus = appliedStatus === "PENDING" ? "ALL" : appliedStatus;
      if (nextStatus !== appliedStatus) {
        setAppliedStatus(nextStatus);
        setStatusFilter(nextStatus);
      }
      await loadLeaves(nextStatus);
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to review leave");
    }
  }

  async function searchStudents(query: string) {
    setStudentQuery(query);
    if (query.trim().length < 2) {
      setStudentResults([]);
      return;
    }
    setSearchingStudents(true);
    try {
      const params = new URLSearchParams({
        search: query.trim(),
        page: "1",
        limit: "8",
        status: "ACTIVE",
      });
      const data = await apiRequest<{
        items: Array<{
          id: string;
          firstName: string;
          lastName: string | null;
          admissionNumber: string;
          photoUrl?: string | null;
          enrollments: Array<{
            id: string;
            rollNumber: string | null;
            classSection: { academicClass: Named; section: Named };
          }>;
        }>;
      }>(`/students?${params}`, token);
      setStudentResults(
        data.items
          .map((student) => {
            const enrollment = student.enrollments[0];
            if (!enrollment) return null;
            return {
              enrollmentId: enrollment.id,
              label: `${student.firstName} ${student.lastName ?? ""}`.trim(),
              roll: enrollment.rollNumber || student.admissionNumber,
              photoUrl: student.photoUrl,
            };
          })
          .filter(Boolean) as Array<{
          enrollmentId: string;
          label: string;
          roll: string;
          photoUrl?: string | null;
        }>,
      );
    } catch {
      setStudentResults([]);
    } finally {
      setSearchingStudents(false);
    }
  }

  async function saveLeave(event: FormEvent) {
    event.preventDefault();
    if (!form.studentEnrollmentId) {
      onError("Select a student");
      return;
    }
    if (form.reason.trim().length < 3) {
      onError("Reason must be at least 3 characters");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/attendance/leaves", token, {
        method: "POST",
        body: JSON.stringify({
          studentEnrollmentId: form.studentEnrollmentId,
          fromDate: form.fromDate,
          toDate: form.toDate,
          reason: form.reason.trim(),
          status: form.status,
        }),
      });
      notifySuccess(
        form.fileName
          ? "Leave saved (attachment UI only — file not uploaded yet)"
          : "Leave request saved",
      );
      setDrawerOpen(false);
      setForm({
        studentEnrollmentId: "",
        studentLabel: "",
        fromDate: today,
        toDate: today,
        reason: "",
        status: "PENDING",
        fileName: "",
      });
      setStudentQuery("");
      setStudentResults([]);
      await loadLeaves(appliedStatus);
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to create leave request");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="relative space-y-4">
      <div className="nx-card p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
          <label>
            <span className="nx-label">Status</span>
            <select
              className="nx-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LeaveStatusFilter)}
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </label>
          <label>
            <span className="nx-label">Class</span>
            <select
              className="nx-input"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="">All Classes</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="nx-btn-primary h-[42px]" onClick={searchLeaves} disabled={loading}>
            <SearchOutlined sx={{ fontSize: 18 }} />
            {loading ? "Searching…" : "Search"}
          </button>
          <button
            type="button"
            className="nx-btn-primary h-[42px]"
            onClick={() => setDrawerOpen(true)}
          >
            <AddOutlined sx={{ fontSize: 18 }} />
            Add leave manually
          </button>
        </div>
      </div>

      <div className="nx-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="nx-table min-w-[980px]">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th>Student Name</th>
                <th>Class/Section</th>
                <th>Leave Date(s)</th>
                <th>Reason</th>
                <th>Applied On</th>
                <th>Status</th>
                <th className="w-36">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((leave, index) => {
                const name = studentName(leave.studentEnrollment.student);
                const photo = leave.studentEnrollment.student.photoUrl
                  ? leave.studentEnrollment.student.photoUrl.startsWith("http")
                    ? leave.studentEnrollment.student.photoUrl
                    : assetUrl(leave.studentEnrollment.student.photoUrl)
                  : undefined;
                const pending = leave.status === "PENDING";
                return (
                  <tr key={leave.id}>
                    <td className="text-slate-500">{(pageSafe - 1) * LEAVE_PAGE_SIZE + index + 1}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={name} photoUrl={photo} size={36} />
                        <span className="font-semibold text-slate-900">{name}</span>
                      </div>
                    </td>
                    <td>
                      {leave.studentEnrollment.classSection.academicClass.name}{" "}
                      {leave.studentEnrollment.classSection.section.name}
                    </td>
                    <td>{formatLeaveDates(leave.fromDate, leave.toDate)}</td>
                    <td className="max-w-[220px] truncate text-slate-600" title={leave.reason}>
                      {leave.reason}
                    </td>
                    <td className="text-[13px] text-slate-500">{formatAppliedOn(leave.createdAt)}</td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold capitalize ring-1 ring-inset ${leaveStatusClass(leave.status)}`}
                      >
                        {leave.status.toLowerCase()}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-600 disabled:opacity-30"
                          disabled={!pending}
                          title="Approve"
                          onClick={() => void review(leave.id, "APPROVED")}
                        >
                          <CheckOutlined sx={{ fontSize: 18 }} />
                        </button>
                        <button
                          type="button"
                          className="grid size-8 place-items-center rounded-lg bg-rose-50 text-rose-600 disabled:opacity-30"
                          disabled={!pending}
                          title="Reject"
                          onClick={() => void review(leave.id, "REJECTED")}
                        >
                          <CloseOutlined sx={{ fontSize: 18 }} />
                        </button>
                        <button
                          type="button"
                          className="grid size-8 place-items-center rounded-lg bg-sky-50 text-sky-600"
                          title="View"
                          onClick={() => setViewLeave(leave)}
                        >
                          <VisibilityOutlined sx={{ fontSize: 18 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!pageRows.length ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-slate-500">
                    {loading ? "Loading leave requests…" : "No leave requests found for this filter."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <p className="text-[13px] text-slate-500">
            {filteredLeaves.length
              ? `Showing ${from} to ${to} of ${filteredLeaves.length} entries.`
              : "Showing 0 entries."}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40"
              disabled={pageSafe <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeftOutlined sx={{ fontSize: 18 }} />
            </button>
            {pageButtons.map((num) => (
              <button
                key={num}
                type="button"
                className={`grid size-8 place-items-center rounded-lg text-[13px] font-semibold ${
                  num === pageSafe
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => setPage(num)}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40"
              disabled={pageSafe >= totalPages || !filteredLeaves.length}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRightOutlined sx={{ fontSize: 18 }} />
            </button>
          </div>
        </div>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onClick={() => setDrawerOpen(false)}>
          <aside
            className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-[16px] font-bold text-slate-900">Add leave manually</h2>
              <button
                type="button"
                className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
                onClick={() => setDrawerOpen(false)}
              >
                <CloseOutlined sx={{ fontSize: 18 }} />
              </button>
            </div>
            <form className="flex min-h-0 flex-1 flex-col" onSubmit={saveLeave}>
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <label className="block">
                  <span className="nx-label">
                    Student <span className="text-rose-500">*</span>
                  </span>
                  <div className="relative">
                    <SearchOutlined
                      sx={{ fontSize: 18 }}
                      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      className="nx-input pl-10"
                      placeholder="Search student by name or roll no."
                      value={form.studentLabel || studentQuery}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, studentEnrollmentId: "", studentLabel: "" }));
                        void searchStudents(e.target.value);
                      }}
                    />
                  </div>
                  {searchingStudents ? (
                    <p className="mt-1 text-[12px] text-slate-400">Searching…</p>
                  ) : null}
                  {studentResults.length > 0 && !form.studentEnrollmentId ? (
                    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      {studentResults.map((item) => (
                        <button
                          key={item.enrollmentId}
                          type="button"
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                          onClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              studentEnrollmentId: item.enrollmentId,
                              studentLabel: `${item.label} (${item.roll})`,
                            }));
                            setStudentQuery("");
                            setStudentResults([]);
                          }}
                        >
                          <InitialsAvatar name={item.label} photoUrl={item.photoUrl} size={32} />
                          <div>
                            <p className="text-[13px] font-semibold text-slate-900">{item.label}</p>
                            <p className="text-[11px] text-slate-500">{item.roll}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </label>

                <div>
                  <span className="nx-label">
                    Leave Date(s) <span className="text-rose-500">*</span>
                  </span>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <input
                      className="nx-input"
                      type="date"
                      required
                      value={form.fromDate}
                      onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
                    />
                    <input
                      className="nx-input"
                      type="date"
                      required
                      value={form.toDate}
                      onChange={(e) => setForm({ ...form, toDate: e.target.value })}
                    />
                  </div>
                </div>

                <label className="block">
                  <span className="nx-label">
                    Reason <span className="text-rose-500">*</span>
                  </span>
                  <textarea
                    className="nx-input min-h-[110px]"
                    required
                    maxLength={250}
                    placeholder="Enter leave reason"
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  />
                  <p className="mt-1 text-right text-[11px] text-slate-400">{form.reason.length}/250</p>
                </label>

                <div>
                  <span className="nx-label">Attach Document</span>
                  <label className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center hover:border-indigo-300 hover:bg-indigo-50/40">
                    <CloudUploadOutlined sx={{ fontSize: 28, color: "#6366f1" }} />
                    <p className="mt-2 text-[13px] font-semibold text-slate-700">
                      {form.fileName || "Drop file or click to upload"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">PDF, JPG, PNG (Max 5MB)</p>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          onError("File must be 5MB or less");
                          return;
                        }
                        setForm((prev) => ({ ...prev, fileName: file.name }));
                      }}
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="nx-label">
                    Status <span className="text-rose-500">*</span>
                  </span>
                  <select
                    className="nx-input"
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as "PENDING" | "APPROVED" | "REJECTED",
                      })
                    }
                  >
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </label>
              </div>
              <div className="border-t border-slate-100 px-5 py-4">
                <button className="nx-btn-primary w-full" type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      ) : null}

      {viewLeave ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setViewLeave(null)}>
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-[16px] font-bold text-slate-900">Leave details</h3>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  {studentName(viewLeave.studentEnrollment.student)}
                </p>
              </div>
              <button type="button" className="text-slate-400" onClick={() => setViewLeave(null)}>
                <CloseOutlined sx={{ fontSize: 18 }} />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4 text-[13px]">
              <p>
                <span className="font-semibold text-slate-500">Class:</span>{" "}
                {viewLeave.studentEnrollment.classSection.academicClass.name}{" "}
                {viewLeave.studentEnrollment.classSection.section.name}
              </p>
              <p>
                <span className="font-semibold text-slate-500">Dates:</span>{" "}
                {formatLeaveDates(viewLeave.fromDate, viewLeave.toDate)}
              </p>
              <p>
                <span className="font-semibold text-slate-500">Applied:</span>{" "}
                {formatAppliedOn(viewLeave.createdAt)}
              </p>
              <p>
                <span className="font-semibold text-slate-500">Status:</span>{" "}
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold capitalize ring-1 ring-inset ${leaveStatusClass(viewLeave.status)}`}>
                  {viewLeave.status.toLowerCase()}
                </span>
              </p>
              <p>
                <span className="font-semibold text-slate-500">Reason:</span> {viewLeave.reason}
              </p>
            </div>
            {viewLeave.status === "PENDING" ? (
              <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
                <button
                  type="button"
                  className="nx-btn-secondary"
                  onClick={() => void review(viewLeave.id, "REJECTED")}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="nx-btn-primary"
                  onClick={() => void review(viewLeave.id, "APPROVED")}
                >
                  Approve
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AttendanceReportPanel({
  setup,
  token,
  onError,
}: {
  setup: Setup;
  token: string;
  onError: (message: string) => void;
}) {
  type ReportKey =
    | "daily"
    | "custom"
    | "remaining"
    | "student_summary"
    | "staff_summary"
    | "inout"
    | "periods"
    | "class_wise";

  const reportCards: Array<{
    key: ReportKey;
    title: string;
    description: string;
    tint: string;
    icon: ReactNode;
  }> = [
    {
      key: "daily",
      title: "Daily Attendance Report",
      description: "Generate a report of attendance for a specific date across classes or sections.",
      tint: "#7c3aed",
      icon: <CalendarMonthOutlined sx={{ fontSize: 22 }} />,
    },
    {
      key: "custom",
      title: "Custom Attendance Report",
      description: "Generate attendance report for a custom date range with advanced filters.",
      tint: "#0ea5e9",
      icon: <CalendarMonthOutlined sx={{ fontSize: 22 }} />,
    },
    {
      key: "remaining",
      title: "Remaining Class Attendance Report",
      description: "View students who have remaining attendance percentage below the required threshold.",
      tint: "#10b981",
      icon: <DonutLargeOutlined sx={{ fontSize: 22 }} />,
    },
    {
      key: "student_summary",
      title: "Student Attendance Summary",
      description: "Get an overall attendance summary of students with percentage and attendance count.",
      tint: "#f59e0b",
      icon: <PersonOutlined sx={{ fontSize: 22 }} />,
    },
    {
      key: "staff_summary",
      title: "Staff Attendance Summary",
      description: "Get an overall attendance summary of staff members with percentage and attendance count.",
      tint: "#8b5cf6",
      icon: <BadgeOutlined sx={{ fontSize: 22 }} />,
    },
    {
      key: "inout",
      title: "In/Out Time Attendance Report",
      description: "View detailed in-time, out-time and duration report for students on a given date or range.",
      tint: "#eab308",
      icon: <AccessTimeOutlined sx={{ fontSize: 22 }} />,
    },
    {
      key: "periods",
      title: "Periods-wise Attendance Report",
      description: "Generate attendance report period wise for a class or section on a given date.",
      tint: "#38bdf8",
      icon: <FormatListBulletedOutlined sx={{ fontSize: 22 }} />,
    },
    {
      key: "class_wise",
      title: "Class-wise Attendance Report",
      description: "Compare attendance across multiple classes or sections in a selected date range.",
      tint: "#ec4899",
      icon: <GroupsOutlined sx={{ fontSize: 22 }} />,
    },
  ];

  const [active, setActive] = useState<(typeof reportCards)[number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [threshold, setThreshold] = useState(75);
  const [form, setForm] = useState({
    classSectionId: "",
    fromDate: today,
    toDate: today,
    periodKey: setup.attendanceType === "PERIOD_WISE" ? "PERIOD-1" : "",
  });
  const [studentReport, setStudentReport] = useState<Report | null>(null);
  const [inoutRows, setInoutRows] = useState<
    Array<{
      student: Student;
      status: AttendanceStatus;
      inTime: string | null;
      outTime: string | null;
      date: string;
    }>
  >([]);
  const [classWise, setClassWise] = useState<
    Array<{ label: string; present: number; late: number; absent: number; halfDay: number; percentage: number }>
  >([]);
  const [staffRows, setStaffRows] = useState<
    Array<{ name: string; present: number; late: number; absent: number; halfDay: number; total: number; percentage: number }>
  >([]);

  function openReport(card: (typeof reportCards)[number]) {
    setActive(card);
    setStudentReport(null);
    setInoutRows([]);
    setClassWise([]);
    setStaffRows([]);
    setForm({
      classSectionId: "",
      fromDate: today,
      toDate: today,
      periodKey: setup.attendanceType === "PERIOD_WISE" ? "PERIOD-1" : "",
    });
  }

  async function generate() {
    if (!active) return;
    setLoading(true);
    setStudentReport(null);
    setInoutRows([]);
    setClassWise([]);
    setStaffRows([]);
    try {
      if (active.key === "staff_summary") {
        const month = form.fromDate.slice(0, 7);
        const data = await apiRequest<{
          staff: Array<{
            user: { firstName: string; lastName: string | null };
            attendance: Array<{ status: string }>;
          }>;
        }>(`/hr/setup?month=${month}-01`, token);
        setStaffRows(
          data.staff.map((item) => {
            let present = 0;
            let late = 0;
            let absent = 0;
            let halfDay = 0;
            for (const row of item.attendance) {
              if (row.status === "PRESENT") present += 1;
              else if (row.status === "LATE") late += 1;
              else if (row.status === "ABSENT") absent += 1;
              else if (row.status === "HALF_DAY") halfDay += 1;
            }
            const total = present + late + absent + halfDay;
            const attended = present + late + halfDay * 0.5;
            return {
              name: `${item.user.firstName} ${item.user.lastName ?? ""}`.trim(),
              present,
              late,
              absent,
              halfDay,
              total,
              percentage: total ? Math.round((attended / total) * 10000) / 100 : 0,
            };
          }),
        );
        return;
      }

      const needsSection = active.key === "periods";

      if (needsSection && !form.classSectionId) {
        onError("Select a class section for period-wise report");
        return;
      }

      const fromDate = form.fromDate;
      const toDate = active.key === "daily" || active.key === "periods" ? form.fromDate : form.toDate;

      if (active.key === "class_wise") {
        const sections = form.classSectionId
          ? setup.classSections.filter((item) => item.id === form.classSectionId)
          : setup.classSections;
        const rows = [];
        for (const section of sections) {
          const params = new URLSearchParams({
            fromDate,
            toDate,
            classSectionId: section.id,
          });
          const data = await apiRequest<Report>(`/attendance/reports?${params}`, token);
          const present = data.summaries.reduce((sum, item) => sum + item.present, 0);
          const late = data.summaries.reduce((sum, item) => sum + item.late, 0);
          const absent = data.summaries.reduce((sum, item) => sum + item.absent, 0);
          const halfDay = data.summaries.reduce((sum, item) => sum + item.halfDay, 0);
          const total = present + late + absent + halfDay;
          const attended = present + late + halfDay * 0.5;
          rows.push({
            label: `${section.academicClass.name} · ${section.section.name}`,
            present,
            late,
            absent,
            halfDay,
            percentage: total ? Math.round((attended / total) * 10000) / 100 : 0,
          });
        }
        setClassWise(rows);
        return;
      }

      const params = new URLSearchParams({
        fromDate,
        toDate,
      });
      if (form.classSectionId) params.set("classSectionId", form.classSectionId);
      if (active.key === "periods" && form.periodKey) params.set("periodKey", form.periodKey);

      const data = await apiRequest<
        Report & {
          records?: Array<{
            attendanceDate: string;
            status: AttendanceStatus;
            inTime: string | null;
            outTime: string | null;
            studentEnrollment: { student: Student };
          }>;
        }
      >(`/attendance/reports?${params}`, token);

      if (active.key === "inout") {
        setInoutRows(
          (data.records ?? []).map((record) => ({
            student: record.studentEnrollment.student,
            status: record.status,
            inTime: record.inTime,
            outTime: record.outTime,
            date: String(record.attendanceDate).slice(0, 10),
          })),
        );
        return;
      }

      if (active.key === "remaining") {
        setStudentReport({
          summaries: data.summaries.filter((item) => item.percentage < threshold),
        });
        return;
      }

      setStudentReport(data);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to generate report");
    } finally {
      setLoading(false);
    }
  }

  const showDateRange = active && active.key !== "daily" && active.key !== "periods" && active.key !== "staff_summary";
  const showSingleDate = active && (active.key === "daily" || active.key === "periods");
  const showSection =
    active &&
    active.key !== "staff_summary" &&
    active.key !== "class_wise";
  const showPeriod = active?.key === "periods";
  const showThreshold = active?.key === "remaining";

  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {reportCards.map((card) => (
          <div key={card.key} className="nx-card flex flex-col p-5">
            <div className="flex items-start gap-3">
              <span
                className="grid size-11 shrink-0 place-items-center rounded-full"
                style={{ background: `${card.tint}1a`, color: card.tint }}
              >
                {card.icon}
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold text-slate-900">{card.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{card.description}</p>
              </div>
            </div>
            <button
              type="button"
              className="mt-5 self-start text-[13px] font-bold text-indigo-600 hover:text-indigo-700"
              onClick={() => openReport(card)}
            >
              Generate
            </button>
          </div>
        ))}
      </div>

      {active ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setActive(null)}>
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-[16px] font-bold text-slate-900">{active.title}</h3>
                <p className="mt-0.5 text-[13px] text-slate-500">{active.description}</p>
              </div>
              <button type="button" className="text-slate-400" onClick={() => setActive(null)}>
                <CloseOutlined sx={{ fontSize: 18 }} />
              </button>
            </div>

            <div className="space-y-3 border-b border-slate-100 px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {showSection ? (
                  <label>
                    <span className="nx-label">Class section</span>
                    <select
                      className="nx-input"
                      value={form.classSectionId}
                      onChange={(e) => setForm({ ...form, classSectionId: e.target.value })}
                    >
                      <option value="">All sections</option>
                      {setup.classSections.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.academicClass.name} · {item.section.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {active.key === "class_wise" ? (
                  <label>
                    <span className="nx-label">Class section (optional)</span>
                    <select
                      className="nx-input"
                      value={form.classSectionId}
                      onChange={(e) => setForm({ ...form, classSectionId: e.target.value })}
                    >
                      <option value="">All classes</option>
                      {setup.classSections.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.academicClass.name} · {item.section.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {showSingleDate ? (
                  <label>
                    <span className="nx-label">Date</span>
                    <input
                      className="nx-input"
                      type="date"
                      value={form.fromDate}
                      onChange={(e) => setForm({ ...form, fromDate: e.target.value, toDate: e.target.value })}
                    />
                  </label>
                ) : null}

                {showDateRange ? (
                  <>
                    <label>
                      <span className="nx-label">From</span>
                      <input
                        className="nx-input"
                        type="date"
                        value={form.fromDate}
                        onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
                      />
                    </label>
                    <label>
                      <span className="nx-label">To</span>
                      <input
                        className="nx-input"
                        type="date"
                        value={form.toDate}
                        onChange={(e) => setForm({ ...form, toDate: e.target.value })}
                      />
                    </label>
                  </>
                ) : null}

                {active.key === "staff_summary" ? (
                  <label>
                    <span className="nx-label">Month</span>
                    <input
                      className="nx-input"
                      type="month"
                      value={form.fromDate.slice(0, 7)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          fromDate: `${e.target.value}-01`,
                          toDate: `${e.target.value}-01`,
                        })
                      }
                    />
                  </label>
                ) : null}

                {showPeriod ? (
                  <label>
                    <span className="nx-label">Period</span>
                    <input
                      className="nx-input"
                      value={form.periodKey}
                      onChange={(e) => setForm({ ...form, periodKey: e.target.value })}
                      placeholder="PERIOD-1"
                    />
                  </label>
                ) : null}

                {showThreshold ? (
                  <label>
                    <span className="nx-label">Below threshold %</span>
                    <input
                      className="nx-input"
                      type="number"
                      min={1}
                      max={100}
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                    />
                  </label>
                ) : null}
              </div>

              <button type="button" className="nx-btn-primary" disabled={loading} onClick={() => void generate()}>
                {loading ? "Generating…" : "Generate report"}
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
              {studentReport ? (
                <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                  {studentReport.summaries.map((item) => (
                    <div
                      className="grid gap-3 p-4 sm:grid-cols-[1fr_repeat(4,90px)]"
                      key={item.student.id}
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{studentName(item.student)}</p>
                        <p className="text-[12px] text-slate-500">{item.student.admissionNumber}</p>
                      </div>
                      <span className="text-sm">Present {item.present}</span>
                      <span className="text-sm">Late {item.late}</span>
                      <span className="text-sm">Absent {item.absent}</span>
                      <strong className="text-sm">{item.percentage}%</strong>
                    </div>
                  ))}
                  {!studentReport.summaries.length ? (
                    <p className="p-8 text-center text-sm text-slate-500">No matching records.</p>
                  ) : null}
                </div>
              ) : null}

              {inoutRows.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="nx-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Date</th>
                        <th>In</th>
                        <th>Out</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inoutRows.map((row, index) => (
                        <tr key={`${row.student.id}-${row.date}-${index}`}>
                          <td className="font-semibold">{studentName(row.student)}</td>
                          <td>{row.date}</td>
                          <td>{row.inTime || "--"}</td>
                          <td>{row.outTime || "--"}</td>
                          <td>{row.status.replaceAll("_", " ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {classWise.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="nx-table">
                    <thead>
                      <tr>
                        <th>Class / Section</th>
                        <th>Present</th>
                        <th>Late</th>
                        <th>Absent</th>
                        <th>Half-day</th>
                        <th>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classWise.map((row) => (
                        <tr key={row.label}>
                          <td className="font-semibold">{row.label}</td>
                          <td>{row.present}</td>
                          <td>{row.late}</td>
                          <td>{row.absent}</td>
                          <td>{row.halfDay}</td>
                          <td className="font-bold">{row.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {staffRows.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="nx-table">
                    <thead>
                      <tr>
                        <th>Staff</th>
                        <th>Present</th>
                        <th>Late</th>
                        <th>Absent</th>
                        <th>Half-day</th>
                        <th>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffRows.map((row) => (
                        <tr key={row.name}>
                          <td className="font-semibold">{row.name}</td>
                          <td>{row.present}</td>
                          <td>{row.late}</td>
                          <td>{row.absent}</td>
                          <td>{row.halfDay}</td>
                          <td className="font-bold">{row.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {!loading &&
              !studentReport &&
              !inoutRows.length &&
              !classWise.length &&
              !staffRows.length ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Choose filters and click Generate report.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
