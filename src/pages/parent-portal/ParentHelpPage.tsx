import { useRef, useState } from "react";
import { AttachFileOutlined } from "@mui/icons-material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  MenuItem,
  TextField,
} from "@mui/material";
import { notifyError, notifySuccess } from "../../lib/notify";
import { PARENT_BORDER, PARENT_PRIMARY } from "./ParentPortalLayout";
import { useParentPortal } from "./ParentPortalContext";
import { PageHeader } from "./components/PageHeader";
import { StatusChip } from "./components/StatusChip";

type TicketStatus = "Open" | "In Progress" | "Resolved";
type TicketCategory = "Fees" | "Attendance" | "Academics" | "Technical" | "Other";

interface Ticket {
  id: string;
  subject: string;
  category: TicketCategory;
  createdOn: string;
  status: TicketStatus;
}

const FAQ_GROUPS: { group: string; items: { q: string; a: string }[] }[] = [
  {
    group: "Fees",
    items: [
      {
        q: "How do I pay fees online?",
        a: "Go to Fees & Payments, select the pending invoice, choose a payment method, and complete the checkout. A receipt will appear under Payment History.",
      },
      {
        q: "When is the late fee applied?",
        a: "A late fee is applied from the day after the due date shown on your invoice. Contact the accounts office if you need an extension.",
      },
    ],
  },
  {
    group: "Attendance",
    items: [
      {
        q: "How do I apply for leave?",
        a: "Open Attendance, tap Apply Leave, choose dates and reason, then submit. Class teachers are notified automatically.",
      },
      {
        q: "Why is attendance showing absent?",
        a: "If your child was present, ask the class teacher to review the day's marking. Corrections usually reflect within 24 hours.",
      },
    ],
  },
  {
    group: "Academics",
    items: [
      {
        q: "Where can I see homework?",
        a: "Under Academics → Homework you will find pending and submitted tasks for the active child.",
      },
      {
        q: "When are exam results published?",
        a: "Results appear under Examination & Results once teachers publish marks. You will also receive an announcement alert.",
      },
    ],
  },
  {
    group: "Technical",
    items: [
      {
        q: "I forgot my password. What should I do?",
        a: "Use Forgot Password on the login screen, or change it from Settings → Change Password after signing in.",
      },
      {
        q: "The app is not loading. How do I fix it?",
        a: "Try refreshing, clearing browser cache, or switching networks. If the issue persists, raise a Technical support ticket below.",
      },
    ],
  },
];

const INITIAL_TICKETS: Ticket[] = [
  {
    id: "TKT-1042",
    subject: "Fee receipt not downloading",
    category: "Fees",
    createdOn: "22 May 2025",
    status: "Resolved",
  },
  {
    id: "TKT-1098",
    subject: "Attendance correction for 18 May",
    category: "Attendance",
    createdOn: "26 May 2025",
    status: "In Progress",
  },
  {
    id: "TKT-1120",
    subject: "Unable to open live class link",
    category: "Technical",
    createdOn: "30 May 2025",
    status: "Open",
  },
];

const STATUS_TONE: Record<TicketStatus, "blue" | "orange" | "green"> = {
  Open: "blue",
  "In Progress": "orange",
  Resolved: "green",
};

const inputSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "12px",
    fontSize: 13.5,
    "& fieldset": { borderColor: PARENT_BORDER },
    "&.Mui-focused fieldset": { borderColor: PARENT_PRIMARY },
  },
};

