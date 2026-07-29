import { useEffect, useMemo, useState } from "react";
import {
  CloseOutlined,
  CreditCardOutlined,
  DescriptionOutlined,
  SearchOutlined,
  TaskAltOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";
import { InitialsAvatar } from "../../../components/InitialsAvatar";
import { ListPagination, paginateItems } from "../../../components/ListPagination";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";
import type { FeeSetup, Student, StudentFees } from "./types";
import { downloadCsv, formatMoney, studentDisplayName, today } from "./utils";

type InvoiceFilter = "all" | "pending" | "settled" | "overdue";
type InvoiceStatus = "DUE" | "PAID" | "OVERDUE" | "CANCELLED";
type Invoice = {
  id: string;
  invoiceNumber: string;
  dueDate: string;
  status: InvoiceStatus;
  total: string;
  paidAmount: string;
  student: Student;
  items: Array<{ description: string }>;
};

const PAGE_SIZE = 8;

function statusPill(status: InvoiceStatus) {
  if (status === "PAID") return "nx-pill nx-pill-success";
  if (status === "OVERDUE") return "nx-pill nx-pill-danger";
  if (status === "CANCELLED") return "nx-pill nx-pill-neutral";
  return "nx-pill nx-pill-warning";
}

function filterTabClass(active: boolean) {
  return active
    ? "border-b-2 border-[#6366f1] pb-1 text-[#6366f1]"
    : "pb-1 text-slate-500 hover:text-slate-800";
}

export function FeeInvoicesPanel({
  setup,
  token,
  openCreateSignal = 0,
  exportSignal = 0,
}: {
  setup: FeeSetup;
  token: string;
  openCreateSignal?: number;
  exportSignal?: number;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<InvoiceFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [studentFees, setStudentFees] = useState<StudentFees | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [dueDate, setDueDate] = useState(today);
  const [saving, setSaving] = useState(false);

  const students = useMemo(() => {
    const map = new Map<string, Student>();
    setup.classSections.forEach((section) =>
      section.enrollments.forEach(({ student }) => map.set(student.id, student)),
    );
    return [...map.values()].sort((a, b) =>
      studentDisplayName(a).localeCompare(studentDisplayName(b)),
    );
  }, [setup.classSections]);

  async function loadInvoices() {
    if (!setup.currentSession?.id) return;
    try {
      setInvoices(
        await apiRequest<Invoice[]>(
          `/fees/invoices?academicSessionId=${encodeURIComponent(setup.currentSession.id)}`,
          token,
        ),
      );
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load invoices");
    }
  }

  useEffect(() => {
    void loadInvoices();
  }, [setup.currentSession?.id, token]);

  useEffect(() => {
    if (openCreateSignal) setShowCreate(true);
  }, [openCreateSignal]);

  useEffect(() => {
    if (!exportSignal) return;
    downloadCsv(
      "fee-invoices.csv",
      ["invoiceNumber", "student", "amount", "paid", "dueDate", "status"],
      invoices.map((invoice) => [
        invoice.invoiceNumber,
        studentDisplayName(invoice.student),
        invoice.total,
        invoice.paidAmount,
        invoice.dueDate.slice(0, 10),
        invoice.status,
      ]),
    );
  }, [exportSignal]);

  async function chooseStudent(id: string) {
    setStudentId(id);
    setSelected({});
    if (!id || !setup.currentSession?.id) {
      setStudentFees(null);
      return;
    }
    try {
      const fees = await apiRequest<StudentFees>(
        `/fees/students/${id}?sessionId=${encodeURIComponent(setup.currentSession.id)}`,
        token,
      );
      setStudentFees(fees);
      setSelected(
        Object.fromEntries(
          fees.assignments
            .filter((assignment) => assignment.totals.balance > 0)
            .map((assignment) => [assignment.id, true]),
        ),
      );
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load student fees");
    }
  }

  async function createInvoice() {
    const assignmentIds = Object.entries(selected)
      .filter(([, checked]) => checked)
      .map(([id]) => id);
    if (!studentId || !setup.currentSession?.id || !assignmentIds.length) {
      notifyError("Select a student and at least one outstanding fee");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/fees/invoices", token, {
        method: "POST",
        body: JSON.stringify({
          studentId,
          academicSessionId: setup.currentSession.id,
          dueDate,
          assignmentIds,
        }),
      });
      notifySuccess("Invoice generated");
      setShowCreate(false);
      setStudentId("");
      setStudentFees(null);
      await loadInvoices();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to generate invoice");
    } finally {
      setSaving(false);
    }
  }

  async function cancelInvoice(id: string) {
    try {
      await apiRequest(`/fees/invoices/${id}/status`, token, {
        method: "PUT",
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      notifySuccess("Invoice cancelled");
      await loadInvoices();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to cancel invoice");
    }
  }

  const query = search.trim().toLowerCase();
  const filteredRows = useMemo(
    () =>
      invoices.filter((invoice) => {
        if (filter === "pending" && invoice.status !== "DUE") return false;
        if (filter === "settled" && invoice.status !== "PAID") return false;
        if (filter === "overdue" && invoice.status !== "OVERDUE") return false;
        if (!query) return true;
        return [
          invoice.invoiceNumber,
          studentDisplayName(invoice.student),
          ...invoice.items.map((item) => item.description),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      }),
    [invoices, filter, query],
  );

  useEffect(() => setPage(1), [filter, search]);

  const overdueCount = invoices.filter((invoice) => invoice.status === "OVERDUE").length;
  const settledCount = invoices.filter((invoice) => invoice.status === "PAID").length;
  const paidRate = invoices.length ? (settledCount / invoices.length) * 100 : 0;
  const receivables = invoices
    .filter((invoice) => invoice.status === "DUE" || invoice.status === "OVERDUE")
    .reduce(
      (sum, invoice) =>
        sum + Math.max(0, Number(invoice.total) - Number(invoice.paidAmount)),
      0,
    );
  const pageRows = paginateItems(filteredRows, page, PAGE_SIZE);

  return (
    <section className="mt-5 space-y-4">
      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Generate Invoice</h3>
                <p className="text-sm text-slate-500">Select a student and outstanding fees.</p>
              </div>
              <button type="button" onClick={() => setShowCreate(false)}>
                <CloseOutlined />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto p-5">
              <label>
                <span className="nx-label">Student</span>
                <select
                  className="nx-input"
                  value={studentId}
                  onChange={(event) => void chooseStudent(event.target.value)}
                >
                  <option value="">Select student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {studentDisplayName(student)} · {student.admissionNumber}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="nx-label">Invoice Due Date</span>
                <input
                  className="nx-input"
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </label>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="nx-table w-full">
                  <thead>
                    <tr>
                      <th className="w-10">Include</th>
                      <th>Fee</th>
                      <th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(studentFees?.assignments ?? [])
                      .filter((assignment) => assignment.totals.balance > 0)
                      .map((assignment) => (
                        <tr key={assignment.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={!!selected[assignment.id]}
                              onChange={(event) =>
                                setSelected({
                                  ...selected,
                                  [assignment.id]: event.target.checked,
                                })
                              }
                            />
                          </td>
                          <td>{assignment.feeMaster.feeType.name}</td>
                          <td className="text-right font-semibold">
                            {formatMoney(assignment.totals.balance)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="border-t border-slate-100 px-5 py-3 text-right">
              <button
                type="button"
                className="nx-btn-primary"
                disabled={saving}
                onClick={() => void createInvoice()}
              >
                {saving ? "Generating…" : "Generate Invoice"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-4">
        {[
          ["Total Receivables", formatMoney(receivables), <CreditCardOutlined />],
          ["Invoices Generated", invoices.length.toLocaleString(), <DescriptionOutlined />],
          ["Paid Rate %", `${paidRate.toFixed(1)}%`, <TaskAltOutlined />],
          ["Overdue Count", overdueCount.toLocaleString(), <WarningAmberOutlined />],
        ].map(([label, value, icon]) => (
          <article className="nx-card flex items-start justify-between gap-3 p-4" key={String(label)}>
            <div>
              <p className="text-[12px] font-semibold text-slate-500">{label}</p>
              <p className="mt-1 text-[30px] font-bold leading-none text-slate-900">{value}</p>
            </div>
            <div className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
              {icon}
            </div>
          </article>
        ))}
      </div>

      <div className="nx-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-5 text-[13px] font-semibold">
            {(
              [
                ["all", "All Invoices"],
                ["pending", "Pending"],
                ["settled", "Settled"],
                ["overdue", "Overdue"],
              ] as Array<[InvoiceFilter, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={filterTabClass(filter === key)}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative w-full max-w-sm">
            <SearchOutlined
              sx={{ fontSize: 16 }}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="nx-input pl-9"
              placeholder="Search student or INV#..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="nx-table min-w-[980px]">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Student Name</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="font-mono text-[12px] font-semibold text-indigo-700">
                    {invoice.invoiceNumber}
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <InitialsAvatar name={studentDisplayName(invoice.student)} size={34} />
                      <span className="font-semibold text-slate-900">
                        {studentDisplayName(invoice.student)}
                      </span>
                    </div>
                  </td>
                  <td className="text-slate-600">
                    {invoice.items.map((item) => item.description).join(", ")}
                  </td>
                  <td className="font-semibold text-slate-900">{formatMoney(invoice.total)}</td>
                  <td className="text-slate-600">
                    {new Date(invoice.dueDate).toLocaleDateString()}
                  </td>
                  <td>
                    <span className={statusPill(invoice.status)}>
                      {invoice.status[0] + invoice.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="text-right">
                    {invoice.status === "DUE" || invoice.status === "OVERDUE" ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-600 hover:underline"
                        onClick={() => void cancelInvoice(invoice.id)}
                      >
                        Cancel
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {!filteredRows.length ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    No invoices match the selected filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <ListPagination
          page={page}
          pageSize={PAGE_SIZE}
          total={filteredRows.length}
          onPageChange={setPage}
          label="invoices"
        />
      </div>
    </section>
  );
}
