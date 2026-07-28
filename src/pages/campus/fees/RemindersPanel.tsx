import { useEffect, useState, type FormEvent } from "react";
import {
  AccessTimeOutlined,
  CalendarMonthOutlined,
  DeleteOutline,
  InfoOutlined,
  MailOutline,
  SaveOutlined,
  SmsOutlined,
} from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import type { FeeSetting } from "./types";

type Step = {
  id: string;
  days: number;
  when: "before" | "after";
  notice: string;
  email: boolean;
  sms: boolean;
};

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function RemindersPanel({
  setting,
  token,
  onSaved,
  onError,
}: {
  setting?: FeeSetting | null;
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [autoReminder, setAutoReminder] = useState(setting?.autoReminder ?? false);
  const [steps, setSteps] = useState<Step[]>([
    {
      id: uid(),
      days: setting?.reminderDaysBefore ?? 5,
      when: "before",
      notice: "Initial Due Notice",
      email: true,
      sms: false,
    },
    {
      id: uid(),
      days: setting?.reminderDaysAfter ?? 2,
      when: "after",
      notice: "Urgent Payment Reminder",
      email: true,
      sms: true,
    },
  ]);
  const [executionTime, setExecutionTime] = useState("09:00");
  const [weekendSilencer, setWeekendSilencer] = useState(true);
  const [minBalance, setMinBalance] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setAutoReminder(setting?.autoReminder ?? false);
    setSteps((prev) => {
      const before = prev.find((s) => s.when === "before") ?? prev[0];
      const after = prev.find((s) => s.when === "after") ?? prev[1];
      return [
        { ...before, days: setting?.reminderDaysBefore ?? before.days },
        { ...after, days: setting?.reminderDaysAfter ?? after.days },
      ].filter(Boolean) as Step[];
    });
  }, [setting]);

  function updateStep(id: string, patch: Partial<Step>) {
    setSteps((prev) => prev.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  }

  async function save(event?: FormEvent) {
    event?.preventDefault();
    const before = steps.find((s) => s.when === "before")?.days ?? 3;
    const after = steps.find((s) => s.when === "after")?.days ?? 7;
    setSaving(true);
    try {
      onError("");
      await apiRequest("/fees/reminders", token, {
        method: "PUT",
        body: JSON.stringify({
          autoReminder,
          reminderDaysBefore: before,
          reminderDaysAfter: after,
        }),
      });
      setSavedAt(
        new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      );
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save reminder settings");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setAutoReminder(setting?.autoReminder ?? false);
    setSteps([
      {
        id: uid(),
        days: setting?.reminderDaysBefore ?? 5,
        when: "before",
        notice: "Initial Due Notice",
        email: true,
        sms: false,
      },
      {
        id: uid(),
        days: setting?.reminderDaysAfter ?? 2,
        when: "after",
        notice: "Urgent Payment Reminder",
        email: true,
        sms: true,
      },
    ]);
    setExecutionTime("09:00");
    setWeekendSilencer(true);
    setMinBalance(true);
  }

  return (
    <section className="mt-5 space-y-5">
      <div className="flex justify-end">
        <div className="nx-card flex items-center gap-3 px-4 py-2.5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Status</p>
            <p className="text-sm font-semibold text-slate-800">
              {autoReminder ? "Automations Active" : "Automations Off"}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoReminder}
            onClick={() => setAutoReminder((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition ${
              autoReminder ? "bg-[#6366f1]" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${
                autoReminder ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="nx-card p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
          {steps.length} Active Steps
        </p>
        <div className="mt-4 space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 lg:flex-row lg:items-center"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-sm font-bold text-slate-600 ring-1 ring-slate-200">
                {index + 1}
              </span>
              <input
                className="nx-input w-20"
                type="number"
                min={0}
                max={90}
                value={step.days}
                onChange={(e) => updateStep(step.id, { days: Number(e.target.value) })}
              />
              <select
                className="nx-input lg:w-36"
                value={step.when}
                onChange={(e) =>
                  updateStep(step.id, { when: e.target.value as "before" | "after" })
                }
              >
                <option value="before">Days Before</option>
                <option value="after">Days After</option>
              </select>
              <span className="text-sm text-slate-500">due date</span>
              <select
                className="nx-input min-w-0 flex-1"
                value={step.notice}
                onChange={(e) => updateStep(step.id, { notice: e.target.value })}
              >
                <option>Initial Due Notice</option>
                <option>Urgent Payment Reminder</option>
                <option>Final Reminder</option>
              </select>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title="Email"
                  onClick={() => updateStep(step.id, { email: !step.email })}
                  className={`rounded-lg p-2 ${
                    step.email ? "bg-indigo-100 text-indigo-600" : "bg-white text-slate-400 ring-1 ring-slate-200"
                  }`}
                >
                  <MailOutline sx={{ fontSize: 18 }} />
                </button>
                <button
                  type="button"
                  title="SMS"
                  onClick={() => updateStep(step.id, { sms: !step.sms })}
                  className={`rounded-lg p-2 ${
                    step.sms ? "bg-indigo-100 text-indigo-600" : "bg-white text-slate-400 ring-1 ring-slate-200"
                  }`}
                >
                  <SmsOutlined sx={{ fontSize: 18 }} />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  onClick={() => setSteps((prev) => prev.filter((s) => s.id !== step.id))}
                  disabled={steps.length <= 1}
                >
                  <DeleteOutline sx={{ fontSize: 18 }} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
          onClick={() =>
            setSteps((prev) => [
              ...prev,
              {
                id: uid(),
                days: 1,
                when: "after",
                notice: "Final Reminder",
                email: true,
                sms: false,
              },
            ])
          }
        >
          + Add another reminder step
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="nx-card p-5">
          <div className="flex items-center gap-2">
            <CalendarMonthOutlined sx={{ fontSize: 18 }} className="text-indigo-500" />
            <h3 className="font-semibold text-slate-900">Dispatch Window</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">Control when reminder batches are processed.</p>
          <label className="nx-label mt-5">Daily Execution Time</label>
          <div className="relative">
            <AccessTimeOutlined
              sx={{ fontSize: 18 }}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="nx-input pl-10"
              type="time"
              value={executionTime}
              onChange={(e) => setExecutionTime(e.target.value)}
            />
          </div>
          <p className="mt-3 text-[12px] text-slate-400">
            Recommended: Morning hours (8:00 AM - 10:00 AM) for better engagement.
          </p>
        </div>

        <div className="nx-card p-5">
          <div className="flex items-center gap-2">
            <InfoOutlined sx={{ fontSize: 18 }} className="text-indigo-500" />
            <h3 className="font-semibold text-slate-900">System Guardrails</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">Automated exclusion rules for reminders.</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Weekend Silencer</p>
                <p className="text-[12px] text-slate-500">Don&apos;t send on Saturday or Sunday.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={weekendSilencer}
                onClick={() => setWeekendSilencer((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition ${
                  weekendSilencer ? "bg-[#6366f1]" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${
                    weekendSilencer ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Minimum Balance</p>
                <p className="text-[12px] text-slate-500">Skip if due amount is below ₹5.00.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={minBalance}
                onClick={() => setMinBalance((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition ${
                  minBalance ? "bg-[#6366f1]" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${
                    minBalance ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="nx-card flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
            Draft Mode
          </span>
          <span className="text-[12px] text-slate-500">
            {savedAt ? `Last saved: Today at ${savedAt}` : "Not saved yet"}
          </span>
        </div>
        <div className="flex gap-2">
          <button type="button" className="nx-btn-secondary" onClick={reset}>
            Reset Changes
          </button>
          <button
            type="button"
            className="nx-btn-primary"
            disabled={saving}
            onClick={() => void save()}
          >
            <SaveOutlined sx={{ fontSize: 16 }} />
            {saving ? "Saving…" : "Save Configuration"}
          </button>
        </div>
      </div>
    </section>
  );
}
