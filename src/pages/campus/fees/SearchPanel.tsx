import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AccessTimeOutlined,
  ConfirmationNumberOutlined,
  ReceiptLongOutlined,
  SearchOutlined,
} from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import type { Payment } from "./types";
import { formatMoney, studentDisplayName } from "./utils";

export function SearchPanel({
  token,
  onError,
}: {
  token: string;
  onError: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Payment[] | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [lastSearch, setLastSearch] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  async function runSearch(value: string) {
    const q = value.trim();
    if (!q) {
      onError("Enter a payment ID / transaction ID to search");
      return;
    }
    setSearching(true);
    try {
      onError("");
      const path = `/fees/payments?query=${encodeURIComponent(q)}`;
      const data = await apiRequest<Payment[]>(path, token);
      setResults(data);
      setLastSearch(q);
      setHistory((prev) => [q, ...prev.filter((item) => item !== q)].slice(0, 8));
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to search payments");
    } finally {
      setSearching(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await runSearch(query);
  }

  return (
    <section className="mt-5 space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Left: search history */}
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-8 py-10 text-center">
          <div className="grid size-16 place-items-center rounded-full bg-white text-slate-300 shadow-sm ring-1 ring-slate-200">
            <ReceiptLongOutlined sx={{ fontSize: 32 }} />
          </div>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-slate-500">
            {history.length
              ? "Recent payment ID searches appear below. Click one to run it again."
              : "No search history. Your recent searches will appear here. Input a valid Payment ID to get started."}
          </p>
          {history.length ? (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {history.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-indigo-700 hover:bg-indigo-100"
                  onClick={() => {
                    setQuery(item);
                    void runSearch(item);
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              className="mt-5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
              onClick={() => {
                setQuery("PAY-88192003");
                void runSearch("PAY-88192003");
              }}
            >
              Quick sample: PAY-88192003
            </button>
          )}
        </div>

        {/* Right: verify card */}
        <form className="nx-card flex flex-col p-6" onSubmit={(e) => void onSubmit(e)}>
          <div className="grid size-12 place-items-center rounded-full bg-indigo-50 text-[#6366f1]">
            <SearchOutlined sx={{ fontSize: 24 }} />
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-900">Verify Transaction</h3>
          <p className="mt-1 text-sm text-slate-500">
            Enter the Payment ID found on the student&apos;s physical or digital slip.
          </p>

          <label className="nx-label mt-6" htmlFor="payment-id">
            Payment ID / Transaction ID
          </label>
          <div className="relative">
            <ConfirmationNumberOutlined
              sx={{ fontSize: 18 }}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              id="payment-id"
              className="nx-input pl-10"
              placeholder="e.g. PAY-12345678"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <button className="nx-btn-primary mt-5 w-full !py-3" type="submit" disabled={searching}>
            {searching ? "Searching…" : "Search Transaction"}
          </button>

          <p className="mt-4 flex items-center gap-1.5 text-[12px] text-slate-400">
            <AccessTimeOutlined sx={{ fontSize: 14 }} />
            {lastSearch
              ? `Last search: ${lastSearch}`
              : "Last search: —"}
          </p>
        </form>
      </div>

      {results ? (
        <div className="nx-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <h3 className="text-sm font-semibold text-slate-900">Search results</h3>
            <p className="text-[12px] text-slate-500">
              {results.length} payment{results.length === 1 ? "" : "s"} found
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="nx-table min-w-[860px]">
              <thead>
                <tr>
                  <th>Payment ID</th>
                  <th>Receipt</th>
                  <th>Student</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {results.map((payment) => (
                  <tr key={payment.id}>
                    <td className="font-mono text-[12px] text-slate-600">{payment.paymentId}</td>
                    <td className="font-semibold">{payment.receiptNumber}</td>
                    <td>
                      <p className="font-medium">{studentDisplayName(payment.student)}</p>
                      <p className="text-[12px] text-slate-400">{payment.student.admissionNumber}</p>
                    </td>
                    <td>{new Date(payment.paymentDate).toLocaleDateString()}</td>
                    <td>
                      <span
                        className={
                          payment.status === "COLLECTED"
                            ? "rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700"
                            : "rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700"
                        }
                      >
                        {payment.status === "COLLECTED" ? "Active" : "Cancelled"}
                      </span>
                    </td>
                    <td className="text-right font-semibold">{formatMoney(payment.amount)}</td>
                    <td className="text-right">
                      <Link
                        className="nx-btn-secondary !px-2.5 !py-1.5 text-[12px]"
                        to={`/print/fees/${payment.id}`}
                        target="_blank"
                      >
                        Print
                      </Link>
                    </td>
                  </tr>
                ))}
                {!results.length ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                      No payments matched that Payment ID.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
