import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  ArticleOutlined,
  ChevronLeftOutlined,
  ChevronRightOutlined,
  DeleteOutline,
  DraftsOutlined,
  EditOutlined,
  FilterListOutlined,
  ImageOutlined,
  InfoOutlined,
  LanguageOutlined,
  MenuOutlined,
  SaveOutlined,
  SearchOutlined,
  VisibilityOutlined,
  ViewCarouselOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest, assetUrl } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type PageItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  menuKey: string;
  menuLabel: string;
  status: "DRAFT" | "PUBLISHED";
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAtLabel: string;
  updatedByName: string;
};

type MenuItem = {
  id: string;
  label: string;
  url: string | null;
  pageId: string | null;
  pageTitle: string | null;
  isActive: boolean;
  sortOrder: number;
};

type Menu = {
  id: string;
  name: string;
  key: string;
  isActive: boolean;
  itemCount: number;
  items: MenuItem[];
};

type MediaItem = {
  id: string;
  name: string;
  fileUrl: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedByName: string;
};

type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  isActive: boolean;
};

type SiteSettings = {
  siteTitle: string;
  siteTagline: string;
  defaultSeoTitle: string;
  defaultSeoDesc: string;
  contactEmail: string;
  contactPhone: string;
  socialFacebook: string;
  socialInstagram: string;
  socialYoutube: string;
  googleAnalyticsId: string;
  homepagePageId: string | null;
  maintenanceMode: boolean;
};

type Setup = {
  pages: PageItem[];
  menus: Menu[];
  media: MediaItem[];
  banners: Banner[];
  siteSettings: SiteSettings;
  menuOptions: Array<{ key: string; label: string }>;
  stats: {
    totalPages: number;
    publishedPages: number;
    draftPages: number;
    menus: number;
    mediaFiles: number;
    banners: number;
  };
};

type TabKey = "pages" | "menus" | "media" | "banners" | "seo" | "site";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "pages", label: "Pages" },
  { key: "menus", label: "Menus" },
  { key: "media", label: "Media Library" },
  { key: "banners", label: "Banners" },
  { key: "seo", label: "SEO Settings" },
  { key: "site", label: "Site Settings" },
];

const PAGE_SIZE = 10;
const EMPTY_PAGE = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  menuKey: "MAIN",
  status: "DRAFT" as const,
  seoTitle: "",
  seoDescription: "",
};

const inputClass =
  "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-primary";

function Card({
  title,
  hint,
  actions,
  children,
}: {
  title?: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title ? <h2 className="text-sm font-bold text-[#1A1A1A]">{title}</h2> : null}
            {hint ? <p className="mt-0.5 text-xs text-[#6B7280]">{hint}</p> : null}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
      {children}
      {required ? <span className="text-rose-500"> *</span> : null}
    </span>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className={`rounded-lg p-2 ${tone}`}>{icon}</div>
      <div>
        <p className="text-xs font-semibold text-[#6B7280]">{label}</p>
        <p className="text-xl font-bold text-[#1A1A1A]">{value}</p>
        <p className="text-xs text-[#9CA3AF]">{hint}</p>
      </div>
    </div>
  );
}

