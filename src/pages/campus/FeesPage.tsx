import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AccountBalanceWalletOutlined,
  AddOutlined,
  DescriptionOutlined,
  DownloadOutlined,
  NotificationsActiveOutlined,
  PaymentsOutlined,
  PercentOutlined,
  ReceiptLongOutlined,
  SearchOutlined,
  SettingsOutlined,
  SwapHorizOutlined,
  TuneOutlined,
} from "@mui/icons-material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { CmsFooter, CmsPage, CmsPageHeader, CmsScrollBody } from "../../components/cms/CmsLayout";
import { CmsIconTabs, type CmsIconTabItem } from "../../components/cms/CmsIconTabs";
import { apiRequest } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";
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
import type { FeeSetup, FeesTab, Payment, Session, Student, StudentFees } from "./fees/types";
import { downloadCsv, headerForTab, studentDisplayName } from "./fees/utils";

const TABS: Array<CmsIconTabItem<FeesTab>> = [
  { key: "collect", label: "Collect Fees", icon: PaymentsOutlined, tone: "emerald" },
  { key: "dues", label: "Search Due Fees", icon: AccountBalanceWalletOutlined, tone: "rose" },
  { key: "search", label: "Search Payment", icon: SearchOutlined, tone: "sky" },
  { key: "carry", label: "Carry Forward", icon: SwapHorizOutlined, tone: "amber" },
  { key: "reminders", label: "Auto Reminders", icon: NotificationsActiveOutlined, tone: "orange" },
  { key: "receipts", label: "Receipts", icon: ReceiptLongOutlined, tone: "indigo" },
  { key: "custom", label: "Custom Fees", icon: TuneOutlined, tone: "violet" },
  { key: "invoices", label: "Fee Invoices", icon: DescriptionOutlined, tone: "blue" },
  { key: "discounts", label: "Discounts", icon: PercentOutlined, tone: "fuchsia" },
  { key: "structure", label: "Structure Setup", icon: SettingsOutlined, tone: "slate" },
];

