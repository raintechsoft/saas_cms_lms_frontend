import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
import { apiRequest } from "../../lib/api";

interface Named { id: string; name: string }
interface FeeType extends Named { code: string | null }
interface FeeGroup extends Named { items: Array<{ feeType: FeeType }> }
interface Student { id: string; admissionNumber: string; firstName: string; lastName: string | null }
interface Enrollment { id: string; student: Student }
interface ClassSection {
  id: string;
  academicClass: Named;
  section: Named;
  enrollments: Enrollment[];
}
interface FeeMaster {
  id: string;
  amount: string;
  dueDate: string;
  feeType: FeeType;
  feeGroup: FeeGroup;
  classSection: ClassSection | null;
  _count: { assignments: number };
}
interface ReceiptBook extends Named { prefix: string; isDefault: boolean }
interface FeeSetting {
  autoReminder: boolean;
  reminderDaysBefore: number;
  reminderDaysAfter: number;
}
interface FeeSetup {
  currentSession: Named | null;
  types: FeeType[];
  groups: FeeGroup[];
  discounts: Named[];
  receiptBooks: ReceiptBook[];
  classSections: ClassSection[];
  masters: FeeMaster[];
  setting?: FeeSetting | null;
}
interface StudentFees {
  student: Student;
  assignments: Array<{
    id: string;
    feeMaster: { feeType: FeeType; dueDate: string };
    totals: { base: number; discount: number; fine: number; paid: number; balance: number };
  }>;
  totals: { base: number; discount: number; fine: number; paid: number; balance: number };
}
interface PaymentItem {
  id: string;
  paidAmount: string;
  assignment: { feeMaster: { feeType: FeeType } };
}
interface Payment {
  id: string;
  paymentId: string;
  receiptNumber: string;
  paymentDate: string;
  paymentMode: string;
  amount: string;
  status: string;
  note: string | null;
  student: Student;
  items: PaymentItem[];
}
interface FeeSummary {
  totals: { assigned: number; discounts: number; fines: number; collected: number; due: number };
  dues: Array<{
    id: string;
    feeMaster: { feeType: FeeType; dueDate: string };
    totals: { base: number; discount: number; fine: number; paid: number; balance: number };
    student: Student;
  }>;
}
interface Session extends Named { isCurrent: boolean }
interface StudentDetail {
  enrollments: Array<{ id: string; academicSession: Named }>;
}

type Tab = "collect" | "setup" | "dues" | "reminders" | "receipts";
type PaymentMode = "CASH" | "UPI" | "CARD" | "BANK" | "CHEQUE" | "OTHER";

const PAYMENT_MODES: PaymentMode[] = ["CASH", "UPI", "CARD", "BANK", "CHEQUE", "OTHER"];
const today = new Date().toISOString().slice(0, 10);
const formatMoney = (value: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value));

