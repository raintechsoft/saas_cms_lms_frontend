import { useEffect, useState, type FormEvent } from "react";
import type { FeeSetup, PaymentMode, Student, StudentFees } from "./types";
import { PAYMENT_MODES, formatMoney, studentDisplayName, today } from "./utils";
import { apiRequest } from "../../../lib/api";

export function CollectPanel({
  setup,
  students,
  studentId,
  studentFees,
  defaultReceiptBookId,
  token,
  onStudentChange,
  onSaved,
  onError,
}: {
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
    if (!studentFees) {
      setSelected({});
      return;
    }
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
    <section className="space-y-4">
      {!setup.receiptBooks.length ? (
        <p className="alert-error">
          No receipt book found. Open Custom Fees and create a receipt book before collecting fees.
        </p>
      ) : null}

      <div className="nx-card p-4">
        <label className="nx-label" htmlFor="collect-student">
          Select student
        </label>
        <select
          id="collect-student"
          className="nx-input max-w-lg"
          value={studentId}
          onChange={(e) => void onStudentChange(e.target.value)}
        >
          <option value="">Choose a student to collect fees</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.admissionNumber} · {studentDisplayName(student)}
            </option>
          ))}
        </select>
      </div>

      {studentFees ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Assigned", studentFees.totals.base],
              ["Discount", studentFees.totals.discount],
              ["Collected", studentFees.totals.paid],
              ["Balance", studentFees.totals.balance],
            ].map(([label, value]) => (
              <div className="nx-kpi-card" key={label}>
                <p className="nx-kpi-label">{label}</p>
                <p className="nx-kpi-value">{formatMoney(value as number)}</p>
              </div>
            ))}
          </div>

          <form className="nx-card overflow-hidden" onSubmit={submit}>
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Outstanding assignments</h3>
              <p className="text-[12px] text-slate-500">
                Select fees and enter the amount to collect for {studentDisplayName(studentFees.student)}.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {studentFees.assignments.map((assignment) => {
                const row = selected[assignment.id];
                if (!row) return null;
                return (
                  <div
                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center"
                    key={assignment.id}
                  >
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
                        <span className="font-semibold text-slate-900">
                          {assignment.feeMaster.feeType.name}
                        </span>
                        <span className="mt-1 block text-[12px] text-slate-500">
                          Due {new Date(assignment.feeMaster.dueDate).toLocaleDateString()} · Paid{" "}
                          {formatMoney(assignment.totals.paid)} · Balance{" "}
                          {formatMoney(assignment.totals.balance)}
                        </span>
                      </span>
                    </label>
                    <input
                      className="nx-input w-full sm:max-w-[140px]"
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
              {!studentFees.assignments.some((a) => a.totals.balance > 0) ? (
                <p className="p-8 text-center text-sm text-slate-500">No outstanding fees for this student.</p>
              ) : null}
            </div>

            {studentFees.assignments.some((a) => a.totals.balance > 0) ? (
              <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="nx-label">Payment date</label>
                    <input
                      className="nx-input"
                      type="date"
                      required
                      value={form.paymentDate}
                      onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="nx-label">Payment mode</label>
                    <select
                      className="nx-input"
                      required
                      value={form.paymentMode}
                      onChange={(e) =>
                        setForm({ ...form, paymentMode: e.target.value as PaymentMode })
                      }
                    >
                      {PAYMENT_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="nx-label">Receipt book</label>
                    <select
                      className="nx-input"
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
                  </div>
                  <div>
                    <label className="nx-label">Note</label>
                    <input
                      className="nx-input"
                      placeholder="Optional note"
                      value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                    />
                  </div>
                </div>
                <button className="nx-btn-primary mt-4" type="submit" disabled={submitting}>
                  {submitting ? "Collecting…" : "Collect selected fees"}
                </button>
              </div>
            ) : null}
          </form>
        </>
      ) : null}
    </section>
  );
}
