import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  CloseOutlined,
  DescriptionOutlined,
  EditOutlined,
  EmailOutlined,
  FilterListOutlined,
  HelpOutlineOutlined,
  InfoOutlined,
  MenuBookOutlined,
  MoreVertOutlined,
  NotificationsNoneOutlined,
  SearchOutlined,
  SmsOutlined,
  WhatsApp,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type TemplateType = "MESSAGE" | "NOTICE" | "EMAIL";

type Template = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  type: TemplateType;
  typeLabel: string;
  category: string;
  language: string;
  languageLabel: string;
  subject: string;
  body: string;
  channels: { whatsapp: boolean; sms: boolean; push: boolean; email: boolean };
  isActive: boolean;
  usedInTriggers: boolean;
  variables: string[];
  updatedAtLabel: string;
};

type Setup = {
  stats: {
    total: number;
    messageCount: number;
    noticeCount: number;
    emailCount: number;
    active: number;
    unused: number;
    activePercent: number;
  };
  variables: Array<{ key: string; label: string }>;
  categories: string[];
  templates: Template[];
};

const PAGE_SIZES = [10, 25, 50];

const inputClass =
  "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-primary";

const EMPTY_FORM = {
  name: "",
  description: "",
  type: "MESSAGE" as TemplateType,
  category: "General",
  language: "en",
  subject: "",
  body: "",
  channelWhatsapp: true,
  channelSms: true,
  channelPush: true,
  channelEmail: false,
  isActive: true,
  usedInTriggers: true,
};

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

