import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
import { apiRequest } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";

interface Named { id: string; name: string }
interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
}
interface Staff {
  id: string;
  employeeNumber: string;
  basicSalary: string;
  status: "ACTIVE" | "DISABLED";
  user: User;
  department: Named | null;
  designation: Named | null;
  attendance: Array<{ attendanceDate: string; status: string; inTime: string | null; outTime: string | null }>;
}
interface Leave {
  id: string;
  fromDate: string;
  toDate: string;
  reason: string;
  staff: Staff;
  leaveType: Named;
}
interface Payroll {
  id: string;
  grossAmount: string;
  netAmount: string;
  attendanceDeduction: string;
  status: "GENERATED" | "PAID";
  staff: Staff;
}
interface Setup {
  month: string;
  currentSession: Named | null;
  departments: Named[];
  designations: Named[];
  leaveTypes: Array<Named & { annualLimit: number | null }>;
  staff: Staff[];
  pendingLeaves: Leave[];
  payrolls: Payroll[];
}

const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);

export function HrPage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<"staff" | "attendance" | "leave" | "payroll" | "setup">("staff");
  const [month, setMonth] = useState(currentMonth);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [times, setTimes] = useState<Record<string, { inTime: string; outTime: string }>>({});

  async function load(selectedMonth = month) {
    try {
      const [next, nextUsers] = await Promise.all([
        apiRequest<Setup>(`/hr/setup?month=${selectedMonth}-01`, accessToken),
        apiRequest<User[]>("/users", accessToken).catch(() => []),
      ]);
      setSetup(next);
      setUsers(nextUsers);
      setStatuses(Object.fromEntries(next.staff.map((member) => [
        member.id,
        member.attendance[0]?.status ?? "PRESENT",
      ])));
      setTimes(Object.fromEntries(next.staff.map((member) => [
        member.id,
        {
          inTime: member.attendance[0]?.inTime ?? "",
          outTime: member.attendance[0]?.outTime ?? "",
        },
      ])));
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load human resources");
    }
  }
  useEffect(() => { void load(); }, [accessToken]);

  async function markAttendance() {
    if (!setup) return;
    try {
      await apiRequest("/hr/attendance", accessToken, {
        method: "POST",
        body: JSON.stringify({
          attendanceDate: today,
          records: setup.staff.filter((member) => member.status === "ACTIVE").map((member) => ({
            staffId: member.id,
            status: statuses[member.id] ?? "PRESENT",
            inTime: times[member.id]?.inTime || null,
            outTime: times[member.id]?.outTime || null,
          })),
        }),
      });
      notifySuccess("Staff attendance saved");
      await load();
    } catch (cause) { notifyError(cause instanceof Error ? cause.message : "Unable to mark attendance"); }
  }

  async function reviewLeave(id: string, status: "APPROVED" | "REJECTED") {
    try {
      await apiRequest(`/hr/leaves/${id}/review`, accessToken, {
        method: "PUT", body: JSON.stringify({ status }),
      });
      notifySuccess(`Leave ${status.toLowerCase()}`); await load();
    } catch (cause) { notifyError(cause instanceof Error ? cause.message : "Unable to review leave"); }
  }

  async function generatePayroll() {
    if (!setup?.currentSession) return;
    try {
      await apiRequest("/hr/payroll", accessToken, {
        method: "POST",
        body: JSON.stringify({
          academicSessionId: setup.currentSession.id,
          payrollMonth: `${month}-01`,
        }),
      });
      notifySuccess("Payroll generated with attendance deductions"); await load();
    } catch (cause) { notifyError(cause instanceof Error ? cause.message : "Unable to generate payroll"); }
  }

  async function payPayroll(id: string) {
    try {
      await apiRequest(`/hr/payroll/${id}/pay`, accessToken, {
        method: "PUT", body: JSON.stringify({ paymentMode: "BANK_TRANSFER" }),
      });
      notifySuccess("Payroll marked paid"); await load();
    } catch (cause) { notifyError(cause instanceof Error ? cause.message : "Unable to pay payroll"); }
  }

  return (
    <main className="page-main">
      <PageHeader
        eyebrow="Human resources"
        title="Staff and payroll"
        description="Maintain staff profiles, attendance, leave, earnings, deductions, and monthly payroll."
        action={<input className="input w-44" type="month" value={month} onChange={(e) => { setMonth(e.target.value); void load(e.target.value); }} />}
      />
      <div className="mt-3 flex shrink-0 gap-2 overflow-x-auto border-b border-slate-200">
        {(["staff", "attendance", "leave", "payroll", "setup"] as const).map((item) => (
          <button className={`tab ${tab === item ? "tab-active" : ""}`} key={item} onClick={() => setTab(item)}>
            {item === "staff" ? "Staff 360" : item === "attendance" ? "Attendance" : item === "leave" ? "Leave approval" : item === "payroll" ? "Payroll" : "HR setup & ratings"}
          </button>
        ))}
      </div>

      <div className="page-scroll">
      {setup && tab === "staff" && (
        <StaffPanel setup={setup} users={users} token={accessToken} onSaved={load} onError={notifyError} />
      )}
      {setup && tab === "attendance" && (
        <section className="mt-6">
          <div className="card divide-y divide-slate-100 overflow-hidden">
            {setup.staff.filter((member) => member.status === "ACTIVE").map((member) => (
              <div className="grid items-center gap-3 p-5 sm:grid-cols-[1fr_180px_120px_120px]" key={member.id}>
                <div><p className="font-medium">{member.user.firstName} {member.user.lastName}</p><p className="text-sm text-slate-500">{member.employeeNumber} · {member.designation?.name ?? "No designation"}</p></div>
                <select className="input" value={statuses[member.id] ?? "PRESENT"} onChange={(e) => setStatuses({ ...statuses, [member.id]: e.target.value })}>
                  <option value="PRESENT">Present</option><option value="LATE">Late</option><option value="ABSENT">Absent</option><option value="HALF_DAY">Half day</option><option value="HOLIDAY">Holiday</option>
                </select>
                <input className="input" type="time" value={times[member.id]?.inTime ?? ""} onChange={(e) => setTimes({ ...times, [member.id]: { inTime: e.target.value, outTime: times[member.id]?.outTime ?? "" } })} />
                <input className="input" type="time" value={times[member.id]?.outTime ?? ""} onChange={(e) => setTimes({ ...times, [member.id]: { inTime: times[member.id]?.inTime ?? "", outTime: e.target.value } })} />
              </div>
            ))}
            <div className="bg-slate-50 p-4"><button className="button-primary" onClick={() => void markAttendance()}>Save today's attendance</button></div>
          </div>
          <div className="card mt-5 divide-y divide-slate-100 overflow-hidden">
            <div className="p-4 font-semibold">Monthly in/out time report</div>
            {setup.staff.flatMap((member) => member.attendance.map((record) => (
              <div className="grid gap-3 p-4 sm:grid-cols-[1fr_130px_100px_100px_110px]" key={`${member.id}-${record.attendanceDate}`}>
                <span>{member.user.firstName} {member.user.lastName}</span>
                <span>{new Date(record.attendanceDate).toLocaleDateString()}</span>
                <span>{record.inTime ?? "—"}</span>
                <span>{record.outTime ?? "—"}</span>
                <span className="badge">{record.status}</span>
              </div>
            )))}
          </div>
        </section>
      )}
      {setup && tab === "leave" && (
        <section className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr]">
          <LeaveForm setup={setup} token={accessToken} onSaved={load} onError={notifyError} />
          <div className="card divide-y divide-slate-100 overflow-hidden">
            {setup.pendingLeaves.map((leave) => (
              <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center" key={leave.id}>
                <div><p className="font-medium">{leave.staff.user.firstName} {leave.staff.user.lastName}</p><p className="text-sm text-slate-500">{leave.leaveType.name} · {new Date(leave.fromDate).toLocaleDateString()}–{new Date(leave.toDate).toLocaleDateString()} · {leave.reason}</p></div>
                <div className="flex gap-2"><button className="button-secondary" onClick={() => void reviewLeave(leave.id, "REJECTED")}>Reject</button><button className="button-primary" onClick={() => void reviewLeave(leave.id, "APPROVED")}>Approve</button></div>
              </div>
            ))}
            {!setup.pendingLeaves.length && <p className="p-8 text-center text-sm text-slate-500">No pending staff leave.</p>}
          </div>
        </section>
      )}
      {setup && tab === "payroll" && (
        <section className="mt-6">
          <button className="button-primary" disabled={!setup.currentSession} onClick={() => void generatePayroll()}>Generate {month} payroll</button>
          <div className="card mt-5 divide-y divide-slate-100 overflow-hidden">
            {setup.payrolls.map((payroll) => (
              <div className="grid items-center gap-3 p-5 md:grid-cols-[1fr_repeat(3,130px)_110px]" key={payroll.id}>
                <div><p className="font-medium">{payroll.staff.user.firstName} {payroll.staff.user.lastName}</p><p className="text-sm text-slate-500">{payroll.staff.employeeNumber}</p></div>
                <span>Gross ₹{Number(payroll.grossAmount).toLocaleString()}</span>
                <span>Deduct ₹{Number(payroll.attendanceDeduction).toLocaleString()}</span>
                <strong>Net ₹{Number(payroll.netAmount).toLocaleString()}</strong>
                {payroll.status === "PAID" ? <span className="badge-success">PAID</span> : <button className="button-primary" onClick={() => void payPayroll(payroll.id)}>Pay</button>}
              </div>
            ))}
          </div>
        </section>
      )}
      {setup && tab === "setup" && (
        <HrSetupPanel setup={setup} token={accessToken} onSaved={load} onError={notifyError} />
      )}
      </div>
    </main>
  );
}

