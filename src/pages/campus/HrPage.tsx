import { useEffect, useState } from "react";
import {
  AddOutlined,
  AssessmentOutlined,
  EventBusyOutlined,
  GroupsOutlined,
  PaymentsOutlined,
  PersonOffOutlined,
  SettingsOutlined,
  StarOutline,
  TodayOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import {
  CmsFooter,
  CmsPage,
  CmsPageHeader,
  CmsScrollBody,
} from "../../components/cms/CmsLayout";
import { CmsIconTabs, type CmsIconTabItem } from "../../components/cms/CmsIconTabs";
import { apiRequest } from "../../lib/api";
import { notifyError } from "../../lib/notify";
import { AddStaffPanel } from "./hr/AddStaffPanel";
import { DisableStaffModal } from "./hr/DisableStaffModal";
import { DisabledStaffPanel } from "./hr/DisabledStaffPanel";
import { HrReportsPanel } from "./hr/HrReportsPanel";
import { HrSetupPanel } from "./hr/HrSetupPanel";
import { LeavePanel } from "./hr/LeavePanel";
import { PayrollPanel } from "./hr/PayrollPanel";
import { Staff360Panel } from "./hr/Staff360Panel";
import { StaffAttendancePanel } from "./hr/StaffAttendancePanel";
import { StaffListPanel } from "./hr/StaffListPanel";
import { TeacherRatingsPanel } from "./hr/TeacherRatingsPanel";
import type { HrSetup, HrTab, Staff } from "./hr/types";

const TABS: Array<CmsIconTabItem<HrTab>> = [
  { key: "staff", label: "Staff List", icon: GroupsOutlined, tone: "indigo" },
  { key: "disabled", label: "Disabled Staff", icon: PersonOffOutlined, tone: "rose" },
  { key: "setup", label: "Setup", icon: SettingsOutlined, tone: "slate" },
  { key: "attendance", label: "Staff Attendance", icon: TodayOutlined, tone: "amber" },
  { key: "leave", label: "Leave Management", icon: EventBusyOutlined, tone: "rose" },
  { key: "payroll", label: "Payroll", icon: PaymentsOutlined, tone: "emerald" },
  { key: "ratings", label: "Teacher Ratings", icon: StarOutline, tone: "amber" },
  { key: "reports", label: "Reports", icon: AssessmentOutlined, tone: "purple" },
];

const currentMonth = new Date().toISOString().slice(0, 7);

export function HrPage() {
  const { accessToken } = useAuth();
  const [tab, setTab] = useState<HrTab>("staff");
  const [month, setMonth] = useState(currentMonth);
  const [setup, setSetup] = useState<HrSetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"list" | "add">("list");
  const [staff360Id, setStaff360Id] = useState<string | null>(null);
  const [disableTarget, setDisableTarget] = useState<Staff | null>(null);
  const [pendingEdit, setPendingEdit] = useState<Staff | null>(null);

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

      <CmsIconTabs
        ariaLabel="HR sections"
        value={tab}
        onChange={setTab}
        columnsClass="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8"
        items={TABS}
      />

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
                onViewStaff={setStaff360Id}
                pendingEdit={pendingEdit}
                onPendingEditHandled={() => setPendingEdit(null)}
              />
            ) : null}
            {tab === "disabled" ? (
              <DisabledStaffPanel
                token={accessToken}
                onViewStaff={setStaff360Id}
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

      {staff360Id && setup ? (
        <Staff360Panel
          staffId={staff360Id}
          setup={setup}
          token={accessToken}
          onClose={() => setStaff360Id(null)}
          onSaved={load}
          onError={notifyError}
          onEditProfile={(member) => {
            setStaff360Id(null);
            setTab("staff");
            setPendingEdit(member);
          }}
          onDisable={(member) => setDisableTarget(member)}
        />
      ) : null}

      {disableTarget ? (
        <DisableStaffModal
          member={disableTarget}
          token={accessToken}
          onClose={() => setDisableTarget(null)}
          onSaved={async () => {
            await load();
            setStaff360Id(null);
          }}
          onError={notifyError}
        />
      ) : null}

      <CmsFooter />
    </CmsPage>
  );
}
