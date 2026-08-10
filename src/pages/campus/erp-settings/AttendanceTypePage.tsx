import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  CalendarMonthOutlined,
  InfoOutlined,
  SaveOutlined,
  ScheduleOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type AttendanceMode = "DAY_WISE" | "PERIOD_WISE";

interface SettingsPayload {
  attendanceType: "DAY_WISE" | "PERIOD_WISE" | "BIOMETRIC";
  biometricAttendanceEnabled?: boolean;
}

type OutletCtx = { activeLabel?: string };

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-4 text-sm font-bold text-[#1A1A1A]">{title}</h2>
      {children}
    </section>
  );
}

function TypeOption({
  selected,
  title,
  description,
  disabled,
  onSelect,
}: {
  selected: boolean;
  title: string;
  description: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={[
        "flex w-full items-start gap-3 rounded-xl border px-4 py-4 text-left transition",
        selected
          ? "border-primary bg-primary/[0.04] shadow-sm"
          : "border-[#E5E7EB] bg-white hover:border-primary/40",
        disabled ? "cursor-not-allowed opacity-60" : "",
      ].join(" ")}
    >
      <span
        className={[
          "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-primary" : "border-[#D1D5DB]",
        ].join(" ")}
        aria-hidden
      >
        {selected ? <span className="size-2.5 rounded-full bg-primary" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-[#1A1A1A]">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-[#6B7280]">{description}</span>
      </span>
    </button>
  );
}

function AboutColumn({
  icon,
  title,
  points,
}: {
  icon: ReactNode;
  title: string;
  points: string[];
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <h3 className="text-sm font-bold text-[#1A1A1A]">{title}</h3>
      </div>
      <ul className="space-y-2 text-sm text-[#6B7280]">
        {points.map((point) => (
          <li key={point} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AttendanceTypePage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Attendance Type";
  const canManage = Boolean(
    user?.permissions.some((p) => ["settings.manage", "erp.manage"].includes(p)),
  );

  const [mode, setMode] = useState<AttendanceMode>("DAY_WISE");
  const [biometricEnabled, setBiometricEnabled] = useState(false);
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
        if (data.attendanceType === "PERIOD_WISE") setMode("PERIOD_WISE");
        else setMode("DAY_WISE");
        setBiometricEnabled(
          Boolean(data.biometricAttendanceEnabled) || data.attendanceType === "BIOMETRIC",
        );
      } catch (cause) {
        if (!cancelled) {
          notifyError(cause instanceof Error ? cause.message : "Unable to load attendance settings");
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

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      await apiRequest("/settings", accessToken, {
        method: "PUT",
        body: JSON.stringify({
          attendanceType: mode,
          biometricAttendanceEnabled: biometricEnabled,
        }),
      });
      notifySuccess("Attendance type saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save attendance type");
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
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">Attendance Type</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Choose how student attendance is marked across the institution.
            {loading ? " Loading…" : null}
          </p>
        </div>

        <div className="space-y-4">
          <Card title="Select Attendance Type">
            <div className="grid gap-3 md:grid-cols-2">
              <TypeOption
                selected={mode === "DAY_WISE"}
                title="Day-wise Attendance"
                description="Students are marked present or absent for the entire day."
                disabled={!canManage || saving}
                onSelect={() => setMode("DAY_WISE")}
              />
              <TypeOption
                selected={mode === "PERIOD_WISE"}
                title="Period-wise Attendance"
                description="Students are marked present or absent for each period."
                disabled={!canManage || saving}
                onSelect={() => setMode("PERIOD_WISE")}
              />
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <WarningAmberOutlined sx={{ fontSize: 18 }} className="mt-0.5 shrink-0 text-amber-600" />
              <p>
                <span className="font-semibold">Note:</span> Changing the attendance type will affect
                existing attendance records and reports. Please choose carefully.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1A1A1A]">Enable Biometric Attendance</p>
                <p className="mt-0.5 text-xs text-[#6B7280]">
                  Allow biometric device integration for attendance marking.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={biometricEnabled}
                disabled={!canManage || saving}
                onClick={() => setBiometricEnabled((value) => !value)}
                className={[
                  "relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50",
                  biometricEnabled ? "bg-primary" : "bg-[#D1D5DB]",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute top-0.5 size-6 rounded-full bg-white shadow transition",
                    biometricEnabled ? "left-[22px]" : "left-0.5",
                  ].join(" ")}
                />
              </button>
            </div>
          </Card>

          <Card title="About Attendance Types">
            <div className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-sky-700">
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                <InfoOutlined sx={{ fontSize: 14 }} />
              </span>
              Compare marking styles before changing your institution default
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <AboutColumn
                icon={<CalendarMonthOutlined sx={{ fontSize: 18 }} />}
                title="Day-wise Attendance"
                points={[
                  "Quick and simple daily marking",
                  "Suitable for all institutions",
                  "Attendance counted for the whole day",
                  "Reports are day-based",
                ]}
              />
              <AboutColumn
                icon={<ScheduleOutlined sx={{ fontSize: 18 }} />}
                title="Period-wise Attendance"
                points={[
                  "Detailed period by period tracking",
                  "Better for subject-wise analysis",
                  "Accurate time and learning tracking",
                  "Reports are period-based",
                ]}
              />
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
