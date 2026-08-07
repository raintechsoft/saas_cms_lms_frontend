import { useEffect, useMemo, useState } from "react";
import { DownloadRounded } from "@mui/icons-material";
import {
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import { apiRequest } from "../../lib/api";
import { isProductBucketAllowed } from "../../lib/productMode";
import { notifyError, notifySuccess } from "../../lib/notify";
import { PageHeader } from "./components/PageHeader";
import { StatusChip } from "./components/StatusChip";
import { useParentPortal } from "./ParentPortalContext";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_DARK } from "./ParentPortalLayout";

type FeeStatus = "Paid" | "Pending" | "Overdue";

interface FeePayment {
  id: string;
  paymentId: string;
  receiptNumber: string | null;
  paymentDate: string;
  paymentMode: string;
  amount: number;
  status: string;
}

interface FeeAssignmentRow {
  id: string;
  feeMaster?: {
    dueDate?: string;
    feeType?: { name: string };
    name?: string;
  };
  totals: { base: number; paid: number; balance: number; discount?: number; fine?: number };
}

interface OnlinePaymentConfig {
  enabled: boolean;
  keyId: string;
  currency: string;
}

interface OnlineCheckoutPayload {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
}

interface CreateOnlineOrderResponse {
  order: { id: string; status: string };
  checkout: OnlineCheckoutPayload;
}

interface FeesResponse {
  academicSessionId: string | null;
  statement: {
    totals: { base: number; discount: number; fine: number; paid: number; balance: number };
    assignments: FeeAssignmentRow[];
  };
  due: { amount: number; dueDate: string; name: string; overdue: boolean } | null;
  payments: FeePayment[];
}

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutInstance {
  open: () => void;
  on: (event: string, handler: (response: { error?: { description?: string } }) => void) => void;
}

interface RazorpayConstructor {
  new (options: Record<string, unknown>): RazorpayCheckoutInstance;
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-razorpay-checkout="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Unable to load Razorpay checkout")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Razorpay checkout"));
    document.body.appendChild(script);
  });
}

const formatInr = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function feeName(row: FeeAssignmentRow) {
  return row.feeMaster?.feeType?.name ?? row.feeMaster?.name ?? "Fee";
}

function rowStatus(row: FeeAssignmentRow): FeeStatus {
  if (row.totals.balance <= 0) return "Paid";
  const due = row.feeMaster?.dueDate;
  if (due && new Date(due).getTime() < Date.now()) return "Overdue";
  return "Pending";
}

const FEE_STATUS_TONE: Record<FeeStatus, "green" | "orange" | "red"> = {
  Paid: "green",
  Pending: "orange",
  Overdue: "red",
};

const tableSx = {
  "& th": {
    fontWeight: 700,
    fontSize: 12,
    color: "#6B7280",
    background: "#F9FAFB",
    borderBottom: `1px solid ${PARENT_BORDER}`,
    whiteSpace: "nowrap" as const,
  },
  "& td": {
    fontSize: 13,
    color: "#1A1A2E",
    borderBottom: `1px solid ${PARENT_BORDER}`,
  },
};

const primaryBtnSx = {
  textTransform: "none" as const,
  fontWeight: 700,
  borderRadius: "12px",
  bgcolor: PARENT_PRIMARY,
  "&:hover": { bgcolor: PARENT_PRIMARY_DARK },
};