export function FeesPage() {
  const { accessToken } = useAuth();
  const [setup, setSetup] = useState<FeeSetup | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tab, setTab] = useState<Tab>("collect");
  const [studentId, setStudentId] = useState("");
  const [studentFees, setStudentFees] = useState<StudentFees | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receiptSearch, setReceiptSearch] = useState("");
  const [error, setError] = useState("");

  const students = useMemo(() => {
    const byId = new Map<string, Student>();
    setup?.classSections.forEach(({ enrollments }) =>
      enrollments.forEach(({ student }) => byId.set(student.id, student)),
    );
    return [...byId.values()];
  }, [setup]);

  const defaultReceiptBookId = useMemo(
    () => setup?.receiptBooks.find((book) => book.isDefault)?.id ?? setup?.receiptBooks[0]?.id ?? "",
    [setup],
  );

  async function load() {
    try {
      const [nextSetup, nextSessions] = await Promise.all([
        apiRequest<FeeSetup>("/fees/setup", accessToken),
        apiRequest<{ sessions: Session[] }>("/academics/setup", accessToken).then((data) => data.sessions),
      ]);
      setSetup(nextSetup);
      setSessions(nextSessions);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load fees");
    }
  }

  async function loadPayments(query?: string) {
    try {
      const path = query?.trim()
        ? `/fees/payments?query=${encodeURIComponent(query.trim())}`
        : "/fees/payments";
      setPayments(await apiRequest<Payment[]>(path, accessToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load receipts");
    }
  }

  useEffect(() => { void load(); }, [accessToken]);
  useEffect(() => {
    if (tab === "receipts") void loadPayments(receiptSearch);
  }, [tab, accessToken]);

  async function loadStudent(id: string) {
    setStudentId(id);
    if (!id) { setStudentFees(null); return; }
    try {
      setStudentFees(await apiRequest<StudentFees>(`/fees/students/${id}`, accessToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load student fees");
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <PageHeader
        eyebrow="CMS operations"
        title="Fees management"
        description="Configure fees, assign dues, collect partial payments, and manage receipts."
        action={setup?.currentSession && <span className="badge-success">{setup.currentSession.name}</span>}
      />
      {error && <p className="alert-error mt-6">{error}</p>}
      <div className="mt-8 flex flex-wrap gap-2 border-b border-slate-200">
        {([
          ["collect", "Collect fees"],
          ["setup", "Fee setup"],
          ["dues", "Dues"],
          ["reminders", "Reminders"],
          ["receipts", "Receipts"],
        ] as const).map(([item, label]) => (
          <button key={item} className={`tab ${tab === item ? "tab-active" : ""}`} onClick={() => setTab(item)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "collect" && setup && (
        <CollectPanel
          setup={setup}
          students={students}
          studentId={studentId}
          studentFees={studentFees}
          defaultReceiptBookId={defaultReceiptBookId}
          token={accessToken}
          onStudentChange={loadStudent}
          onSaved={async () => {
            if (studentId) await loadStudent(studentId);
            await load();
          }}
          onError={setError}
        />
      )}

      {tab === "setup" && setup && (
        <FeeSetupPanel setup={setup} token={accessToken} onSaved={load} onError={setError} />
      )}

      {tab === "dues" && setup && (
        <DuesPanel
          setup={setup}
          sessions={sessions}
          students={students}
          token={accessToken}
          onSaved={load}
          onError={setError}
        />
      )}

      {tab === "reminders" && setup && (
        <RemindersPanel
          setting={setup.setting}
          token={accessToken}
          onSaved={load}
          onError={setError}
        />
      )}

      {tab === "receipts" && (
        <ReceiptsPanel
          payments={payments}
          search={receiptSearch}
          token={accessToken}
          onSearchChange={setReceiptSearch}
          onSearch={() => void loadPayments(receiptSearch)}
          onRevert={() => void loadPayments(receiptSearch)}
          onError={setError}
        />
      )}
    </main>
  );
}

function CollectPanel({ setup, students, studentId, studentFees, defaultReceiptBookId, token, onStudentChange, onSaved, onError }: {
  setup: FeeSetup;
  students: Student[];
  studentId: string;
  studentFees: StudentFees | null;
  defaultReceiptBookId: string;
  token: string;
  onStudentChange: (id: string) => Promise<void>;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [selected, setSelected] = useState<Record<string, { checked: boolean; amount: string }>>({});
  const [form, setForm] = useState({
    paymentDate: today,
    paymentMode: "CASH" as PaymentMode,
    note: "",
    receiptBookId: defaultReceiptBookId,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!studentFees) { setSelected({}); return; }
    const next: Record<string, { checked: boolean; amount: string }> = {};
    studentFees.assignments.forEach((assignment) => {
      if (assignment.totals.balance > 0) {
        next[assignment.id] = { checked: false, amount: String(assignment.totals.balance) };
      }
    });
    setSelected(next);
  }, [studentFees]);

  useEffect(() => {
    if (defaultReceiptBookId && !form.receiptBookId) {
      setForm((current) => ({ ...current, receiptBookId: defaultReceiptBookId }));
    }
  }, [defaultReceiptBookId, form.receiptBookId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!setup.currentSession || !studentId) return;
    const items = Object.entries(selected)
      .filter(([, value]) => value.checked && Number(value.amount) > 0)
      .map(([assignmentId, value]) => ({ assignmentId, amount: Number(value.amount) }));
    if (!items.length) {
      onError("Select at least one fee assignment with a valid amount");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("/fees/payments", token, {
        method: "POST",
        body: JSON.stringify({
          studentId,
          academicSessionId: setup.currentSession.id,
          paymentDate: form.paymentDate,
          paymentMode: form.paymentMode,
          note: form.note.trim() || null,
          ...(form.receiptBookId ? { receiptBookId: form.receiptBookId } : {}),
          items,
        }),
      });
      setForm((current) => ({ ...current, note: "" }));
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to collect payment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-6">
      <select className="input max-w-lg" value={studentId} onChange={(e) => void onStudentChange(e.target.value)}>
        <option value="">Select student</option>
        {students.map((student) => (
          <option key={student.id} value={student.id}>
            {student.admissionNumber} · {student.firstName} {student.lastName}
          </option>
        ))}
      </select>
      {studentFees && (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-4">
            <Metric label="Assigned" value={studentFees.totals.base} />
            <Metric label="Discount" value={studentFees.totals.discount} />
            <Metric label="Collected" value={studentFees.totals.paid} />
            <Metric label="Balance" value={studentFees.totals.balance} accent />
          </div>
          <form className="card mt-5 overflow-hidden" onSubmit={submit}>
            <div className="divide-y divide-slate-100">
              {studentFees.assignments.map((assignment) => {
                const row = selected[assignment.id];
                if (!row) return null;
                return (
                  <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center" key={assignment.id}>
                    <label className="flex flex-1 items-start gap-3">
                      <input
                        className="mt-1"
                        type="checkbox"
                        checked={row.checked}
                        onChange={(e) =>
                          setSelected({
                            ...selected,
                            [assignment.id]: { ...row, checked: e.target.checked },
                          })
                        }
                      />
                      <span>
                        <span className="font-medium">{assignment.feeMaster.feeType.name}</span>
                        <span className="mt-1 block text-sm text-slate-500">
                          Due {new Date(assignment.feeMaster.dueDate).toLocaleDateString()} ·
                          {" "}Paid {formatMoney(assignment.totals.paid)} · Balance {formatMoney(assignment.totals.balance)}
                        </span>
                      </span>
                    </label>
                    <input
                      className="input w-full sm:max-w-[140px]"
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={assignment.totals.balance}
                      value={row.amount}
                      disabled={!row.checked}
                      onChange={(e) =>
                        setSelected({
                          ...selected,
                          [assignment.id]: { ...row, amount: e.target.value },
                        })
                      }
                    />
                  </div>
                );
              })}
              {!studentFees.assignments.length && (
                <p className="p-8 text-center text-sm text-slate-500">No fees assigned.</p>
              )}
            </div>
            {studentFees.assignments.some((a) => a.totals.balance > 0) && (
              <div className="border-t border-slate-100 p-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <input
                    className="input"
                    type="date"
                    required
                    value={form.paymentDate}
                    onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                  />
                  <select
                    className="input"
                    required
                    value={form.paymentMode}
                    onChange={(e) => setForm({ ...form, paymentMode: e.target.value as PaymentMode })}
                  >
                    {PAYMENT_MODES.map((mode) => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={form.receiptBookId}
                    onChange={(e) => setForm({ ...form, receiptBookId: e.target.value })}
                  >
                    <option value="">Default receipt book</option>
                    {setup.receiptBooks.map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.name} ({book.prefix})
                      </option>
                    ))}
                  </select>
                  <input
                    className="input sm:col-span-2 lg:col-span-1"
                    placeholder="Note (optional)"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                  />
                </div>
                <button className="button-primary mt-4" type="submit" disabled={submitting}>
                  {submitting ? "Collecting…" : "Collect selected fees"}
                </button>
              </div>
            )}
          </form>
        </>
      )}
    </section>
  );
}

function DuesPanel({ setup, sessions, students, token, onSaved, onError }: {
  setup: FeeSetup;
  sessions: Session[];
  students: Student[];
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [sessionId, setSessionId] = useState(setup.currentSession?.id ?? "");
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [carry, setCarry] = useState({
    studentId: "",
    fromSessionId: "",
    toSessionId: setup.currentSession?.id ?? "",
    dueDate: today,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (setup.currentSession?.id && !sessionId) setSessionId(setup.currentSession.id);
  }, [setup.currentSession?.id, sessionId]);

  async function loadSummary(id: string) {
    if (!id) { setSummary(null); return; }
    setLoading(true);
    try {
      setSummary(await apiRequest<FeeSummary>(`/fees/reports/summary?sessionId=${id}`, token));
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load dues summary");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadSummary(sessionId); }, [sessionId, token]);

  async function carryForward(event: FormEvent) {
    event.preventDefault();
    if (!carry.studentId || !carry.fromSessionId || !carry.toSessionId) return;
    setSubmitting(true);
    try {
      const student = await apiRequest<StudentDetail>(`/students/${carry.studentId}`, token);
      const enrollment = student.enrollments.find((item) => item.academicSession.id === carry.toSessionId);
      if (!enrollment) throw new Error("Student is not enrolled in the target session");
      await apiRequest("/fees/carry-forward", token, {
        method: "POST",
        body: JSON.stringify({
          fromSessionId: carry.fromSessionId,
          targetEnrollmentId: enrollment.id,
          dueDate: carry.dueDate,
        }),
      });
      await loadSummary(sessionId);
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to carry forward dues");
    } finally {
      setSubmitting(false);
    }
  }

  const openDues = summary?.dues.filter((item) => item.totals.balance > 0) ?? [];

  return (
    <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_360px]">
      <div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[220px]">
            <span className="text-sm font-medium text-slate-700">Session</span>
            <select
              className="input mt-2"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            >
              <option value="">Select session</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>{session.name}</option>
              ))}
            </select>
          </label>
        </div>
        {summary && (
          <div className="mt-5 grid gap-4 sm:grid-cols-5">
            <Metric label="Assigned" value={summary.totals.assigned} />
            <Metric label="Discounts" value={summary.totals.discounts} />
            <Metric label="Fines" value={summary.totals.fines} />
            <Metric label="Collected" value={summary.totals.collected} />
            <Metric label="Outstanding" value={summary.totals.due} accent />
          </div>
        )}
        <div className="card mt-5 divide-y divide-slate-100 overflow-hidden">
          {loading && <p className="p-8 text-center text-sm text-slate-500">Loading dues…</p>}
          {!loading && openDues.map((due) => (
            <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center" key={due.id}>
              <div>
                <p className="font-medium">
                  {due.student.firstName} {due.student.lastName}
                  <span className="ml-2 text-sm font-normal text-slate-500">{due.student.admissionNumber}</span>
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {due.feeMaster.feeType.name} · Due {new Date(due.feeMaster.dueDate).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatMoney(due.totals.balance)}</p>
                <p className="text-xs text-slate-500">
                  Paid {formatMoney(due.totals.paid)} of {formatMoney(due.totals.base)}
                </p>
              </div>
            </div>
          ))}
          {!loading && !openDues.length && (
            <p className="p-8 text-center text-sm text-slate-500">No outstanding dues for this session.</p>
          )}
        </div>
      </div>
      <form className="card p-5" onSubmit={carryForward}>
        <h2 className="font-semibold">Carry forward previous dues</h2>
        <p className="mt-2 text-sm text-slate-500">
          Move unpaid balance from a prior session into the current enrolment.
        </p>
        <select
          className="input mt-4"
          required
          value={carry.studentId}
          onChange={(e) => setCarry({ ...carry, studentId: e.target.value })}
        >
          <option value="">Select student</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.admissionNumber} · {student.firstName} {student.lastName}
            </option>
          ))}
        </select>
        <select
          className="input mt-3"
          required
          value={carry.fromSessionId}
          onChange={(e) => setCarry({ ...carry, fromSessionId: e.target.value })}
        >
          <option value="">From session</option>
          {sessions.filter((s) => s.id !== carry.toSessionId).map((session) => (
            <option key={session.id} value={session.id}>{session.name}</option>
          ))}
        </select>
        <select
          className="input mt-3"
          required
          value={carry.toSessionId}
          onChange={(e) => setCarry({ ...carry, toSessionId: e.target.value })}
        >
          <option value="">To session</option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>{session.name}</option>
          ))}
        </select>
        <input
          className="input mt-3"
          type="date"
          required
          value={carry.dueDate}
          onChange={(e) => setCarry({ ...carry, dueDate: e.target.value })}
        />
        <button className="button-primary mt-4" type="submit" disabled={submitting}>
          {submitting ? "Processing…" : "Carry forward"}
        </button>
      </form>
    </section>
  );
}

