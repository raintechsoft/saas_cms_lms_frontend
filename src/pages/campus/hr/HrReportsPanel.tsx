import { useState, type ReactNode } from "react";
import {
  AccountBalanceWalletOutlined,
  CakeOutlined,
  CalendarMonthOutlined,
  DescriptionOutlined,
  FlightOutlined,
  GroupsOutlined,
  HowToRegOutlined,
  PersonOffOutlined,
} from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";
import { staffName, type HrSetup, type Staff } from "./types";

const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);
const monthStart = `${currentMonth}-01`;

interface AttendanceRow {
  id: string;
  attendanceDate: string;
  status: string;
  inTime: string | null;
  outTime: string | null;
  staff: Staff;
}

function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number>>) {
  const lines = [header, ...rows].map((row) =>
    row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","),
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function staffCsvRow(member: Staff) {
  return [
    staffName(member),
    member.employeeNumber,
    member.user.email,
    member.phone ?? member.user.phone ?? "",
    member.designation?.name ?? "",
    member.department?.name ?? "",
    member.status,
    member.joiningDate ? member.joiningDate.slice(0, 10) : "",
  ];
}

const STAFF_CSV_HEADER = [
  "Name",
  "Employee No",
  "Email",
  "Phone",
  "Role",
  "Department",
  "Status",
  "Joining Date",
];

function ReportCard({
  icon,
  tint,
  title,
  description,
  controls,
  busy,
  onGenerate,
  wide,
}: {
  icon: ReactNode;
  tint: string;
  title: string;
  description: string;
  controls?: ReactNode;
  busy?: boolean;
  onGenerate: () => void;
  wide?: boolean;
}) {
  const inner = (
    <>
      <span
        className="grid size-12 shrink-0 place-items-center rounded-xl"
        style={{ background: `${tint}14`, color: tint }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[14px] font-bold text-slate-900">{title}</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">{description}</p>
        {controls ? <div className="mt-2.5 flex flex-wrap items-end gap-2">{controls}</div> : null}
      </div>
    </>
  );
  const button = (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3.5 py-2 text-[12.5px] font-semibold text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50"
      disabled={busy}
      onClick={onGenerate}
    >
      <DescriptionOutlined sx={{ fontSize: 15 }} />
      {busy ? "Generating…" : "Generate"}
    </button>
  );
  if (wide) {
    return (
      <div className="nx-card flex flex-wrap items-center gap-4 p-5 sm:col-span-2 xl:col-span-3">
        {inner}
        <div className="shrink-0">{button}</div>
      </div>
    );
  }
  return (
    <div className="nx-card flex flex-col p-5">
      <div className="flex items-start gap-4">{inner}</div>
      <div className="mt-4 pl-16">{button}</div>
    </div>
  );
}

export function HrReportsPanel({
  setup,
  token,
  onError,
}: {
  setup: HrSetup;
  token: string;
  onError: (message: string) => void;
}) {
  const [payrollMonth, setPayrollMonth] = useState(setup.month?.slice(0, 7) ?? currentMonth);
  const [birthdayMonth, setBirthdayMonth] = useState(currentMonth);
  const [attendanceFrom, setAttendanceFrom] = useState(monthStart);
  const [attendanceTo, setAttendanceTo] = useState(today);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function generateStaffList() {
    if (!setup.staff.length) {
      notifyError("No staff records to export");
      return;
    }
    downloadCsv("staff-list-report.csv", STAFF_CSV_HEADER, setup.staff.map(staffCsvRow));
    notifySuccess("Staff list report downloaded");
  }

  function generateByStatus(status: "ACTIVE" | "DISABLED") {
    const members = setup.staff.filter((member) => member.status === status);
    if (!members.length) {
      notifyError(`No ${status === "ACTIVE" ? "active" : "disabled"} staff to export`);
      return;
    }
    downloadCsv(
      status === "ACTIVE" ? "active-staff-report.csv" : "disabled-staff-report.csv",
      STAFF_CSV_HEADER,
      members.map(staffCsvRow),
    );
    notifySuccess(`${status === "ACTIVE" ? "Active" : "Disabled"} staff report downloaded`);
  }

  async function generatePayroll() {
    setBusyKey("payroll");
    try {
      const data = await apiRequest<HrSetup>(`/hr/setup?month=${payrollMonth}-01`, token);
      if (!data.payrolls.length) {
        notifyError(`No payroll generated for ${payrollMonth}`);
        return;
      }
      downloadCsv(
        `staff-payroll-report-${payrollMonth}.csv`,
        [
          "Name",
          "Employee No",
          "Month",
          "Basic Salary",
          "Gross Amount",
          "Attendance Deduction",
          "Net Amount",
          "Status",
        ],
        data.payrolls.map((payroll) => [
          staffName(payroll.staff),
          payroll.staff.employeeNumber,
          payrollMonth,
          payroll.basicSalary ?? payroll.staff.basicSalary,
          payroll.grossAmount,
          payroll.attendanceDeduction,
          payroll.netAmount,
          payroll.status,
        ]),
      );
      notifySuccess("Payroll report downloaded");
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to generate payroll report");
    } finally {
      setBusyKey(null);
    }
  }

  function generateBirthdays() {
    const month = Number(birthdayMonth.slice(5, 7));
    const members = setup.staff.filter(
      (member) =>
        member.dateOfBirth && Number(member.dateOfBirth.slice(5, 7)) === month,
    );
    if (!members.length) {
      notifyError("No staff birthdays in the selected month");
      return;
    }
    const year = Number(birthdayMonth.slice(0, 4));
    downloadCsv(
      `staff-birthday-report-${birthdayMonth}.csv`,
      ["Name", "Employee No", "Role", "Department", "Date of Birth", "Turns"],
      members
        .sort(
          (a, b) =>
            Number(a.dateOfBirth!.slice(8, 10)) - Number(b.dateOfBirth!.slice(8, 10)),
        )
        .map((member) => [
          staffName(member),
          member.employeeNumber,
          member.designation?.name ?? "",
          member.department?.name ?? "",
          member.dateOfBirth!.slice(0, 10),
          year - Number(member.dateOfBirth!.slice(0, 4)),
        ]),
    );
    notifySuccess("Birthday report downloaded");
  }

  function generateLeaves() {
    const leaves = setup.leaves ?? [];
    if (!leaves.length) {
      notifyError("No leave requests to export");
      return;
    }
    downloadCsv(
      "staff-leave-request-report.csv",
      [
        "Name",
        "Employee No",
        "Leave Type",
        "From",
        "To",
        "Days",
        "Status",
        "Reason",
        "Applied On",
        "Reviewer Note",
      ],
      leaves.map((leave) => {
        const days =
          Math.round(
            (new Date(leave.toDate).getTime() - new Date(leave.fromDate).getTime()) / 86_400_000,
          ) + 1;
        return [
          staffName(leave.staff),
          leave.staff.employeeNumber,
          leave.leaveType.name,
          leave.fromDate.slice(0, 10),
          leave.toDate.slice(0, 10),
          Math.max(1, days),
          leave.status,
          leave.reason,
          leave.createdAt.slice(0, 10),
          leave.reviewNote ?? "",
        ];
      }),
    );
    notifySuccess("Leave request report downloaded");
  }

  async function generateAttendance() {
    if (!attendanceFrom || !attendanceTo || attendanceFrom > attendanceTo) {
      notifyError("Pick a valid date range first");
      return;
    }
    setBusyKey("attendance");
    try {
      const query = new URLSearchParams({ from: attendanceFrom, to: attendanceTo });
      const rows = await apiRequest<AttendanceRow[]>(`/hr/attendance?${query}`, token);
      if (!rows.length) {
        notifyError("No attendance records in the selected range");
        return;
      }
      const byStaff = new Map<
        string,
        { staff: Staff; present: number; late: number; absent: number; halfDay: number }
      >();
      for (const row of rows) {
        const entry =
          byStaff.get(row.staff.id) ??
          { staff: row.staff, present: 0, late: 0, absent: 0, halfDay: 0 };
        if (row.status === "PRESENT") entry.present += 1;
        else if (row.status === "LATE") entry.late += 1;
        else if (row.status === "ABSENT") entry.absent += 1;
        else if (row.status === "HALF_DAY") entry.halfDay += 1;
        byStaff.set(row.staff.id, entry);
      }
      downloadCsv(
        `staff-attendance-report-${attendanceFrom}-to-${attendanceTo}.csv`,
        [
          "Name",
          "Employee No",
          "Role",
          "Department",
          "Present",
          "Late",
          "Absent",
          "Half Day",
          "Total Marked",
        ],
        [...byStaff.values()].map((entry) => [
          staffName(entry.staff),
          entry.staff.employeeNumber,
          entry.staff.designation?.name ?? "",
          entry.staff.department?.name ?? "",
          entry.present,
          entry.late,
          entry.absent,
          entry.halfDay,
          entry.present + entry.late + entry.absent + entry.halfDay,
        ]),
      );
      notifySuccess("Attendance report downloaded");
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to generate attendance report");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="mt-4">
      <h2 className="text-[15px] font-bold text-slate-900">Available Reports</h2>
      <p className="mt-0.5 text-[12.5px] text-slate-500">
        Generate and download HR related reports.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <ReportCard
          icon={<GroupsOutlined sx={{ fontSize: 24 }} />}
          tint="#6366f1"
          title="Staff List Report"
          description="Get a complete list of all staff members with their role and department details."
          onGenerate={generateStaffList}
        />
        <ReportCard
          icon={<AccountBalanceWalletOutlined sx={{ fontSize: 24 }} />}
          tint="#10b981"
          title="Staff Payroll Report"
          description="Generate payroll summary report for staff based on selected month and year."
          controls={
            <input
              className="nx-input w-40 !py-1.5 text-[12.5px]"
              type="month"
              value={payrollMonth}
              onChange={(e) => setPayrollMonth(e.target.value)}
            />
          }
          busy={busyKey === "payroll"}
          onGenerate={() => void generatePayroll()}
        />
        <ReportCard
          icon={<CakeOutlined sx={{ fontSize: 24 }} />}
          tint="#f59e0b"
          title="Staff Birthday Report"
          description="View upcoming birthdays of staff members for the selected month."
          controls={
            <input
              className="nx-input w-40 !py-1.5 text-[12.5px]"
              type="month"
              value={birthdayMonth}
              onChange={(e) => setBirthdayMonth(e.target.value)}
            />
          }
          onGenerate={generateBirthdays}
        />
        <ReportCard
          icon={<FlightOutlined sx={{ fontSize: 24 }} />}
          tint="#0ea5e9"
          title="Staff Leave Request Report"
          description="Get a detailed report of all leave requests with status and duration."
          onGenerate={generateLeaves}
        />
        <ReportCard
          icon={<HowToRegOutlined sx={{ fontSize: 24 }} />}
          tint="#10b981"
          title="Active Staff Report"
          description="List of all active staff members currently working in the organization."
          onGenerate={() => generateByStatus("ACTIVE")}
        />
        <ReportCard
          icon={<PersonOffOutlined sx={{ fontSize: 24 }} />}
          tint="#f43f5e"
          title="Disabled Staff Report"
          description="List of all disabled/inactive staff members in the system."
          onGenerate={() => generateByStatus("DISABLED")}
        />
        <ReportCard
          wide
          icon={<CalendarMonthOutlined sx={{ fontSize: 24 }} />}
          tint="#7c3aed"
          title="Staff Attendance Report"
          description="Generate attendance summary report for staff based on date range with present, absent, late details."
          controls={
            <>
              <label className="block">
                <span className="nx-label">From</span>
                <input
                  className="nx-input mt-1 w-40 !py-1.5 text-[12.5px]"
                  type="date"
                  value={attendanceFrom}
                  onChange={(e) => setAttendanceFrom(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="nx-label">To</span>
                <input
                  className="nx-input mt-1 w-40 !py-1.5 text-[12.5px]"
                  type="date"
                  value={attendanceTo}
                  onChange={(e) => setAttendanceTo(e.target.value)}
                />
              </label>
            </>
          }
          busy={busyKey === "attendance"}
          onGenerate={() => void generateAttendance()}
        />
      </div>
    </section>
  );
}
