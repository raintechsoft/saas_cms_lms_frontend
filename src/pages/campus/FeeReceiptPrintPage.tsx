import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import { applyBrandingToDocument, parseBranding } from "../../lib/branding";

interface Student { id: string; admissionNumber: string; firstName: string; lastName: string | null }
interface PaymentItem {
  id: string;
  paidAmount: string;
  assignment: { feeMaster: { feeType: { name: string } } };
}
interface Payment {
  id: string;
  paymentId: string;
  receiptNumber: string;
  paymentDate: string;
  paymentMode: string;
  amount: string;
  note: string | null;
  status: string;
  student: Student;
  items: PaymentItem[];
  academicSession?: { name: string };
}

const formatMoney = (value: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value));

export function FeeReceiptPrintPage() {
  const { id } = useParams();
  const { accessToken, isAuthenticated, user } = useAuth();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.tenant?.branding) return;
    applyBrandingToDocument(parseBranding(user.tenant.branding));
  }, [user?.tenant?.branding]);

  useEffect(() => {
    if (!id || !isAuthenticated) return;
    apiRequest<Payment[]>("/fees/payments", accessToken)
      .then((payments) => {
        const match = payments.find((item) => item.id === id || item.paymentId === id);
        if (!match) throw new Error("Receipt not found");
        setPayment(match);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Unable to load receipt"),
      );
  }, [id, accessToken, isAuthenticated]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (error) return <p className="alert-error m-8">{error}</p>;
  if (!payment) return <p className="p-8 text-center text-slate-500">Preparing receipt…</p>;

  const tenantName = user?.tenant?.name ?? "School";

  return (
    <main className="min-h-screen bg-slate-200 p-6 print:bg-white print:p-0">
      <div className="print-controls mx-auto mb-5 flex max-w-2xl justify-between">
        <Link className="button-secondary" to="/fees">Back to fees</Link>
        <button className="button-primary" type="button" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>
      <article className="mx-auto max-w-2xl overflow-hidden bg-white p-10 shadow-xl print:shadow-none">
        <header className="border-b-2 pb-6 text-center" style={{ borderColor: "var(--brand-primary, #4f46e5)" }}>
          <p className="text-sm font-bold uppercase tracking-[0.25em]" style={{ color: "var(--brand-primary, #4f46e5)" }}>
            {tenantName}
          </p>
          <h1 className="mt-3 text-2xl font-serif font-bold">Fee receipt</h1>
          <p className="mt-1 text-sm text-slate-500">{payment.receiptNumber}</p>
        </header>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Student</p>
            <p className="mt-1 font-medium">
              {payment.student.firstName} {payment.student.lastName}
            </p>
            <p className="text-sm text-slate-500">Admission {payment.student.admissionNumber}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment details</p>
            <p className="mt-1 text-sm">{new Date(payment.paymentDate).toLocaleDateString()}</p>
            <p className="text-sm text-slate-500">{payment.paymentMode.replaceAll("_", " ")}</p>
            {payment.academicSession && (
              <p className="text-sm text-slate-500">{payment.academicSession.name}</p>
            )}
          </div>
        </div>
        {payment.items.length > 0 && (
          <div className="mt-8 overflow-hidden rounded-xl border">
            <div className="grid grid-cols-[1fr_120px] border-b bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Fee head</span>
              <span className="text-right">Amount</span>
            </div>
            {payment.items.map((item) => (
              <div className="grid grid-cols-[1fr_120px] border-b px-4 py-3 last:border-b-0" key={item.id}>
                <span>{item.assignment.feeMaster.feeType.name}</span>
                <span className="text-right font-medium">{formatMoney(item.paidAmount)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-8 flex items-end justify-between border-t pt-6">
          <div>
            <p className="text-xs text-slate-500">Payment ID</p>
            <p className="font-mono text-sm">{payment.paymentId}</p>
            {payment.note && <p className="mt-2 text-sm text-slate-600">{payment.note}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total paid</p>
            <p className="text-2xl font-bold" style={{ color: "var(--brand-primary, #4f46e5)" }}>
              {formatMoney(payment.amount)}
            </p>
            <span className={payment.status === "COLLECTED" ? "badge-success" : "badge-danger"}>
              {payment.status}
            </span>
          </div>
        </div>
      </article>
    </main>
  );
}
