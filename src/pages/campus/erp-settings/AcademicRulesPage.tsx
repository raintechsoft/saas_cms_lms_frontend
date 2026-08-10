import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { InfoOutlined, SaveOutlined, WarningAmberOutlined } from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type SettingsPayload = {
  teacherRestricted: boolean;
};

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-4 text-sm font-bold text-[#1A1A1A]">{title}</h2>
      {children}
    </section>
  );
}

export function AcademicRulesPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Academic Rules";
  const canManage = Boolean(
    user?.permissions.some((p) => ["settings.manage", "erp.manage"].includes(p)),
  );

  const [teacherRestricted, setTeacherRestricted] = useState(false);
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
        setTeacherRestricted(Boolean(data.teacherRestricted));
      } catch (cause) {
        if (!cancelled) {
          notifyError(cause instanceof Error ? cause.message : "Unable to load academic rules");
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
      const saved = await apiRequest<SettingsPayload>("/settings", accessToken, {
        method: "PUT",
        body: JSON.stringify({ teacherRestricted }),
      });
      setTeacherRestricted(Boolean(saved.teacherRestricted));
      notifySuccess("Academic rules saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save academic rules");
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
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">Academic Rules</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Control academic access policies for teaching staff.
            {loading ? " Loading…" : null}
          </p>
        </div>

        <div className="space-y-4">
          <Card title="Teacher Restricted Mode">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={teacherRestricted}
                disabled={!canManage || saving}
                onClick={() => setTeacherRestricted((value) => !value)}
                className={[
                  "relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50",
                  teacherRestricted ? "bg-primary" : "bg-[#D1D5DB]",
                ].join(" ")}
              >
                <span
                  className={[
                    "absolute top-0.5 size-6 rounded-full bg-white shadow transition",
                    teacherRestricted ? "left-[22px]" : "left-0.5",
                  ].join(" ")}
                />
              </button>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1A1A1A]">Enable Teacher Restricted Mode</p>
                <p className="mt-0.5 text-xs text-[#6B7280]">
                  When enabled, teachers will have restricted access as per their roles and
                  permissions.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <WarningAmberOutlined sx={{ fontSize: 18 }} className="mt-0.5 shrink-0 text-amber-600" />
              <p>
                <span className="font-semibold">Note:</span> Enabling this option will limit teachers
                from accessing unrelated modules and sensitive information.
              </p>
            </div>
          </Card>

          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-[#374151]">
            <div className="mb-2 flex items-center gap-2 font-semibold text-primary">
              <InfoOutlined sx={{ fontSize: 18 }} />
              About Academic Rules
            </div>
            <p>
              Academic rules help institutions control what teachers can see and manage inside the
              campus portal. Use restricted mode when you want role-based limits without changing
              individual permissions for every teacher.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[#4B5563]">
              <li>Applies to teacher accounts only.</li>
              <li>Does not change admin or accountant access.</li>
              <li>Existing academic records remain unchanged.</li>
            </ul>
          </div>
        </div>
      </div>
    </form>
  );
}
