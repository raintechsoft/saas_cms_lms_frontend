import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AccessTimeOutlined,
  CloseOutlined,
  CreditCardOutlined,
  EmailOutlined,
  GroupOutlined,
  MoreVertOutlined,
  NotificationsActiveOutlined,
  NotificationsNoneOutlined,
  PeopleOutline,
  SchoolOutlined,
  ScienceOutlined,
  SearchOutlined,
  SmsOutlined,
  WhatsApp,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type Module =
  | "ADMISSION"
  | "FEES"
  | "ACADEMICS"
  | "EXAMINATIONS"
  | "ATTENDANCE"
  | "HR"
  | "GENERAL";

type Trigger = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  module: Module;
  moduleLabel: string;
  eventKey: string;
  eventLabel: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  sendTiming: "IMMEDIATELY" | "SCHEDULED" | "QUIET_HOURS";
  channels: { whatsapp: boolean; email: boolean; push: boolean; sms: boolean };
  recipients: { student: boolean; parent: boolean; staff: boolean };
  recipientsLabel: string;
  messageSubject: string;
  messageBody: string;
  isActive: boolean;
  isScheduledToday: boolean;
  weekSentCount: number;
  updatedAtLabel: string;
};

type Setup = {
  stats: {
    totalTriggers: number;
    active: number;
    inactive: number;
    sentToday: number;
    growthPercent: number;
    usersReached: number;
    upcomingTriggers: number;
  };
  moduleCounts: Array<{ module: Module; label: string; count: number }>;
  eventOptions: Array<{ module: Module; key: string; label: string }>;
  triggers: Trigger[];
  analytics: {
    activity: Array<{
      label: string;
      whatsapp: number;
      email: number;
      push: number;
      sms: number;
    }>;
    channelDistribution: Array<{
      key: string;
      label: string;
      count: number;
      percent: number;
    }>;
    topTriggers: Array<{ id: string; name: string; count: number }>;
  };
  recentLogs: Array<{
    id: string;
    triggerName: string;
    channel: string;
    recipientCount: number;
    status: string;
    createdAtLabel: string;
  }>;
};

const PAGE_SIZE = 12;