export function WebsiteCmsPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Website CMS";
  const canManage = Boolean(
    user?.permissions.some((p) => ["erp.manage", "settings.manage"].includes(p)),
  );

  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabKey>("pages");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PUBLISHED" | "DRAFT">("ALL");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPageForm, setShowPageForm] = useState(false);
  const [form, setForm] = useState(EMPTY_PAGE);
  const [siteForm, setSiteForm] = useState<SiteSettings | null>(null);
  const [bannerForm, setBannerForm] = useState({
    id: "" as string,
    title: "",
    subtitle: "",
    imageUrl: "",
    linkUrl: "",
    isActive: true,
  });
  const [menuForm, setMenuForm] = useState({ name: "", key: "", isActive: true });
  const [menuItemForm, setMenuItemForm] = useState({
    menuId: "",
    label: "",
    url: "",
    pageId: "",
  });

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/website-cms", accessToken);
      setSetup(data);
      setSiteForm(data.siteSettings);
      if (!menuItemForm.menuId && data.menus[0]) {
        setMenuItemForm((prev) => ({ ...prev, menuId: data.menus[0].id }));
      }
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load Website CMS");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const filteredPages = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (setup?.pages ?? []).filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q) ||
        item.menuLabel.toLowerCase().includes(q)
      );
    });
  }, [setup?.pages, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPages.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filteredPages.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filteredPages.length);
  const paged = filteredPages.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  function openNewPage() {
    setEditingId(null);
    setForm(EMPTY_PAGE);
    setShowPageForm(true);
    setTab("pages");
  }

  function openEditPage(item: PageItem) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      slug: item.slug,
      excerpt: item.excerpt ?? "",
      content: item.content ?? "",
      menuKey: item.menuKey,
      status: item.status,
      seoTitle: item.seoTitle ?? "",
      seoDescription: item.seoDescription ?? "",
    });
    setShowPageForm(true);
    setTab("pages");
  }

  async function savePage(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canManage) return;
    if (!form.title.trim()) {
      notifyError("Page title is required");
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        excerpt: form.excerpt.trim() || null,
        content: form.content.trim() || null,
        menuKey: form.menuKey,
        status: form.status,
        seoTitle: form.seoTitle.trim() || null,
        seoDescription: form.seoDescription.trim() || null,
      };
      const data = editingId
        ? await apiRequest<Setup>(`/erp/website-cms/pages/${editingId}`, accessToken, {
            method: "PUT",
            body: JSON.stringify(body),
          })
        : await apiRequest<Setup>("/erp/website-cms/pages", accessToken, {
            method: "POST",
            body: JSON.stringify(body),
          });
      setSetup(data);
      setSiteForm(data.siteSettings);
      setShowPageForm(false);
      setEditingId(null);
      setForm(EMPTY_PAGE);
      notifySuccess(editingId ? "Page updated" : "Page created");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save page");
    } finally {
      setSaving(false);
    }
  }

  async function removePage(item: PageItem) {
    if (!accessToken || !canManage) return;
    const ok = await confirmDelete(`Delete page "${item.title}"?`);
    if (!ok) return;
    try {
      const data = await apiRequest<Setup>(`/erp/website-cms/pages/${item.id}`, accessToken, {
        method: "DELETE",
      });
      setSetup(data);
      notifySuccess("Page deleted");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete page");
    }
  }

  async function saveMenu(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/website-cms/menus", accessToken, {
        method: "POST",
        body: JSON.stringify(menuForm),
      });
      setSetup(data);
      setMenuForm({ name: "", key: "", isActive: true });
      notifySuccess("Menu saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save menu");
    } finally {
      setSaving(false);
    }
  }

  async function saveMenuItem(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/website-cms/menu-items", accessToken, {
        method: "POST",
        body: JSON.stringify({
          menuId: menuItemForm.menuId,
          label: menuItemForm.label,
          url: menuItemForm.url || null,
          pageId: menuItemForm.pageId || null,
        }),
      });
      setSetup(data);
      setMenuItemForm((prev) => ({ ...prev, label: "", url: "", pageId: "" }));
      notifySuccess("Menu item added");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save menu item");
    } finally {
      setSaving(false);
    }
  }

  async function onMediaUpload(file: File | null) {
    if (!file || !accessToken || !canManage) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("application/")) {
      notifyError("Unsupported file type");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      notifyError("File must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const data = await apiRequest<Setup>("/erp/website-cms/media", accessToken, {
            method: "POST",
            body: JSON.stringify({
              name: file.name,
              fileUrl: String(reader.result ?? ""),
              mimeType: file.type,
              sizeBytes: file.size,
            }),
          });
          setSetup(data);
          notifySuccess("Media uploaded");
        } catch (cause) {
          notifyError(cause instanceof Error ? cause.message : "Unable to upload media");
        }
      })();
    };
    reader.readAsDataURL(file);
  }

  async function saveBanner(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/website-cms/banners", accessToken, {
        method: "POST",
        body: JSON.stringify({
          id: bannerForm.id || undefined,
          title: bannerForm.title,
          subtitle: bannerForm.subtitle || null,
          imageUrl: bannerForm.imageUrl || null,
          linkUrl: bannerForm.linkUrl || null,
          isActive: bannerForm.isActive,
        }),
      });
      setSetup(data);
      setBannerForm({
        id: "",
        title: "",
        subtitle: "",
        imageUrl: "",
        linkUrl: "",
        isActive: true,
      });
      notifySuccess("Banner saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save banner");
    } finally {
      setSaving(false);
    }
  }

  async function saveSiteSettings(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !canManage || !siteForm) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/website-cms/site-settings", accessToken, {
        method: "PUT",
        body: JSON.stringify(siteForm),
      });
      setSetup(data);
      setSiteForm(data.siteSettings);
      notifySuccess("Site settings saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save site settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !setup) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading Website CMS…</div>;
  }

  const stats = setup.stats;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">Website CMS</h1>
          <p className="text-xs text-[#6B7280]">
            Manage and update website content, pages, menus, and media from one place.
          </p>
        </div>
        <button
          type="button"
          disabled={!canManage}
          onClick={openNewPage}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <AddOutlined className="!text-[18px]" />
          Add New Page
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Pages"
            value={stats.totalPages}
            hint={`Published: ${stats.publishedPages}`}
            tone="bg-violet-50"
            icon={<ArticleOutlined className="!text-[20px] text-violet-600" />}
          />
          <StatCard
            label="Draft Pages"
            value={stats.draftPages}
            hint="Unpublished"
            tone="bg-sky-50"
            icon={<DraftsOutlined className="!text-[20px] text-sky-600" />}
          />
          <StatCard
            label="Menus"
            value={stats.menus}
            hint="Active menus"
            tone="bg-emerald-50"
            icon={<LanguageOutlined className="!text-[20px] text-emerald-600" />}
          />
          <StatCard
            label="Media Files"
            value={stats.mediaFiles}
            hint="Total uploaded"
            tone="bg-amber-50"
            icon={<ImageOutlined className="!text-[20px] text-amber-600" />}
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#E5E7EB] bg-white px-2 shadow-sm">
          <div className="flex min-w-max gap-1">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={[
                  "inline-flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-semibold whitespace-nowrap",
                  tab === item.key
                    ? "border-primary text-primary"
                    : "border-transparent text-[#6B7280]",
                ].join(" ")}
              >
                {item.key === "pages" ? <ArticleOutlined className="!text-[16px]" /> : null}
                {item.key === "menus" ? <MenuOutlined className="!text-[16px]" /> : null}
                {item.key === "media" ? <ImageOutlined className="!text-[16px]" /> : null}
                {item.key === "banners" ? <ViewCarouselOutlined className="!text-[16px]" /> : null}
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "pages" ? (
          <div className="space-y-4">
            {showPageForm ? (
              <Card
                title={editingId ? "Edit Page" : "Add New Page"}
                actions={
                  <button
                    type="button"
                    className="text-xs font-semibold text-[#6B7280]"
                    onClick={() => {
                      setShowPageForm(false);
                      setEditingId(null);
                    }}
                  >
                    Close
                  </button>
                }
              >
                <form onSubmit={(e) => void savePage(e)} className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <FieldLabel required>Page Title</FieldLabel>
                    <input
                      className={inputClass}
                      value={form.title}
                      disabled={!canManage}
                      onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>URL Slug</FieldLabel>
                    <input
                      className={inputClass}
                      value={form.slug}
                      disabled={!canManage}
                      placeholder="/about-us"
                      onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Menu</FieldLabel>
                    <select
                      className={inputClass}
                      value={form.menuKey}
                      disabled={!canManage}
                      onChange={(e) => setForm((p) => ({ ...p, menuKey: e.target.value }))}
                    >
                      {setup.menuOptions.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <FieldLabel>Status</FieldLabel>
                    <select
                      className={inputClass}
                      value={form.status}
                      disabled={!canManage}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          status: e.target.value as "DRAFT" | "PUBLISHED",
                        }))
                      }
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="PUBLISHED">Published</option>
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <FieldLabel>Excerpt</FieldLabel>
                    <input
                      className={inputClass}
                      value={form.excerpt}
                      disabled={!canManage}
                      onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value }))}
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <FieldLabel>Content</FieldLabel>
                    <textarea
                      rows={5}
                      className={inputClass}
                      value={form.content}
                      disabled={!canManage}
                      onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>SEO Title</FieldLabel>
                    <input
                      className={inputClass}
                      value={form.seoTitle}
                      disabled={!canManage}
                      onChange={(e) => setForm((p) => ({ ...p, seoTitle: e.target.value }))}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>SEO Description</FieldLabel>
                    <input
                      className={inputClass}
                      value={form.seoDescription}
                      disabled={!canManage}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, seoDescription: e.target.value }))
                      }
                    />
                  </label>
                  <div className="flex gap-2 sm:col-span-2">
                    <button
                      type="submit"
                      disabled={!canManage || saving}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      <SaveOutlined className="!text-[16px]" />
                      {saving ? "Saving…" : "Save Page"}
                    </button>
                  </div>
                </form>
              </Card>
            ) : null}

            <Card>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <select
                  className={`${inputClass} max-w-[160px]`}
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "ALL" | "PUBLISHED" | "DRAFT")
                  }
                >
                  <option value="ALL">All Pages</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="DRAFT">Draft</option>
                </select>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="relative min-w-[220px]">
                    <SearchOutlined className="pointer-events-none absolute left-2.5 top-1/2 !text-[18px] -translate-y-1/2 text-[#9CA3AF]" />
                    <input
                      className={`${inputClass} pl-9`}
                      placeholder="Search pages..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowFilters((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#374151]"
                  >
                    <FilterListOutlined className="!text-[18px]" />
                    Filters
                  </button>
                </div>
              </div>

              {showFilters ? (
                <p className="mb-3 text-xs text-[#6B7280]">
                  Use the All Pages dropdown and search to filter by status, title, or slug.
                </p>
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">#</th>
                      <th className="px-3 py-2 font-semibold">Page Title</th>
                      <th className="px-3 py-2 font-semibold">URL Slug</th>
                      <th className="px-3 py-2 font-semibold">Menu</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Last Updated</th>
                      <th className="px-3 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-[#6B7280]">
                          No pages found.
                        </td>
                      </tr>
                    ) : (
                      paged.map((item, index) => (
                        <tr key={item.id} className="border-t border-[#F3F4F6]">
                          <td className="px-3 py-2.5 text-[#6B7280]">
                            {(currentPage - 1) * PAGE_SIZE + index + 1}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-[#1A1A1A]">
                            {item.title}
                          </td>
                          <td className="px-3 py-2.5 text-[#6B7280]">{item.slug}</td>
                          <td className="px-3 py-2.5 text-[#374151]">{item.menuLabel}</td>
                          <td className="px-3 py-2.5">
                            <span
                              className={[
                                "rounded-full px-2 py-0.5 text-xs font-semibold",
                                item.status === "PUBLISHED"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700",
                              ].join(" ")}
                            >
                              {item.status === "PUBLISHED" ? "Published" : "Draft"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-[#6B7280]">
                            <p>{item.updatedAtLabel}</p>
                            <p className="text-[11px]">by {item.updatedByName}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="rounded p-1 text-sky-600 hover:bg-sky-50"
                                title="View"
                                onClick={() => openEditPage(item)}
                              >
                                <VisibilityOutlined className="!text-[18px]" />
                              </button>
                              <button
                                type="button"
                                disabled={!canManage}
                                className="rounded p-1 text-violet-600 hover:bg-violet-50 disabled:opacity-40"
                                onClick={() => openEditPage(item)}
                              >
                                <EditOutlined className="!text-[18px]" />
                              </button>
                              <button
                                type="button"
                                disabled={!canManage}
                                className="rounded p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                                onClick={() => void removePage(item)}
                              >
                                <DeleteOutline className="!text-[18px]" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[#6B7280]">
                <p>
                  Showing {pageStart} to {pageEnd} of {filteredPages.length} entries
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-[#E5E7EB] p-1.5 disabled:opacity-40"
                  >
                    <ChevronLeftOutlined className="!text-[18px]" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPage(num)}
                      className={[
                        "min-w-8 rounded-lg px-2 py-1 text-sm font-semibold",
                        num === currentPage
                          ? "bg-primary text-white"
                          : "border border-[#E5E7EB] text-[#374151]",
                      ].join(" ")}
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-lg border border-[#E5E7EB] p-1.5 disabled:opacity-40"
                  >
                    <ChevronRightOutlined className="!text-[18px]" />
                  </button>
                </div>
              </div>
            </Card>
          </div>
        ) : null}

        {tab === "menus" ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Menus" hint="Navigation groups shown on the public site.">
              <form onSubmit={(e) => void saveMenu(e)} className="mb-4 grid gap-2 sm:grid-cols-3">
                <input
                  className={inputClass}
                  placeholder="Menu name"
                  value={menuForm.name}
                  disabled={!canManage}
                  onChange={(e) => setMenuForm((p) => ({ ...p, name: e.target.value }))}
                />
                <input
                  className={inputClass}
                  placeholder="KEY"
                  value={menuForm.key}
                  disabled={!canManage}
                  onChange={(e) => setMenuForm((p) => ({ ...p, key: e.target.value }))}
                />
                <button
                  type="submit"
                  disabled={!canManage || saving}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Add Menu
                </button>
              </form>
              <div className="space-y-2">
                {setup.menus.map((menu) => (
                  <div
                    key={menu.id}
                    className="flex items-center justify-between rounded-lg border border-[#E5E7EB] px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold">{menu.name}</p>
                      <p className="text-xs text-[#6B7280]">
                        {menu.key} · {menu.itemCount} items ·{" "}
                        {menu.isActive ? "Active" : "Inactive"}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!canManage}
                      className="rounded p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                      onClick={() =>
                        void (async () => {
                          if (!accessToken) return;
                          const ok = await confirmDelete(`Delete menu "${menu.name}"?`);
                          if (!ok) return;
                          try {
                            const data = await apiRequest<Setup>(
                              `/erp/website-cms/menus/${menu.id}`,
                              accessToken,
                              { method: "DELETE" },
                            );
                            setSetup(data);
                            notifySuccess("Menu deleted");
                          } catch (cause) {
                            notifyError(
                              cause instanceof Error ? cause.message : "Unable to delete menu",
                            );
                          }
                        })()
                      }
                    >
                      <DeleteOutline className="!text-[18px]" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Menu Items" hint="Links belonging to a selected menu.">
              <form onSubmit={(e) => void saveMenuItem(e)} className="mb-4 space-y-2">
                <select
                  className={inputClass}
                  value={menuItemForm.menuId}
                  disabled={!canManage}
                  onChange={(e) => setMenuItemForm((p) => ({ ...p, menuId: e.target.value }))}
                >
                  {setup.menus.map((menu) => (
                    <option key={menu.id} value={menu.id}>
                      {menu.name}
                    </option>
                  ))}
                </select>
                <input
                  className={inputClass}
                  placeholder="Label"
                  value={menuItemForm.label}
                  disabled={!canManage}
                  onChange={(e) => setMenuItemForm((p) => ({ ...p, label: e.target.value }))}
                />
                <input
                  className={inputClass}
                  placeholder="URL (optional)"
                  value={menuItemForm.url}
                  disabled={!canManage}
                  onChange={(e) => setMenuItemForm((p) => ({ ...p, url: e.target.value }))}
                />
                <select
                  className={inputClass}
                  value={menuItemForm.pageId}
                  disabled={!canManage}
                  onChange={(e) => setMenuItemForm((p) => ({ ...p, pageId: e.target.value }))}
                >
                  <option value="">Link to page (optional)</option>
                  {setup.pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!canManage || saving}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Add Item
                </button>
              </form>
              <div className="space-y-2">
                {(setup.menus.find((m) => m.id === menuItemForm.menuId)?.items ?? []).map(
                  (item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-semibold">{item.label}</p>
                        <p className="text-xs text-[#6B7280]">
                          {item.url || item.pageTitle || "—"}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!canManage}
                        className="rounded p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                        onClick={() =>
                          void (async () => {
                            if (!accessToken) return;
                            try {
                              const data = await apiRequest<Setup>(
                                `/erp/website-cms/menu-items/${item.id}`,
                                accessToken,
                                { method: "DELETE" },
                              );
                              setSetup(data);
                              notifySuccess("Menu item removed");
                            } catch (cause) {
                              notifyError(
                                cause instanceof Error
                                  ? cause.message
                                  : "Unable to delete menu item",
                              );
                            }
                          })()
                        }
                      >
                        <DeleteOutline className="!text-[18px]" />
                      </button>
                    </div>
                  ),
                )}
              </div>
            </Card>
          </div>
        ) : null}

        {tab === "media" ? (
          <Card
            title="Media Library"
            hint="Upload images and files used across website pages and banners."
            actions={
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">
                <AddOutlined className="!text-[16px]" />
                Upload
                <input
                  type="file"
                  className="hidden"
                  disabled={!canManage}
                  accept="image/*,.pdf"
                  onChange={(e) => void onMediaUpload(e.target.files?.[0] ?? null)}
                />
              </label>
            }
          >
            {setup.media.length === 0 ? (
              <p className="text-sm text-[#6B7280]">No media uploaded yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {setup.media.map((item) => (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]"
                  >
                    {item.mimeType?.startsWith("image/") ? (
                      <img
                        src={assetUrl(item.fileUrl) || item.fileUrl}
                        alt={item.name}
                        className="h-28 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-28 items-center justify-center text-xs text-[#9CA3AF]">
                        File
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-2 p-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{item.name}</p>
                        <p className="text-[10px] text-[#9CA3AF]">{item.uploadedByName}</p>
                      </div>
                      <button
                        type="button"
                        disabled={!canManage}
                        className="rounded p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                        onClick={() =>
                          void (async () => {
                            if (!accessToken) return;
                            const ok = await confirmDelete(`Delete "${item.name}"?`);
                            if (!ok) return;
                            try {
                              const data = await apiRequest<Setup>(
                                `/erp/website-cms/media/${item.id}`,
                                accessToken,
                                { method: "DELETE" },
                              );
                              setSetup(data);
                              notifySuccess("Media deleted");
                            } catch (cause) {
                              notifyError(
                                cause instanceof Error ? cause.message : "Unable to delete media",
                              );
                            }
                          })()
                        }
                      >
                        <DeleteOutline className="!text-[16px]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : null}

        {tab === "banners" ? (
          <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
            <Card title={bannerForm.id ? "Edit Banner" : "Add Banner"}>
              <form onSubmit={(e) => void saveBanner(e)} className="space-y-3">
                <label className="block">
                  <FieldLabel required>Title</FieldLabel>
                  <input
                    className={inputClass}
                    value={bannerForm.title}
                    disabled={!canManage}
                    onChange={(e) => setBannerForm((p) => ({ ...p, title: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Subtitle</FieldLabel>
                  <input
                    className={inputClass}
                    value={bannerForm.subtitle}
                    disabled={!canManage}
                    onChange={(e) => setBannerForm((p) => ({ ...p, subtitle: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Link URL</FieldLabel>
                  <input
                    className={inputClass}
                    value={bannerForm.linkUrl}
                    disabled={!canManage}
                    onChange={(e) => setBannerForm((p) => ({ ...p, linkUrl: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Image</FieldLabel>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={!canManage}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () =>
                        setBannerForm((p) => ({
                          ...p,
                          imageUrl: String(reader.result ?? ""),
                        }));
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={bannerForm.isActive}
                    disabled={!canManage}
                    onChange={(e) => setBannerForm((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                  Active
                </label>
                <button
                  type="submit"
                  disabled={!canManage || saving}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Save Banner
                </button>
              </form>
            </Card>
            <Card title="Banners">
              <div className="space-y-2">
                {setup.banners.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">No banners yet.</p>
                ) : (
                  setup.banners.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {item.imageUrl ? (
                          <img
                            src={assetUrl(item.imageUrl) || item.imageUrl}
                            alt=""
                            className="size-12 rounded object-cover"
                          />
                        ) : (
                          <div className="grid size-12 place-items-center rounded bg-[#F3F4F6]">
                            <ViewCarouselOutlined className="!text-[18px] text-[#9CA3AF]" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{item.title}</p>
                          <p className="text-xs text-[#6B7280]">
                            {item.isActive ? "Active" : "Inactive"}
                            {item.linkUrl ? ` · ${item.linkUrl}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={!canManage}
                          className="rounded p-1 text-violet-600 hover:bg-violet-50"
                          onClick={() =>
                            setBannerForm({
                              id: item.id,
                              title: item.title,
                              subtitle: item.subtitle ?? "",
                              imageUrl: item.imageUrl ?? "",
                              linkUrl: item.linkUrl ?? "",
                              isActive: item.isActive,
                            })
                          }
                        >
                          <EditOutlined className="!text-[18px]" />
                        </button>
                        <button
                          type="button"
                          disabled={!canManage}
                          className="rounded p-1 text-rose-600 hover:bg-rose-50"
                          onClick={() =>
                            void (async () => {
                              if (!accessToken) return;
                              const ok = await confirmDelete(`Delete banner "${item.title}"?`);
                              if (!ok) return;
                              try {
                                const data = await apiRequest<Setup>(
                                  `/erp/website-cms/banners/${item.id}`,
                                  accessToken,
                                  { method: "DELETE" },
                                );
                                setSetup(data);
                                notifySuccess("Banner deleted");
                              } catch (cause) {
                                notifyError(
                                  cause instanceof Error
                                    ? cause.message
                                    : "Unable to delete banner",
                                );
                              }
                            })()
                          }
                        >
                          <DeleteOutline className="!text-[18px]" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        ) : null}

        {tab === "seo" || tab === "site" ? (
          <Card
            title={tab === "seo" ? "SEO Settings" : "Site Settings"}
            hint={
              tab === "seo"
                ? "Default meta title and description for public pages."
                : "Global website identity, contact, and maintenance controls."
            }
          >
            {siteForm ? (
              <form onSubmit={(e) => void saveSiteSettings(e)} className="grid gap-3 sm:grid-cols-2">
                {tab === "seo" ? (
                  <>
                    <label className="block sm:col-span-2">
                      <FieldLabel>Default SEO Title</FieldLabel>
                      <input
                        className={inputClass}
                        value={siteForm.defaultSeoTitle}
                        disabled={!canManage}
                        onChange={(e) =>
                          setSiteForm((p) => (p ? { ...p, defaultSeoTitle: e.target.value } : p))
                        }
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <FieldLabel>Default SEO Description</FieldLabel>
                      <textarea
                        rows={3}
                        className={inputClass}
                        value={siteForm.defaultSeoDesc}
                        disabled={!canManage}
                        onChange={(e) =>
                          setSiteForm((p) => (p ? { ...p, defaultSeoDesc: e.target.value } : p))
                        }
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Google Analytics ID</FieldLabel>
                      <input
                        className={inputClass}
                        value={siteForm.googleAnalyticsId}
                        disabled={!canManage}
                        placeholder="G-XXXXXXXX"
                        onChange={(e) =>
                          setSiteForm((p) =>
                            p ? { ...p, googleAnalyticsId: e.target.value } : p,
                          )
                        }
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Homepage</FieldLabel>
                      <select
                        className={inputClass}
                        value={siteForm.homepagePageId ?? ""}
                        disabled={!canManage}
                        onChange={(e) =>
                          setSiteForm((p) =>
                            p ? { ...p, homepagePageId: e.target.value || null } : p,
                          )
                        }
                      >
                        <option value="">Select page</option>
                        {setup.pages.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <>
                    <label className="block">
                      <FieldLabel>Site Title</FieldLabel>
                      <input
                        className={inputClass}
                        value={siteForm.siteTitle}
                        disabled={!canManage}
                        onChange={(e) =>
                          setSiteForm((p) => (p ? { ...p, siteTitle: e.target.value } : p))
                        }
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Tagline</FieldLabel>
                      <input
                        className={inputClass}
                        value={siteForm.siteTagline}
                        disabled={!canManage}
                        onChange={(e) =>
                          setSiteForm((p) => (p ? { ...p, siteTagline: e.target.value } : p))
                        }
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Contact Email</FieldLabel>
                      <input
                        className={inputClass}
                        value={siteForm.contactEmail}
                        disabled={!canManage}
                        onChange={(e) =>
                          setSiteForm((p) => (p ? { ...p, contactEmail: e.target.value } : p))
                        }
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Contact Phone</FieldLabel>
                      <input
                        className={inputClass}
                        value={siteForm.contactPhone}
                        disabled={!canManage}
                        onChange={(e) =>
                          setSiteForm((p) => (p ? { ...p, contactPhone: e.target.value } : p))
                        }
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Facebook</FieldLabel>
                      <input
                        className={inputClass}
                        value={siteForm.socialFacebook}
                        disabled={!canManage}
                        onChange={(e) =>
                          setSiteForm((p) => (p ? { ...p, socialFacebook: e.target.value } : p))
                        }
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Instagram</FieldLabel>
                      <input
                        className={inputClass}
                        value={siteForm.socialInstagram}
                        disabled={!canManage}
                        onChange={(e) =>
                          setSiteForm((p) => (p ? { ...p, socialInstagram: e.target.value } : p))
                        }
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>YouTube</FieldLabel>
                      <input
                        className={inputClass}
                        value={siteForm.socialYoutube}
                        disabled={!canManage}
                        onChange={(e) =>
                          setSiteForm((p) => (p ? { ...p, socialYoutube: e.target.value } : p))
                        }
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#374151]">
                      <input
                        type="checkbox"
                        checked={siteForm.maintenanceMode}
                        disabled={!canManage}
                        onChange={(e) =>
                          setSiteForm((p) =>
                            p ? { ...p, maintenanceMode: e.target.checked } : p,
                          )
                        }
                      />
                      Maintenance mode
                    </label>
                  </>
                )}
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={!canManage || saving}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <SaveOutlined className="!text-[16px]" />
                    {saving ? "Saving…" : "Save Settings"}
                  </button>
                </div>
              </form>
            ) : null}
          </Card>
        ) : null}

        <div className="rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#5B21B6]">
            <InfoOutlined className="!text-[18px]" />
            About Website CMS
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-[#5B21B6]">
            <li>Create, edit and organize website pages, menus and media content.</li>
            <li>Use draft/publish status to control what visitors can see.</li>
            <li>Manage navigation menus and homepage banners from the dedicated tabs.</li>
            <li>Optimize default SEO settings and site contact details for discoverability.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
