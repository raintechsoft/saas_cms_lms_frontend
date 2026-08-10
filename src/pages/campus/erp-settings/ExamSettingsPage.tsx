import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { InfoOutlined, SaveOutlined, WarningAmberOutlined } from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };
type ResultDisplay = "SUBJECT_WISE" | "OVERALL";
type OnlineViewMode = "AFTER_SUBMISSION" | "AFTER_PUBLISH";

type SettingsPayload = {
  examResultDisplayType?: ResultDisplay;
  onlineExamViewMode?: OnlineViewMode;
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

export function ExamSettingsPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Exam Settings";
  const canManage = Boolean(
    user?.permissions.some((p) => ["settings.manage", "erp.manage"].includes(p)),
  );

  const [resultDisplay, setResultDisplay] = useState<ResultDisplay>("SUBJECT_WISE");
  const [onlineView, setOnlineView] = useState<OnlineViewMode>("AFTER_SUBMISSION");
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
        setResultDisplay(data.examResultDisplayType === "OVERALL" ? "OVERALL" : "SUBJECT_WISE");
        setOnlineView(
          data.onlineExamViewMode === "AFTER_PUBLISH" ? "AFTER_PUBLISH" : "AFTER_SUBMISSION",
        );
      } catch (cause) {
        if (!cancelled) {
          notifyError(cause instanceof Error ? cause.message : "Unable to load exam settings");
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
        body: JSON.stringify({
          examResultDisplayType: resultDisplay,
          onlineExamViewMode: onlineView,
        }),
      });
      setResultDisplay(saved.examResultDisplayType === "OVERALL" ? "OVERALL" : "SUBJECT_WISE");
      setOnlineView(
        saved.onlineExamViewMode === "AFTER_PUBLISH" ? "AFTER_PUBLISH" : "AFTER_SUBMISSION",
      );
      notifySuccess("Exam settings saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save exam settings");
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
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">Exam Settings</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Configure default exam result display and online exam viewing rules.
            {loading ? " Loading…" : null}
          </p>
        </div>

        <div className="space-y-4">
          <Card
            title="Result Display Type"
            description="Choose how exam results will be displayed."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <TypeOption
                selected={resultDisplay === "SUBJECT_WISE"}
                title="Subject-wise"
                description="Display results subject-wise with marks and grades."
                disabled={!canManage || saving}
                onSelect={() => setResultDisplay("SUBJECT_WISE")}
              />
              <TypeOption
                selected={resultDisplay === "OVERALL"}
                title="Overall"
                description="Display overall result with total marks and percentage."
                disabled={!canManage || saving}
                onSelect={() => setResultDisplay("OVERALL")}
              />
            </div>
          </Card>

          <Card
            title="Online Exam View"
            description="Select how students can view their exam responses and results online."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <TypeOption
                selected={onlineView === "AFTER_SUBMISSION"}
                title="View After Submission"
                description="Students can view their responses and results after submission."
                disabled={!canManage || saving}
                onSelect={() => setOnlineView("AFTER_SUBMISSION")}
              />
              <TypeOption
                selected={onlineView === "AFTER_PUBLISH"}
                title="View After Publish"
                description="Students can view responses and results after publication by admin."
                disabled={!canManage || saving}
                onSelect={() => setOnlineView("AFTER_PUBLISH")}
              />
            </div>
          </Card>

          <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-[#374151]">
            <InfoOutlined sx={{ fontSize: 18 }} className="mt-0.5 shrink-0 text-primary" />
            <p>
              <span className="font-semibold text-[#1A1A1A]">Note:</span> These settings will be
              applicable to all exams unless overridden at individual exam level.
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <WarningAmberOutlined sx={{ fontSize: 18 }} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">
                Important: Changing these settings will affect existing and future exams.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900/90">
                <li>Subject-wise display provides detailed performance analysis.</li>
                <li>Choose view options based on your institution&apos;s evaluation policy.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
