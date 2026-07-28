import { useEffect, useMemo, useState } from "react";
import {
  CreditCardOutlined,
  DescriptionOutlined,
  MoreHorizOutlined,
  SearchOutlined,
  TaskAltOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";
import { InitialsAvatar } from "../../../components/InitialsAvatar";
import { ListPagination, paginateItems } from "../../../components/ListPagination";
import type { FeeSummary, Payment } from "./types";
import { formatMoney, overdueDays, studentDisplayName } from "./utils";

type InvoiceFilter = "all" | "pending" | "settled" | "overdue";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  studentName: string;
  category: string;
  amount: number;
  dueDate: string;
  status: "Paid" | "Due" | "Overdue" | "Cancelled";
};

const PAGE_SIZE = 8;

function paymentToRow(payment: Payment): InvoiceRow {
  if (payment.status === "REVERTED") {
    return {
      id: payment.id,
      invoiceNumber: payment.receiptNumber,
      studentName: studentDisplayName(payment.student),
      category: payment.items[0]?.assignment.feeMaster.feeType.name ?? "Tuition Fee",
      amount: Number(payment.amount),
      dueDate: payment.paymentDate.slice(0, 10),
      status: "Cancelled",
    };
  }
  return {
    id: payment.id,
    invoiceNumber: payment.receiptNumber,
    studentName: studentDisplayName(payment.student),
    category: payment.items[0]?.assignment.feeMaster.feeType.name ?? "Tuition Fee",
    amount: Number(payment.amount),
    dueDate: payment.paymentDate.slice(0, 10),
    status: payment.status === "COLLECTED" ? "Paid" : "Due",
  };
}

function statusPill(status: InvoiceRow["status"]) {
  if (status === "Paid") return "nx-pill nx-pill-success";
  if (status === "Overdue") return "nx-pill nx-pill-danger";
  if (status === "Cancelled") return "nx-pill nx-pill-neutral";
  return "nx-pill nx-pill-warning";
}

function filterTabClass(active: boolean) {
  return active
    ? "border-b-2 border-[#6366f1] pb-1 text-[#6366f1]"
    : "pb-1 text-slate-500 hover:text-slate-800";
}

export function FeeInvoicesPanel({
  payments,
  summary,
  search,
  onSearchChange,
}: {
  payments: Payment[];
  summary: FeeSummary | null;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const [filter, setFilter] = useState<InvoiceFilter>("all");
  const [page, setPage] = useState(1);

  const allRows = useMemo(() => {
    const paymentRows = payments.map(paymentToRow);
    const dueRows: InvoiceRow[] = (summary?.dues ?? [])
      .filter((due) => due.totals.balance > 0)
      .map((due) => {
        const days = overdueDays(due.feeMaster.dueDate);
        return {
          id: `due-${due.id}`,
          invoiceNumber: `DUE-${due.id.slice(-6).toUpperCase()}`,
          studentName: studentDisplayName(due.student),
          category: due.feeMaster.feeType.name,
          amount: due.totals.balance,
          dueDate: due.feeMaster.dueDate.slice(0, 10),
          status: days > 0 ? ("Overdue" as const) : ("Due" as const),
        };
      });
    return [...paymentRows, ...dueRows];
  }, [payments, summary]);

  const query = search.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      if (filter === "pending" && row.status !== "Due") return false;
      if (filter === "settled" && row.status !== "Paid") return false;
      if (filter === "overdue" && row.status !== "Overdue") return false;
      if (!query) return true;
      const haystack = [row.invoiceNumber, row.studentName, row.category, row.status]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [allRows, filter, query]);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
    if (page > maxPage) setPage(maxPage);
  }, [filteredRows.length, page]);

  const overdueCount = allRows.filter((row) => row.status === "Overdue").length;
  const settledCount = allRows.filter((row) => row.status === "Paid").length;
  const paidRate = allRows.length ? (settledCount / allRows.length) * 100 : 0;
  const pageRows = paginateItems(filteredRows, page, PAGE_SIZE);

  return (
    <section className="mt-5 space-y-4">
      <div className="grid gap-3 lg:grid-cols-4">
        <article className="nx-card flex items-start justify-between gap-3 p-4">
          <div>
            <p className="text-[12px] font-semibold text-slate-500">Total Receivables</p>
            <p className="mt-1 text-[34px] font-bold leading-none text-slate-900">
              {formatMoney(summary?.totals.due ?? 0)}
            </p>
          </div>
          <div className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-[#6366f1]">
            <CreditCardOutlined sx={{ fontSize: 22 }} />
          </div>
        </article>
        <article className="nx-card flex items-start justify-between gap-3 p-4">
          <div>
            <p className="text-[12px] font-semibold text-slate-500">Invoices Generated</p>
            <p className="mt-1 text-[34px] font-bold leading-none text-slate-900">{allRows.length}</p>
          </div>
          <div className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-600">
            <DescriptionOutlined sx={{ fontSize: 22 }} />
          </div>
        </article>
        <article className="nx-card flex items-start justify-between gap-3 p-4">
          <div>
            <p className="text-[12px] font-semibold text-slate-500">Paid Rate %</p>
            <p className="mt-1 text-[34px] font-bold leading-none text-slate-900">{paidRate.toFixed(1)}%</p>
          </div>
          <div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <TaskAltOutlined sx={{ fontSize: 22 }} />
          </div>
        </article>
        <article className="nx-card flex items-start justify-between gap-3 border-rose-100 bg-rose-50/40 p-4">
          <div>
            <p className="text-[12px] font-semibold text-rose-600">Overdue Count</p>
            <p className="mt-1 text-[34px] font-bold leading-none text-rose-600">{overdueCount}</p>
          </div>
          <div className="grid size-10 place-items-center rounded-xl bg-rose-100 text-rose-600">
            <WarningAmberOutlined sx={{ fontSize: 24 }} />
          </div>
        </article>
      </div>

      <div className="nx-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-5 text-[13px] font-semibold">
            <button type="button" className={filterTabClass(filter === "all")} onClick={() => setFilter("all")}>
              All Invoices
            </button>
            <button type="button" className={filterTabClass(filter === "pending")} onClick={() => setFilter("pending")}>
              Pending
            </button>
            <button type="button" className={filterTabClass(filter === "settled")} onClick={() => setFilter("settled")}>
              Settled
            </button>
            <button type="button" className={filterTabClass(filter === "overdue")} onClick={() => setFilter("overdue")}>
              Overdue
            </button>
          </div>
          <div className="relative w-full max-w-sm">
            <SearchOutlined
              sx={{ fontSize: 16 }}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="nx-input pl-9"
              placeholder="Search student or invoice..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
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
              {pageRows.map((item) => (
                <tr key={item.id}>
                  <td className="font-semibold text-indigo-600">{item.invoiceNumber}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <InitialsAvatar name={item.studentName} className="size-8 text-[10px]" />
                      <span className="font-medium text-slate-900">{item.studentName}</span>
                    </div>
                  </td>
                  <td className="text-slate-600">{item.category}</td>
                  <td className="font-semibold text-slate-900">{formatMoney(item.amount)}</td>
                  <td className="text-slate-500">{item.dueDate}</td>
                  <td>
                    <span className={statusPill(item.status)}>{item.status}</span>
                  </td>
                  <td className="text-right">
                    <button type="button" className="rounded p-1.5 text-slate-400 hover:bg-slate-100">
                      <MoreHorizOutlined sx={{ fontSize: 18 }} />
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredRows.length ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    No {filter === "all" ? "" : `${filter} `}invoices found.
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
