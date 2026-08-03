import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AddOutlined,
  ArrowBackOutlined,
  PrintOutlined,
  SearchOutlined,
  UndoOutlined,
} from "@mui/icons-material";
import { InitialsAvatar } from "../../../components/InitialsAvatar";
import { apiRequest, assetUrl } from "../../../lib/api";
import { notifySuccess } from "../../../lib/notify";
import type {
  FeeSetup,
  Payment,
  PaymentMode,
  Student,
  StudentFees,
} from "./types";
import {
  PAYMENT_MODES,
  formatMoney,
  parentContactOf,
  studentDisplayName,
  today,
} from "./utils";

type CollectAssignment = StudentFees["assignments"][number];

export function CollectPanel({
  setup,
  students,
  studentId,
  studentFees,
  defaultReceiptBookId,
  preselectAssignmentIds = [],
  token,
  onStudentChange,
  onSaved,
  onError,
  embedded = false,
}: {
  setup: FeeSetup;
  students: Student[];
  studentId: string;
  studentFees: StudentFees | null;
  defaultReceiptBookId: string;
  preselectAssignmentIds?: string[];
  token: string;
  onStudentChange: (id: string) => Promise<void>;
  onSaved: (payment: Payment) => Promise<void>;
  onError: (message: string) => void;
  /** When true, skip search list and show collect page / student picker only (Receipts flow). */
  embedded?: boolean;
}) {
  const [view, setView] = useState<"search" | "collect">(
    embedded || studentId ? "collect" : "search",
  );
  const [className, setClassName] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [searched, setSearched] = useState(false);
  const [appliedClass, setAppliedClass] = useState("");
  const [appliedSection, setAppliedSection] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");

  const [modalAssignment, setModalAssignment] = useState<CollectAssignment | null>(null);
  const [showMultiModal, setShowMultiModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState({
    paymentDate: today,
    amount: "",
    discountId: "",
    manualDiscount: "",
    fine: "",
    paymentMode: "CASH" as PaymentMode,
    note: "",
    receiptBookId: defaultReceiptBookId,
  });
  const [multiModal, setMultiModal] = useState({
    paymentDate: today,
    discountId: "",
    manualDiscount: "",
    paymentMode: "CASH" as PaymentMode,
    note: "",
    receiptBookId: defaultReceiptBookId,
  });
  const [submitting, setSubmitting] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const classOptions = useMemo(
    () => [...new Set(setup.classSections.map((cs) => cs.academicClass.name))].sort(),
    [setup.classSections],
  );
  const sectionOptions = useMemo(() => {
    const sections = setup.classSections
      .filter((cs) => !className || cs.academicClass.name === className)
      .map((cs) => cs.section.name);
    return [...new Set(sections)].sort();
  }, [setup.classSections, className]);

  const searchedStudents = useMemo(() => {
    if (!searched) return [];
    const list: Array<Student & { classLabel: string; balanceHint: number }> = [];
    const seen = new Set<string>();
    setup.classSections.forEach((cs) => {
      if (appliedClass && cs.academicClass.name !== appliedClass) return;
      if (appliedSection && cs.section.name !== appliedSection) return;
      cs.enrollments.forEach(({ student }) => {
        if (seen.has(student.id)) return;
        seen.add(student.id);
        list.push({
          ...student,
          classLabel: `${cs.academicClass.name} - ${cs.section.name}`,
          balanceHint: 0,
        });
      });
    });
    const q = appliedKeyword.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        studentDisplayName(s).toLowerCase().includes(q) ||
        s.admissionNumber.toLowerCase().includes(q),
    );
  }, [setup.classSections, searched, appliedClass, appliedSection, appliedKeyword]);

  useEffect(() => {
    if (studentId) setView("collect");
  }, [studentId]);

  useEffect(() => {
    if (defaultReceiptBookId) {
      setModal((current) =>
        current.receiptBookId ? current : { ...current, receiptBookId: defaultReceiptBookId },
      );
      setMultiModal((current) =>
        current.receiptBookId ? current : { ...current, receiptBookId: defaultReceiptBookId },
      );
    }
  }, [defaultReceiptBookId]);

  useEffect(() => {
    setSelectedIds({});
    setShowMultiModal(false);
  }, [studentId]);

  const outstandingAssignments = useMemo(
    () => (studentFees?.assignments ?? []).filter((a) => a.totals.balance > 0),
    [studentFees],
  );

  const selectedOutstanding = useMemo(
    () => outstandingAssignments.filter((a) => selectedIds[a.id]),
    [outstandingAssignments, selectedIds],
  );

  const allOutstandingChecked =
    outstandingAssignments.length > 0 &&
    outstandingAssignments.every((a) => selectedIds[a.id]);

  useEffect(() => {
    if (!preselectAssignmentIds.length || !studentFees) return;
    const next: Record<string, boolean> = {};
    for (const id of preselectAssignmentIds) {
      const row = studentFees.assignments.find((a) => a.id === id && a.totals.balance > 0);
      if (row) next[id] = true;
    }
    if (Object.keys(next).length) setSelectedIds((prev) => ({ ...prev, ...next }));
    const target = studentFees.assignments.find(
      (a) => preselectAssignmentIds.includes(a.id) && a.totals.balance > 0,
    );
    if (target && preselectAssignmentIds.length === 1) openCollectModal(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentFees, preselectAssignmentIds]);

  function runSearch() {
    setAppliedClass(className);
    setAppliedSection(sectionName);
    setAppliedKeyword(keyword);
    setSearched(true);
  }

  async function openCollectFor(id: string) {
    await onStudentChange(id);
    setView("collect");
  }

  function openCollectModal(assignment: CollectAssignment) {
    setModalAssignment(assignment);
    setModal({
      paymentDate: today,
      amount: String(assignment.totals.balance),
      discountId: assignment.discount?.id ?? "",
      manualDiscount: "",
      fine: String(assignment.totals.fine || 0),
      paymentMode: "CASH",
      note: "",
      receiptBookId: defaultReceiptBookId,
    });
  }

  async function submitCollect(event: FormEvent) {
    event.preventDefault();
    if (!setup.currentSession || !studentId || !modalAssignment) return;
    const amount = Number(modal.amount);
    if (!(amount > 0)) {
      onError("Enter a valid amount");
      return;
    }
    if (amount > modalAssignment.totals.balance + 0.001) {
      onError("Amount cannot exceed the outstanding balance");
      return;
    }
    setSubmitting(true);
    try {
      if (modal.discountId && modal.discountId !== (modalAssignment.discount?.id ?? "")) {
        await apiRequest(`/fees/assignments/${modalAssignment.id}/discount`, token, {
          method: "PUT",
          body: JSON.stringify({ discountId: modal.discountId || null }),
        });
      }
      const manualDiscount = Number(modal.manualDiscount || 0);
      const fineAmount = Number(modal.fine || 0);
      const payment = await apiRequest<Payment>("/fees/payments", token, {
        method: "POST",
        body: JSON.stringify({
          studentId,
          academicSessionId: setup.currentSession.id,
          paymentDate: modal.paymentDate,
          paymentMode: modal.paymentMode,
          note: modal.note.trim() || null,
          ...(modal.receiptBookId ? { receiptBookId: modal.receiptBookId } : {}),
          items: [
            {
              assignmentId: modalAssignment.id,
              amount,
              ...(manualDiscount > 0 ? { discountAmount: manualDiscount } : {}),
              fineAmount,
            },
          ],
        }),
      });
      setModalAssignment(null);
      notifySuccess("Fees collected");
      await onSaved(payment);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to collect payment");
    } finally {
      setSubmitting(false);
    }
  }

  function openMultiCollect() {
    if (!selectedOutstanding.length) {
      onError("Select at least one fee head");
      return;
    }
    setMultiModal({
      paymentDate: today,
      discountId: "",
      manualDiscount: "",
      paymentMode: "CASH",
      note: "",
      receiptBookId: defaultReceiptBookId,
    });
    setShowMultiModal(true);
  }

  /** Apply a ₹ discount top-to-bottom across selected fee heads. */
  function waterfallDiscount(
    rows: CollectAssignment[],
    discountTotal: number,
  ): Array<{ assignmentId: string; amount: number; discountAmount: number; fineAmount: number }> {
    let remaining = Math.max(0, discountTotal);
    const items: Array<{
      assignmentId: string;
      amount: number;
      discountAmount: number;
      fineAmount: number;
    }> = [];
    for (const row of rows) {
      const applied = Math.min(remaining, row.totals.balance);
      remaining -= applied;
      const amount = Math.max(0, Number((row.totals.balance - applied).toFixed(2)));
      if (amount <= 0) continue;
      items.push({
        assignmentId: row.id,
        amount,
        discountAmount: Number((row.totals.discount + applied).toFixed(2)),
        fineAmount: row.totals.fine,
      });
    }
    return items;
  }

  async function submitMultiCollect(event: FormEvent) {
    event.preventDefault();
    if (!setup.currentSession || !studentId || !selectedOutstanding.length) return;
    setSubmitting(true);
    try {
      if (multiModal.discountId) {
        for (const row of selectedOutstanding) {
          await apiRequest(`/fees/assignments/${row.id}/discount`, token, {
            method: "PUT",
            body: JSON.stringify({ discountId: multiModal.discountId }),
          });
        }
        // Reload balances after discount group is applied.
        await onStudentChange(studentId);
      }

      // Re-read selection from current studentFees after possible reload.
      const latestFees = await apiRequest<StudentFees>(`/fees/students/${studentId}`, token);
      const rows = latestFees.assignments.filter(
        (a) => selectedIds[a.id] && a.totals.balance > 0,
      );
      if (!rows.length) {
        onError("No outstanding balance left on the selected fee heads");
        setShowMultiModal(false);
        return;
      }

      const discountRs = Number(multiModal.manualDiscount || 0);
      const items =
        discountRs > 0
          ? waterfallDiscount(rows, discountRs)
          : rows.map((row) => ({
              assignmentId: row.id,
              amount: row.totals.balance,
              discountAmount: row.totals.discount,
              fineAmount: row.totals.fine,
            }));

      if (!items.length) {
        onError("Discount covers the full selected balance — nothing left to collect");
        return;
      }

      const payment = await apiRequest<Payment>("/fees/payments", token, {
        method: "POST",
        body: JSON.stringify({
          studentId,
          academicSessionId: setup.currentSession.id,
          paymentDate: multiModal.paymentDate,
          paymentMode: multiModal.paymentMode,
          note: multiModal.note.trim() || null,
          ...(multiModal.receiptBookId ? { receiptBookId: multiModal.receiptBookId } : {}),
          items,
        }),
      });
      setShowMultiModal(false);
      setSelectedIds({});
      notifySuccess(`Collected ${items.length} fee head(s) — opening receipt`);
      await onSaved(payment);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to collect selected fees");
    } finally {
      setSubmitting(false);
    }
  }

  async function revertPayment(paymentId: string) {
    const reason = window.prompt("Reason for reverting this fee (min 3 characters):");
    if (!reason || reason.trim().length < 3) return;
    setRevertingId(paymentId);
    try {
      await apiRequest(`/fees/payments/${paymentId}/revert`, token, {
        method: "PUT",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      notifySuccess("Payment reverted");
      if (studentId) await onStudentChange(studentId);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to revert payment");
    } finally {
      setRevertingId(null);
    }
  }

  const classLabel =
    studentFees?.assignments[0]?.enrollment?.classSection
      ? `${studentFees.assignments[0].enrollment.classSection.academicClass.name} - ${studentFees.assignments[0].enrollment.classSection.section.name}`
      : students.find((s) => s.id === studentId)
        ? ""
        : "";

  if (view === "search" && !embedded) {
    return (
      <section className="mt-5 space-y-4">
        <div className="nx-card p-5">
          <h3 className="text-[18px] font-bold text-slate-900">Collect Fees</h3>
          <p className="mt-1 text-[13px] text-slate-500">
            Select class &amp; section (and optional keyword), then click Search.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label>
              <span className="nx-label">Class</span>
              <select
                className="nx-input"
                value={className}
                onChange={(e) => {
                  setClassName(e.target.value);
                  setSectionName("");
                  setSearched(false);
                }}
              >
                <option value="">All classes</option>
                {classOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="nx-label">Section</span>
              <select
                className="nx-input"
                value={sectionName}
                onChange={(e) => {
                  setSectionName(e.target.value);
                  setSearched(false);
                }}
              >
                <option value="">All sections</option>
                {sectionOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="lg:col-span-2">
              <span className="nx-label">Search keyword</span>
              <div className="relative">
                <SearchOutlined
                  sx={{ fontSize: 18 }}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  className="nx-input pl-10"
                  placeholder="Student name or admission number"
                  value={keyword}
                  onChange={(e) => {
                    setKeyword(e.target.value);
                    setSearched(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      runSearch();
                    }
                  }}
                />
              </div>
            </label>
          </div>
          <button type="button" className="nx-btn-primary mt-4" onClick={runSearch}>
            <SearchOutlined sx={{ fontSize: 16 }} />
            Search
          </button>
        </div>

        <div className="nx-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-[17px] font-bold text-slate-900">Students</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="nx-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Admission #</th>
                  <th>Class / Section</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {searchedStudents.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <InitialsAvatar
                          name={studentDisplayName(student)}
                          photoUrl={assetUrl(student.photoUrl)}
                          size={36}
                        />
                        <span className="font-semibold text-slate-900">
                          {studentDisplayName(student)}
                        </span>
                      </div>
                    </td>
                    <td className="font-mono text-[13px] text-slate-600">
                      {student.admissionNumber}
                    </td>
                    <td className="text-slate-600">{student.classLabel}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="nx-btn-primary !py-1.5 !text-[12px]"
                        onClick={() => void openCollectFor(student.id)}
                      >
                        Collect Fees
                      </button>
                    </td>
                  </tr>
                ))}
                {!searched ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-slate-500">
                      Select class &amp; section, then click <strong>Search</strong>.
                    </td>
                  </tr>
                ) : null}
                {searched && !searchedStudents.length ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-slate-500">
                      No students found for these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-5 space-y-4">
      {!setup.receiptBooks.length ? (
        <p className="alert-error">
          No receipt book found. Open Structure Setup → Receipt Books and create one before collecting
          fees.
        </p>
      ) : null}

      {!embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="nx-btn-secondary"
            onClick={() => {
              setView("search");
              void onStudentChange("");
            }}
          >
            <ArrowBackOutlined sx={{ fontSize: 16 }} />
            Back to student search
          </button>
        </div>
      ) : (
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
      )}

      {studentFees ? (
        <>
          <div className="nx-card flex flex-wrap items-center gap-4 p-5">
            <InitialsAvatar
              name={studentDisplayName(studentFees.student)}
              photoUrl={assetUrl(studentFees.student.photoUrl)}
              size={72}
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-[20px] font-bold text-slate-900">
                {studentDisplayName(studentFees.student)}
              </h3>
              <p className="mt-1 text-[13px] text-slate-500">
                {studentFees.student.admissionNumber}
                {classLabel ? ` · ${classLabel}` : ""}
                {parentContactOf(studentFees.student)
                  ? ` · ${parentContactOf(studentFees.student)}`
                  : ""}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Assigned", studentFees.totals.base],
                ["Discount", studentFees.totals.discount],
                ["Collected", studentFees.totals.paid],
                ["Balance", studentFees.totals.balance],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {label}
                  </p>
                  <p className="text-[15px] font-bold text-slate-900">
                    {formatMoney(value as number)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="nx-card overflow-hidden">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-[17px] font-bold text-slate-900">Assigned fees</h3>
                <p className="mt-1 text-[12.5px] text-slate-500">
                  Select multiple fee heads and click Collect selected, or use + for one fee.
                </p>
              </div>
              <button
                type="button"
                className="nx-btn-primary"
                disabled={!selectedOutstanding.length || submitting}
                onClick={openMultiCollect}
              >
                Collect selected ({selectedOutstanding.length})
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="nx-table min-w-[960px]">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input
                        type="checkbox"
                        checked={allOutstandingChecked}
                        disabled={!outstandingAssignments.length}
                        onChange={(e) => {
                          const next: Record<string, boolean> = { ...selectedIds };
                          outstandingAssignments.forEach((a) => {
                            next[a.id] = e.target.checked;
                          });
                          setSelectedIds(next);
                        }}
                      />
                    </th>
                    <th>Fee Type</th>
                    <th>Group</th>
                    <th>Due Date</th>
                    <th>Base</th>
                    <th>Discount</th>
                    <th>Fine</th>
                    <th>Paid</th>
                    <th>Balance</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {studentFees.assignments.map((assignment) => {
                    const latestPayment = [...(assignment.paymentItems ?? [])]
                      .filter((item) => item.payment.status === "COLLECTED")
                      .sort((a, b) =>
                        b.payment.paymentDate.localeCompare(a.payment.paymentDate),
                      )[0];
                    const hasBalance = assignment.totals.balance > 0;
                    return (
                      <tr key={assignment.id}>
                        <td>
                          {hasBalance ? (
                            <input
                              type="checkbox"
                              checked={!!selectedIds[assignment.id]}
                              onChange={(e) =>
                                setSelectedIds({
                                  ...selectedIds,
                                  [assignment.id]: e.target.checked,
                                })
                              }
                            />
                          ) : (
                            <span className="inline-block w-4" />
                          )}
                        </td>
                        <td className="font-semibold text-slate-900">
                          {assignment.feeMaster.feeType.name}
                        </td>
                        <td className="text-slate-600">
                          {assignment.feeMaster.feeGroup?.name ?? "—"}
                        </td>
                        <td className="text-slate-600">
                          {assignment.feeMaster.dueDate.slice(0, 10)}
                        </td>
                        <td>{formatMoney(assignment.totals.base)}</td>
                        <td>{formatMoney(assignment.totals.discount)}</td>
                        <td>{formatMoney(assignment.totals.fine)}</td>
                        <td>{formatMoney(assignment.totals.paid)}</td>
                        <td className="font-semibold text-slate-900">
                          {formatMoney(assignment.totals.balance)}
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            {hasBalance ? (
                              <button
                                type="button"
                                className="rounded-md bg-indigo-50 p-1.5 text-indigo-600 hover:bg-indigo-100"
                                title="Collect fees"
                                onClick={() => openCollectModal(assignment)}
                              >
                                <AddOutlined sx={{ fontSize: 18 }} />
                              </button>
                            ) : null}
                            {latestPayment ? (
                              <>
                                <button
                                  type="button"
                                  className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                                  title="Revert"
                                  disabled={revertingId === latestPayment.payment.id}
                                  onClick={() => void revertPayment(latestPayment.payment.id)}
                                >
                                  <UndoOutlined sx={{ fontSize: 18 }} />
                                </button>
                                <Link
                                  to={`/print/fees/${latestPayment.payment.id}`}
                                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
                                  title="Print receipt"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <PrintOutlined sx={{ fontSize: 18 }} />
                                </Link>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!studentFees.assignments.length ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-12 text-center text-slate-500">
                        No fees assigned to this student yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : studentId ? (
        <p className="text-sm text-slate-500">Loading student fees…</p>
      ) : embedded ? (
        <p className="text-sm text-slate-500">Select a student to collect fees.</p>
      ) : null}

      {modalAssignment ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => !submitting && setModalAssignment(null)}
        >
          <form
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void submitCollect(e)}
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-[18px] font-bold text-slate-900">Collect Fees</h3>
              <p className="mt-1 text-[13px] text-slate-500">
                {modalAssignment.feeMaster.feeType.name} · Balance{" "}
                {formatMoney(modalAssignment.totals.balance)}
              </p>
            </div>
            <div className="space-y-3 px-5 py-4">
              <label>
                <span className="nx-label">Date</span>
                <input
                  className="nx-input"
                  type="date"
                  required
                  value={modal.paymentDate}
                  onChange={(e) => setModal({ ...modal, paymentDate: e.target.value })}
                />
              </label>
              <label>
                <span className="nx-label">Amount (₹) — partial allowed</span>
                <input
                  className="nx-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={modalAssignment.totals.balance}
                  required
                  value={modal.amount}
                  onChange={(e) => setModal({ ...modal, amount: e.target.value })}
                />
              </label>
              <label>
                <span className="nx-label">Discount Group</span>
                <select
                  className="nx-input"
                  value={modal.discountId}
                  onChange={(e) => setModal({ ...modal, discountId: e.target.value })}
                >
                  <option value="">None</option>
                  {setup.discounts
                    .filter((d) => d.isActive !== false)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} (
                        {d.type === "PERCENTAGE"
                          ? `${Number(d.value)}%`
                          : formatMoney(d.value)}
                        )
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span className="nx-label">Discount (₹) — optional</span>
                <input
                  className="nx-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={modal.manualDiscount}
                  onChange={(e) => setModal({ ...modal, manualDiscount: e.target.value })}
                />
              </label>
              <label>
                <span className="nx-label">Fine (₹)</span>
                <input
                  className="nx-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={modal.fine}
                  onChange={(e) => setModal({ ...modal, fine: e.target.value })}
                />
              </label>
              <label>
                <span className="nx-label">Payment Mode</span>
                <select
                  className="nx-input"
                  required
                  value={modal.paymentMode}
                  onChange={(e) =>
                    setModal({ ...modal, paymentMode: e.target.value as PaymentMode })
                  }
                >
                  {PAYMENT_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="nx-label">Receipt book</span>
                <select
                  className="nx-input"
                  value={modal.receiptBookId}
                  onChange={(e) => setModal({ ...modal, receiptBookId: e.target.value })}
                >
                  <option value="">Default</option>
                  {setup.receiptBooks.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="nx-label">Note</span>
                <input
                  className="nx-input"
                  placeholder="Optional note"
                  value={modal.note}
                  onChange={(e) => setModal({ ...modal, note: e.target.value })}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                className="nx-btn-secondary"
                disabled={submitting}
                onClick={() => setModalAssignment(null)}
              >
                Cancel
              </button>
              <button type="submit" className="nx-btn-primary" disabled={submitting}>
                {submitting ? "Collecting…" : "Collect Fees"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {showMultiModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => !submitting && setShowMultiModal(false)}
        >
          <form
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => void submitMultiCollect(e)}
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-[18px] font-bold text-slate-900">Collect selected fees</h3>
              <p className="mt-1 text-[13px] text-slate-500">
                {selectedOutstanding.length} fee head(s) · Total balance{" "}
                {formatMoney(
                  selectedOutstanding.reduce((sum, row) => sum + row.totals.balance, 0),
                )}
              </p>
            </div>
            <div className="space-y-3 px-5 py-4">
              <ul className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-700">
                {selectedOutstanding.map((row) => (
                  <li key={row.id} className="flex justify-between gap-3">
                    <span>{row.feeMaster.feeType.name}</span>
                    <span className="font-semibold">{formatMoney(row.totals.balance)}</span>
                  </li>
                ))}
              </ul>
              <label>
                <span className="nx-label">Date</span>
                <input
                  className="nx-input"
                  type="date"
                  required
                  value={multiModal.paymentDate}
                  onChange={(e) => setMultiModal({ ...multiModal, paymentDate: e.target.value })}
                />
              </label>
              <label>
                <span className="nx-label">Discount Group (applied to all selected)</span>
                <select
                  className="nx-input"
                  value={multiModal.discountId}
                  onChange={(e) => setMultiModal({ ...multiModal, discountId: e.target.value })}
                >
                  <option value="">None</option>
                  {setup.discounts
                    .filter((d) => d.isActive !== false)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} (
                        {d.type === "PERCENTAGE"
                          ? `${Number(d.value)}%`
                          : formatMoney(d.value)}
                        )
                      </option>
                    ))}
                </select>
              </label>
              <label>
                <span className="nx-label">Discount (₹) — applied top to bottom</span>
                <input
                  className="nx-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={multiModal.manualDiscount}
                  onChange={(e) =>
                    setMultiModal({ ...multiModal, manualDiscount: e.target.value })
                  }
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Discount is applied from the first selected fee downward until used up.
                </p>
              </label>
              <label>
                <span className="nx-label">Payment Mode</span>
                <select
                  className="nx-input"
                  required
                  value={multiModal.paymentMode}
                  onChange={(e) =>
                    setMultiModal({
                      ...multiModal,
                      paymentMode: e.target.value as PaymentMode,
                    })
                  }
                >
                  {PAYMENT_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="nx-label">Note</span>
                <input
                  className="nx-input"
                  placeholder="Optional note"
                  value={multiModal.note}
                  onChange={(e) => setMultiModal({ ...multiModal, note: e.target.value })}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                className="nx-btn-secondary"
                disabled={submitting}
                onClick={() => setShowMultiModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className="nx-btn-primary" disabled={submitting}>
                {submitting ? "Collecting…" : "Collect selected"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
