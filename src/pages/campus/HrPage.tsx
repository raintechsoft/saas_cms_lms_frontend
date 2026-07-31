import { useEffect, useState } from "react";
import { AddOutlined } from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import {
  CmsFooter,
  CmsPage,
  CmsPageHeader,
  CmsScrollBody,
  CmsTab,
  CmsTabs,
} from "../../components/cms/CmsLayout";
import { apiRequest } from "../../lib/api";
import { notifyError } from "../../lib/notify";
import { AddStaffPanel } from "./hr/AddStaffPanel";
import { HrReportsPanel } from "./hr/HrReportsPanel";
import { HrSetupPanel } from "./hr/HrSetupPanel";
import { LeavePanel } from "./hr/LeavePanel";
import { PayrollPanel } from "./hr/PayrollPanel";
import { StaffAttendancePanel } from "./hr/StaffAttendancePanel";
import { StaffListPanel } from "./hr/StaffListPanel";
import { TeacherRatingsPanel } from "./hr/TeacherRatingsPanel";
import type { HrSetup, HrTab } from "./hr/types";

const TABS: Array<[HrTab, string]> = [
  ["staff", "Staff List"],
  ["setup", "Setup"],
  ["attendance", "Staff Attendance"],
  ["leave", "Leave Management"],
  ["payroll", "Payroll"],
  ["ratings", "Teacher Ratings"],
  ["reports", "Reports"],
];

const currentMonth = new Date().toISOString().slice(0, 7);

export function HrPage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<HrTab>("staff");
  const [month, setMonth] = useState(currentMonth);
  const [setup, setSetup] = useState<HrSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"list" | "add">("list");

  async function load(selectedMonth = month) {
    setLoading(true);
    try {
      setSetup(await apiRequest<HrSetup>(`/hr/setup?month=${selectedMonth}-01`, accessToken));
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load HR & payroll");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {setup?.currentSession ? (
        <span className="nx-pill nx-pill-indigo">{setup.currentSession.name}</span>
      ) : (
        <span className="nx-pill nx-pill-warning">No active session</span>
      )}
      {tab === "staff" ? (
        <button type="button" className="nx-btn-primary" onClick={() => setMode("add")}>
          <AddOutlined sx={{ fontSize: 16 }} /> Add staff
        </button>
      ) : null}
    </div>
  );

  if (mode === "add" && setup) {
    return (
      <CmsPage>
        <CmsScrollBody>
          <AddStaffPanel
            setup={setup}
            token={accessToken}
            onCancel={() => setMode("list")}
            onSaved={async () => {
              setMode("list");
              await load();
            }}
            onError={notifyError}
          />
        </CmsScrollBody>
        <CmsFooter />
      </CmsPage>
    );
  }

  return (
    <CmsPage>
      <CmsPageHeader
        title="HR & Payroll"
        description="Manage staff records, attendance, leave, and payroll."
        actions={headerActions}
      />

      <CmsTabs>
        {TABS.map(([key, label]) => (
          <CmsTab key={key} active={tab === key} onClick={() => setTab(key)}>
            {label}
          </CmsTab>
        ))}
      </CmsTabs>

      <CmsScrollBody>
        {!setup ? (
          <p className="mt-8 text-center text-sm text-slate-500">
            {loading ? "Loading HR & payroll…" : "Unable to load HR & payroll."}
          </p>
        ) : (
          <>
            {tab === "staff" ? (
              <StaffListPanel
                setup={setup}
                token={accessToken}
                onSaved={load}
                onError={notifyError}
              />
            ) : null}
            {tab === "setup" ? (
              <HrSetupPanel
                setup={setup}
                token={accessToken}
                onSaved={load}
                onError={notifyError}
              />
            ) : null}
            {tab === "attendance" ? (
              <StaffAttendancePanel
                setup={setup}
                token={accessToken}
                onSaved={load}
                onError={notifyError}
              />
            ) : null}
            {tab === "leave" ? (
              <LeavePanel
                setup={setup}
                token={accessToken}
                onSaved={load}
                onError={notifyError}
              />
            ) : null}
            {tab === "payroll" ? (
              <PayrollPanel
                setup={setup}
                month={month}
                onMonthChange={(next) => {
                  setMonth(next);
                  void load(next);
                }}
                token={accessToken}
                onSaved={load}
                onError={notifyError}
              />
            ) : null}
            {tab === "ratings" ? (
              <TeacherRatingsPanel
                setup={setup}
                token={accessToken}
                onSaved={load}
                onError={notifyError}
              />
            ) : null}
            {tab === "reports" ? (
              <HrReportsPanel setup={setup} token={accessToken} onError={notifyError} />
            ) : null}
          </>
        )}
      </CmsScrollBody>

      <CmsFooter />
    </CmsPage>
  );
}
