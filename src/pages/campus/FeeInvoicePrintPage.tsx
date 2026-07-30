import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import { applyBrandingToDocument, parseBranding } from "../../lib/branding";

interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
}
interface InvoiceItem {
  id: string;
  description: string;
  baseAmount: string;
  discount: string;
  fine: string;
  amount: string;
}
interface Invoice {
  id: string;
  invoiceNumber: string;
  dueDate: string;
  status: string;
  subtotal: string;
  discountAmount: string;
  fineAmount: string;
  total: string;
  paidAmount: string;
  note: string | null;
  student: Student;
  academicSession?: { name: string };
  items: InvoiceItem[];
}

const formatMoney = (value: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value));

export function FeeInvoicePrintPage() {
  const { id } = useParams();
  const { accessToken, isAuthenticated, user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.tenant?.branding) return;
    applyBrandingToDocument(parseBranding(user.tenant.branding));
  }, [user?.tenant?.branding]);

  useEffect(() => {
    if (!id || !isAuthenticated) return;
    apiRequest<Invoice>(`/fees/invoices/${id}`, accessToken)
      .then(setInvoice)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Unable to load invoice"),
      );
  }, [id, accessToken, isAuthenticated]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (error) return <p className="alert-error m-8">{error}</p>;
  if (!invoice) return <p className="p-8 text-center text-slate-500">Preparing invoice…</p>;

  const tenantName = user?.tenant?.name ?? "School";
  const balance = Math.max(0, Number(invoice.total) - Number(invoice.paidAmount));

  return (
    <main className="min-h-screen bg-slate-200 p-6 print:bg-white print:p-0">
      <div className="print-controls mx-auto mb-5 flex max-w-2xl justify-between">
        <Link className="button-secondary" to="/fees">
          Back to fees
        </Link>
        <button className="button-primary" type="button" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>
      <article className="mx-auto max-w-2xl overflow-hidden bg-white p-10 shadow-xl print:shadow-none">
        <header
          className="border-b-2 pb-6 text-center"
          style={{ borderColor: "var(--brand-primary, #4f46e5)" }}
        >
          <p
            className="text-sm font-bold uppercase tracking-[0.25em]"
            style={{ color: "var(--brand-primary, #4f46e5)" }}
          >
            {tenantName}
          </p>
          <h1 className="mt-3 text-2xl font-serif font-bold">Fee invoice</h1>
          <p className="mt-1 text-sm text-slate-500">{invoice.invoiceNumber}</p>
        </header>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Student</p>
            <p className="mt-1 font-medium">
              {invoice.student.firstName} {invoice.student.lastName}
            </p>
            <p className="text-sm text-slate-500">Admission {invoice.student.admissionNumber}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice details</p>
            <p className="mt-1 text-sm">Due {new Date(invoice.dueDate).toLocaleDateString()}</p>
            <p className="text-sm text-slate-500">{invoice.status}</p>
            {invoice.academicSession ? (
              <p className="text-sm text-slate-500">{invoice.academicSession.name}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-8 overflow-hidden rounded-xl border">
          <div className="grid grid-cols-[1fr_100px_100px_100px] border-b bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Fee head</span>
            <span className="text-right">Discount</span>
            <span className="text-right">Fine</span>
            <span className="text-right">Amount</span>
          </div>
          {invoice.items.map((item) => (
            <div
              className="grid grid-cols-[1fr_100px_100px_100px] border-b px-4 py-3 last:border-b-0"
              key={item.id}
            >
              <span>{item.description}</span>
              <span className="text-right text-sm text-slate-600">{formatMoney(item.discount)}</span>
              <span className="text-right text-sm text-slate-600">{formatMoney(item.fine)}</span>
              <span className="text-right font-medium">{formatMoney(item.amount)}</span>
            </div>
          ))}
        </div>
        <div className="mt-8 flex items-end justify-between border-t pt-6">
          <div>
            <p className="text-xs text-slate-500">Paid</p>
            <p className="font-medium">{formatMoney(invoice.paidAmount)}</p>
            {invoice.note ? <p className="mt-2 text-sm text-slate-600">{invoice.note}</p> : null}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {balance > 0 ? "Balance due" : "Total"}
            </p>
            <p className="text-2xl font-bold" style={{ color: "var(--brand-primary, #4f46e5)" }}>
              {formatMoney(balance > 0 ? balance : invoice.total)}
            </p>
          </div>
        </div>
      </article>
    </main>
  );
}
