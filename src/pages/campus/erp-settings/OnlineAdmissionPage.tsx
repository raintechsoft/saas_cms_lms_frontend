import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { InfoOutlined, SaveOutlined } from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type SettingsPayload = {
  onlineAdmission: boolean;
  onlineAdmissionRequirePayment?: boolean;
  onlineAdmissionFeeTypeId?: string | null;
};

type FeeTypeOption = { id: string; name: string; isActive?: boolean };

function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
      {children}
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F3F4F6] py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#1A1A1A]">{label}</p>
        <p className="mt-0.5 text-xs text-[#6B7280]">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={[
          "relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50",
          checked ? "bg-primary" : "bg-[#D1D5DB]",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 size-6 rounded-full bg-white shadow transition",
            checked ? "left-[22px]" : "left-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

export function OnlineAdmissionPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Online Admission";
  const canManage = Boolean(
    user?.permissions.some((p) => ["settings.manage", "erp.manage"].includes(p)),
  );

  const [enabled, setEnabled] = useState(false);
  const [requirePayment, setRequirePayment] = useState(false);
  const [feeTypeId, setFeeTypeId] = useState("");
  const [feeTypes, setFeeTypes] = useState<FeeTypeOption[]>([]);
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
        const [settings, setup] = await Promise.all([
          apiRequest<SettingsPayload>("/settings", accessToken),
          apiRequest<{ types: FeeTypeOption[] }>("/fees/setup", accessToken).catch(() => ({
            types: [] as FeeTypeOption[],
          })),
        ]);
        if (cancelled) return;
        setEnabled(Boolean(settings.onlineAdmission));
        setRequirePayment(Boolean(settings.onlineAdmissionRequirePayment));
        setFeeTypeId(settings.onlineAdmissionFeeTypeId ?? "");
        setFeeTypes((setup.types ?? []).filter((item) => item.isActive !== false));
      } catch (cause) {
        if (!cancelled) {
          notifyError(cause instanceof Error ? cause.message : "Unable to load online admission settings");
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
    if (requirePayment && !feeTypeId) {
      notifyError("Select a fee type when payment is required.");
      return;
    }
    setSaving(true);
    try {
      const saved = await apiRequest<SettingsPayload>("/settings", accessToken, {
        method: "PUT",
        body: JSON.stringify({
          onlineAdmission: enabled,
          onlineAdmissionRequirePayment: requirePayment,
          onlineAdmissionFeeTypeId: requirePayment ? feeTypeId || null : null,
        }),
      });
      setEnabled(Boolean(saved.onlineAdmission));
      setRequirePayment(Boolean(saved.onlineAdmissionRequirePayment));
      setFeeTypeId(saved.onlineAdmissionFeeTypeId ?? "");
      notifySuccess("Online admission settings saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save online admission settings");
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
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">Online Admission</h1>
          {loading ? <p className="mt-1 text-sm text-[#6B7280]">Loading…</p> : null}
        </div>

        <div className="space-y-4">
          <Card>
            <ToggleRow
              label="Enable Online Admission"
              description="Allow prospective students to apply for admission online."
              checked={enabled}
              disabled={!canManage || saving}
              onChange={() => setEnabled((value) => !value)}
            />
            <ToggleRow
              label="Require Payment for Submission"
              description="Applicants must make a payment to submit the admission form."
              checked={requirePayment}
              disabled={!canManage || saving || !enabled}
              onChange={() => setRequirePayment((value) => !value)}
            />

            {requirePayment ? (
              <>
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2.5 text-sm text-[#374151]">
                  <InfoOutlined sx={{ fontSize: 18 }} className="mt-0.5 shrink-0 text-primary" />
                  <p>
                    <span className="font-semibold text-[#1A1A1A]">Note:</span> If enabled, applicants
                    will be required to pay the selected fee type during form submission.
                  </p>
                </div>

                <label className="mt-4 block max-w-md">
                  <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                    Fee Type <span className="text-rose-500">*</span>
                  </span>
                  <select
                    className="nx-input w-full"
                    required={requirePayment}
                    value={feeTypeId}
                    disabled={!canManage || saving}
                    onChange={(e) => setFeeTypeId(e.target.value)}
                  >
                    <option value="">Select fee type</option>
                    {feeTypes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[11px] text-[#9CA3AF]">
                    Select the fee type to be collected during online admission.
                  </span>
                </label>
              </>
            ) : null}

            {enabled && user?.tenant?.slug ? (
              <p className="mt-4 text-xs text-[#6B7280]">
                Public form:{" "}
                <code className="rounded bg-[#F3F4F6] px-1.5 py-0.5 text-[#1A1A1A]">
                  /admit/{user.tenant.slug}
                </code>
              </p>
            ) : null}
          </Card>

          <div className="rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm">
            <div className="mb-2 flex items-center gap-2 font-semibold text-[#1A1A1A]">
              <InfoOutlined sx={{ fontSize: 18 }} className="text-primary" />
              About Online Admission
            </div>
            <p className="text-[#374151]">
              These settings control the online admission process for prospective students.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[#4B5563]">
              <li>Enable online admission to accept applications through the website.</li>
              <li>Optionally require payment to complete form submission.</li>
              <li>Payment will be recorded against the selected fee type.</li>
            </ul>
            <p className="mt-2 text-[#4B5563]">
              Changes will apply to all future online admission applications.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
