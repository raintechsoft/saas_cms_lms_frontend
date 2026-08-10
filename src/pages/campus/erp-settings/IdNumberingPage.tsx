import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { InfoOutlined, SaveOutlined } from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type SettingsPayload = {
  admissionPrefix: string | null;
  admissionNumberDigits?: number;
  nextAdmissionNumber: number;
  staffPrefix: string | null;
  staffNumberDigits?: number;
  nextStaffNumber: number;
  autoAdmissionNumber: boolean;
  autoStaffNumber: boolean;
};

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-[#1A1A1A]">{title}</h2>
        <p className="mt-0.5 text-xs text-[#6B7280]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function RequiredLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
      {children} <span className="text-rose-500">*</span>
    </span>
  );
}

function FieldHint({ children }: { children: ReactNode }) {
  return <span className="mt-1 block text-[11px] text-[#9CA3AF]">{children}</span>;
}

function formatId(prefix: string, value: number, digits: number) {
  const safeDigits = Math.max(1, Math.min(12, digits || 1));
  return `${prefix}${String(Math.max(0, value)).padStart(safeDigits, "0")}`;
}

function previewLine(prefix: string, startFrom: number, digits: number) {
  const a = formatId(prefix, startFrom, digits);
  const b = formatId(prefix, startFrom + 1, digits);
  const c = formatId(prefix, startFrom + 2, digits);
  return `Preview: ${a}, ${b}, ${c}, ...`;
}

export function IdNumberingPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "ID Numbering";
  const canManage = Boolean(
    user?.permissions.some((p) => ["settings.manage", "erp.manage"].includes(p)),
  );

  const [studentPrefix, setStudentPrefix] = useState("STU");
  const [studentDigits, setStudentDigits] = useState(5);
  const [studentStart, setStudentStart] = useState(10001);
  const [staffPrefix, setStaffPrefix] = useState("STA");
  const [staffDigits, setStaffDigits] = useState(4);
  const [staffStart, setStaffStart] = useState(1001);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!accessToken) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await apiRequest<SettingsPayload>("/settings", accessToken);
        if (cancelled) return;
        setStudentPrefix(data.admissionPrefix ?? "STU");
        setStudentDigits(data.admissionNumberDigits ?? 5);
        setStudentStart(data.nextAdmissionNumber || 1);
        setStaffPrefix(data.staffPrefix ?? "STA");
        setStaffDigits(data.staffNumberDigits ?? 4);
        setStaffStart(data.nextStaffNumber || 1);
      } catch (cause) {
        if (!cancelled) {
          notifyError(cause instanceof Error ? cause.message : "Unable to load ID numbering settings");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const studentPreview = useMemo(
    () => previewLine(studentPrefix.trim(), studentStart, studentDigits),
    [studentPrefix, studentStart, studentDigits],
  );
  const staffPreview = useMemo(
    () => previewLine(staffPrefix.trim(), staffStart, staffDigits),
    [staffPrefix, staffStart, staffDigits],
  );

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;

    if (studentDigits < 1 || staffDigits < 1) {
      notifyError("Number of digits must be at least 1.");
      return;
    }
    if (studentStart < 1 || staffStart < 1) {
      notifyError("Start From must be at least 1.");
      return;
    }

    setSaving(true);
    try {
      await apiRequest("/settings", accessToken, {
        method: "PUT",
        body: JSON.stringify({
          autoAdmissionNumber: true,
          admissionPrefix: studentPrefix.trim() || null,
          admissionNumberDigits: studentDigits,
          nextAdmissionNumber: studentStart,
          autoStaffNumber: true,
          staffPrefix: staffPrefix.trim() || null,
          staffNumberDigits: staffDigits,
          nextStaffNumber: staffStart,
        }),
      });
      notifySuccess("ID numbering saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save ID numbering");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]" onSubmit={save}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-6">
        <p className="text-xs text-[#6B7280]">
          Dashboard <span className="mx-1 text-[#9CA3AF]">/</span> ERP Settings{" "}
          <span className="mx-1 text-[#9CA3AF]">/</span>{" "}
          <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
        </p>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving || loading || !canManage}
        >
          <SaveOutlined sx={{ fontSize: 16 }} />
          {saving ? "Saving…" : "Save configuration"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">ID Numbering</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Configure automatic student admission and staff ID formats.
            {loading ? " Loading…" : null}
          </p>
        </div>

        <div className="space-y-4">
          <Card
            title="Student Admission Number"
            description="Configure the format for student admission numbers."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">Prefix</span>
                <input
                  className="nx-input w-full"
                  value={studentPrefix}
                  disabled={!canManage || saving}
                  onChange={(e) => setStudentPrefix(e.target.value.toUpperCase())}
                  maxLength={20}
                  placeholder="STU"
                />
                <FieldHint>Text prefix for student ID</FieldHint>
              </label>
              <label className="block">
                <RequiredLabel>Number of Digits</RequiredLabel>
                <input
                  className="nx-input w-full"
                  type="number"
                  min={1}
                  max={12}
                  required
                  value={studentDigits}
                  disabled={!canManage || saving}
                  onChange={(e) => setStudentDigits(Number(e.target.value) || 1)}
                />
                <FieldHint>Total number of digits</FieldHint>
              </label>
              <label className="block">
                <RequiredLabel>Start From</RequiredLabel>
                <input
                  className="nx-input w-full"
                  type="number"
                  min={1}
                  required
                  value={studentStart}
                  disabled={!canManage || saving}
                  onChange={(e) => setStudentStart(Number(e.target.value) || 1)}
                />
                <FieldHint>Starting number for student ID</FieldHint>
              </label>
            </div>
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm font-medium text-primary">
              {studentPreview}
            </div>
          </Card>

          <Card title="Staff ID Number" description="Configure the format for staff ID numbers.">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">Prefix</span>
                <input
                  className="nx-input w-full"
                  value={staffPrefix}
                  disabled={!canManage || saving}
                  onChange={(e) => setStaffPrefix(e.target.value.toUpperCase())}
                  maxLength={20}
                  placeholder="STA"
                />
                <FieldHint>Text prefix for staff ID</FieldHint>
              </label>
              <label className="block">
                <RequiredLabel>Number of Digits</RequiredLabel>
                <input
                  className="nx-input w-full"
                  type="number"
                  min={1}
                  max={12}
                  required
                  value={staffDigits}
                  disabled={!canManage || saving}
                  onChange={(e) => setStaffDigits(Number(e.target.value) || 1)}
                />
                <FieldHint>Total number of digits</FieldHint>
              </label>
              <label className="block">
                <RequiredLabel>Start From</RequiredLabel>
                <input
                  className="nx-input w-full"
                  type="number"
                  min={1}
                  required
                  value={staffStart}
                  disabled={!canManage || saving}
                  onChange={(e) => setStaffStart(Number(e.target.value) || 1)}
                />
                <FieldHint>Starting number for staff ID</FieldHint>
              </label>
            </div>
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm font-medium text-primary">
              {staffPreview}
            </div>
          </Card>

          <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-[#374151]">
            <InfoOutlined sx={{ fontSize: 18 }} className="mt-0.5 shrink-0 text-primary" />
            <p>
              <span className="font-semibold text-[#1A1A1A]">Important Note:</span> Changing the ID
              numbering format will not affect existing records. New IDs will be generated based on
              the above configuration.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