const inputClass =
  "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-primary";

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint: ReactNode;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className={`rounded-lg p-2 ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#6B7280]">{label}</p>
        <p className="truncate text-lg font-bold text-[#1A1A1A]">{value}</p>
        <div className="text-xs text-[#9CA3AF]">{hint}</div>
      </div>
    </div>
  );
}

function ChannelIcons({ channels }: { channels: Trigger["channels"] }) {
  const items = [
    { on: channels.whatsapp, icon: <WhatsApp className="!text-[16px]" />, onClass: "text-emerald-600" },
    { on: channels.email, icon: <EmailOutlined className="!text-[16px]" />, onClass: "text-sky-600" },
    {
      on: channels.push,
      icon: <NotificationsNoneOutlined className="!text-[16px]" />,
      onClass: "text-violet-600",
    },
    { on: channels.sms, icon: <SmsOutlined className="!text-[16px]" />, onClass: "text-amber-600" },
  ];
  return (
    <div className="flex items-center gap-1.5">
      {items.map((item, index) => (
        <span key={index} className={item.on ? item.onClass : "text-[#D1D5DB]"}>
          {item.icon}
        </span>
      ))}
    </div>
  );
}

function moduleIcon(module: Module) {
  if (module === "FEES") return <CreditCardOutlined className="!text-[18px] text-amber-600" />;
  if (module === "ADMISSION") return <SchoolOutlined className="!text-[18px] text-violet-600" />;
  if (module === "ATTENDANCE") return <PeopleOutline className="!text-[18px] text-sky-600" />;
  return <NotificationsActiveOutlined className="!text-[18px] text-primary" />;
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition disabled:opacity-50 ${
        checked ? "bg-emerald-500" : "bg-[#D1D5DB]"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function NotificationTriggersPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Notification Triggers";
  const canManage = Boolean(
    user?.permissions.some((p) => ["erp.manage", "settings.manage"].includes(p)),
  );

  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moduleTab, setModuleTab] = useState<"ALL" | Module>("ALL");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [channelFilter, setChannelFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Trigger | null>(null);
  const [drawerTab, setDrawerTab] = useState<"config" | "message" | "recipients" | "logs">(
    "config",
  );
  const [menuId, setMenuId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    module: "ADMISSION" as Module,
    eventKey: "admission_approved",
    eventLabel: "On Admission Approved",
    priority: "MEDIUM" as "HIGH" | "MEDIUM" | "LOW",
    sendTiming: "IMMEDIATELY" as "IMMEDIATELY" | "SCHEDULED" | "QUIET_HOURS",
    channelWhatsapp: true,
    channelEmail: true,
    channelPush: true,
    channelSms: false,
    recipientStudent: true,
    recipientParent: true,
    recipientStaff: false,
    messageSubject: "",
    messageBody: "",
    isActive: true,
  });

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/notification-triggers", accessToken);
      setSetup(data);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load notification triggers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  function openDrawer(trigger: Trigger) {
    setSelected(trigger);
    setDrawerTab("config");
    setMenuId(null);
    setForm({
      name: trigger.name,
      description: trigger.description || "",
      module: trigger.module,
      eventKey: trigger.eventKey,
      eventLabel: trigger.eventLabel,
      priority: trigger.priority,
      sendTiming: trigger.sendTiming,
      channelWhatsapp: trigger.channels.whatsapp,
      channelEmail: trigger.channels.email,
      channelPush: trigger.channels.push,
      channelSms: trigger.channels.sms,
      recipientStudent: trigger.recipients.student,
      recipientParent: trigger.recipients.parent,
      recipientStaff: trigger.recipients.staff,
      messageSubject: trigger.messageSubject,
      messageBody: trigger.messageBody,
      isActive: trigger.isActive,
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (setup?.triggers ?? []).filter((item) => {
      if (moduleTab !== "ALL" && item.module !== moduleTab) return false;
      if (moduleFilter !== "ALL" && item.module !== moduleFilter) return false;
      if (statusFilter === "ACTIVE" && !item.isActive) return false;
      if (statusFilter === "INACTIVE" && item.isActive) return false;
      if (channelFilter === "whatsapp" && !item.channels.whatsapp) return false;
      if (channelFilter === "email" && !item.channels.email) return false;
      if (channelFilter === "push" && !item.channels.push) return false;
      if (channelFilter === "sms" && !item.channels.sms) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.eventLabel.toLowerCase().includes(q) ||
        item.moduleLabel.toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q)
      );
    });
  }, [setup, moduleTab, moduleFilter, statusFilter, channelFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [moduleTab, moduleFilter, statusFilter, channelFilter, search]);

  const activityMax = useMemo(() => {
    const values =
      setup?.analytics.activity.map((d) => d.whatsapp + d.email + d.push + d.sms) ?? [1];
    return Math.max(1, ...values);
  }, [setup]);

  const topMax = useMemo(() => {
    const values = setup?.analytics.topTriggers.map((t) => t.count) ?? [1];
    return Math.max(1, ...values);
  }, [setup]);

  async function saveTrigger(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage || !selected) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/notification-triggers", accessToken, {
        method: "POST",
        body: JSON.stringify({ id: selected.id, ...form }),
      });
      setSetup(data);
      const updated = data.triggers.find((t) => t.id === selected.id);
      if (updated) openDrawer(updated);
      notifySuccess("Trigger saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save trigger");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(id: string, isActive: boolean) {
    if (!accessToken || !canManage) return;
    try {
      const data = await apiRequest<Setup>(`/erp/notification-triggers/${id}/toggle`, accessToken, {
        method: "POST",
        body: JSON.stringify({ isActive }),
      });
      setSetup(data);
      if (selected?.id === id) {
        const updated = data.triggers.find((t) => t.id === id);
        if (updated) openDrawer(updated);
        else setForm((prev) => ({ ...prev, isActive }));
      }
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to update status");
    }
  }

  async function testTrigger() {
    if (!accessToken || !canManage || !selected) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>(
        `/erp/notification-triggers/${selected.id}/test`,
        accessToken,
        { method: "POST", body: JSON.stringify({}) },
      );
      setSetup(data);
      notifySuccess("Test notification queued");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Test failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeTrigger(id: string) {
    if (!accessToken || !canManage) return;
    if (!window.confirm("Delete this trigger?")) return;
    setMenuId(null);
    try {
      const data = await apiRequest<Setup>(`/erp/notification-triggers/${id}`, accessToken, {
        method: "DELETE",
      });
      setSetup(data);
      if (selected?.id === id) setSelected(null);
      notifySuccess("Trigger deleted");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete trigger");
    }
  }

  if (loading || !setup) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading notification triggers…</div>;
  }

  const stats = setup.stats;
  const tabs: Array<{ id: "ALL" | Module; label: string }> = [
    { id: "ALL", label: `All Triggers` },
    ...setup.moduleCounts.map((m) => ({
      id: m.module,
      label: `${m.label} (${m.count})`,
    })),
  ];

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="shrink-0 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <p className="text-xs text-[#6B7280]">
          Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
          Communication <span className="mx-1">/</span>{" "}
          <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
        </p>
        <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">Notification Triggers</h1>
        <p className="text-xs text-[#6B7280]">
          Configure automated notifications across WhatsApp, Email, Push, and SMS for school events.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Triggers"
            value={stats.totalTriggers}
            hint={`Active: ${stats.active} | Inactive: ${stats.inactive}`}
            tone="bg-violet-50"
            icon={<NotificationsActiveOutlined className="!text-[20px] text-violet-600" />}
          />
          <StatCard
            label="Notifications Sent (Today)"
            value={stats.sentToday.toLocaleString()}
            hint={
              <span className="text-emerald-600">
                {stats.growthPercent >= 0 ? "+" : ""}
                {stats.growthPercent}% vs yesterday
              </span>
            }
            tone="bg-sky-50"
            icon={<EmailOutlined className="!text-[20px] text-sky-600" />}
          />
          <StatCard
            label="Users Reached"
            value={stats.usersReached.toLocaleString()}
            hint="Students • Parents • Staff"
            tone="bg-emerald-50"
            icon={<GroupOutlined className="!text-[20px] text-emerald-600" />}
          />
          <StatCard
            label="Upcoming Triggers"
            value={stats.upcomingTriggers}
            hint="Scheduled for today"
            tone="bg-amber-50"
            icon={<AccessTimeOutlined className="!text-[20px] text-amber-600" />}
          />
        </div>

        <section className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="flex gap-1 overflow-x-auto border-b border-[#E5E7EB] px-3 pt-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setModuleTab(tab.id)}
                className={`shrink-0 rounded-t-lg px-3 py-2 text-xs font-semibold ${
                  moduleTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "text-[#6B7280] hover:text-[#1A1A1A]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E7EB] p-3">
            <div className="relative min-w-[200px] flex-1">
              <SearchOutlined className="pointer-events-none absolute left-2 top-1/2 !text-[18px] -translate-y-1/2 text-[#9CA3AF]" />
              <input
                className={`${inputClass} pl-8`}
                placeholder="Search triggers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className={inputClass + " max-w-[150px]"}
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
            >
              <option value="ALL">All Modules</option>
              {setup.moduleCounts.map((m) => (
                <option key={m.module} value={m.module}>
                  {m.label}
                </option>
              ))}
            </select>
            <select
              className={inputClass + " max-w-[150px]"}
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
            >
              <option value="ALL">All Channels</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="push">Push</option>
              <option value="sms">SMS</option>
            </select>
            <select
              className={inputClass + " max-w-[140px]"}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setModuleFilter("ALL");
                setChannelFilter("ALL");
                setStatusFilter("ALL");
                setModuleTab("ALL");
              }}
              className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs font-semibold text-[#374151]"
            >
              Reset
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#E5E7EB] bg-[#FAFAFA] text-xs uppercase text-[#9CA3AF]">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Trigger Name</th>
                  <th className="px-3 py-2.5 font-semibold">Module</th>
                  <th className="px-3 py-2.5 font-semibold">Event / Condition</th>
                  <th className="px-3 py-2.5 font-semibold">Channels</th>
                  <th className="px-3 py-2.5 font-semibold">Recipients</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((trigger) => (
                  <tr
                    key={trigger.id}
                    className="cursor-pointer border-b border-[#F3F4F6] hover:bg-[#F9FAFB]"
                    onClick={() => openDrawer(trigger)}
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 rounded-lg bg-[#F3F4F6] p-1.5">
                          {moduleIcon(trigger.module)}
                        </div>
                        <div>
                          <p className="font-semibold text-[#1A1A1A]">{trigger.name}</p>
                          <p className="text-xs text-[#9CA3AF]">
                            {trigger.description || "No description"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-xs font-semibold text-[#4B5563]">
                        {trigger.moduleLabel}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[#6B7280]">{trigger.eventLabel}</td>
                    <td className="px-3 py-3">
                      <ChannelIcons channels={trigger.channels} />
                    </td>
                    <td className="px-3 py-3 text-[#6B7280]">{trigger.recipientsLabel}</td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            trigger.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {trigger.isActive ? "Active" : "Inactive"}
                        </span>
                        <Toggle
                          checked={trigger.isActive}
                          disabled={!canManage}
                          onChange={(value) => void toggle(trigger.id, value)}
                        />
                      </div>
                    </td>
                    <td className="relative px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="rounded p-1 text-[#9CA3AF] hover:bg-[#F3F4F6]"
                        onClick={() => setMenuId((id) => (id === trigger.id ? null : trigger.id))}
                      >
                        <MoreVertOutlined className="!text-[18px]" />
                      </button>
                      {menuId === trigger.id ? (
                        <div className="absolute right-3 z-10 mt-1 w-36 rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            className="block w-full px-3 py-1.5 text-left text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB]"
                            onClick={() => openDrawer(trigger)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={!canManage}
                            className="block w-full px-3 py-1.5 text-left text-xs font-semibold text-rose-600 hover:bg-[#F9FAFB] disabled:opacity-50"
                            onClick={() => void removeTrigger(trigger.id)}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!paged.length ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-sm text-[#9CA3AF]">
                      No triggers match your filters
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-xs text-[#6B7280]">
            <span>
              Showing {pageStart} to {pageEnd} of {filtered.length} triggers
            </span>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`h-7 w-7 rounded ${
                    currentPage === n
                      ? "bg-primary text-white"
                      : "border border-[#E5E7EB] text-[#374151]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-3">
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm xl:col-span-1">
            <h2 className="text-sm font-bold text-[#1A1A1A]">Notification Activity</h2>
            <p className="mb-3 text-xs text-[#9CA3AF]">Volume by channel this week</p>
            <div className="flex h-40 items-end gap-2">
              {setup.analytics.activity.map((day) => {
                const total = day.whatsapp + day.email + day.push + day.sms;
                const h = Math.max(8, Math.round((total / activityMax) * 120));
                const w = day.whatsapp / (total || 1);
                const e = day.email / (total || 1);
                const p = day.push / (total || 1);
                return (
                  <div key={day.label} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-col justify-end" style={{ height: `${h}px` }}>
                      <div className="w-full bg-emerald-500" style={{ height: `${w * 100}%` }} />
                      <div className="w-full bg-sky-500" style={{ height: `${e * 100}%` }} />
                      <div className="w-full bg-violet-500" style={{ height: `${p * 100}%` }} />
                      <div
                        className="w-full bg-amber-500"
                        style={{ height: `${(1 - w - e - p) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-[#9CA3AF]">{day.label}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-[#1A1A1A]">Channel Distribution</h2>
            <p className="mb-3 text-xs text-[#9CA3AF]">Share of notifications this week</p>
            <div className="flex items-center gap-4">
              <div
                className="h-28 w-28 shrink-0 rounded-full"
                style={{
                  background: `conic-gradient(
                    #10B981 0 ${setup.analytics.channelDistribution[0]?.percent ?? 0}%,
                    #0EA5E9 0 ${
                      (setup.analytics.channelDistribution[0]?.percent ?? 0) +
                      (setup.analytics.channelDistribution[1]?.percent ?? 0)
                    }%,
                    #8B5CF6 0 ${
                      (setup.analytics.channelDistribution[0]?.percent ?? 0) +
                      (setup.analytics.channelDistribution[1]?.percent ?? 0) +
                      (setup.analytics.channelDistribution[2]?.percent ?? 0)
                    }%,
                    #F59E0B 0 100%
                  )`,
                }}
              />
              <ul className="space-y-1.5 text-xs">
                {setup.analytics.channelDistribution.map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-4">
                    <span className="font-semibold text-[#4B5563]">{item.label}</span>
                    <span className="text-[#9CA3AF]">{item.percent}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-[#1A1A1A]">Top 5 Triggers (This Week)</h2>
            <p className="mb-3 text-xs text-[#9CA3AF]">Most active automated alerts</p>
            <ul className="space-y-2.5">
              {setup.analytics.topTriggers.map((item, index) => (
                <li key={item.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#374151]">
                      {index + 1}. {item.name}
                    </span>
                    <span className="text-[#9CA3AF]">{item.count.toLocaleString()}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#F3F4F6]">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round((item.count / topMax) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {selected ? (
        <aside className="absolute inset-y-0 right-0 z-20 flex w-full max-w-md flex-col border-l border-[#E5E7EB] bg-white shadow-xl">
          <div className="flex items-start justify-between gap-2 border-b border-[#E5E7EB] px-4 py-3">
            <div>
              <h2 className="text-base font-bold text-[#1A1A1A]">{selected.name}</h2>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    form.isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {form.isActive ? "Active" : "Inactive"}
                </span>
                <Toggle
                  checked={form.isActive}
                  disabled={!canManage}
                  onChange={(value) => {
                    setForm((prev) => ({ ...prev, isActive: value }));
                    void toggle(selected.id, value);
                  }}
                />
              </div>
            </div>
            <button
              type="button"
              className="rounded p-1 text-[#9CA3AF] hover:bg-[#F3F4F6]"
              onClick={() => setSelected(null)}
            >
              <CloseOutlined />
            </button>
          </div>

          <div className="flex gap-1 border-b border-[#E5E7EB] px-3 pt-2">
            {(
              [
                ["config", "Configuration"],
                ["message", "Message"],
                ["recipients", "Recipients"],
                ["logs", "Logs"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDrawerTab(id)}
                className={`rounded-t-lg px-3 py-2 text-xs font-semibold ${
                  drawerTab === id ? "bg-primary/10 text-primary" : "text-[#6B7280]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => void saveTrigger(e)}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
          >
            {drawerTab === "config" ? (
              <>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#9CA3AF]">
                    Basic Information
                  </p>
                  <div className="space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                        Trigger Name
                      </span>
                      <input
                        className={inputClass}
                        disabled={!canManage}
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                        Module
                      </span>
                      <select
                        className={inputClass}
                        disabled={!canManage}
                        value={form.module}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, module: e.target.value as Module }))
                        }
                      >
                        {setup.moduleCounts.map((m) => (
                          <option key={m.module} value={m.module}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                        Event / Condition
                      </span>
                      <select
                        className={inputClass}
                        disabled={!canManage}
                        value={form.eventKey}
                        onChange={(e) => {
                          const opt = setup.eventOptions.find((o) => o.key === e.target.value);
                          setForm((prev) => ({
                            ...prev,
                            eventKey: e.target.value,
                            eventLabel: opt?.label || e.target.value,
                            module: opt?.module || prev.module,
                          }));
                        }}
                      >
                        <option value={form.eventKey}>{form.eventLabel}</option>
                        {setup.eventOptions
                          .filter((o) => o.key !== form.eventKey)
                          .map((o) => (
                            <option key={o.key} value={o.key}>
                              {o.label}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                        Priority
                      </span>
                      <select
                        className={inputClass}
                        disabled={!canManage}
                        value={form.priority}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            priority: e.target.value as "HIGH" | "MEDIUM" | "LOW",
                          }))
                        }
                      >
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#9CA3AF]">
                    Notification Channels
                  </p>
                  <div className="space-y-2">
                    {(
                      [
                        ["channelWhatsapp", "WhatsApp"],
                        ["channelEmail", "Email"],
                        ["channelPush", "Push Notification"],
                        ["channelSms", "SMS"],
                      ] as const
                    ).map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          disabled={!canManage}
                          checked={form[key]}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, [key]: e.target.checked }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#9CA3AF]">
                    Recipient Rules
                  </p>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {(
                      [
                        ["recipientStudent", "Student"],
                        ["recipientParent", "Parent/Guardian"],
                        ["recipientStaff", "Staff"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          disabled={!canManage}
                          checked={form[key]}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, [key]: e.target.checked }))
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#9CA3AF]">
                    Send Time
                  </p>
                  <div className="space-y-2 text-sm">
                    {(
                      [
                        ["IMMEDIATELY", "Immediately"],
                        ["SCHEDULED", "Scheduled"],
                        ["QUIET_HOURS", "Quiet Hours (8 PM - 6 AM)"],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="sendTiming"
                          disabled={!canManage}
                          checked={form.sendTiming === value}
                          onChange={() => setForm((prev) => ({ ...prev, sendTiming: value }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {drawerTab === "message" ? (
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                    Subject
                  </span>
                  <input
                    className={inputClass}
                    disabled={!canManage}
                    value={form.messageSubject}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, messageSubject: e.target.value }))
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">Body</span>
                  <textarea
                    className={inputClass + " min-h-[180px]"}
                    disabled={!canManage}
                    value={form.messageBody}
                    onChange={(e) => setForm((prev) => ({ ...prev, messageBody: e.target.value }))}
                  />
                </label>
                <p className="text-xs text-[#9CA3AF]">
                  Tokens: {"{{name}}"}, {"{{school_name}}"}, {"{{amount}}"}, {"{{date}}"}
                </p>
              </div>
            ) : null}

            {drawerTab === "recipients" ? (
              <div className="space-y-3 text-sm text-[#4B5563]">
                <p>
                  Current audience:{" "}
                  <strong>
                    {[
                      form.recipientStudent ? "Student" : null,
                      form.recipientParent ? "Parent/Guardian" : null,
                      form.recipientStaff ? "Staff" : null,
                    ]
                      .filter(Boolean)
                      .join(", ") || "None"}
                  </strong>
                </p>
                <p className="text-xs text-[#9CA3AF]">
                  Recipient rules are applied when the trigger event fires. Channel availability
                  still depends on gateway configuration.
                </p>
              </div>
            ) : null}

            {drawerTab === "logs" ? (
              <ul className="space-y-2">
                {setup.recentLogs
                  .filter((log) => log.triggerName === selected.name)
                  .slice(0, 8)
                  .map((log) => (
                    <li
                      key={log.id}
                      className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs"
                    >
                      <p className="font-semibold text-[#1A1A1A]">
                        {log.channel.toUpperCase()} · {log.recipientCount} recipients
                      </p>
                      <p className="text-[#9CA3AF]">
                        {log.status} · {log.createdAtLabel}
                      </p>
                    </li>
                  ))}
                {!setup.recentLogs.some((log) => log.triggerName === selected.name) ? (
                  <li className="py-6 text-center text-sm text-[#9CA3AF]">No logs for this trigger</li>
                ) : null}
              </ul>
            ) : null}
          </form>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#E5E7EB] px-4 py-3">
            <button
              type="button"
              disabled={!canManage || saving}
              onClick={() => void testTrigger()}
              className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs font-semibold text-[#374151] disabled:opacity-50"
            >
              <ScienceOutlined className="!text-[16px]" />
              Test Trigger
            </button>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs font-semibold text-[#374151]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canManage || saving}
              onClick={() => void saveTrigger()}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
