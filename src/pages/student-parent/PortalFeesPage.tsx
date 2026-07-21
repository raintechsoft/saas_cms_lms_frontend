import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiRequest } from "../../lib/api";
import { isProductBucketAllowed } from "../../lib/productMode";
import { usePortal } from "./PortalContext";

interface FeePayment {
  id: string;
  paymentId: string;
  receiptNumber: string | null;
  paymentDate: string;
  paymentMode: string;
  amount: number;
  status: string;
}

interface FeeStatement {
  totals: { base: number; discount: number; fine: number; paid: number; balance: number };
  assignments: Array<{
    feeMaster?: { feeType?: { name: string } };
    totals: { base: number; paid: number; balance: number };
  }>;
}

interface FeesResponse {
  statement: FeeStatement;
  payments: FeePayment[];
}

export function PortalFeesPage() {
  const { accessToken, child, productMode, basePath } = usePortal();
  const [data, setData] = useState<FeesResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const showCms = isProductBucketAllowed(productMode, "CMS");

  useEffect(() => {
    if (!showCms || !child) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiRequest<FeesResponse>(`/portal/children/${child.student.id}/fees`, accessToken)
      .then(setData)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load fees");
      })
      .finally(() => setLoading(false));
  }, [accessToken, child?.student.id, showCms]);

  if (!showCms) {
    return <Navigate to={basePath} replace />;
  }

  if (!child) {
    return <p className="text-sm text-slate-500">No student profile linked.</p>;
  }

  const statement = data?.statement;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Fees</h1>
        <p className="mt-1 text-sm text-slate-500">Fee statement and payment history.</p>
      </div>

      {error && <p className="alert-error">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">Loading fees…</p>
      ) : !statement ? (
        <section className="card p-6">
          <p className="text-sm text-slate-500">No fee assignments.</p>
        </section>
      ) : (
        <>
          <section className="card p-6">
            <h2 className="font-semibold">Summary</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Payable" value={`₹${statement.totals.base.toLocaleString()}`} />
              <Stat label="Paid" value={`₹${statement.totals.paid.toLocaleString()}`} />
              <Stat label="Fine" value={`₹${statement.totals.fine.toLocaleString()}`} />
              <Stat
                label="Balance"
                value={`₹${statement.totals.balance.toLocaleString()}`}
                highlight={statement.totals.balance > 0}
              />
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 font-semibold">Fee heads</div>
            <div className="divide-y divide-slate-100">
              {statement.assignments.map((assignment, index) => (
                <div className="flex justify-between px-5 py-3 text-sm" key={index}>
                  <span>{assignment.feeMaster?.feeType?.name ?? "Fee"}</span>
                  <span className={assignment.totals.balance > 0 ? "font-semibold text-rose-600" : "text-emerald-700"}>
                    ₹{assignment.totals.balance.toLocaleString()} due
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 font-semibold">Payment history</div>
            {!data?.payments.length ? (
              <p className="p-5 text-sm text-slate-500">No payments recorded.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.payments.map((payment) => (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm" key={payment.id}>
                    <div>
                      <p className="font-medium">
                        {payment.receiptNumber ?? payment.paymentId} · {payment.paymentMode}
                      </p>
                      <p className="text-xs text-slate-500">{new Date(payment.paymentDate).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">₹{Number(payment.amount).toLocaleString()}</p>
                      <span className="badge">{payment.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${highlight ? "text-rose-600" : ""}`}>{value}</p>
    </div>
  );
}
