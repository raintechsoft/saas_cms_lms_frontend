import { useMemo, useState } from "react";
import { DownloadRounded } from "@mui/icons-material";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import Swal from "sweetalert2";
import { notifySuccess } from "../../lib/notify";
import { PageHeader } from "./components/PageHeader";
import { StatusChip } from "./components/StatusChip";
import { useParentPortal } from "./ParentPortalContext";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_DARK } from "./ParentPortalLayout";

type FeeStatus = "Paid" | "Pending" | "Overdue";
type PaymentMode = "Card" | "UPI" | "Net Banking";

interface FeeRow {
  id: string;
  term: string;
  head: string;
  amount: number;
  dueDate: string;
  status: FeeStatus;
}

interface PaymentRow {
  id: string;
  date: string;
  amount: number;
  mode: PaymentMode;
  receiptId: string;
}

const FEE_STATUS_TONE: Record<FeeStatus, "green" | "orange" | "red"> = {
  Paid: "green",
  Pending: "orange",
  Overdue: "red",
};

const MOCK_FEES: Record<string, FeeRow[]> = {
  "child-1": [
    { id: "f1", term: "Term 1", head: "Tuition", amount: 12000, dueDate: "15 Apr 2025", status: "Paid" },
    { id: "f2", term: "Term 1", head: "Transport", amount: 3500, dueDate: "15 Apr 2025", status: "Paid" },
    { id: "f3", term: "Term 2", head: "Tuition", amount: 12000, dueDate: "25 May 2025", status: "Pending" },
    { id: "f4", term: "Term 2", head: "Exam fee", amount: 1500, dueDate: "20 May 2025", status: "Overdue" },
    { id: "f5", term: "Term 2", head: "Library", amount: 800, dueDate: "25 May 2025", status: "Pending" },
  ],
  "child-2": [
    { id: "f6", term: "Term 1", head: "Tuition", amount: 9000, dueDate: "10 Apr 2025", status: "Paid" },
    { id: "f7", term: "Term 1", head: "Transport", amount: 2800, dueDate: "10 Apr 2025", status: "Paid" },
    { id: "f8", term: "Term 2", head: "Tuition", amount: 9000, dueDate: "20 May 2025", status: "Pending" },
    { id: "f9", term: "Term 2", head: "Activity fee", amount: 1200, dueDate: "18 May 2025", status: "Pending" },
  ],
};

const MOCK_PAYMENTS: Record<string, PaymentRow[]> = {
  "child-1": [
    { id: "p1", date: "12 Apr 2025", amount: 12000, mode: "UPI", receiptId: "RCP-2412" },
    { id: "p2", date: "12 Apr 2025", amount: 3500, mode: "Card", receiptId: "RCP-2413" },
    { id: "p3", date: "02 Mar 2025", amount: 5000, mode: "Net Banking", receiptId: "RCP-2388" },
  ],
  "child-2": [
    { id: "p4", date: "08 Apr 2025", amount: 9000, mode: "UPI", receiptId: "RCP-2401" },
    { id: "p5", date: "08 Apr 2025", amount: 2800, mode: "Card", receiptId: "RCP-2402" },
  ],
};

const formatInr = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

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
  const { activeChild } = useParentPortal();
  const fees = MOCK_FEES[activeChild.id] ?? Object.values(MOCK_FEES)[0];
  const payments = MOCK_PAYMENTS[activeChild.id] ?? Object.values(MOCK_PAYMENTS)[0];

  const totalDue = useMemo(
    () => fees.filter((f) => f.status !== "Paid").reduce((sum, f) => sum + f.amount, 0),
    [fees],
  );

  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMode>("UPI");

  const openPay = () => {
    setAmount(String(totalDue));
    setMethod("UPI");
    setPayOpen(true);
  };

  const handlePay = async () => {
    const paid = Number(amount);
    if (!paid || paid <= 0) return;
    setPayOpen(false);
    notifySuccess("Payment successful");
    await Swal.fire({
      title: "Payment confirmed",
      text: `${formatInr(paid)} paid via ${method} for ${activeChild.name}.`,
      icon: "success",
      confirmButtonText: "OK",
      buttonsStyling: false,
      customClass: {
        popup: "swal-popup",
        title: "swal-title",
        htmlContainer: "swal-text",
        actions: "swal-actions",
        confirmButton: "swal-confirm",
      },
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Fees & Payments"
        subtitle={`Fee details and payment history for ${activeChild.name}.`}
      />

      <div
        className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)] sm:p-6"
        style={{ borderColor: PARENT_BORDER, background: "linear-gradient(135deg, #EEF2FF 0%, #FFFFFF 55%)" }}
      >
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B7280]">Total Due</p>
          <p className="mt-1 text-[32px] font-extrabold leading-none text-[#4F46E5]">{formatInr(totalDue)}</p>
          <p className="mt-2 text-[13px] text-[#6B7280]">Outstanding for {activeChild.className} - {activeChild.section}</p>
        </div>
        <Button variant="contained" disableElevation sx={primaryBtnSx} onClick={openPay} disabled={totalDue <= 0}>
          Pay Now
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
                <TableCell>Term</TableCell>
                <TableCell>Fee Head</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fees.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.term}</TableCell>
                  <TableCell>{row.head}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatInr(row.amount)}
                  </TableCell>
                  <TableCell>{row.dueDate}</TableCell>
                  <TableCell>
                    <StatusChip label={row.status} tone={FEE_STATUS_TONE[row.status]} />
                  </TableCell>
                </TableRow>
              ))}
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
                <TableCell align="center">Receipt</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.date}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {formatInr(row.amount)}
                  </TableCell>
                  <TableCell>{row.mode}</TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      aria-label={`Download receipt ${row.receiptId}`}
                      onClick={() => notifySuccess(`Downloading ${row.receiptId}`)}
                      sx={{ color: PARENT_PRIMARY }}
                    >
                      <DownloadRounded sx={{ fontSize: 20 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog open={payOpen} onClose={() => setPayOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800, fontSize: 18 }}>Pay Fees</DialogTitle>
        <DialogContent className="flex flex-col gap-4 !pt-2">
          <TextField
            label="Amount (₹)"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            select
            label="Payment method"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMode)}
            fullWidth
            size="small"
          >
            <MenuItem value="Card">Card</MenuItem>
            <MenuItem value="UPI">UPI</MenuItem>
            <MenuItem value="Net Banking">Net Banking</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setPayOpen(false)} sx={{ textTransform: "none", fontWeight: 600, color: "#6B7280" }}>
            Cancel
          </Button>
          <Button variant="contained" disableElevation sx={primaryBtnSx} onClick={() => void handlePay()}>
            Pay
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