export function ParentHelpPage() {
  const { activeChild } = useParentPortal();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tickets, setTickets] = useState(INITIAL_TICKETS);
  const [form, setForm] = useState({
    subject: "",
    category: "Technical" as TicketCategory,
    description: "",
    fileName: "",
  });

  function submitTicket() {
    if (!form.subject.trim() || !form.description.trim()) {
      notifyError("Please fill subject and description");
      return;
    }
    const id = `TKT-${1100 + tickets.length + 1}`;
    setTickets((prev) => [
      {
        id,
        subject: form.subject.trim(),
        category: form.category,
        createdOn: new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        status: "Open",
      },
      ...prev,
    ]);
    setForm({ subject: "", category: "Technical", description: "", fileName: "" });
    if (fileRef.current) fileRef.current.value = "";
    notifySuccess(`Support ticket ${id} submitted`);
  }

  return (
    <div>
      <PageHeader
        title="Help / Support"
        subtitle={`FAQs and support for ${activeChild.name.split(" ")[0]}'s parent account`}
      />

      <div className="mb-6">
        <h2 className="mb-3 text-[15px] font-bold text-[#1A1A2E]">Frequently Asked Questions</h2>
        <div className="flex flex-col gap-4">
          {FAQ_GROUPS.map((group) => (
            <div
              key={group.group}
              className="overflow-hidden rounded-[20px] border bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
              style={{ borderColor: PARENT_BORDER }}
            >
              <div className="border-b px-5 py-3" style={{ borderColor: PARENT_BORDER }}>
                <h3 className="text-[14px] font-bold" style={{ color: PARENT_PRIMARY }}>
                  {group.group}
                </h3>
              </div>
              {group.items.map((item) => (
                <Accordion
                  key={item.q}
                  disableGutters
                  elevation={0}
                  sx={{
                    "&:before": { display: "none" },
                    borderBottom: `1px solid ${PARENT_BORDER}`,
                    "&:last-of-type": { borderBottom: "none" },
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <span className="pr-2 text-[13.5px] font-semibold text-[#1A1A2E]">{item.q}</span>
                  </AccordionSummary>
                  <AccordionDetails>
                    <p className="text-[13px] leading-relaxed text-[#6B7280]">{item.a}</p>
                  </AccordionDetails>
                </Accordion>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div
        className="mb-6 rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)] sm:p-6"
        style={{ borderColor: PARENT_BORDER }}
      >
        <h2 className="mb-4 text-[15px] font-bold text-[#1A1A2E]">Raise Support Ticket</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="Subject"
            size="small"
            fullWidth
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            sx={inputSx}
          />
          <TextField
            select
            label="Category"
            size="small"
            fullWidth
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as TicketCategory }))}
            sx={inputSx}
          >
            {(["Fees", "Attendance", "Academics", "Technical", "Other"] as TicketCategory[]).map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Description"
            size="small"
            fullWidth
            multiline
            minRows={3}
            className="sm:col-span-2"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            sx={inputSx}
          />
          <div className="sm:col-span-2">
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setForm((f) => ({ ...f, fileName: file?.name ?? "" }));
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-3.5 text-[12.5px] font-semibold text-[#374151]"
              style={{ borderColor: PARENT_BORDER }}
            >
              <AttachFileOutlined sx={{ fontSize: 18 }} />
              {form.fileName || "Attach file"}
            </button>
          </div>
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={submitTicket}
              className="h-10 rounded-xl px-5 text-[13px] font-bold text-white"
              style={{ background: PARENT_PRIMARY }}
            >
              Submit ticket
            </button>
          </div>
        </div>
      </div>

      <div
        className="overflow-hidden rounded-[20px] border bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
        style={{ borderColor: PARENT_BORDER }}
      >
        <div className="border-b px-5 py-4" style={{ borderColor: PARENT_BORDER }}>
          <h2 className="text-[15px] font-bold text-[#1A1A2E]">Past Tickets</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr
                className="border-b bg-[#F9FAFB] text-[12px] font-bold uppercase tracking-wide text-[#6B7280]"
                style={{ borderColor: PARENT_BORDER }}
              >
                <th className="px-5 py-3">Ticket ID</th>
                <th className="px-5 py-3">Subject</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b last:border-b-0" style={{ borderColor: PARENT_BORDER }}>
                  <td className="px-5 py-3.5 text-[13px] font-semibold" style={{ color: PARENT_PRIMARY }}>
                    {t.id}
                  </td>
                  <td className="px-5 py-3.5 text-[13.5px] font-medium text-[#1A1A2E]">{t.subject}</td>
                  <td className="px-5 py-3.5 text-[13px] text-[#6B7280]">{t.category}</td>
                  <td className="px-5 py-3.5 text-[13px] text-[#6B7280]">{t.createdOn}</td>
                  <td className="px-5 py-3.5">
                    <StatusChip label={t.status} tone={STATUS_TONE[t.status]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
