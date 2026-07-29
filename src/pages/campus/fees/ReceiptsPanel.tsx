import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarMonthOutlined,
  FilterListOutlined,
  MoreVert,
  SearchOutlined,
} from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import { notifySuccess } from "../../../lib/notify";
import type { Payment } from "./types";
import { formatMoney, studentDisplayName } from "./utils";

const PAGE_SIZE = 5;

export function ReceiptsPanel({
  payments,
  search,
  token,
  onSearchChange,
  onSearch,
  onRevert,
  onError,
  onCollectClick,
}: {
  payments: Payment[];
  search: string;
  token: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  onRevert: () => void;
  onError: (message: string) => void;
  onCollectClick?: () => void;
}) {
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return payments.filter((payment) => {
      if (status === "active" && payment.status !== "COLLECTED") return false;
      if (status === "cancelled" && payment.status !== "REVERTED") return false;
      const d = payment.paymentDate.slice(0, 10);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }, [payments, status, fromDate, toDate]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function revertPayment(id: string) {
    const reason = window.prompt("Reason for reverting this receipt (min 3 characters):");
    if (!reason || reason.trim().length < 3) return;
    setRevertingId(id);
    setMenuId(null);
    try {
      await apiRequest(`/fees/payments/${id}/revert`, token, {
        method: "PUT",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      notifySuccess("Payment reverted");
      onRevert();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to revert payment");
    } finally {
      setRevertingId(null);
    }
  }

  function resetFilters() {
    onSearchChange("");
    setStatus("");
    setFromDate("");
    setToDate("");
    setPage(1);
    onSearch();
  }

  return (
    <section className="mt-5 space-y-4">
      <div className="nx-card p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <label className="min-w-0 flex-1">
            <span className="nx-label">Search Receipts</span>
            <div className="relative">
              <SearchOutlined
                sx={{ fontSize: 18 }}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className="nx-input pl-10"
                placeholder="Receipt No or Name"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
              />
            </div>
          </label>
          <label>
            <span className="nx-label">From</span>
            <div className="relative">
              <CalendarMonthOutlined
                sx={{ fontSize: 16 }}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className="nx-input pl-9"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
          </label>
          <label>
            <span className="nx-label">To</span>
            <input
              className="nx-input"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>
          <label>
            <span className="nx-label">Status</span>
            <select className="nx-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <button type="button" className="nx-btn-primary" onClick={() => { setPage(1); onSearch(); }}>
            <FilterListOutlined sx={{ fontSize: 16 }} />
            Filter
          </button>
          <button type="button" className="text-sm font-semibold text-slate-500 hover:text-indigo-600" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </div>

      <div className="nx-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h3 className="font-semibold text-slate-900">Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="nx-table min-w-[900px]">
            <thead>
              <tr>
                <th>Receipt No</th>
                <th>Student Name</th>
                <th>Amount</th>
                <th>Date Generated</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((payment) => (
                <tr key={payment.id}>
                  <td className="font-mono text-[12px] font-semibold text-slate-700">
                    {payment.receiptNumber}
                  </td>
                  <td className="font-medium text-slate-800">
                    {studentDisplayName(payment.student)}
                  </td>
                  <td className="font-semibold text-slate-900">{formatMoney(payment.amount)}</td>
                  <td className="text-slate-600">
                    {new Date(payment.paymentDate).toLocaleDateString(undefined, {
                      month: "short",
                      day: "2-digit",
                      year: "numeric",
                    })}
                  </td>
                  <td>
                    <span
                      className={
                        payment.status === "COLLECTED"
                          ? "nx-pill nx-pill-indigo"
                          : "nx-pill nx-pill-danger"
                      }
                    >
                      {payment.status === "COLLECTED" ? "Active" : "Cancelled"}
                    </span>
                  </td>
                  <td className="relative text-right">
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      onClick={() => setMenuId(menuId === payment.id ? null : payment.id)}
                    >
                      <MoreVert sx={{ fontSize: 18 }} />
                    </button>
                    {menuId === payment.id ? (
                      <div className="absolute right-4 z-10 mt-1 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                        <Link
                          className="block px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          to={`/print/fees/${payment.id}`}
                          target="_blank"
                          onClick={() => setMenuId(null)}
                        >
                          Print
                        </Link>
                        {payment.status === "COLLECTED" ? (
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                            disabled={revertingId === payment.id}
                            onClick={() => void revertPayment(payment.id)}
                          >
                            {revertingId === payment.id ? "Reverting…" : "Revert"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!pageRows.length ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    No receipts found.
                    {onCollectClick ? (
                      <>
                        {" "}
                        <button
                          type="button"
                          className="font-semibold text-indigo-600 hover:underline"
                          onClick={onCollectClick}
                        >
                          Generate a receipt
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5">
          <p className="text-[12px] text-slate-500">
            Showing {filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0} to{" "}
            {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} receipts
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            {Array.from({ length: Math.min(pageCount, 3) }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`min-w-8 rounded-md px-2.5 py-1.5 text-[12px] font-semibold ${
                  page === n ? "bg-[#6366f1] text-white" : "border border-slate-200 bg-white text-slate-600"
                }`}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