export function ParentFeesPage() {
  const { activeChild, portalChild, accessToken, productMode, reload } = useParentPortal();
  const showCms = isProductBucketAllowed(productMode, "CMS");
  const studentId = portalChild?.student.id;

  const [data, setData] = useState<FeesResponse | null>(null);
  const [onlineConfig, setOnlineConfig] = useState<OnlinePaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!showCms || !studentId) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    setError("");
    Promise.all([
      apiRequest<FeesResponse>(`/portal/children/${studentId}/fees`, accessToken),
      apiRequest<OnlinePaymentConfig>("/portal/fees/online/config", accessToken).catch(() => ({
        enabled: false,
        keyId: "",
        currency: "INR",
      })),
    ])
      .then(([fees, config]) => {
        setData(fees);
        setOnlineConfig(config);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load fees");
      })
      .finally(() => setLoading(false));
  }, [accessToken, studentId, showCms]);

  const totalDue = data?.statement.totals.balance ?? 0;
  const assignments = data?.statement.assignments ?? [];
  const payments = data?.payments ?? [];

  const feeRows = useMemo(
    () =>
      assignments.map((row) => ({
        id: row.id,
        head: feeName(row),
        amount: row.totals.base + (row.totals.fine ?? 0),
        dueDate: formatDate(row.feeMaster?.dueDate),
        status: rowStatus(row),
        balance: row.totals.balance,
      })),
    [assignments],
  );

  async function payNow() {
    if (!studentId || !data || paying) return;
    if (!onlineConfig?.enabled) {
      notifyError("Online payments are not enabled. Contact the school office.");
      return;
    }
    if (!data.academicSessionId) {
      notifyError("No active academic session found for fee payment.");
      return;
    }
    const items = data.statement.assignments
      .filter((row) => row.totals.balance > 0)
      .map((row) => ({ assignmentId: row.id, amount: row.totals.balance }));
    if (!items.length) {
      notifyError("No outstanding dues to pay.");
      return;
    }

    setPaying(true);
    try {
      const created = await apiRequest<CreateOnlineOrderResponse>(
        `/portal/children/${studentId}/fees/online/orders`,
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            studentId,
            academicSessionId: data.academicSessionId,
            items,
          }),
        },
      );
      await loadRazorpayScript();
      if (!window.Razorpay) throw new Error("Razorpay checkout is unavailable");

      await new Promise<void>((resolve, reject) => {
        const checkout = new window.Razorpay!({
          key: created.checkout.keyId,
          amount: created.checkout.amount,
          currency: created.checkout.currency,
          name: created.checkout.name,
          description: created.checkout.description,
          order_id: created.checkout.orderId,
          prefill: created.checkout.prefill,
          theme: { color: PARENT_PRIMARY },
          handler: (response: RazorpaySuccessResponse) => {
            void (async () => {
              try {
                await apiRequest(`/portal/fees/online/orders/${created.order.id}/confirm`, accessToken, {
                  method: "POST",
                  body: JSON.stringify({
                    paymentId: response.razorpay_payment_id,
                    signature: response.razorpay_signature,
                  }),
                });
                const fees = await apiRequest<FeesResponse>(
                  `/portal/children/${studentId}/fees`,
                  accessToken,
                );
                setData(fees);
                await reload();
                notifySuccess("Payment successful");
                resolve();
              } catch (cause) {
                reject(cause instanceof Error ? cause : new Error("Payment confirmation failed"));
              }
            })();
          },
          modal: { ondismiss: () => resolve() },
        });
        checkout.on("payment.failed", (response) => {
          reject(new Error(response.error?.description ?? "Payment failed"));
        });
        checkout.open();
      });
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to start online payment");
    } finally {
      setPaying(false);
    }
  }

  if (!showCms) {
    return (
      <div className="rounded-2xl border border-[#E5E7EB] bg-white px-6 py-12 text-center text-[14px] text-[#6B7280]">
        Fees are available when the school has CMS billing enabled.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Fees & Payments"
        subtitle={`${activeChild.name} · ${activeChild.className} - ${activeChild.section}`}
      />

      {loading ? (
        <p className="text-[13px] text-[#6B7280]">Loading fees…</p>
      ) : error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>
      ) : (
        <>
          <div
            className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)] sm:p-6"
            style={{
              borderColor: PARENT_BORDER,
              background: "linear-gradient(135deg, #EEF2FF 0%, #FFFFFF 55%)",
            }}
          >
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">Total Due</p>
              <p className="mt-1 text-[32px] font-extrabold leading-none text-[#4F46E5]">
                {formatInr(totalDue)}
              </p>
              <p className="mt-2 text-[13px] text-[#6B7280]">
                Outstanding for {activeChild.className} - {activeChild.section}
                {data?.due?.dueDate ? ` · Due ${formatDate(data.due.dueDate)}` : ""}
              </p>
            </div>
            <Button
              variant="contained"
              disableElevation
              sx={primaryBtnSx}
              onClick={() => void payNow()}
              disabled={totalDue <= 0 || paying}
            >
              {paying ? "Processing…" : "Pay Now"}
            </Button>
          </div>

          <section
            className="overflow-hidden rounded-[20px] border bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
            style={{ borderColor: PARENT_BORDER }}
          >
            <div className="border-b px-5 py-4" style={{ borderColor: PARENT_BORDER }}>
              <h2 className="text-[15px] font-bold text-[#1A1A2E]">Fee Structure</h2>
            </div>
            <div className="overflow-x-auto">
              <Table size="small" sx={tableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Fee Head</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">Balance</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {feeRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ color: "#6B7280", py: 4 }}>
                        No fee assignments found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    feeRows.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{row.head}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {formatInr(row.amount)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {formatInr(row.balance)}
                        </TableCell>
                        <TableCell>{row.dueDate}</TableCell>
                        <TableCell>
                          <StatusChip label={row.status} tone={FEE_STATUS_TONE[row.status]} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <section
            className="overflow-hidden rounded-[20px] border bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
            style={{ borderColor: PARENT_BORDER }}
          >
            <div className="border-b px-5 py-4" style={{ borderColor: PARENT_BORDER }}>
              <h2 className="text-[15px] font-bold text-[#1A1A2E]">Payment History</h2>
            </div>
            <div className="overflow-x-auto">
              <Table size="small" sx={tableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Mode</TableCell>
                    <TableCell>Receipt</TableCell>
                    <TableCell align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ color: "#6B7280", py: 4 }}>
                        No payments yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{formatDate(row.paymentDate)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {formatInr(row.amount)}
                        </TableCell>
                        <TableCell>{row.paymentMode}</TableCell>
                        <TableCell>{row.receiptNumber ?? row.paymentId}</TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            aria-label="Receipt"
                            onClick={() =>
                              notifySuccess(`Receipt ${row.receiptNumber ?? row.paymentId}`)
                            }
                            sx={{ color: PARENT_PRIMARY }}
                          >
                            <DownloadRounded sx={{ fontSize: 20 }} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
