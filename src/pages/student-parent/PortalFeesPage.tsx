import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowForwardRounded,
  CheckCircleRounded,
  CloudUploadOutlined,
  DescriptionOutlined,
  DownloadRounded,
  PaymentsOutlined,
  ReceiptLongOutlined,
  ScheduleRounded,
  UploadFileOutlined,
} from "@mui/icons-material";
import { Link, Navigate } from "react-router-dom";
import { apiRequest } from "../../lib/api";
import { isProductBucketAllowed } from "../../lib/productMode";
import { usePortal } from "./PortalContext";

const PRIMARY = "#534AB7";
const PRIMARY_SOFT = "#EEF0FD";
const BORDER = "#E5E7EB";
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

interface FeePayment {
  id: string;
  paymentId: string;
  receiptNumber: string | null;
  paymentDate: string;
  paymentMode: string;
  amount: number;
  status: string;
  label?: string;
  feeNames?: string[];
  partial?: boolean;
}

interface FeeAssignmentRow {
  feeMaster?: {
    dueDate?: string;
    feeType?: { name: string };
    name?: string;
  };
  totals: { base: number; paid: number; balance: number; discount?: number; fine?: number };
}

interface FeeStatement {
  totals: { base: number; discount: number; fine: number; paid: number; balance: number };
  assignments: FeeAssignmentRow[];
}

interface FeesResponse {
  statement: FeeStatement;
  due: {
    amount: number;
    dueDate: string;
    name: string;
    overdue: boolean;
  } | null;
  payments: FeePayment[];
}

