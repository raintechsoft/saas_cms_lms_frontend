import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ContentCopyOutlined,
  InfoOutlined,
  ReceiptLongOutlined,
  SaveOutlined,
  SortOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type FeeSettings = {
  allowDuplicateInvoice: boolean;
  allowCustomFeeReceipt: boolean;
  dueDateWiseFeeOrdering: boolean;
  feesDueDays: number;
};

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-4 text-sm font-bold text-[#1A1A1A]">{title}</h2>
      {children}
    </section>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F3F4F6] py-3 last:border-b-0">
      <div className="flex min-w-0 items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[#1A1A1A]">{label}</span>
          <span className="mt-0.5 block text-xs text-[#6B7280]">{description}</span>
        </span>
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

export function FeesSettingsPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Fees Settings";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["fees.manage", "erp.manage", "settings.manage"].includes(p),
    ),
  );

  const [settings, setSettings] = useState<FeeSettings>({
    allowDuplicateInvoice: true,
    allowCustomFeeReceipt: true,
    dueDateWiseFeeOrdering: true,
    feesDueDays: 30,
  });
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
        const data = await apiRequest<FeeSettings>("/fees/settings", accessToken);
        if (cancelled) return;
        setSettings({
          allowDuplicateInvoice: data.allowDuplicateInvoice ?? true,
          allowCustomFeeReceipt: data.allowCustomFeeReceipt ?? true,
          dueDateWiseFeeOrdering: data.dueDateWiseFeeOrdering ?? true,
          feesDueDays: data.feesDueDays ?? 30,
        });
      } catch (cause) {
        if (!cancelled) {
          notifyError(cause instanceof Error ? cause.message : "Unable to load fees settings");
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
    if (settings.feesDueDays < 1 || settings.feesDueDays > 365) {
      notifyError("Fees due days must be between 1 and 365.");
      return;
    }
    setSaving(true);
    try {
      const saved = await apiRequest<FeeSettings>("/fees/settings", accessToken, {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings({
        allowDuplicateInvoice: saved.allowDuplicateInvoice,
        allowCustomFeeReceipt: saved.allowCustomFeeReceipt,
        dueDateWiseFeeOrdering: saved.dueDateWiseFeeOrdering,
        feesDueDays: saved.feesDueDays,
      });
      notifySuccess("Fees settings saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save fees settings");
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
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">Fees Settings</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Configure invoice, receipt and due-date behaviour for fee collection.
            {loading ? " Loading…" : null}
          </p>
        </div>

        <div className="space-y-4">
          <Card title="Invoice & Receipt Settings">
            <ToggleRow
              icon={<ContentCopyOutlined sx={{ fontSize: 18 }} />}
              label="Duplicate Invoice"
              description="Allow printing of duplicate student invoices."
              checked={settings.allowDuplicateInvoice}
              disabled={!canManage || saving}
              onChange={() =>
                setSettings((prev) => ({
                  ...prev,
                  allowDuplicateInvoice: !prev.allowDuplicateInvoice,
                }))
              }
            />
            <ToggleRow
              icon={<ReceiptLongOutlined sx={{ fontSize: 18 }} />}
              label="Custom Fee Receipt"
              description="Allow printing of custom fee receipt."
              checked={settings.allowCustomFeeReceipt}
              disabled={!canManage || saving}
              onChange={() =>
                setSettings((prev) => ({
                  ...prev,
                  allowCustomFeeReceipt: !prev.allowCustomFeeReceipt,
                }))
              }
            />
            <ToggleRow
              icon={<SortOutlined sx={{ fontSize: 18 }} />}
              label="Due-Date Wise Fee Ordering"
              description="Order fees in invoices based on due date."
              checked={settings.dueDateWiseFeeOrdering}
              disabled={!canManage || saving}
              onChange={() =>
                setSettings((prev) => ({
                  ...prev,
                  dueDateWiseFeeOrdering: !prev.dueDateWiseFeeOrdering,
                }))
              }
            />

            <label className="mt-4 block max-w-xs">
              <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                Fees Due Days <span className="text-rose-500">*</span>
              </span>
              <input
                className="nx-input w-full"
                type="number"
                min={1}
                max={365}
                required
                value={settings.feesDueDays}
                disabled={!canManage || saving}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    feesDueDays: Number(e.target.value) || 1,
                  }))
                }
              />
              <span className="mt-1 block text-[11px] text-[#9CA3AF]">
                Set default number of days for fee due calculation.
              </span>
            </label>
          </Card>

          <div className="rounded-xl border border-primary/20 bg-primary/[0.06] px-4 py-3 text-sm">
            <div className="mb-2 flex items-center gap-2 font-semibold text-[#1A1A1A]">
              <InfoOutlined sx={{ fontSize: 18 }} className="text-primary" />
              About Fees Settings
            </div>
            <p className="text-[#374151]">
              These settings will be applied to all fee invoices, fee receipts and student accounts.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[#4B5563]">
              <li>Changes will reflect in new invoices and receipts.</li>
              <li>Existing records will not be affected.</li>
            </ul>
          </div>
        </div>
      </div>
    </form>
  );
}
