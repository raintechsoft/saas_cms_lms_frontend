import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AddOutlined,
  DownloadOutlined,
  ReceiptLongOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import { CmsFooter, CmsPage, CmsPageHeader, CmsTab, CmsTabs } from "../../components/cms/CmsLayout";
import { apiRequest } from "../../lib/api";
import { CarryPanel } from "./fees/CarryPanel";
import { CollectPanel } from "./fees/CollectPanel";
import { CustomFeesPanel } from "./fees/CustomFeesPanel";
import { DuesPanel } from "./fees/DuesPanel";
import { FeeInvoicesPanel } from "./fees/FeeInvoicesPanel";
import { ReceiptsPanel } from "./fees/ReceiptsPanel";
import { RemindersPanel } from "./fees/RemindersPanel";
import { SearchPanel } from "./fees/SearchPanel";
import { DiscountsPanel } from "./fees/DiscountsPanel";
import { SetupPanel } from "./fees/SetupPanel";
import type { FeeSetup, FeeSummary, FeesTab, Payment, Session, Student, StudentFees } from "./fees/types";
import { downloadCsv, headerForTab, studentDisplayName } from "./fees/utils";

const TABS: Array<[FeesTab, string]> = [
  ["dues", "Due Fees"],
  ["search", "Payment Search"],
  ["carry", "Carry Forward"],
  ["reminders", "Auto Reminders"],
  ["receipts", "Receipts"],
  ["custom", "Custom Fees"],
  ["invoices", "Fee Invoices"],
  ["discounts", "Discounts"],
  ["structure", "Structure Setup"],
];

