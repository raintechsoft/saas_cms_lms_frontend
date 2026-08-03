import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  AccessTimeOutlined,
  AddOutlined,
  AssessmentOutlined,
  AttachFileOutlined,
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
  FactCheckOutlined,
  FileDownloadOutlined,
  FormatListBulletedOutlined,
  GroupsOutlined,
  InfoOutlined,
  PersonOffOutlined,
  PersonOutlined,
  QrCodeScannerOutlined,
  SaveOutlined,
  SearchOutlined,
  SendOutlined,
  StarsOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import { CmsFooter, CmsPage, CmsPageHeader, CmsScrollBody } from "../../components/cms/CmsLayout";
import { CmsIconTabs, type CmsIconTabItem } from "../../components/cms/CmsIconTabs";
import { InitialsAvatar } from "../../components/InitialsAvatar";
import { apiRequest, assetUrl } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";

type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "HALF_DAY" | "HOLIDAY";
type PageTab = "mark" | "inout" | "leave" | "points" | "reports";

const TABS: Array<CmsIconTabItem<PageTab>> = [
  { key: "mark", label: "Mark Attendance", icon: FactCheckOutlined, tone: "emerald" },
  {
    key: "inout",
    label: "In/Out Time Report",
    shortLabel: "In/Out Report",
    icon: AccessTimeOutlined,
    tone: "amber",
  },
  { key: "leave", label: "Approve Leave", icon: EventBusyOutlined, tone: "rose" },
  { key: "points", label: "Attendance Points", icon: StarsOutlined, tone: "violet" },
  { key: "reports", label: "Reports", icon: AssessmentOutlined, tone: "purple" },
];

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
  attachmentUrl?: string | null;
  studentEnrollment: {
    id?: string;
    rollNumber?: string | null;
    student: Student;
    classSection: ClassSection;
  };
}
interface AttendancePeriod {
  key: string;
  label: string;
  startTime: string;
  endTime: string;
}
interface Setup {
  attendanceType: "DAY_WISE" | "PERIOD_WISE" | "BIOMETRIC";
  currentSession: Named | null;
  classSections: ClassSection[];
  roster: RosterItem[];
  pendingLeaves: Leave[];
  alreadySubmitted?: boolean;
  isHolidayDate?: boolean;
  holidayTitle?: string | null;
  periods?: AttendancePeriod[];
  classTimes?: {
    inTime: string | null;
    halfDayTime?: string | null;
    outTime: string | null;
  } | null;
}
type PackReportKey =
  | "daily_attendance"
  | "custom_attendance"
  | "remaining_class"
  | "student_summary"
  | "staff_summary"
  | "inout_time"
  | "period_wise"
  | "class_wise";