function Card({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)] ${className}`}
      style={{ borderColor: BORDER }}
    >
      {children}
    </section>
  );
}

function money(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function feeName(row: FeeAssignmentRow) {
  return row.feeMaster?.feeType?.name ?? row.feeMaster?.name ?? "Fee";
}

function ProgressRing({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const r = 40;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  return (
    <div className="relative size-[108px] shrink-0">
      <svg className="size-full -rotate-90" viewBox="0 0 108 108" aria-hidden>
        <circle cx="54" cy="54" r={r} fill="none" stroke="#EEF0FD" strokeWidth="10" />
        <circle
          cx="54"
          cy="54"
          r={r}
          fill="none"
          stroke={PRIMARY}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-[20px] font-bold text-[#1A1A1A]">{clamped}%</span>
      </div>
    </div>
  );
}

export function PortalFeesPage() {
  const { accessToken, child, productMode, basePath } = usePortal();
  const [data, setData] = useState<FeesResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [uploadNote, setUploadNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const showCms = isProductBucketAllowed(productMode, "CMS");

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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

  const statement = data?.statement;
  const paidPct = useMemo(() => {
    if (!statement || statement.totals.base <= 0) return 0;
    return Math.round((statement.totals.paid / statement.totals.base) * 100);
  }, [statement]);

  const payments = data?.payments ?? [];
  const visiblePayments = showAllPayments ? payments : payments.slice(0, 5);

  async function uploadProof(file: File) {
    if (!child) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadNote("File is larger than 5MB. Please choose a smaller file.");
      return;
    }
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setUploadNote("Only JPG, PNG, or PDF files are supported.");
      return;
    }

    setUploading(true);
    setUploadNote("");
    try {
      const docs = await apiRequest<{ folders: Array<{ id: string; name: string }> }>(
        `/portal/children/${child.student.id}/documents`,
        accessToken,
      );
      const folder =
        docs.folders.find((f) => /payment|fee|receipt|deposit/i.test(f.name)) ?? docs.folders[0];
      if (!folder) {
        setUploadNote("No document folder is available. Contact the school office to upload proof.");
        return;
      }

      const form = new FormData();
      form.append("file", file);
      form.append("folderId", folder.id);
      form.append("name", `Payment proof - ${file.name}`);

      const response = await fetch(`${API_URL}/portal/children/${child.student.id}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? "Upload failed");
      }
      setUploadNote("Payment proof uploaded. Accounts will verify it shortly.");
    } catch (cause) {
      setUploadNote(cause instanceof Error ? cause.message : "Unable to upload payment proof");
    } finally {
      setUploading(false);
    }
  }

  if (!showCms) {
    return <Navigate to={basePath} replace />;
  }

  if (!child) {
    return <p className="text-sm text-[#6B7280]">No student profile linked.</p>;
  }

  const due = data?.due;
  const firstName = child.student.firstName;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-[#1A1A1A]">
          Hi, {firstName}! 👋
        </h1>
        <p className="mt-1 text-[13px] text-[#6B7280]">Here&apos;s your fees overview and payment details.</p>
      </div>

      {error && <p className="alert-error">{error}</p>}

      {loading ? (
        <p className="text-sm text-[#6B7280]">Loading fees…</p>
      ) : !statement ? (
        <Card>
          <p className="text-sm text-[#6B7280]">No fee assignments for this session yet.</p>
        </Card>
      ) : (
        <>
          {/* Top row */}
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr_1fr_0.85fr]">
            <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <ProgressRing pct={paidPct} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-[#1A1A1A]">Fees Paid - This Session</p>
                <div className="mt-3 space-y-2 text-[12px]">
                  <p className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-[#6B7280]">
                      <span className="size-2 rounded-full" style={{ background: PRIMARY }} />
                      Paid
                    </span>
                    <span className="font-bold text-[#1A1A1A]">{money(statement.totals.paid)}</span>
                  </p>
                  <p className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-[#6B7280]">
                      <span className="size-2 rounded-full bg-[#C4B5FD]" />
                      Pending
                    </span>
                    <span className="font-bold text-[#1A1A1A]">{money(statement.totals.balance)}</span>
                  </p>
                </div>
                <p className="mt-3 border-t border-[#E5E7EB] pt-3 text-[12px] text-[#6B7280]">
                  Total Fees: <span className="font-bold text-[#1A1A1A]">{money(statement.totals.base)}</span>
                </p>
              </div>
            </Card>

            <Card className="relative flex flex-col">
              {due?.overdue ? (
                <span className="absolute right-4 top-4 rounded-full bg-[#FEF2F2] px-2.5 py-0.5 text-[10px] font-bold text-[#E11D48]">
                  Overdue
                </span>
              ) : due ? (
                <span className="absolute right-4 top-4 rounded-full bg-[#FFF7ED] px-2.5 py-0.5 text-[10px] font-bold text-[#D97706]">
                  Due
                </span>
              ) : null}
              <p className="text-[13px] font-bold text-[#1A1A1A]">Due Fees</p>
              <p className={`mt-3 text-[28px] font-bold leading-none ${due && due.amount > 0 ? "text-[#E11D48]" : "text-[#059669]"}`}>
                {money(due?.amount ?? 0)}
              </p>
              <p className="mt-2 text-[12px] text-[#6B7280]">
                {due
                  ? `Due Date: ${new Date(due.dueDate).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}`
                  : "No pending dues"}
              </p>
              <button
                type="button"
                className="mt-auto inline-flex items-center justify-center gap-1 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white"
                style={{ background: PRIMARY }}
                onClick={() => scrollTo("fee-upload")}
                disabled={!due || due.amount <= 0}
              >
                Pay Now <ArrowForwardRounded sx={{ fontSize: 16 }} />
              </button>
            </Card>

            <Card
              className="relative overflow-hidden"
              style={{ background: `linear-gradient(145deg, ${PRIMARY} 0%, #3F3A9A 100%)` }}
            >
              <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-white/10" />
              <div className="relative text-white">
                <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-white/15">
                  <PaymentsOutlined sx={{ fontSize: 26 }} />
                </div>
                <p className="text-[15px] font-bold">Make your fee payment</p>
                <p className="mt-1 text-[12px] text-white/80">Secure and easy online payment</p>
                <button
                  type="button"
                  className="mt-4 inline-flex items-center gap-1 text-[13px] font-bold text-white hover:underline"
                  onClick={() => scrollTo("fee-upload")}
                >
                  Pay Now <ArrowForwardRounded sx={{ fontSize: 16 }} />
                </button>
              </div>
            </Card>

            <Card>
              <p className="mb-3 text-[13px] font-bold text-[#1A1A1A]">Quick Actions</p>
              <div className="flex flex-col gap-2">
                {[
                  {
                    label: "View Fee Receipt",
                    hint: "Download your receipt",
                    Icon: ReceiptLongOutlined,
                    bg: PRIMARY_SOFT,
                    fg: PRIMARY,
                    onClick: () => {
                      if (payments[0]) window.open(`/print/fees/${payments[0].id}`, "_blank");
                      else scrollTo("fee-history");
                    },
                  },
                  {
                    label: "View Deposit Fee Invoice",
                    hint: "Upload payment proof",
                    Icon: UploadFileOutlined,
                    bg: "#ECFDF5",
                    fg: "#059669",
                    onClick: () => scrollTo("fee-upload"),
                  },
                  {
                    label: "Fee Structure",
                    hint: "View fee details",
                    Icon: DescriptionOutlined,
                    bg: "#FFF7ED",
                    fg: "#D97706",
                    onClick: () => scrollTo("fee-structure"),
                  },
                ].map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-[#F8F9FC]"
                  >
                    <span
                      className="grid size-9 place-items-center rounded-xl"
                      style={{ background: action.bg, color: action.fg }}
                    >
                      <action.Icon sx={{ fontSize: 18 }} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-bold text-[#1A1A1A]">{action.label}</span>
                      <span className="block text-[11px] text-[#9CA3AF]">{action.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* Bottom grid */}
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr_0.9fr]">
            <Card className="!p-0 overflow-hidden">
              <div id="fee-structure" className="border-b border-[#E5E7EB] px-5 py-4">
                <h2 className="text-[15px] font-bold text-[#1A1A1A]">Fee Structure</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                      <th className="px-5 py-3 font-semibold">Fee Type</th>
                      <th className="px-5 py-3 font-semibold">Total Amount (₹)</th>
                      <th className="px-5 py-3 font-semibold">Paid (₹)</th>
                      <th className="px-5 py-3 font-semibold">Pending (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.assignments.map((row, index) => (
                      <tr key={index} className="border-b border-[#F1F2F6]">
                        <td className="px-5 py-3 font-semibold text-[#1A1A1A]">{feeName(row)}</td>
                        <td className="px-5 py-3 text-[#6B7280]">{money(row.totals.base)}</td>
                        <td className="px-5 py-3 font-semibold text-[#059669]">{money(row.totals.paid)}</td>
                        <td
                          className={`px-5 py-3 font-semibold ${
                            row.totals.balance > 0 ? "text-[#D97706]" : "text-[#059669]"
                          }`}
                        >
                          {money(row.totals.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#F8F9FC]">
                      <td className="px-5 py-3.5 text-[13px] font-bold text-[#1A1A1A]">Total</td>
                      <td className="px-5 py-3.5 font-bold text-[#1A1A1A]">{money(statement.totals.base)}</td>
                      <td className="px-5 py-3.5 font-bold text-[#059669]">{money(statement.totals.paid)}</td>
                      <td className="px-5 py-3.5 font-bold text-[#E11D48]">{money(statement.totals.balance)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            <Card id="fee-history">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-bold text-[#1A1A1A]">Payment History</h2>
                {payments.length > 5 ? (
                  <button
                    type="button"
                    className="text-[12px] font-bold hover:underline"
                    style={{ color: PRIMARY }}
                    onClick={() => setShowAllPayments((v) => !v)}
                  >
                    {showAllPayments ? "Show Less" : "View All"}
                  </button>
                ) : null}
              </div>
              {payments.length === 0 ? (
                <p className="py-8 text-center text-[12px] text-[#6B7280]">No payments recorded yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {visiblePayments.map((payment) => {
                    const partial =
                      payment.partial ||
                      payment.status === "PARTIAL" ||
                      /partial/i.test(payment.status);
                    return (
                      <div key={payment.id} className="flex items-start gap-3 rounded-xl bg-[#F8F9FC] px-3 py-3">
                        <span
                          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full"
                          style={{
                            background: partial ? "#FFF7ED" : "#ECFDF5",
                            color: partial ? "#D97706" : "#059669",
                          }}
                        >
                          {partial ? <ScheduleRounded sx={{ fontSize: 16 }} /> : <CheckCircleRounded sx={{ fontSize: 16 }} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-bold text-[#1A1A1A]">
                            {payment.label ?? payment.feeNames?.[0] ?? "Fee Payment"}
                            {partial ? " · Partially Paid" : ""}
                          </p>
                          <p className="text-[11px] text-[#9CA3AF]">
                            {payment.receiptNumber ?? payment.paymentId} ·{" "}
                            {new Date(payment.paymentDate).toLocaleDateString(undefined, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold text-[#1A1A1A]">{money(Number(payment.amount))}</span>
                          <Link
                            to={`/print/fees/${payment.id}`}
                            target="_blank"
                            className="grid size-8 place-items-center rounded-lg text-[#6B7280] hover:bg-white"
                            title="Download receipt"
                          >
                            <DownloadRounded sx={{ fontSize: 16 }} />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <div id="fee-upload">
            <Card>
              <h2 className="mb-3 text-[15px] font-bold text-[#1A1A1A]">Upload Payment Proof</h2>
              <div
                className={`flex flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-8 text-center transition ${
                  dragOver ? "border-[#534AB7] bg-[#EEF0FD]" : "border-[#C7C9D9] bg-[#F8F9FC]"
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file) void uploadProof(file);
                }}
              >
                <span className="grid size-12 place-items-center rounded-2xl" style={{ background: PRIMARY_SOFT, color: PRIMARY }}>
                  <CloudUploadOutlined sx={{ fontSize: 26 }} />
                </span>
                <p className="mt-3 text-[13px] font-semibold text-[#1A1A1A]">Drag & drop your file here</p>
                <p className="mt-1 text-[12px] text-[#6B7280]">
                  or{" "}
                  <button
                    type="button"
                    className="font-bold hover:underline"
                    style={{ color: PRIMARY }}
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    Choose File
                  </button>
                </p>
                <p className="mt-2 text-[11px] text-[#9CA3AF]">JPG, PNG, PDF (Max. 5MB)</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadProof(file);
                    event.target.value = "";
                  }}
                />
              </div>
              {uploadNote ? (
                <p className="mt-3 text-[12px] font-medium text-[#534AB7]">{uploadNote}</p>
              ) : null}
              <div className="mt-3 rounded-xl bg-[#EEF0FD] px-3 py-2.5 text-[11px] leading-relaxed text-[#534AB7]">
                <strong>Note:</strong> Please upload a clear payment receipt for verification. It will be verified by the accounts department.
              </div>
              {uploading ? <p className="mt-2 text-[12px] text-[#6B7280]">Uploading…</p> : null}
            </Card>
            </div>
          </div>

          <footer className="flex flex-col gap-2 border-t border-[#E5E7EB] pt-4 text-[11px] text-[#9CA3AF] sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Your School Name. All rights reserved.</p>
            <div className="flex flex-wrap gap-4 font-medium">
              <Link to={`${basePath}/help`} className="hover:text-[#6B7280]">
                Privacy Policy
              </Link>
              <Link to={`${basePath}/help`} className="hover:text-[#6B7280]">
                Terms of Use
              </Link>
              <Link to={`${basePath}/help`} className="hover:text-[#6B7280]">
                Help & Support
              </Link>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