function ChannelIcons({ channels }: { channels: Template["channels"] }) {
  const items = [
    { on: channels.whatsapp, icon: <WhatsApp className="!text-[16px]" />, onClass: "text-emerald-600" },
    { on: channels.sms, icon: <SmsOutlined className="!text-[16px]" />, onClass: "text-amber-600" },
    {
      on: channels.push,
      icon: <NotificationsNoneOutlined className="!text-[16px]" />,
      onClass: "text-violet-600",
    },
    { on: channels.email, icon: <EmailOutlined className="!text-[16px]" />, onClass: "text-sky-600" },
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

function previewBody(body: string) {
  return body
    .replaceAll("{{Parent Name}}", "Mrs. Sharma")
    .replaceAll("{{Student Name}}", "Aarav Sharma")
    .replaceAll("{{School Name}}", "Sunshine Public School")
    .replaceAll("{{Class}}", "8")
    .replaceAll("{{Section}}", "A")
    .replaceAll("{{Adm No}}", "ADM-2026-0142")
    .replaceAll("{{Amount}}", "₹12,500")
    .replaceAll("{{Due Date}}", "15 Aug 2026")
    .replaceAll("{{Exam Name}}", "Term 1 Examination")
    .replaceAll("{{Date}}", "12 Aug 2026")
    .replaceAll("{{Time}}", "10:00 AM")
    .replaceAll("{{Staff Name}}", "Mr. Verma");
}

export function MessageNoticeTemplatesPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Message & Notice Templates";
  const canManage = Boolean(
    user?.permissions.some((p) => ["erp.manage", "settings.manage"].includes(p)),
  );

  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"ALL" | "MESSAGE" | "NOTICE" | "EMAIL">("ALL");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewChannel, setPreviewChannel] = useState("whatsapp");
  const [showGuide, setShowGuide] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/message-notice-templates", accessToken);
      setSetup(data);
      if (!selectedId && data.templates[0]) setSelectedId(data.templates[0].id);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load templates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (setup?.templates ?? []).filter((item) => {
      if (tab === "MESSAGE" && item.type !== "MESSAGE") return false;
      if (tab === "NOTICE" && item.type !== "NOTICE") return false;
      if (tab === "EMAIL" && item.type !== "EMAIL" && !item.channels.email) return false;
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false;
      if (statusFilter === "ACTIVE" && !item.isActive) return false;
      if (statusFilter === "INACTIVE" && item.isActive) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q) ||
        item.body.toLowerCase().includes(q)
      );
    });
  }, [setup, tab, search, categoryFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filtered.length ? (currentPage - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(currentPage * pageSize, filtered.length);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [tab, search, categoryFilter, statusFilter, pageSize]);

  const selected =
    setup?.templates.find((t) => t.id === selectedId) ||
    filtered[0] ||
    setup?.templates[0] ||
    null;

  useEffect(() => {
    if (!selected) return;
    const preferred = selected.channels.whatsapp
      ? "whatsapp"
      : selected.channels.sms
        ? "sms"
        : selected.channels.push
          ? "push"
          : "email";
    setPreviewChannel(preferred);
  }, [selected?.id]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setEditorOpen(true);
    setMenuId(null);
  }

  function openEdit(template: Template) {
    setEditingId(template.id);
    setForm({
      name: template.name,
      description: template.description || "",
      type: template.type,
      category: template.category,
      language: template.language,
      subject: template.subject,
      body: template.body,
      channelWhatsapp: template.channels.whatsapp,
      channelSms: template.channels.sms,
      channelPush: template.channels.push,
      channelEmail: template.channels.email,
      isActive: template.isActive,
      usedInTriggers: template.usedInTriggers,
    });
    setEditorOpen(true);
    setMenuId(null);
  }

  async function saveTemplate(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/message-notice-templates", accessToken, {
        method: "POST",
        body: JSON.stringify({
          id: editingId || undefined,
          ...form,
        }),
      });
      setSetup(data);
      const focusId = editingId || data.templates[data.templates.length - 1]?.id;
      if (focusId) setSelectedId(focusId);
      setEditorOpen(false);
      notifySuccess(editingId ? "Template updated" : "Template created");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save template");
    } finally {
      setSaving(false);
    }
  }

  async function removeTemplate(id: string) {
    if (!accessToken || !canManage) return;
    if (!window.confirm("Delete this template?")) return;
    setMenuId(null);
    try {
      const data = await apiRequest<Setup>(`/erp/message-notice-templates/${id}`, accessToken, {
        method: "DELETE",
      });
      setSetup(data);
      if (selectedId === id) setSelectedId(data.templates[0]?.id ?? null);
      notifySuccess("Template deleted");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete template");
    }
  }

  if (loading || !setup) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading message & notice templates…</div>;
  }

  const stats = setup.stats;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            Communication <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">Message & Notice Templates</h1>
          <p className="text-xs text-[#6B7280]">
            Create and manage reusable message and notice templates with personalization variables.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151]"
          >
            <HelpOutlineOutlined className="!text-[18px]" />
            Help
          </button>
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151]"
          >
            <MenuBookOutlined className="!text-[18px]" />
            Variables Guide
          </button>
          <button
            type="button"
            disabled={!canManage}
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <AddOutlined className="!text-[18px]" />
            Create New Template
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Total Templates"
            value={stats.total}
            hint="All Categories"
            tone="bg-violet-50"
            icon={<DescriptionOutlined className="!text-[20px] text-violet-600" />}
          />
          <StatCard
            label="Message Templates"
            value={stats.messageCount}
            hint="For SMS / WhatsApp / Push"
            tone="bg-emerald-50"
            icon={<WhatsApp className="!text-[20px] text-emerald-600" />}
          />
          <StatCard
            label="Notice Templates"
            value={stats.noticeCount}
            hint="For Portal / App / Email"
            tone="bg-sky-50"
            icon={<NotificationsNoneOutlined className="!text-[20px] text-sky-600" />}
          />
          <StatCard
            label="Active Templates"
            value={stats.active}
            hint={`${stats.activePercent}% of total`}
            tone="bg-emerald-50"
            icon={<DescriptionOutlined className="!text-[20px] text-emerald-600" />}
          />
          <StatCard
            label="Unused Templates"
            value={stats.unused}
            hint="Not used in triggers"
            tone="bg-amber-50"
            icon={<InfoOutlined className="!text-[20px] text-amber-600" />}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EB] px-3 pt-3">
              <div className="flex gap-1 overflow-x-auto">
                {(
                  [
                    ["ALL", "All Templates"],
                    ["MESSAGE", "Messages"],
                    ["NOTICE", "Notices"],
                    ["EMAIL", "Email Templates"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`shrink-0 rounded-t-lg px-3 py-2 text-xs font-semibold ${
                      tab === id ? "bg-primary/10 text-primary" : "text-[#6B7280]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mb-2 flex items-center gap-2">
                <div className="relative">
                  <SearchOutlined className="pointer-events-none absolute left-2 top-1/2 !text-[18px] -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    className={`${inputClass} w-44 pl-8 sm:w-56`}
                    placeholder="Search templates…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs font-semibold text-[#374151]"
                >
                  <FilterListOutlined className="!text-[16px]" />
                  Filters
                </button>
              </div>
            </div>

            {showFilters ? (
              <div className="flex flex-wrap gap-2 border-b border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2">
                <select
                  className={inputClass + " max-w-[160px]"}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="ALL">All Categories</option>
                  {setup.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
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
                  className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs font-semibold"
                  onClick={() => {
                    setCategoryFilter("ALL");
                    setStatusFilter("ALL");
                    setSearch("");
                  }}
                >
                  Reset
                </button>
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[#E5E7EB] bg-[#FAFAFA] text-xs uppercase text-[#9CA3AF]">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Template Name</th>
                    <th className="px-3 py-2.5 font-semibold">Type</th>
                    <th className="px-3 py-2.5 font-semibold">Category</th>
                    <th className="px-3 py-2.5 font-semibold">Channels</th>
                    <th className="px-3 py-2.5 font-semibold">Language</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Last Updated</th>
                    <th className="px-3 py-2.5 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((template) => (
                    <tr
                      key={template.id}
                      onClick={() => setSelectedId(template.id)}
                      className={`cursor-pointer border-b border-[#F3F4F6] hover:bg-[#F9FAFB] ${
                        selected?.id === template.id ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="px-3 py-3">
                        <p className="font-semibold text-[#1A1A1A]">{template.name}</p>
                        <p className="text-xs text-[#9CA3AF]">
                          {template.description || "No description"}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            template.type === "MESSAGE"
                              ? "bg-emerald-50 text-emerald-700"
                              : template.type === "NOTICE"
                                ? "bg-violet-50 text-violet-700"
                                : "bg-sky-50 text-sky-700"
                          }`}
                        >
                          {template.typeLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[#6B7280]">{template.category}</td>
                      <td className="px-3 py-3">
                        <ChannelIcons channels={template.channels} />
                      </td>
                      <td className="px-3 py-3 text-[#6B7280]">{template.languageLabel}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            template.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {template.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-[#6B7280]">{template.updatedAtLabel}</td>
                      <td className="relative px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={!canManage}
                            className="rounded p-1 text-primary hover:bg-[#F3F4F6] disabled:opacity-50"
                            onClick={() => openEdit(template)}
                          >
                            <EditOutlined className="!text-[18px]" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-[#9CA3AF] hover:bg-[#F3F4F6]"
                            onClick={() =>
                              setMenuId((id) => (id === template.id ? null : template.id))
                            }
                          >
                            <MoreVertOutlined className="!text-[18px]" />
                          </button>
                        </div>
                        {menuId === template.id ? (
                          <div className="absolute right-3 z-10 mt-1 w-36 rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-lg">
                            <button
                              type="button"
                              className="block w-full px-3 py-1.5 text-left text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB]"
                              onClick={() => openEdit(template)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={!canManage}
                              className="block w-full px-3 py-1.5 text-left text-xs font-semibold text-rose-600 hover:bg-[#F9FAFB] disabled:opacity-50"
                              onClick={() => void removeTemplate(template.id)}
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
                      <td colSpan={8} className="px-3 py-10 text-center text-sm text-[#9CA3AF]">
                        No templates match your filters
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-xs text-[#6B7280]">
              <span>
                Showing {pageStart} to {pageEnd} of {filtered.length} entries
              </span>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1">
                  Entries per page
                  <select
                    className="rounded border border-[#E5E7EB] px-2 py-1"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                  >
                    {PAGE_SIZES.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
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
            </div>
          </section>

          <aside className="h-fit space-y-4 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm xl:sticky xl:top-0">
            {selected ? (
              <>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-[#1A1A1A]">Template Preview</h2>
                    <select
                      className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs font-semibold"
                      value={previewChannel}
                      onChange={(e) => setPreviewChannel(e.target.value)}
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="sms">SMS</option>
                      <option value="push">Push</option>
                      <option value="email">Email</option>
                    </select>
                  </div>
                  <div
                    className={`rounded-2xl p-3 text-sm leading-relaxed ${
                      previewChannel === "whatsapp"
                        ? "bg-[#E7F8EF] text-[#065F46]"
                        : previewChannel === "sms"
                          ? "bg-[#FFF7ED] text-[#9A3412]"
                          : previewChannel === "push"
                            ? "bg-[#F5F3FF] text-[#5B21B6]"
                            : "bg-[#F0F9FF] text-[#075985]"
                    }`}
                  >
                    {selected.subject && previewChannel === "email" ? (
                      <p className="mb-2 font-bold">{selected.subject}</p>
                    ) : null}
                    <p className="whitespace-pre-wrap">{previewBody(selected.body)}</p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#9CA3AF]">
                    Template Details
                  </h3>
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#9CA3AF]">Template Name</dt>
                      <dd className="font-semibold text-[#1A1A1A]">{selected.name}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#9CA3AF]">Category</dt>
                      <dd className="font-semibold text-[#1A1A1A]">{selected.category}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#9CA3AF]">Type</dt>
                      <dd className="font-semibold text-[#1A1A1A]">{selected.typeLabel}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#9CA3AF]">Language</dt>
                      <dd className="font-semibold text-[#1A1A1A]">{selected.languageLabel}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-[#9CA3AF]">Channels</dt>
                      <dd>
                        <ChannelIcons channels={selected.channels} />
                      </dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#9CA3AF]">
                    Variables Used ({selected.variables.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.variables.map((variable) => (
                      <span
                        key={variable}
                        className="rounded-md bg-[#F3F4F6] px-2 py-0.5 font-mono text-[11px] text-[#4B5563]"
                      >
                        {variable}
                      </span>
                    ))}
                    {!selected.variables.length ? (
                      <span className="text-xs text-[#9CA3AF]">No variables</span>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => openEdit(selected)}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#374151] disabled:opacity-50"
                >
                  Edit Template
                </button>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-[#9CA3AF]">Select a template to preview</p>
            )}
          </aside>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-[#4C1D95]">
          <span className="inline-flex items-center gap-2">
            <InfoOutlined className="!text-[18px]" />
            Use variables to personalize messages. Click on &apos;Variables Guide&apos; to see all
            available variables.
          </span>
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="font-semibold text-primary underline"
          >
            Learn more
          </button>
        </div>
      </div>

      {showGuide ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1A1A1A]">Variables Guide</h2>
              <button type="button" onClick={() => setShowGuide(false)}>
                <CloseOutlined />
              </button>
            </div>
            <ul className="space-y-2">
              {setup.variables.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs text-primary">{item.key}</span>
                  <span className="text-[#6B7280]">{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {editorOpen ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <form
            onSubmit={(e) => void saveTemplate(e)}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1A1A1A]">
                {editingId ? "Edit Template" : "Create New Template"}
              </h2>
              <button type="button" onClick={() => setEditorOpen(false)}>
                <CloseOutlined />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">Name</span>
                <input
                  className={inputClass}
                  required
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                  Description
                </span>
                <input
                  className={inputClass}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">Type</span>
                <select
                  className={inputClass}
                  value={form.type}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, type: e.target.value as TemplateType }))
                  }
                >
                  <option value="MESSAGE">Message</option>
                  <option value="NOTICE">Notice</option>
                  <option value="EMAIL">Email</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">Category</span>
                <input
                  className={inputClass}
                  required
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  list="mnt-categories"
                />
                <datalist id="mnt-categories">
                  {setup.categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">Subject</span>
                <input
                  className={inputClass}
                  value={form.subject}
                  onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">Body</span>
                <textarea
                  className={inputClass + " min-h-[160px]"}
                  required
                  value={form.body}
                  onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {(
                [
                  ["channelWhatsapp", "WhatsApp"],
                  ["channelSms", "SMS"],
                  ["channelPush", "Push"],
                  ["channelEmail", "Email"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                Active
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Template"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