export function FeesPage() {
  const { accessToken, user } = useAuth();
  const [setup, setSetup] = useState<FeeSetup | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tab, setTab] = useState<FeesTab>("dues");
  const [studentId, setStudentId] = useState("");
  const [studentFees, setStudentFees] = useState<StudentFees | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoiceSummary, setInvoiceSummary] = useState<FeeSummary | null>(null);
  const [receiptSearch, setReceiptSearch] = useState("");
  const [error, setError] = useState("");
  const [showCollect, setShowCollect] = useState(false);
  const [duesExport, setDuesExport] = useState<(() => void) | null>(null);
  const [customFocusSignal, setCustomFocusSignal] = useState(0);

  const students = useMemo(() => {
    const byId = new Map<string, Student>();
    setup?.classSections.forEach(({ enrollments }) =>
      enrollments.forEach(({ student }) => byId.set(student.id, student)),
    );
    return [...byId.values()];
  }, [setup]);

  const defaultReceiptBookId = useMemo(
    () => setup?.receiptBooks.find((book) => book.isDefault)?.id ?? setup?.receiptBooks[0]?.id ?? "",
    [setup],
  );

  const header = headerForTab(tab);

  const onExportReady = useCallback((fn: (() => void) | null) => {
    setDuesExport(() => fn);
  }, []);

  async function load() {
    try {
      setError("");
      const [nextSetup, nextSessions] = await Promise.all([
        apiRequest<FeeSetup>("/fees/setup", accessToken),
        apiRequest<{ sessions: Session[] }>("/academics/setup", accessToken).then(
          (data) => data.sessions,
        ),
      ]);
      setSetup(nextSetup);
      setSessions(nextSessions);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load fees");
    }
  }

  async function loadPayments(query?: string) {
    try {
      setError("");
      const path = query?.trim()
        ? `/fees/payments?query=${encodeURIComponent(query.trim())}`
        : "/fees/payments";
      setPayments(await apiRequest<Payment[]>(path, accessToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load receipts");
    }
  }

  async function loadInvoiceSummary() {
    if (!setup?.currentSession?.id) {
      setInvoiceSummary(null);
      return;
    }
    try {
      const summary = await apiRequest<FeeSummary>(
        `/fees/reports/summary?sessionId=${setup.currentSession.id}`,
        accessToken,
      );
      setInvoiceSummary(summary);
    } catch {
      setInvoiceSummary(null);
    }
  }

  async function loadStudent(id: string) {
    setStudentId(id);
    if (!id) {
      setStudentFees(null);
      return;
    }
    try {
      setError("");
      setStudentFees(await apiRequest<StudentFees>(`/fees/students/${id}`, accessToken));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load student fees");
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  useEffect(() => {
    if (tab === "receipts" || tab === "invoices") void loadPayments(receiptSearch);
  }, [tab, accessToken]);

  useEffect(() => {
    if (tab === "invoices") void loadInvoiceSummary();
  }, [tab, accessToken, setup?.currentSession?.id]);

  useEffect(() => {
    setShowCollect(false);
  }, [tab]);

  function exportReceipts() {
    downloadCsv(
      "fee-receipts.csv",
      ["receiptNumber", "paymentId", "student", "amount", "date", "status"],
      payments.map((p) => [
        p.receiptNumber,
        p.paymentId,
        studentDisplayName(p.student),
        String(p.amount),
        p.paymentDate.slice(0, 10),
        p.status,
      ]),
    );
  }

  function exportMasters() {
    if (!setup) return;
    downloadCsv(
      "custom-fees.csv",
      ["feeName", "group", "class", "amount", "dueDate"],
      setup.masters.map((m) => [
        m.feeType.name,
        m.feeGroup.name,
        m.classSection
          ? `${m.classSection.academicClass.name}-${m.classSection.section.name}`
          : "All",
        String(m.amount),
        m.dueDate.slice(0, 10),
      ]),
    );
  }

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {tab === "dues" ? (
        <button type="button" className="nx-btn-secondary" onClick={() => duesExport?.()}>
          <DownloadOutlined sx={{ fontSize: 16 }} />
          Export CSV
        </button>
      ) : null}
      {tab === "search" ? (
        <button type="button" className="nx-btn-secondary" onClick={exportReceipts}>
          <DownloadOutlined sx={{ fontSize: 16 }} />
          Export CSV
        </button>
      ) : null}
      {tab === "carry" || tab === "reminders" ? (
        <button type="button" className="nx-btn-secondary" disabled title="Export not available for this tab">
          <DownloadOutlined sx={{ fontSize: 16 }} />
          Export CSV
        </button>
      ) : null}
      {tab === "receipts" ? (
        <>
          <button type="button" className="nx-btn-secondary" onClick={exportReceipts}>
            <DownloadOutlined sx={{ fontSize: 16 }} />
            Export CSV
          </button>
          <button
            type="button"
            className="nx-btn-primary"
            onClick={() => setShowCollect(true)}
          >
            <AddOutlined sx={{ fontSize: 16 }} />
            Generate New Receipt
          </button>
        </>
      ) : null}
      {tab === "custom" ? (
        <>
          <button
            type="button"
            className="nx-btn-secondary"
            onClick={() =>
              downloadCsv(
                "custom-fees.csv",
                ["name", "target", "amount", "status", "createdAt"],
                (setup?.masters ?? [])
                  .filter((master) => master.isCustom)
                  .map((master) => [
                    master.feeType.name,
                    master.classSection
                      ? `${master.classSection.academicClass.name} - ${master.classSection.section.name}`
                      : (master.feeType.code ?? "").startsWith("CUSTOM_IND")
                        ? "Individual Basis"
                        : "All Students",
                    String(master.amount),
                    master.feeType.isActive === false ? "Inactive" : "Active",
                    master.createdAt ? master.createdAt.slice(0, 10) : "",
                  ]),
              )
            }
          >
            <DownloadOutlined sx={{ fontSize: 16 }} />
            Export CSV
          </button>
          <button
            type="button"
            className="nx-btn-primary"
            onClick={() => setCustomFocusSignal((value) => value + 1)}
          >
            <AddOutlined sx={{ fontSize: 16 }} />
            New Category
          </button>
        </>
      ) : null}
      {tab === "invoices" ? (
        <>
          <button type="button" className="nx-btn-secondary" onClick={exportReceipts}>
            <DownloadOutlined sx={{ fontSize: 16 }} />
            Export CSV
          </button>
          <button type="button" className="nx-btn-primary" onClick={() => setShowCollect(true)}>
            <AddOutlined sx={{ fontSize: 16 }} />
            Generate Invoice
          </button>
        </>
      ) : null}
      {tab === "discounts" ? (
        <>
          <button
            type="button"
            className="nx-btn-secondary"
            onClick={() =>
              downloadCsv(
                "fee-discounts.csv",
                ["name", "type", "value", "status"],
                (setup?.discounts ?? []).map((d) => [
                  d.name,
                  d.type,
                  String(d.value),
                  d.isActive === false ? "Inactive" : "Active",
                ]),
              )
            }
          >
            <DownloadOutlined sx={{ fontSize: 16 }} />
            Export CSV
          </button>
          <button type="button" className="nx-btn-primary" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <AddOutlined sx={{ fontSize: 16 }} />
            Add discount
          </button>
        </>
      ) : null}
      {tab === "structure" ? (
        <>
          <button type="button" className="nx-btn-secondary" onClick={exportMasters}>
            <DownloadOutlined sx={{ fontSize: 16 }} />
            Export CSV
          </button>
          <button
            type="button"
            className="rounded-lg border border-[#6366f1] bg-white px-3 py-2 text-[13px] font-semibold text-[#6366f1] hover:bg-indigo-50"
            onClick={exportMasters}
          >
            <span className="inline-flex items-center gap-1.5">
              <AddOutlined sx={{ fontSize: 16 }} />
              Bulk Export
            </span>
          </button>
        </>
      ) : null}
      {setup?.currentSession ? (
        <span className="nx-pill nx-pill-indigo">{setup.currentSession.name}</span>
      ) : null}
    </div>
  );

  return (
    <CmsPage>
      <CmsPageHeader
        title={header.title}
        description={
          tab === "dues"
            ? "Monitor and manage outstanding student fee records across all departments."
            : tab === "search"
              ? "Retrieve student payment records and digital receipts using unique Transaction IDs."
              : tab === "carry"
                ? `Manage student balances moving from previous academic session to the current session${setup?.currentSession ? ` (${setup.currentSession.name})` : ""}.`
                : tab === "reminders"
                  ? "Configure automated schedule for payment due notices and overdue reminders."
                  : tab === "receipts"
                    ? "View and manage fee collection receipts generated for students."
                    : tab === "custom"
                      ? "Configure and manage individual or group-based custom fee structures."
                    : tab === "invoices"
                      ? "Manage student billing, arrears, receipt generation, and automated financial reminders."
                      : tab === "discounts"
                        ? "Maintain active discounts and concessions available for student fee assignments."
                        : "Configure fee type, fee group, and fee master structures."
        }
        actions={headerActions}
      />

      {error ? <p className="alert-error mt-4">{error}</p> : null}

      <CmsTabs>
        {TABS.map(([key, label]) => (
          <CmsTab key={key} active={tab === key} onClick={() => setTab(key)}>
            {label}
          </CmsTab>
        ))}
      </CmsTabs>

      {tab === "dues" && setup ? (
        <DuesPanel
          setup={setup}
          sessions={sessions}
          token={accessToken}
          onError={setError}
          onExportReady={onExportReady}
        />
      ) : null}

      {tab === "search" ? <SearchPanel token={accessToken} onError={setError} /> : null}

      {tab === "carry" && setup ? (
        <CarryPanel
          setup={setup}
          sessions={sessions}
          students={students}
          token={accessToken}
          onSaved={load}
          onError={setError}
        />
      ) : null}

      {tab === "reminders" && setup ? (
        <RemindersPanel
          setting={setup.setting}
          token={accessToken}
          onSaved={load}
          onError={setError}
        />
      ) : null}

      {tab === "receipts" ? (
        showCollect && setup ? (
          <div className="mt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <ReceiptLongOutlined sx={{ fontSize: 18 }} className="text-indigo-600" />
                Generate New Receipt
              </div>
              <button type="button" className="nx-btn-secondary" onClick={() => setShowCollect(false)}>
                Back to receipts
              </button>
            </div>
            <CollectPanel
              setup={setup}
              students={students}
              studentId={studentId}
              studentFees={studentFees}
              defaultReceiptBookId={defaultReceiptBookId}
              token={accessToken}
              onStudentChange={loadStudent}
              onSaved={async () => {
                if (studentId) await loadStudent(studentId);
                await load();
                await loadPayments(receiptSearch);
                setShowCollect(false);
              }}
              onError={setError}
            />
          </div>
        ) : (
          <ReceiptsPanel
            payments={payments}
            search={receiptSearch}
            token={accessToken}
            onSearchChange={setReceiptSearch}
            onSearch={() => void loadPayments(receiptSearch)}
            onRevert={() => void loadPayments(receiptSearch)}
            onError={setError}
            onCollectClick={() => setShowCollect(true)}
          />
        )
      ) : null}

      {tab === "custom" && setup ? (
        <CustomFeesPanel
          setup={setup}
          token={accessToken}
          schoolName={user?.tenant?.name}
          onSaved={load}
          onError={setError}
          focusCreateSignal={customFocusSignal}
        />
      ) : null}

      {tab === "invoices" ? (
        <FeeInvoicesPanel
          payments={payments}
          summary={invoiceSummary}
          search={receiptSearch}
          onSearchChange={setReceiptSearch}
        />
      ) : null}

      {tab === "discounts" && setup ? (
        <DiscountsPanel setup={setup} token={accessToken} onSaved={load} onError={setError} />
      ) : null}

      {tab === "structure" && setup ? (
        <SetupPanel setup={setup} token={accessToken} onSaved={load} onError={setError} />
      ) : null}

      {!setup && !error ? (
        <p className="mt-8 text-center text-sm text-slate-500">Loading fees…</p>
      ) : null}

      <CmsFooter />
    </CmsPage>
  );
}
