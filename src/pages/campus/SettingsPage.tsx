import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
import { apiRequest } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";

interface Settings {
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  timezone: string;
  dateFormat: string;
  attendanceType: "DAY_WISE" | "PERIOD_WISE" | "BIOMETRIC";
  autoAdmissionNumber: boolean;
  admissionPrefix: string | null;
  nextAdmissionNumber: number;
  autoStaffNumber: boolean;
  staffPrefix: string | null;
  nextStaffNumber: number;
  teacherRestricted: boolean;
  examResultType: "GENERAL" | "SCHOOL_GRADING" | "COLLEGE_GRADING" | "GPA";
  onlineAdmission: boolean;
  liveClassAutoAttendance: boolean;
}

type SettingsResponse = Settings & { id: string; tenantId: string; updatedAt: string };

function settingsUpdatePayload(settings: Settings | SettingsResponse) {
  const {
    nextAdmissionNumber: _nextAdmissionNumber,
    nextStaffNumber: _nextStaffNumber,
    id: _id,
    tenantId: _tenantId,
    updatedAt: _updatedAt,
    ...payload
  } = settings as SettingsResponse;
  return payload;
}

export function SettingsPage() {
  const { accessToken } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    apiRequest<SettingsResponse>("/settings", accessToken)
      .then((data) => setSettings(data))
      .catch((cause) => {
        notifyError(cause instanceof Error ? cause.message : "Unable to load settings");
      });
  }, [accessToken]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    try {
      const payload = settingsUpdatePayload(settings);
      const saved = await apiRequest<SettingsResponse>("/settings", accessToken, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setSettings(saved);
      notifySuccess("Settings saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save settings");
    }
  }

  return (
    <main className="page-main">
      <PageHeader
        eyebrow="ERP settings"
        title="General settings"
        description="Configure the tenant profile and academic defaults."
      />
      {!settings ? (
        <p className="mt-8 text-sm text-slate-500">Loading settings…</p>
      ) : (
        <form className="card mt-8 grid gap-5 p-6 md:grid-cols-2" onSubmit={save}>
          <Field label="Contact email">
            <input className="input" type="email" value={settings.email ?? ""}
              onChange={(e) => setSettings({ ...settings, email: e.target.value || null })} />
          </Field>
          <Field label="Phone">
            <input className="input" value={settings.phone ?? ""}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value || null })} />
          </Field>
          <Field label="Currency">
            <input className="input" maxLength={3} value={settings.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Timezone">
            <input className="input" value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} />
          </Field>
          <Field label="Date format">
            <input className="input" value={settings.dateFormat}
              onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })} />
          </Field>
          <Field label="Attendance type">
            <select className="input" value={settings.attendanceType}
              onChange={(e) => setSettings({ ...settings, attendanceType: e.target.value as Settings["attendanceType"] })}>
              <option value="DAY_WISE">Day wise</option>
              <option value="PERIOD_WISE">Period wise</option>
              <option value="BIOMETRIC">Biometric</option>
            </select>
          </Field>
          <Field label="Admission prefix">
            <input className="input" value={settings.admissionPrefix ?? ""}
              onChange={(e) => setSettings({ ...settings, admissionPrefix: e.target.value || null })} />
          </Field>
          <Field label="Next admission number">
            <input className="input bg-slate-50" value={settings.nextAdmissionNumber} disabled />
          </Field>
          <Field label="Staff ID prefix">
            <input className="input" value={settings.staffPrefix ?? ""}
              onChange={(e) => setSettings({ ...settings, staffPrefix: e.target.value || null })} />
          </Field>
          <Field label="Next staff ID number">
            <input className="input bg-slate-50" value={settings.nextStaffNumber} disabled />
          </Field>
          <Field label="Exam result type">
            <select className="input" value={settings.examResultType}
              onChange={(e) => setSettings({ ...settings, examResultType: e.target.value as Settings["examResultType"] })}>
              <option value="GENERAL">General pass/fail</option>
              <option value="SCHOOL_GRADING">School grading</option>
              <option value="COLLEGE_GRADING">College grading</option>
              <option value="GPA">GPA grading</option>
            </select>
          </Field>
          <Field label="Address" wide>
            <textarea className="input min-h-24" value={settings.address ?? ""}
              onChange={(e) => setSettings({ ...settings, address: e.target.value || null })} />
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={settings.autoAdmissionNumber}
              onChange={(e) => setSettings({ ...settings, autoAdmissionNumber: e.target.checked })} />
            Auto-generate admission numbers
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={settings.teacherRestricted}
              onChange={(e) => setSettings({ ...settings, teacherRestricted: e.target.checked })} />
            Teacher restricted mode
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={settings.autoStaffNumber}
              onChange={(e) => setSettings({ ...settings, autoStaffNumber: e.target.checked })} />
            Auto-generate staff IDs
          </label>
          <label className="flex items-center gap-3 text-sm md:col-span-2">
            <input type="checkbox" checked={settings.onlineAdmission}
              onChange={(e) => setSettings({ ...settings, onlineAdmission: e.target.checked })} />
            Enable online admission
          </label>
          {settings.onlineAdmission && (
            <p className="md:col-span-2 text-sm text-slate-600">
              Public form: <code className="rounded bg-slate-100 px-1">/admit/&lt;tenant-slug&gt;</code>
            </p>
          )}
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={settings.liveClassAutoAttendance}
              onChange={(e) => setSettings({ ...settings, liveClassAutoAttendance: e.target.checked })} />
            Auto-mark live-class attendance
          </label>
          <div className="flex items-center gap-4 md:col-span-2">
            <button className="button-primary" type="submit">Save settings</button>
          </div>
        </form>
      )}
    </main>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={wide ? "md:col-span-2" : ""}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