function RemindersPanel({ setting, token, onSaved, onError }: {
  setting?: FeeSetting | null;
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [form, setForm] = useState({
    autoReminder: setting?.autoReminder ?? false,
    reminderDaysBefore: setting?.reminderDaysBefore ?? 3,
    reminderDaysAfter: setting?.reminderDaysAfter ?? 7,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      autoReminder: setting?.autoReminder ?? false,
      reminderDaysBefore: setting?.reminderDaysBefore ?? 3,
      reminderDaysAfter: setting?.reminderDaysAfter ?? 7,
    });
  }, [setting]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiRequest("/fees/reminders", token, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save reminder settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card mt-6 max-w-xl p-5" onSubmit={submit}>
      <h2 className="font-semibold">Fee reminder settings</h2>
      <p className="mt-2 text-sm text-slate-500">
        Configure automated reminders before and after due dates.
      </p>
      <label className="mt-5 flex items-center gap-3">
        <input
          type="checkbox"
          checked={form.autoReminder}
          onChange={(e) => setForm({ ...form, autoReminder: e.target.checked })}
        />
        <span className="text-sm font-medium">Enable automatic fee reminders</span>
      </label>
      <label className="mt-4 block">
        <span className="text-sm font-medium text-slate-700">Days before due date</span>
        <input
          className="input mt-2"
          type="number"
          min="0"
          max="90"
          required
          value={form.reminderDaysBefore}
          onChange={(e) => setForm({ ...form, reminderDaysBefore: Number(e.target.value) })}
        />
      </label>
      <label className="mt-3 block">
        <span className="text-sm font-medium text-slate-700">Days after due date</span>
        <input
          className="input mt-2"
          type="number"
          min="0"
          max="90"
          required
          value={form.reminderDaysAfter}
          onChange={(e) => setForm({ ...form, reminderDaysAfter: Number(e.target.value) })}
        />
      </label>
      <button className="button-primary mt-5" type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save reminder settings"}
      </button>
    </form>
  );
}