function StaffPanel({ setup, users, token, onSaved, onError }: {
  setup: Setup; users: User[]; token: string; onSaved: () => Promise<void>; onError: (message: string) => void;
}) {
  const [form, setForm] = useState({ userId: "", employeeNumber: "", departmentId: "", designationId: "", joiningDate: today, basicSalary: "0" });
  const available = users.filter((user) => !setup.staff.some((member) => member.user.id === user.id));
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/hr/staff", token, { method: "POST", body: JSON.stringify(form) });
      setForm({ ...form, userId: "", employeeNumber: "" });
      notifySuccess("Staff profile created");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to add staff profile"); }
  }
  async function disable(member: Staff) {
    try {
      await apiRequest(`/hr/staff/${member.id}/status`, token, {
        method: "PUT",
        body: JSON.stringify(member.status === "ACTIVE" ? { status: "DISABLED", disabledReason: "Disabled by administrator" } : { status: "ACTIVE" }),
      });
      notifySuccess(member.status === "ACTIVE" ? "Staff disabled" : "Staff enabled");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to update staff"); }
  }
  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr]">
      <form className="card p-5" onSubmit={submit}>
        <h2 className="font-semibold">Add staff profile</h2>
        <select className="input mt-4" required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}><option value="">Tenant user</option>{available.map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>)}</select>
        <input className="input mt-3" required placeholder="Employee number" value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} />
        <select className="input mt-3" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}><option value="">Department</option>{setup.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select className="input mt-3" value={form.designationId} onChange={(e) => setForm({ ...form, designationId: e.target.value })}><option value="">Designation</option>{setup.designations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <input className="input mt-3" type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} />
        <input className="input mt-3" type="number" min="0" placeholder="Basic salary" value={form.basicSalary} onChange={(e) => setForm({ ...form, basicSalary: e.target.value })} />
        <button className="button-primary mt-4">Create staff profile</button>
      </form>
      <div className="card divide-y divide-slate-100 overflow-hidden">
        {setup.staff.map((member) => (
          <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center" key={member.id}>
            <div><p className="font-medium">{member.user.firstName} {member.user.lastName}</p><p className="text-sm text-slate-500">{member.employeeNumber} · {member.department?.name ?? "—"} · {member.designation?.name ?? "—"} · ₹{Number(member.basicSalary).toLocaleString()}</p></div>
            <button className="button-secondary" onClick={() => void disable(member)}>{member.status === "ACTIVE" ? "Disable" : "Enable"}</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function LeaveForm({ setup, token, onSaved, onError }: {
  setup: Setup; token: string; onSaved: () => Promise<void>; onError: (message: string) => void;
}) {
  const [form, setForm] = useState({ staffId: "", leaveTypeId: "", fromDate: today, toDate: today, reason: "" });
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/hr/leaves", token, { method: "POST", body: JSON.stringify(form) });
      setForm({ ...form, reason: "" });
      notifySuccess("Leave request submitted");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to apply leave"); }
  }
  return (
    <form className="card p-5" onSubmit={submit}>
      <h2 className="font-semibold">Apply leave</h2>
      <select className="input mt-4" required value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}><option value="">Staff member</option>{setup.staff.filter((item) => item.status === "ACTIVE").map((item) => <option value={item.id} key={item.id}>{item.user.firstName} {item.user.lastName}</option>)}</select>
      <select className="input mt-3" required value={form.leaveTypeId} onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}><option value="">Leave type</option>{setup.leaveTypes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
      <div className="mt-3 grid grid-cols-2 gap-3"><input className="input" type="date" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} /><input className="input" type="date" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} /></div>
      <textarea className="input mt-3" required placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      <button className="button-primary mt-4">Submit leave request</button>
    </form>
  );
}