interface PackReportCatalogItem {
  key: PackReportKey;
  label: string;
  description: string;
}
interface PackReportResult {
  reportKey: PackReportKey;
  title: string;
  summary?: Record<string, number>;
  rows: Array<Record<string, unknown>>;
  columns?: Array<{ key: string; label: string }>;
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
  const [inTimes, setInTimes] = useState<Record<string, string>>({});
  const [outTimes, setOutTimes] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [markHoliday, setMarkHoliday] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searched, setSearched] = useState(false);
  const [scanCode, setScanCode] = useState("");
  const [scanMode, setScanMode] = useState<"IN" | "OUT">("IN");
  const [scanDevice, setScanDevice] = useState<"BARCODE" | "RFID" | "BIOMETRIC">("BARCODE");
  const [scanning, setScanning] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

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
      if (next.attendanceType === "PERIOD_WISE") {
        const periods = next.periods ?? [];
        if (periods.length && !periods.some((item) => item.key === period)) {
          const corrected = periods[0].key;
          setPeriodKey(corrected);
          if (sectionClassId && corrected !== period) {
            const retryParams = new URLSearchParams({
              date: selectedDate,
              periodKey: corrected,
              classSectionId: sectionClassId,
            });
            const retried = await apiRequest<Setup>(`/attendance/setup?${retryParams}`, accessToken);
            setSetup(retried);
            applyRosterState(retried);
            return;
          }
        } else if (!periods.length && !period) {
          setPeriodKey("PERIOD-1");
        }
      }
      applyRosterState(next);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load attendance");
    }
  }

  function applyRosterState(next: Setup) {
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
      setInTimes(
        Object.fromEntries(
          next.roster.map((item) => [
            item.id,
            (item.attendanceRecords[0]?.inTime ?? "").slice(0, 5),
          ]),
        ),
      );
      setOutTimes(
        Object.fromEntries(
          next.roster.map((item) => [
            item.id,
            (item.attendanceRecords[0]?.outTime ?? "").slice(0, 5),
          ]),
        ),
      );
      setSelected(Object.fromEntries(next.roster.map((item) => [item.id, false])));
      const allHoliday =
        next.roster.length > 0 &&
        next.roster.every((item) => item.attendanceRecords[0]?.status === "HOLIDAY");
      setMarkHoliday(Boolean(next.isHolidayDate) || allHoliday);
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
      const effectivePeriod =
        setup.attendanceType === "PERIOD_WISE" ? periodKey || "PERIOD-1" : periodKey;
      const result = await apiRequest<{ marked: number; periodKey: string; mode: "create" | "update" }>(
        "/attendance/records",
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            classSectionId,
            attendanceDate: date,
            periodKey: effectivePeriod,
            records: setup.roster.map((item) => ({
              studentEnrollmentId: item.id,
              status: markHoliday ? "HOLIDAY" : (statuses[item.id] ?? "PRESENT"),
              inTime: markHoliday ? null : inTimes[item.id]?.trim() || null,
              outTime: markHoliday ? null : outTimes[item.id]?.trim() || null,
              note: notes[item.id]?.trim() || null,
            })),
          }),
        },
      );
      notifySuccess(
        markHoliday
          ? `Marked ${result.marked} students as holiday`
          : result.mode === "update"
            ? `Updated ${result.marked} attendance records`
            : `${result.marked} attendance records saved`,
      );
      await load(classSectionId, date, effectivePeriod);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to mark attendance");
    } finally {
      setSaving(false);
    }
  }

  async function submitScan() {
    const code = scanCode.trim();
    if (!code) {
      notifyError("Enter a barcode or RFID code");
      return;
    }
    if (!classSectionId) {
      notifyError("Search a class section first");
      return;
    }
    setScanning(true);
    try {
      const result = await apiRequest<{
        enrollmentId: string;
        studentName: string;
        status: AttendanceStatus;
        inTime: string | null;
        outTime: string | null;
        mode: "IN" | "OUT";
      }>("/attendance/scan", accessToken, {
        method: "POST",
        body: JSON.stringify({
          code,
          mode: scanMode,
          deviceType: scanDevice,
          classSectionId,
          attendanceDate: date,
          periodKey: setup?.attendanceType === "PERIOD_WISE" ? periodKey || "PERIOD-1" : undefined,
        }),
      });
      setStatuses((prev) => ({ ...prev, [result.enrollmentId]: result.status }));
      setInTimes((prev) => ({ ...prev, [result.enrollmentId]: (result.inTime ?? "").slice(0, 5) }));
      setOutTimes((prev) => ({ ...prev, [result.enrollmentId]: (result.outTime ?? "").slice(0, 5) }));
      notifySuccess(
        `${result.studentName} marked ${result.mode === "IN" ? "in" : "out"} (${result.status.replaceAll("_", " ")})`,
      );
      setScanCode("");
      requestAnimationFrame(() => scanInputRef.current?.focus());
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to scan attendance");
    } finally {
      setScanning(false);
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

      <CmsIconTabs
        ariaLabel="Attendance sections"
        value={tab}
        onChange={setTab}
        columnsClass="grid-cols-2 sm:grid-cols-3 md:grid-cols-5"
        items={TABS}
      />

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
                  <select
                    className="nx-input"
                    value={periodKey}
                    onChange={(e) => {
                      const nextPeriod = e.target.value || "PERIOD-1";
                      setPeriodKey(nextPeriod);
                      if (searched && classSectionId) {
                        void load(classSectionId, date, nextPeriod);
                      }
                    }}
                  >
                    {(setup.periods?.length ? setup.periods : [{ key: "PERIOD-1", label: "PERIOD-1", startTime: "", endTime: "" }]).map(
                      (period) => (
                        <option key={period.key} value={period.key}>
                          {period.label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              )}
            </div>

            {searched && classSectionId ? (
              <>
                {setup?.isHolidayDate ? (
                  <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                    <EventBusyOutlined sx={{ fontSize: 18 }} />
                    Holiday date — {setup.holidayTitle || "Sunday / holiday"}. Mark as holiday is enabled.
                  </div>
                ) : null}
                {setup?.alreadySubmitted ? (
                  <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-900">
                    <InfoOutlined sx={{ fontSize: 18 }} />
                    Attendance already submitted — you are editing.
                  </div>
                ) : null}

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

                  <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                    <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-slate-800">
                      <QrCodeScannerOutlined sx={{ fontSize: 18 }} />
                      Barcode / RFID scan
                    </div>
                    <div className="grid gap-2 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
                      <label>
                        <span className="nx-label">Code</span>
                        <input
                          ref={scanInputRef}
                          className="nx-input"
                          value={scanCode}
                          autoFocus
                          disabled={markHoliday || scanning}
                          placeholder="Scan or type admission / barcode"
                          onChange={(e) => setScanCode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void submitScan();
                            }
                          }}
                        />
                      </label>
                      <div>
                        <span className="nx-label">Mode</span>
                        <div className="flex overflow-hidden rounded-lg border border-slate-200">
                          {(["IN", "OUT"] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              disabled={markHoliday}
                              className={`px-3 py-2 text-[12px] font-bold ${
                                scanMode === mode
                                  ? "bg-indigo-600 text-white"
                                  : "bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                              onClick={() => setScanMode(mode)}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                      </div>
                      <label>
                        <span className="nx-label">Device</span>
                        <select
                          className="nx-input"
                          value={scanDevice}
                          disabled={markHoliday}
                          onChange={(e) =>
                            setScanDevice(e.target.value as "BARCODE" | "RFID" | "BIOMETRIC")
                          }
                        >
                          <option value="BARCODE">BARCODE</option>
                          <option value="RFID">RFID</option>
                          <option value="BIOMETRIC">BIOMETRIC</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        className="nx-btn-primary h-[42px]"
                        disabled={markHoliday || scanning || !setup?.roster.length}
                        onClick={() => void submitScan()}
                      >
                        {scanning ? "Scanning…" : "Scan"}
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="nx-table min-w-[1100px]">
                      <thead>
                        <tr>
                          <th className="w-10">#</th>
                          <th>Student</th>
                          <th>Roll No</th>
                          <th>Attendance</th>
                          <th>In Time</th>
                          <th>Out Time</th>
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
                                  className="nx-input min-w-[120px]"
                                  type="time"
                                  value={inTimes[item.id] ?? ""}
                                  disabled={markHoliday}
                                  onChange={(e) =>
                                    setInTimes((prev) => ({ ...prev, [item.id]: e.target.value }))
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  className="nx-input min-w-[120px]"
                                  type="time"
                                  value={outTimes[item.id] ?? ""}
                                  disabled={markHoliday}
                                  onChange={(e) =>
                                    setOutTimes((prev) => ({ ...prev, [item.id]: e.target.value }))
                                  }
                                />
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
                            <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
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
                      {saving
                        ? "Saving…"
                        : setup?.alreadySubmitted
                          ? "Update Attendance"
                          : "Submit attendance"}
                    </button>
                    <p className="text-[12px] text-slate-500">
                      {setup?.alreadySubmitted
                        ? "Existing records for this date will be updated."
                        : "If already submitted for this date, you can only edit it."}
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
  const [periodKey, setPeriodKey] = useState(
    setup.attendanceType === "PERIOD_WISE" ? "PERIOD-1" : "DAY",
  );
  const [periods, setPeriods] = useState<AttendancePeriod[]>(setup.periods ?? []);
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
      const effectivePeriod =
        setup.attendanceType === "PERIOD_WISE" ? periodKey || "PERIOD-1" : "DAY";
      const params = new URLSearchParams({
        date: selectedDate,
        classSectionId,
        periodKey: effectivePeriod,
      });
      const next = await apiRequest<Setup>(`/attendance/setup?${params}`, token);
      const nextPeriods = next.periods ?? [];
      setPeriods(nextPeriods);
      if (
        setup.attendanceType === "PERIOD_WISE" &&
        nextPeriods.length &&
        !nextPeriods.some((item) => item.key === effectivePeriod)
      ) {
        setPeriodKey(nextPeriods[0].key);
      }
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
        {setup.attendanceType === "PERIOD_WISE" ? (
          <label className="mt-3 block max-w-xs">
            <span className="nx-label">Period</span>
            <select
              className="nx-input"
              value={periodKey}
              onChange={(e) => {
                setPeriodKey(e.target.value || "PERIOD-1");
                setSearched(false);
              }}
            >
              {(periods.length
                ? periods
                : [{ key: "PERIOD-1", label: "PERIOD-1", startTime: "", endTime: "" }]
              ).map((period) => (
                <option key={period.key} value={period.key}>
                  {period.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
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
  const [month, setMonth] = useState(today.slice(0, 7));
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

  async function loadScores(selectedMonth = month) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedMonth) params.set("month", selectedMonth);
      const data = await apiRequest<{
        config: { presentPoints: number; halfDayPoints: number; latePoints: number };
        scores: typeof scores;
      }>(`/attendance/points/scores${params.toString() ? `?${params}` : ""}`, token);
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
    void loadScores(month);
  }, [token, month]);

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
      await loadScores(month);
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
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h2 className="text-[15px] font-bold text-slate-900">Student attendance scores</h2>
          <label className="block min-w-[180px]">
            <span className="nx-label">Month</span>
            <input
              className="nx-input"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
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
    attachmentUrl: "" as string,
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
          attachmentUrl: form.attachmentUrl || null,
        }),
      });
      notifySuccess("Leave request saved");
      setDrawerOpen(false);
      setForm({
        studentEnrollmentId: "",
        studentLabel: "",
        fromDate: today,
        toDate: today,
        reason: "",
        status: "PENDING",
        fileName: "",
        attachmentUrl: "",
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
                <th className="w-10">File</th>
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
                      {leave.attachmentUrl ? (
                        <a
                          href={
                            leave.attachmentUrl.startsWith("data:") ||
                            leave.attachmentUrl.startsWith("http")
                              ? leave.attachmentUrl
                              : assetUrl(leave.attachmentUrl)
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="grid size-8 place-items-center rounded-lg bg-indigo-50 text-indigo-600"
                          title="View attachment"
                        >
                          <AttachFileOutlined sx={{ fontSize: 18 }} />
                        </a>
                      ) : (
                        <span className="text-[12px] text-slate-400">—</span>
                      )}
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
                  <td colSpan={9} className="py-12 text-center text-sm text-slate-500">
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
                        const reader = new FileReader();
                        reader.onload = () => {
                          setForm((prev) => ({
                            ...prev,
                            fileName: file.name,
                            attachmentUrl: String(reader.result ?? ""),
                          }));
                        };
                        reader.onerror = () => onError("Unable to read attachment");
                        reader.readAsDataURL(file);
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
              {viewLeave.attachmentUrl ? (
                <p>
                  <span className="font-semibold text-slate-500">Attachment:</span>{" "}
                  <a
                    href={
                      viewLeave.attachmentUrl.startsWith("data:") ||
                      viewLeave.attachmentUrl.startsWith("http")
                        ? viewLeave.attachmentUrl
                        : assetUrl(viewLeave.attachmentUrl)
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    <AttachFileOutlined sx={{ fontSize: 16 }} />
                    View file
                  </a>
                </p>
              ) : null}
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

function packReportIcon(key: PackReportKey): ReactNode {
  if (key === "daily_attendance" || key === "custom_attendance") {
    return <CalendarMonthOutlined sx={{ fontSize: 22 }} />;
  }
  if (key === "remaining_class") return <DonutLargeOutlined sx={{ fontSize: 22 }} />;
  if (key === "student_summary") return <PersonOutlined sx={{ fontSize: 22 }} />;
  if (key === "staff_summary") return <BadgeOutlined sx={{ fontSize: 22 }} />;
  if (key === "inout_time") return <AccessTimeOutlined sx={{ fontSize: 22 }} />;
  if (key === "period_wise") return <FormatListBulletedOutlined sx={{ fontSize: 22 }} />;
  return <GroupsOutlined sx={{ fontSize: 22 }} />;
}

function packReportTint(key: PackReportKey): string {
  const map: Record<PackReportKey, string> = {
    daily_attendance: "#7c3aed",
    custom_attendance: "#0ea5e9",
    remaining_class: "#10b981",
    student_summary: "#f59e0b",
    staff_summary: "#8b5cf6",
    inout_time: "#eab308",
    period_wise: "#38bdf8",
    class_wise: "#ec4899",
  };
  return map[key];
}

function humanizeColumnKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatPackCell(value: unknown): string {
  if (value == null) return "--";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && value !== null && "name" in value) {
    return String((value as { name?: unknown }).name ?? "--");
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "--";
  }
}

function derivePackColumns(result: PackReportResult): Array<{ key: string; label: string }> {
  if (result.columns?.length) return result.columns;
  const sample = result.rows[0];
  if (!sample) return [];
  return Object.keys(sample)
    .filter((key) => {
      const value = sample[key];
      return value == null || ["string", "number", "boolean"].includes(typeof value);
    })
    .map((key) => ({ key, label: humanizeColumnKey(key) }));
}

function exportPackReportCsv(result: PackReportResult) {
  const columns = derivePackColumns(result);
  if (!columns.length) return;
  const header = columns.map((col) => col.label);
  const body = result.rows.map((row) => columns.map((col) => formatPackCell(row[col.key])));
  const csv = [header, ...body]
    .map((cols) => cols.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${result.reportKey}-${today}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
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
  const [catalog, setCatalog] = useState<PackReportCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [active, setActive] = useState<PackReportCatalogItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PackReportResult | null>(null);
  const [form, setForm] = useState({
    classSectionId: "",
    date: today,
    fromDate: today,
    toDate: today,
    periodKey: setup.attendanceType === "PERIOD_WISE" ? "PERIOD-1" : "",
    month: today.slice(0, 7),
  });

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      setCatalogLoading(true);
      try {
        const data = await apiRequest<PackReportCatalogItem[]>("/attendance/reports/catalog", token);
        if (!cancelled) setCatalog(data);
      } catch (cause) {
        if (!cancelled) {
          onError(cause instanceof Error ? cause.message : "Unable to load report catalog");
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function openReport(item: PackReportCatalogItem) {
    setActive(item);
    setResult(null);
    setForm({
      classSectionId: "",
      date: today,
      fromDate: today,
      toDate: today,
      periodKey: setup.attendanceType === "PERIOD_WISE" ? "PERIOD-1" : "",
      month: today.slice(0, 7),
    });
  }

  async function generate() {
    if (!active) return;
    setLoading(true);
    setResult(null);
    try {
      const params = new URLSearchParams({ reportKey: active.key });
      if (active.key === "daily_attendance" || active.key === "remaining_class") {
        params.set("date", form.date);
      } else if (active.key === "staff_summary") {
        params.set("month", form.month);
      } else {
        params.set("fromDate", form.fromDate);
        params.set("toDate", form.toDate);
      }
      if (form.classSectionId) params.set("classSectionId", form.classSectionId);
      if (form.periodKey && (active.key === "period_wise" || active.key === "daily_attendance" || active.key === "remaining_class")) {
        params.set("periodKey", form.periodKey);
      }

      const data = await apiRequest<PackReportResult>(`/attendance/reports/run?${params}`, token);
      setResult({
        ...data,
        rows: Array.isArray(data.rows) ? data.rows : [],
      });
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to generate report");
    } finally {
      setLoading(false);
    }
  }

  const showDateRange =
    active &&
    active.key !== "daily_attendance" &&
    active.key !== "remaining_class" &&
    active.key !== "staff_summary";
  const showSingleDate = active && (active.key === "daily_attendance" || active.key === "remaining_class");
  const showSection = active && active.key !== "staff_summary";
  const showPeriod =
    active &&
    setup.attendanceType === "PERIOD_WISE" &&
    (active.key === "period_wise" || active.key === "daily_attendance" || active.key === "remaining_class");
  const columns = result ? derivePackColumns(result) : [];

  const cards = catalog.length
    ? catalog
    : ([
        { key: "daily_attendance", label: "Daily Attendance Report", description: "Attendance records for a selected day" },
        { key: "custom_attendance", label: "Custom Attendance Report", description: "Filtered attendance records over a date range" },
        { key: "remaining_class", label: "Remaining Class Attendance Report", description: "Class sections with attendance not yet marked" },
        { key: "student_summary", label: "Student Attendance Summary", description: "Per-student present/absent/late totals and percentage" },
        { key: "staff_summary", label: "Staff Attendance Summary", description: "Staff present/absent/late counts for a month" },
        { key: "inout_time", label: "In/Out Time Attendance Report", description: "Attendance records with in and out times" },
        { key: "period_wise", label: "Periods wise Attendance Report", description: "Attendance counts grouped by period" },
        { key: "class_wise", label: "Class wise Attendance Report", description: "Aggregated attendance per class section" },
      ] as PackReportCatalogItem[]);

  return (
    <section className="space-y-4">
      {catalogLoading ? (
        <div className="nx-card px-6 py-10 text-center text-sm text-slate-500">Loading report catalog…</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <div key={card.key} className="nx-card flex flex-col p-5">
              <div className="flex items-start gap-3">
                <span
                  className="grid size-11 shrink-0 place-items-center rounded-full"
                  style={{ background: `${packReportTint(card.key)}1a`, color: packReportTint(card.key) }}
                >
                  {packReportIcon(card.key)}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold text-slate-900">{card.label}</h3>
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
      )}

      {active ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setActive(null)}>
          <div
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-[16px] font-bold text-slate-900">{active.label}</h3>
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

                {showSingleDate ? (
                  <label>
                    <span className="nx-label">Date</span>
                    <input
                      className="nx-input"
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
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
                      value={form.month}
                      onChange={(e) => setForm({ ...form, month: e.target.value })}
                    />
                  </label>
                ) : null}

                {showPeriod ? (
                  <label>
                    <span className="nx-label">Period</span>
                    <select
                      className="nx-input"
                      value={form.periodKey}
                      onChange={(e) => setForm({ ...form, periodKey: e.target.value || "PERIOD-1" })}
                    >
                      {(setup.periods?.length
                        ? setup.periods
                        : [{ key: "PERIOD-1", label: "PERIOD-1", startTime: "", endTime: "" }]
                      ).map((period) => (
                        <option key={period.key} value={period.key}>
                          {period.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="nx-btn-primary" disabled={loading} onClick={() => void generate()}>
                  {loading ? "Generating…" : "Generate report"}
                </button>
                {result?.rows.length ? (
                  <button type="button" className="nx-btn-secondary" onClick={() => exportPackReportCsv(result)}>
                    <FileDownloadOutlined sx={{ fontSize: 16 }} />
                    Export CSV
                  </button>
                ) : null}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
              {result ? (
                <div className="space-y-3">
                  {result.summary ? (
                    <p className="text-[13px] text-slate-500">
                      {Object.entries(result.summary)
                        .map(([key, value]) => `${humanizeColumnKey(key)}: ${value}`)
                        .join(" · ")}
                    </p>
                  ) : null}
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="nx-table">
                      <thead>
                        <tr>
                          {columns.map((col) => (
                            <th key={col.key}>{col.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, index) => (
                          <tr key={String(row.id ?? row.studentId ?? row.staffId ?? row.classSectionId ?? index)}>
                            {columns.map((col) => (
                              <td key={col.key} className={col.key.toLowerCase().includes("name") || col.key === "classSection" ? "font-semibold" : undefined}>
                                {formatPackCell(row[col.key])}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {!result.rows.length ? (
                          <tr>
                            <td colSpan={Math.max(columns.length, 1)} className="py-8 text-center text-sm text-slate-500">
                              No matching records.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : !loading ? (
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