function ReceiptsPanel({ payments, search, token, onSearchChange, onSearch, onRevert, onError }: {
  payments: Payment[];
  search: string;
  token: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  onRevert: () => void;
  onError: (message: string) => void;
}) {
  const [revertingId, setRevertingId] = useState<string | null>(null);

  async function revertPayment(id: string) {
    const reason = window.prompt("Reason for reverting this receipt (min 3 characters):");
    if (!reason || reason.trim().length < 3) return;
    setRevertingId(id);
    try {
      await apiRequest(`/fees/payments/${id}/revert`, token, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      onRevert();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to revert payment");
    } finally {
      setRevertingId(null);
    }
  }

  return (
    <section className="mt-6">
      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-md flex-1"
          placeholder="Search receipt, payment ID, or student"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
        />
        <button className="button-secondary" type="button" onClick={onSearch}>Search</button>
      </div>
      <div className="card mt-5 divide-y divide-slate-100 overflow-hidden">
        {payments.map((payment) => (
          <div className="p-5" key={payment.id}>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="font-medium">{payment.receiptNumber}</p>
                <p className="text-sm text-slate-500">
                  {payment.student.firstName} {payment.student.lastName} · {payment.paymentId}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(payment.paymentDate).toLocaleDateString()} · {payment.paymentMode}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <p className="font-semibold">{formatMoney(payment.amount)}</p>
                <span className={payment.status === "COLLECTED" ? "badge-success" : "badge-danger"}>
                  {payment.status}
                </span>
                <Link className="button-secondary text-sm" to={`/print/fees/${payment.id}`} target="_blank">
                  Print
                </Link>
                {payment.status === "COLLECTED" && (
                  <button
                    className="button-secondary text-sm"
                    type="button"
                    disabled={revertingId === payment.id}
                    onClick={() => void revertPayment(payment.id)}
                  >
                    {revertingId === payment.id ? "Reverting…" : "Revert"}
                  </button>
                )}
              </div>
            </div>
            {payment.items.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-xl border">
                {payment.items.map((item) => (
                  <div className="flex justify-between border-b px-4 py-2 text-sm last:border-b-0" key={item.id}>
                    <span>{item.assignment.feeMaster.feeType.name}</span>
                    <span className="font-medium">{formatMoney(item.paidAmount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {!payments.length && (
          <p className="p-8 text-center text-sm text-slate-500">No receipts found.</p>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`card p-5 ${accent ? "border-indigo-200 bg-indigo-50" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold">{formatMoney(value)}</p>
    </div>
  );
}

function FeeSetupPanel({ setup, token, onSaved, onError }: {
  setup: FeeSetup;
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [typeName, setTypeName] = useState("");
  const [group, setGroup] = useState({ name: "", feeTypeId: "" });
  const [master, setMaster] = useState({
    classSectionId: "", feeGroupId: "", feeTypeId: "", amount: "", dueDate: today,
  });
  async function create(path: string, payload: unknown, reset: () => void) {
    try {
      await apiRequest(path, token, { method: "POST", body: JSON.stringify(payload) });
      reset();
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to save fee setup"); }
  }
  async function createMaster(event: FormEvent) {
    event.preventDefault();
    if (!setup.currentSession) return;
    try {
      const result = await apiRequest<{ id: string }>("/fees/masters", token, {
        method: "POST",
        body: JSON.stringify({
          ...master,
          academicSessionId: setup.currentSession.id,
          amount: Number(master.amount),
          fineType: "NONE",
        }),
      });
      await apiRequest(`/fees/masters/${result.id}/assign`, token, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setMaster({ classSectionId: "", feeGroupId: "", feeTypeId: "", amount: "", dueDate: today });
      await onSaved();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Unable to create fee master"); }
  }
  return (
    <section className="mt-6 grid gap-5 xl:grid-cols-3">
      <form className="card p-5" onSubmit={(e) => {
        e.preventDefault();
        void create("/fees/types", { name: typeName }, () => setTypeName(""));
      }}>
        <h2 className="font-semibold">Fee type</h2>
        <input className="input mt-4" placeholder="e.g. Transport Fee" required value={typeName}
          onChange={(e) => setTypeName(e.target.value)} />
        <button className="button-primary mt-4" type="submit">Add type</button>
        <div className="mt-4 flex flex-wrap gap-2">{setup.types.map((item) =>
          <span className="badge" key={item.id}>{item.name}</span>)}</div>
      </form>
      <form className="card p-5" onSubmit={(e) => {
        e.preventDefault();
        void create("/fees/groups", { name: group.name, feeTypeIds: [group.feeTypeId] },
          () => setGroup({ name: "", feeTypeId: "" }));
      }}>
        <h2 className="font-semibold">Fee group</h2>
        <input className="input mt-4" placeholder="Group name" required value={group.name}
          onChange={(e) => setGroup({ ...group, name: e.target.value })} />
        <select className="input mt-3" required value={group.feeTypeId}
          onChange={(e) => setGroup({ ...group, feeTypeId: e.target.value })}>
          <option value="">Select fee type</option>
          {setup.types.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button className="button-primary mt-4" type="submit">Add group</button>
      </form>
      <form className="card p-5 xl:row-span-2" onSubmit={createMaster}>
        <h2 className="font-semibold">Fee master and class assignment</h2>
        <select className="input mt-4" required value={master.classSectionId}
          onChange={(e) => setMaster({ ...master, classSectionId: e.target.value })}>
          <option value="">Class and section</option>
          {setup.classSections.map((item) => <option key={item.id} value={item.id}>
            {item.academicClass.name} · {item.section.name}
          </option>)}
        </select>
        <select className="input mt-3" required value={master.feeGroupId}
          onChange={(e) => setMaster({ ...master, feeGroupId: e.target.value, feeTypeId: "" })}>
          <option value="">Fee group</option>
          {setup.groups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className="input mt-3" required value={master.feeTypeId}
          onChange={(e) => setMaster({ ...master, feeTypeId: e.target.value })}>
          <option value="">Fee type</option>
          {setup.groups.find((item) => item.id === master.feeGroupId)?.items.map(({ feeType }) =>
            <option key={feeType.id} value={feeType.id}>{feeType.name}</option>)}
        </select>
        <input className="input mt-3" type="number" min="0.01" step="0.01" placeholder="Amount" required
          value={master.amount} onChange={(e) => setMaster({ ...master, amount: e.target.value })} />
        <input className="input mt-3" type="date" required value={master.dueDate}
          onChange={(e) => setMaster({ ...master, dueDate: e.target.value })} />
        <button className="button-primary mt-4" type="submit">Create and assign</button>
      </form>
      <div className="card p-5 xl:col-span-2">
        <h2 className="font-semibold">Current fee masters</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {setup.masters.map((item) => <div className="rounded-xl bg-slate-50 p-4" key={item.id}>
            <p className="font-medium">{item.feeType.name}</p>
            <p className="mt-1 text-sm text-slate-500">
              {item.classSection?.academicClass.name} {item.classSection?.section.name} ·
              {" "}{formatMoney(item.amount)} · {item._count.assignments} assigned
            </p>
          </div>)}
        </div>
      </div>
    </section>
  );
}