function HrSetupPanel({ setup, token, onSaved, onError }: {
  setup: Setup; token: string; onSaved: () => Promise<void>; onError: (message: string) => void;
}) {
  const [master, setMaster] = useState({ resource: "departments", name: "", annualLimit: "12" });
  const [adjustment, setAdjustment] = useState({ staffId: "", name: "", type: "EARNING", amount: "", isRecurring: true });
  const [rating, setRating] = useState({ staffId: "", rating: "5", comment: "", ratingDate: today });
  async function createMaster(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest(`/hr/${master.resource}`, token, {
        method: "POST",
        body: JSON.stringify({
          name: master.name,
          ...(master.resource === "leave-types" ? { annualLimit: Number(master.annualLimit) } : {}),
        }),
      });
      setMaster({ ...master, name: "" });
      notifySuccess("HR master added");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to create HR master"); }
  }
  async function addAdjustment(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest(`/hr/staff/${adjustment.staffId}/adjustments`, token, {
        method: "POST",
        body: JSON.stringify({ ...adjustment, amount: Number(adjustment.amount) }),
      });
      setAdjustment({ ...adjustment, name: "", amount: "" });
      notifySuccess("Earning or deduction added");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to add earning or deduction"); }
  }
  async function addRating(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/hr/ratings", token, {
        method: "POST",
        body: JSON.stringify({ ...rating, rating: Number(rating.rating) }),
      });
      setRating({ ...rating, comment: "" });
      notifySuccess("Teacher rating added");
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to add teacher rating"); }
  }
  return (
    <section className="mt-6 grid gap-5 lg:grid-cols-3">
      <form className="card p-5" onSubmit={createMaster}>
        <h2 className="font-semibold">Departments and leave setup</h2>
        <select className="input mt-4" value={master.resource} onChange={(e) => setMaster({ ...master, resource: e.target.value })}>
          <option value="departments">Department</option><option value="designations">Designation</option><option value="leave-types">Leave type</option>
        </select>
        <input className="input mt-3" required placeholder="Name" value={master.name} onChange={(e) => setMaster({ ...master, name: e.target.value })} />
        {master.resource === "leave-types" && <input className="input mt-3" type="number" min="1" placeholder="Annual limit" value={master.annualLimit} onChange={(e) => setMaster({ ...master, annualLimit: e.target.value })} />}
        <button className="button-primary mt-4">Add master</button>
        <div className="mt-5 flex flex-wrap gap-2">
          {setup.departments.map((item) => <span className="badge" key={item.id}>{item.name}</span>)}
          {setup.designations.map((item) => <span className="badge" key={item.id}>{item.name}</span>)}
          {setup.leaveTypes.map((item) => <span className="badge" key={item.id}>{item.name} ({item.annualLimit ?? "∞"})</span>)}
        </div>
      </form>
      <form className="card p-5" onSubmit={addAdjustment}>
        <h2 className="font-semibold">Earning or deduction</h2>
        <select className="input mt-4" required value={adjustment.staffId} onChange={(e) => setAdjustment({ ...adjustment, staffId: e.target.value })}><option value="">Staff member</option>{setup.staff.filter((item) => item.status === "ACTIVE").map((item) => <option key={item.id} value={item.id}>{item.user.firstName} {item.user.lastName}</option>)}</select>
        <input className="input mt-3" required placeholder="Adjustment name" value={adjustment.name} onChange={(e) => setAdjustment({ ...adjustment, name: e.target.value })} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <select className="input" value={adjustment.type} onChange={(e) => setAdjustment({ ...adjustment, type: e.target.value })}><option value="EARNING">Earning</option><option value="DEDUCTION">Deduction</option></select>
          <input className="input" type="number" min="1" required placeholder="Amount" value={adjustment.amount} onChange={(e) => setAdjustment({ ...adjustment, amount: e.target.value })} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={adjustment.isRecurring} onChange={(e) => setAdjustment({ ...adjustment, isRecurring: e.target.checked })} />Apply each payroll month</label>
        <button className="button-primary mt-4">Add adjustment</button>
      </form>
      <form className="card p-5" onSubmit={addRating}>
        <h2 className="font-semibold">Teacher rating</h2>
        <select className="input mt-4" required value={rating.staffId} onChange={(e) => setRating({ ...rating, staffId: e.target.value })}><option value="">Teacher</option>{setup.staff.map((item) => <option key={item.id} value={item.id}>{item.user.firstName} {item.user.lastName}</option>)}</select>
        <select className="input mt-3" value={rating.rating} onChange={(e) => setRating({ ...rating, rating: e.target.value })}><option value="5">5 · Excellent</option><option value="4">4 · Very good</option><option value="3">3 · Good</option><option value="2">2 · Needs improvement</option><option value="1">1 · Unsatisfactory</option></select>
        <input className="input mt-3" type="date" value={rating.ratingDate} onChange={(e) => setRating({ ...rating, ratingDate: e.target.value })} />
        <textarea className="input mt-3" placeholder="Review comment" value={rating.comment} onChange={(e) => setRating({ ...rating, comment: e.target.value })} />
        <button className="button-primary mt-4">Save rating</button>
      </form>
    </section>
  );
}