export function FeesPage() {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [setup, setSetup] = useState<FeeSetup | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tab, setTab] = useState<FeesTab>("collect");
  const [studentId, setStudentId] = useState("");
  const [studentFees, setStudentFees] = useState<StudentFees | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receiptSearch, setReceiptSearch] = useState("");
  const [showCollect, setShowCollect] = useState(false);
  const [preselectAssignmentIds, setPreselectAssignmentIds] = useState<string[]>([]);
  const [duesExport, setDuesExport] = useState<(() => void) | null>(null);
  const [customFocusSignal, setCustomFocusSignal] = useState(0);
  const [discountCreateSignal, setDiscountCreateSignal] = useState(0);
  const [discountAssignSignal, setDiscountAssignSignal] = useState(0);
  const [invoiceCreateSignal, setInvoiceCreateSignal] = useState(0);
  const [invoiceExportSignal, setInvoiceExportSignal] = useState(0);

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
      const [nextSetup, nextSessions] = await Promise.all([
        apiRequest<FeeSetup>("/fees/setup", accessToken),
        apiRequest<{ sessions: Session[] }>("/academics/setup", accessToken).then(
          (data) => data.sessions,
        ),
      ]);
      setSetup(nextSetup);
      setSessions(nextSessions);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load fees");
    }
  }

  async function loadPayments(query?: string) {
    try {
      const path = query?.trim()
        ? `/fees/payments?query=${encodeURIComponent(query.trim())}`
        : "/fees/payments";
      setPayments(await apiRequest<Payment[]>(path, accessToken));
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load receipts");
    }
  }

  async function loadStudent(id: string) {
    setStudentId(id);
    if (!id) {
      setStudentFees(null);
      return;
    }
    try {
      setStudentFees(await apiRequest<StudentFees>(`/fees/students/${id}`, accessToken));
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load student fees");
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  useEffect(() => {
    const fromQuery = searchParams.get("studentId")?.trim() ?? "";
    const action = searchParams.get("action")?.trim() ?? "";
    if (!fromQuery || !setup) return;
    void (async () => {
      if (action === "collect") {
        await openCollect(fromQuery);
      } else {
        setTab("collect");
        await loadStudent(fromQuery);
      }
      const next = new URLSearchParams(searchParams);
      next.delete("studentId");
      next.delete("action");
      setSearchParams(next, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup, searchParams]);

  useEffect(() => {
    if (tab === "receipts") void loadPayments(receiptSearch);
  }, [tab, accessToken]);

  useEffect(() => {
    if (tab !== "receipts") {
      setShowCollect(false);
    }
  }, [tab]);

  async function openCollect(forStudentId: string, assignmentIds: string[] = []) {
    setPreselectAssignmentIds(assignmentIds);
    setTab("collect");
    setShowCollect(false);
    await loadStudent(forStudentId);
  }

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
            onClick={() => {
              setPreselectAssignmentIds([]);
              setShowCollect(true);
            }}
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
          <button
            type="button"
            className="nx-btn-secondary"
            onClick={() => setInvoiceExportSignal((value) => value + 1)}
          >
            <DownloadOutlined sx={{ fontSize: 16 }} />
            Export CSV
          </button>
          <button
            type="button"
            className="nx-btn-primary"
            onClick={() => setInvoiceCreateSignal((value) => value + 1)}
          >
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
          <button
            type="button"
            className="nx-btn-primary"
            onClick={() => setDiscountAssignSignal((value) => value + 1)}
          >
            <AddOutlined sx={{ fontSize: 16 }} />
            Assign Discount
          </button>
          <button
            type="button"
            className="nx-btn-primary"
            onClick={() => setDiscountCreateSignal((value) => value + 1)}
          >
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
          tab === "carry"
            ? `Manage student balances moving from previous academic session to the current session${setup?.currentSession ? ` (${setup.currentSession.name})` : ""}.`
            : header.description
        }
        actions={headerActions}
      />

      <CmsIconTabs
        ariaLabel="Fees sections"
        value={tab}
        onChange={setTab}
        columnsClass="grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-5"
        items={TABS}
      />

      <CmsScrollBody>
      {tab === "collect" && setup ? (
        <CollectPanel
          setup={setup}
          students={students}
          studentId={studentId}
          studentFees={studentFees}
          defaultReceiptBookId={defaultReceiptBookId}
          preselectAssignmentIds={preselectAssignmentIds}
          token={accessToken}
          onStudentChange={loadStudent}
          onSaved={async (payment) => {
            if (studentId) await loadStudent(studentId);
            await load();
            setPreselectAssignmentIds([]);
            notifySuccess("Opening fee receipt…");
            navigate(`/print/fees/${payment.id}`);
          }}
          onError={notifyError}
        />
      ) : null}

      {tab === "dues" && setup ? (
        <DuesPanel
          setup={setup}
          sessions={sessions}
          token={accessToken}
          onError={notifyError}
          onExportReady={onExportReady}
          onCollect={(id, assignmentId) =>
            void openCollect(id, assignmentId ? [assignmentId] : [])
          }
        />
      ) : null}

      {tab === "search" ? <SearchPanel token={accessToken} onError={notifyError} /> : null}

      {tab === "carry" && setup ? (
        <CarryPanel
          setup={setup}
          sessions={sessions}
          students={students}
          token={accessToken}
          onSaved={load}
          onError={notifyError}
        />
      ) : null}

      {tab === "reminders" && setup ? (
        <RemindersPanel
          setting={setup.setting}
          token={accessToken}
          onSaved={load}
          onError={notifyError}
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
              preselectAssignmentIds={preselectAssignmentIds}
              token={accessToken}
              embedded
              onStudentChange={loadStudent}
              onSaved={async (payment) => {
                if (studentId) await loadStudent(studentId);
                await load();
                await loadPayments(receiptSearch);
                setShowCollect(false);
                setPreselectAssignmentIds([]);
                notifySuccess("Opening receipt for print…");
                navigate(`/print/fees/${payment.id}`);
              }}
              onError={notifyError}
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
            onError={notifyError}
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
          onError={notifyError}
          focusCreateSignal={customFocusSignal}
        />
      ) : null}

      {tab === "invoices" && setup ? (
        <FeeInvoicesPanel
          setup={setup}
          token={accessToken}
          openCreateSignal={invoiceCreateSignal}
          exportSignal={invoiceExportSignal}
          onCollect={(id, assignmentIds) => void openCollect(id, assignmentIds)}
        />
      ) : null}

      {tab === "discounts" && setup ? (
        <DiscountsPanel
          setup={setup}
          token={accessToken}
          onSaved={load}
          onError={notifyError}
          openCreateSignal={discountCreateSignal}
          openAssignSignal={discountAssignSignal}
        />
      ) : null}

      {tab === "structure" && setup ? (
        <SetupPanel setup={setup} token={accessToken} onSaved={load} onError={notifyError} />
      ) : null}

      {!setup ? (
        <p className="mt-8 text-center text-sm text-slate-500">Loading fees…</p>
      ) : null}
      </CmsScrollBody>

      <CmsFooter />
    </CmsPage>
  );
}
