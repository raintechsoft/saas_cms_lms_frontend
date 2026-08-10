import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ColorLensOutlined,
  DarkModeOutlined,
  EmailOutlined,
  ImageOutlined,
  InfoOutlined,
  LightModeOutlined,
  PaletteOutlined,
  SaveOutlined,
  SettingsOutlined,
  VisibilityOutlined,
  WallpaperOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest, assetUrl } from "../../../lib/api";
import { applyBrandingToDocument, parseBranding } from "../../../lib/branding";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type Settings = {
  brandName: string;
  tagline: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  appIconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  themePreset: string;
  themeStyle: "light" | "dark" | "system";
  sidebarStyle: "light" | "dark";
  sidebarPosition: "fixed" | "scrollable";
  sidebarSize: "compact" | "standard" | "wide";
  fontFamily: string;
  headingFont: string;
  baseFontSize: number;
  contentWidth: "fluid" | "boxed";
  borderRadius: "sm" | "md" | "lg" | "xl";
  density: "compact" | "comfortable" | "spacious";
  loginBackgroundUrl: string | null;
  loginWelcomeText: string;
  showLogoOnLogin: boolean;
  emailHeaderColor: string;
  emailFooterText: string;
  emailLogoUrl: string | null;
};

type Setup = {
  settings: Settings;
  presets: Array<{
    key: string;
    label: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  }>;
  stats: {
    activeTheme: string;
    logoStatus: string;
    logoUploaded: boolean;
    primaryColor: string;
    lastUpdatedAt: string;
    lastUpdatedBy: string;
  };
};

type TabKey =
  | "general"
  | "colors"
  | "typography"
  | "layout"
  | "login"
  | "favicon"
  | "email";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "general", label: "General Settings" },
  { key: "colors", label: "Colors" },
  { key: "typography", label: "Typography" },
  { key: "layout", label: "Layout" },
  { key: "login", label: "Login Page" },
  { key: "favicon", label: "Favicon & App Icon" },
  { key: "email", label: "Email Templates" },
];

const FONT_OPTIONS = ["DM Sans", "Inter", "Roboto", "Poppins", "Nunito", "Open Sans", "Lato"];

const inputClass =
  "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-primary";

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-[#1A1A1A]">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-[#6B7280]">{hint}</p> : null}
      </div>
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
  icon,
  tone,
  extra,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: string;
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className={`rounded-lg p-2 ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#6B7280]">{label}</p>
        <div className="mt-0.5 flex items-center gap-2">
          {extra}
          <p className="truncate text-sm font-bold text-[#1A1A1A]">{value}</p>
        </div>
      </div>
    </div>
  );
}

function ChoiceGroup<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: ReactNode }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={[
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]",
              disabled ? "opacity-50" : "",
            ].join(" ")}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function readImageFile(file: File, maxKb: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose a PNG, JPG, or SVG image"));
      return;
    }
    if (file.size > maxKb * 1024) {
      reject(new Error(`Image must be under ${maxKb}KB`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read image"));
    reader.readAsDataURL(file);
  });
}

function sidebarWidth(size: Settings["sidebarSize"]) {
  if (size === "compact") return 72;
  if (size === "wide") return 280;
  return 220;
}

export function ThemeBrandingPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Theme & Branding";
  const canManage = Boolean(
    user?.permissions.some((p) => ["erp.manage", "settings.manage"].includes(p)),
  );

  const [setup, setSetup] = useState<Setup | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabKey>("general");
  const [previewOpen, setPreviewOpen] = useState(true);

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/theme-branding", accessToken);
      setSetup(data);
      setForm(data.settings);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load branding");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  function patch<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function applyPreset(key: string) {
    const preset = setup?.presets.find((item) => item.key === key);
    if (!preset) return;
    setForm((prev) =>
      prev
        ? {
            ...prev,
            themePreset: key,
            primaryColor: preset.primaryColor,
            secondaryColor: preset.secondaryColor,
            accentColor: preset.accentColor,
            emailHeaderColor: preset.primaryColor,
          }
        : prev,
    );
  }

  async function onUpload(
    file: File | null,
    key: "logoUrl" | "faviconUrl" | "appIconUrl" | "loginBackgroundUrl" | "emailLogoUrl",
    maxKb: number,
  ) {
    if (!file) return;
    try {
      const dataUrl = await readImageFile(file, maxKb);
      patch(key, dataUrl);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to upload image");
    }
  }

  async function save() {
    if (!accessToken || !form || !canManage) return;
    if (!form.brandName.trim()) {
      notifyError("Brand / Institution Name is required");
      return;
    }
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/theme-branding", accessToken, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setSetup(data);
      setForm(data.settings);
      applyBrandingToDocument(
        parseBranding({
          ...(user?.tenant?.branding ?? {}),
          ...data.settings,
          frontDisplayName: data.settings.brandName,
          logoText: data.settings.brandName,
        }),
      );
      notifySuccess("Theme & branding saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save branding");
    } finally {
      setSaving(false);
    }
  }

  const preview = useMemo(() => {
    if (!form) return null;
    const width = sidebarWidth(form.sidebarSize);
    const darkSide = form.sidebarStyle === "dark";
    return { width, darkSide };
  }, [form]);

  if (loading || !form || !setup) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading theme & branding…</div>;
  }

  const stats = setup.stats;
  const logoSrc = form.logoUrl ? assetUrl(form.logoUrl) || form.logoUrl : null;
  const faviconSrc = form.faviconUrl ? assetUrl(form.faviconUrl) || form.faviconUrl : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">Theme & Branding</h1>
          <p className="text-xs text-[#6B7280]">
            Customize logos, colors, layout, and login appearance for your campus portal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151]"
          >
            <VisibilityOutlined className="!text-[18px]" />
            {previewOpen ? "Hide Preview" : "Preview Changes"}
          </button>
          <button
            type="button"
            disabled={!canManage || saving}
            onClick={() => void save()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <SaveOutlined className="!text-[18px]" />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Active Theme"
            value={stats.activeTheme}
            tone="bg-violet-50"
            icon={<PaletteOutlined className="!text-[20px] text-violet-600" />}
          />
          <StatCard
            label="Logo"
            value={form.logoUrl ? "Custom Logo" : "Default"}
            tone="bg-sky-50"
            icon={<ImageOutlined className="!text-[20px] text-sky-600" />}
          />
          <StatCard
            label="Primary Color"
            value={form.primaryColor.toUpperCase()}
            tone="bg-fuchsia-50"
            icon={<ColorLensOutlined className="!text-[20px] text-fuchsia-600" />}
            extra={
              <span
                className="inline-block size-4 rounded-full border border-[#E5E7EB]"
                style={{ background: form.primaryColor }}
              />
            }
          />
          <StatCard
            label="Last Updated"
            value={`${stats.lastUpdatedAt} by ${stats.lastUpdatedBy}`}
            tone="bg-amber-50"
            icon={<SettingsOutlined className="!text-[20px] text-amber-600" />}
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
                  "border-b-2 px-3 py-3 text-sm font-semibold whitespace-nowrap",
                  tab === item.key
                    ? "border-primary text-primary"
                    : "border-transparent text-[#6B7280] hover:text-[#374151]",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className={[
            "grid gap-4",
            previewOpen ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "",
          ].join(" ")}
        >
          <div className="space-y-4">
            {tab === "general" ? (
              <>
                <Card title="Brand Identity" hint="Logo, favicon, and institution naming.">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-4">
                      <p className="mb-2 text-xs font-semibold text-[#6B7280]">Logo Upload</p>
                      <div className="mb-3 flex h-20 items-center justify-center rounded-lg bg-white">
                        {logoSrc ? (
                          <img src={logoSrc} alt="Logo" className="max-h-16 max-w-full object-contain" />
                        ) : (
                          <div
                            className="rounded-lg px-3 py-2 text-xs font-bold text-white"
                            style={{ background: form.primaryColor }}
                          >
                            CAMPUS ERP
                          </div>
                        )}
                      </div>
                      <label className="inline-flex cursor-pointer items-center rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151]">
                        Change Logo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={!canManage}
                          onChange={(e) =>
                            void onUpload(e.target.files?.[0] ?? null, "logoUrl", 500)
                          }
                        />
                      </label>
                      <p className="mt-2 text-[11px] text-[#9CA3AF]">
                        Recommended 250×80px, max 500KB
                      </p>
                    </div>

                    <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-4">
                      <p className="mb-2 text-xs font-semibold text-[#6B7280]">Favicon</p>
                      <div className="mb-3 flex h-20 items-center justify-center rounded-lg bg-white">
                        {faviconSrc ? (
                          <img src={faviconSrc} alt="Favicon" className="size-10 object-contain" />
                        ) : (
                          <div
                            className="grid size-10 place-items-center rounded-md text-[10px] font-bold text-white"
                            style={{ background: form.primaryColor }}
                          >
                            CE
                          </div>
                        )}
                      </div>
                      <label className="inline-flex cursor-pointer items-center rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151]">
                        Change Favicon
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={!canManage}
                          onChange={(e) =>
                            void onUpload(e.target.files?.[0] ?? null, "faviconUrl", 100)
                          }
                        />
                      </label>
                      <p className="mt-2 text-[11px] text-[#9CA3AF]">32×32px recommended</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <FieldLabel required>Brand / Institution Name</FieldLabel>
                      <input
                        className={inputClass}
                        value={form.brandName}
                        disabled={!canManage}
                        onChange={(e) => patch("brandName", e.target.value)}
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Tagline (Optional)</FieldLabel>
                      <input
                        className={inputClass}
                        value={form.tagline}
                        disabled={!canManage}
                        onChange={(e) => patch("tagline", e.target.value)}
                        placeholder="Excellence in Education"
                      />
                    </label>
                  </div>
                </Card>

                <Card title="Appearance Settings" hint="Theme and sidebar presentation.">
                  <div className="space-y-4">
                    <div>
                      <FieldLabel>Theme Style</FieldLabel>
                      <ChoiceGroup
                        value={form.themeStyle}
                        disabled={!canManage}
                        onChange={(value) => patch("themeStyle", value)}
                        options={[
                          {
                            value: "light",
                            label: "Light",
                            icon: <LightModeOutlined className="!text-[16px]" />,
                          },
                          {
                            value: "dark",
                            label: "Dark",
                            icon: <DarkModeOutlined className="!text-[16px]" />,
                          },
                          { value: "system", label: "System" },
                        ]}
                      />
                    </div>
                    <div>
                      <FieldLabel>Sidebar Style</FieldLabel>
                      <ChoiceGroup
                        value={form.sidebarStyle}
                        disabled={!canManage}
                        onChange={(value) => patch("sidebarStyle", value)}
                        options={[
                          { value: "light", label: "Light" },
                          { value: "dark", label: "Dark" },
                        ]}
                      />
                    </div>
                    <div>
                      <FieldLabel>Sidebar Position</FieldLabel>
                      <ChoiceGroup
                        value={form.sidebarPosition}
                        disabled={!canManage}
                        onChange={(value) => patch("sidebarPosition", value)}
                        options={[
                          { value: "fixed", label: "Fixed" },
                          { value: "scrollable", label: "Scrollable" },
                        ]}
                      />
                    </div>
                    <label className="block max-w-xs">
                      <FieldLabel>Sidebar Size</FieldLabel>
                      <select
                        className={inputClass}
                        value={form.sidebarSize}
                        disabled={!canManage}
                        onChange={(e) =>
                          patch("sidebarSize", e.target.value as Settings["sidebarSize"])
                        }
                      >
                        <option value="compact">Compact (72px)</option>
                        <option value="standard">Standard (260px)</option>
                        <option value="wide">Wide (280px)</option>
                      </select>
                    </label>
                  </div>
                </Card>
              </>
            ) : null}

            {tab === "colors" ? (
              <Card title="Color Palette" hint="Choose a preset or customize individual colors.">
                <div className="mb-4 flex flex-wrap gap-2">
                  {setup.presets.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      disabled={!canManage}
                      onClick={() => applyPreset(preset.key)}
                      className={[
                        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold",
                        form.themePreset === preset.key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-[#E5E7EB] text-[#374151]",
                      ].join(" ")}
                    >
                      <span
                        className="size-4 rounded-full"
                        style={{ background: preset.primaryColor }}
                      />
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      ["primaryColor", "Primary Color"],
                      ["secondaryColor", "Secondary Color"],
                      ["accentColor", "Accent Color"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block">
                      <FieldLabel>{label}</FieldLabel>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="h-10 w-12 cursor-pointer rounded border border-[#E5E7EB] bg-white p-1"
                          value={form[key]}
                          disabled={!canManage}
                          onChange={(e) => {
                            patch(key, e.target.value);
                            patch("themePreset", "custom");
                          }}
                        />
                        <input
                          className={inputClass}
                          value={form[key]}
                          disabled={!canManage}
                          onChange={(e) => {
                            patch(key, e.target.value);
                            patch("themePreset", "custom");
                          }}
                        />
                      </div>
                    </label>
                  ))}
                </div>
              </Card>
            ) : null}

            {tab === "typography" ? (
              <Card title="Typography" hint="Fonts and base text sizing for the portal.">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <FieldLabel>Body Font</FieldLabel>
                    <select
                      className={inputClass}
                      value={form.fontFamily}
                      disabled={!canManage}
                      onChange={(e) => patch("fontFamily", e.target.value)}
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={font} value={font}>
                          {font}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <FieldLabel>Heading Font</FieldLabel>
                    <select
                      className={inputClass}
                      value={form.headingFont}
                      disabled={!canManage}
                      onChange={(e) => patch("headingFont", e.target.value)}
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={font} value={font}>
                          {font}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <FieldLabel>Base Font Size</FieldLabel>
                    <select
                      className={inputClass}
                      value={form.baseFontSize}
                      disabled={!canManage}
                      onChange={(e) => patch("baseFontSize", Number(e.target.value))}
                    >
                      {[12, 13, 14, 15, 16].map((size) => (
                        <option key={size} value={size}>
                          {size}px
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div
                  className="mt-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4"
                  style={{ fontFamily: form.fontFamily, fontSize: form.baseFontSize }}
                >
                  <p className="font-bold" style={{ fontFamily: form.headingFont, fontSize: form.baseFontSize + 6 }}>
                    Heading preview
                  </p>
                  <p className="mt-1 text-[#6B7280]">
                    The quick brown fox jumps over the lazy dog. Student fees, attendance, and
                    academics stay readable at this size.
                  </p>
                </div>
              </Card>
            ) : null}

            {tab === "layout" ? (
              <Card title="Layout" hint="Control content width, density, and corner radius.">
                <div className="space-y-4">
                  <div>
                    <FieldLabel>Content Width</FieldLabel>
                    <ChoiceGroup
                      value={form.contentWidth}
                      disabled={!canManage}
                      onChange={(value) => patch("contentWidth", value)}
                      options={[
                        { value: "fluid", label: "Fluid" },
                        { value: "boxed", label: "Boxed" },
                      ]}
                    />
                  </div>
                  <div>
                    <FieldLabel>Density</FieldLabel>
                    <ChoiceGroup
                      value={form.density}
                      disabled={!canManage}
                      onChange={(value) => patch("density", value)}
                      options={[
                        { value: "compact", label: "Compact" },
                        { value: "comfortable", label: "Comfortable" },
                        { value: "spacious", label: "Spacious" },
                      ]}
                    />
                  </div>
                  <div>
                    <FieldLabel>Border Radius</FieldLabel>
                    <ChoiceGroup
                      value={form.borderRadius}
                      disabled={!canManage}
                      onChange={(value) => patch("borderRadius", value)}
                      options={[
                        { value: "sm", label: "Small" },
                        { value: "md", label: "Medium" },
                        { value: "lg", label: "Large" },
                        { value: "xl", label: "XL" },
                      ]}
                    />
                  </div>
                </div>
              </Card>
            ) : null}

            {tab === "login" ? (
              <Card title="Login Page" hint="Welcome copy and login screen visuals.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <FieldLabel>Welcome Text</FieldLabel>
                    <input
                      className={inputClass}
                      value={form.loginWelcomeText}
                      disabled={!canManage}
                      onChange={(e) => patch("loginWelcomeText", e.target.value)}
                    />
                  </label>
                  <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-4 sm:col-span-2">
                    <p className="mb-2 text-xs font-semibold text-[#6B7280]">Background Image</p>
                    {form.loginBackgroundUrl ? (
                      <img
                        src={assetUrl(form.loginBackgroundUrl) || form.loginBackgroundUrl}
                        alt="Login background"
                        className="mb-3 h-28 w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="mb-3 flex h-28 items-center justify-center rounded-lg bg-white text-xs text-[#9CA3AF]">
                        <WallpaperOutlined className="mr-1 !text-[16px]" />
                        No background uploaded
                      </div>
                    )}
                    <label className="inline-flex cursor-pointer items-center rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151]">
                      Upload Background
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={!canManage}
                        onChange={(e) =>
                          void onUpload(e.target.files?.[0] ?? null, "loginBackgroundUrl", 1500)
                        }
                      />
                    </label>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#374151]">
                    <input
                      type="checkbox"
                      checked={form.showLogoOnLogin}
                      disabled={!canManage}
                      onChange={(e) => patch("showLogoOnLogin", e.target.checked)}
                    />
                    Show logo on login page
                  </label>
                </div>
              </Card>
            ) : null}

            {tab === "favicon" ? (
              <Card title="Favicon & App Icon" hint="Browser tab and PWA / shortcut icons.">
                <div className="grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      ["faviconUrl", "Favicon", 100],
                      ["appIconUrl", "App Icon", 300],
                    ] as const
                  ).map(([key, label, maxKb]) => {
                    const src = form[key] ? assetUrl(form[key]!) || form[key] : null;
                    return (
                      <div
                        key={key}
                        className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-4"
                      >
                        <p className="mb-2 text-xs font-semibold text-[#6B7280]">{label}</p>
                        <div className="mb-3 flex h-24 items-center justify-center rounded-lg bg-white">
                          {src ? (
                            <img src={src} alt={label} className="max-h-16 max-w-full object-contain" />
                          ) : (
                            <span className="text-xs text-[#9CA3AF]">No {label.toLowerCase()}</span>
                          )}
                        </div>
                        <label className="inline-flex cursor-pointer items-center rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151]">
                          Upload {label}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={!canManage}
                            onChange={(e) =>
                              void onUpload(e.target.files?.[0] ?? null, key, maxKb)
                            }
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : null}

            {tab === "email" ? (
              <Card title="Email Templates" hint="Header color and footer used in outbound mail.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <FieldLabel>Email Header Color</FieldLabel>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        className="h-10 w-12 rounded border border-[#E5E7EB] p-1"
                        value={form.emailHeaderColor}
                        disabled={!canManage}
                        onChange={(e) => patch("emailHeaderColor", e.target.value)}
                      />
                      <input
                        className={inputClass}
                        value={form.emailHeaderColor}
                        disabled={!canManage}
                        onChange={(e) => patch("emailHeaderColor", e.target.value)}
                      />
                    </div>
                  </label>
                  <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-3">
                    <p className="mb-2 text-xs font-semibold text-[#6B7280]">Email Logo</p>
                    {form.emailLogoUrl ? (
                      <img
                        src={assetUrl(form.emailLogoUrl) || form.emailLogoUrl}
                        alt="Email logo"
                        className="mb-2 max-h-12 object-contain"
                      />
                    ) : null}
                    <label className="inline-flex cursor-pointer items-center rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#374151]">
                      Upload Email Logo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={!canManage}
                        onChange={(e) =>
                          void onUpload(e.target.files?.[0] ?? null, "emailLogoUrl", 300)
                        }
                      />
                    </label>
                  </div>
                  <label className="block sm:col-span-2">
                    <FieldLabel>Email Footer Text</FieldLabel>
                    <textarea
                      rows={3}
                      className={inputClass}
                      value={form.emailFooterText}
                      disabled={!canManage}
                      onChange={(e) => patch("emailFooterText", e.target.value)}
                      placeholder="© Your School Name. All rights reserved."
                    />
                  </label>
                </div>
                <div className="mt-4 overflow-hidden rounded-xl border border-[#E5E7EB]">
                  <div
                    className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-white"
                    style={{ background: form.emailHeaderColor }}
                  >
                    <EmailOutlined className="!text-[18px]" />
                    {form.brandName || "Campus ERP"}
                  </div>
                  <div className="bg-white p-4 text-sm text-[#374151]">
                    Sample notification email body for fee reminders and notices.
                  </div>
                  <div className="border-t border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2 text-xs text-[#6B7280]">
                    {form.emailFooterText || "Email footer preview"}
                  </div>
                </div>
              </Card>
            ) : null}
          </div>

          {previewOpen && preview ? (
            <Card title="Live Preview" hint="Mini dashboard reflecting your current choices.">
              <div
                className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F3F4F6]"
                style={{ fontFamily: form.fontFamily, fontSize: Math.max(10, form.baseFontSize - 3) }}
              >
                <div className="flex min-h-[280px]">
                  <aside
                    className={[
                      "shrink-0 border-r p-2",
                      preview.darkSide
                        ? "border-[#1F2937] bg-[#111827] text-white"
                        : "border-[#E5E7EB] bg-white text-[#1A1A1A]",
                    ].join(" ")}
                    style={{ width: Math.min(preview.width * 0.45, 110) }}
                  >
                    <div className="mb-3 flex items-center gap-1.5">
                      {logoSrc && form.showLogoOnLogin ? (
                        <img src={logoSrc} alt="" className="size-6 rounded object-cover" />
                      ) : (
                        <span
                          className="grid size-6 place-items-center rounded text-[8px] font-bold text-white"
                          style={{ background: form.primaryColor }}
                        >
                          CE
                        </span>
                      )}
                      <div className="min-w-0">
                        <p
                          className="truncate text-[10px] font-bold"
                          style={{ fontFamily: form.headingFont }}
                        >
                          {form.brandName || "Campus ERP"}
                        </p>
                        {form.tagline ? (
                          <p className="truncate text-[8px] opacity-70">{form.tagline}</p>
                        ) : null}
                      </div>
                    </div>
                    {["Dashboard", "Students", "Fees", "Academics"].map((item, index) => (
                      <div
                        key={item}
                        className={[
                          "mb-1 rounded-md px-2 py-1.5 text-[9px] font-semibold",
                          index === 0 ? "text-white" : preview.darkSide ? "opacity-70" : "text-[#6B7280]",
                        ].join(" ")}
                        style={index === 0 ? { background: form.primaryColor } : undefined}
                      >
                        {item}
                      </div>
                    ))}
                  </aside>
                  <div className="min-w-0 flex-1 p-2">
                    <div className="mb-2 rounded-md bg-white px-2 py-1.5 shadow-sm">
                      <p className="text-[10px] font-bold" style={{ fontFamily: form.headingFont }}>
                        Dashboard
                      </p>
                      <p className="text-[8px] text-[#9CA3AF]">{form.loginWelcomeText}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        ["Students", "1,240"],
                        ["Teachers", "86"],
                        ["Fees Due", "₹2.4L"],
                        ["Attendance", "96%"],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-md bg-white p-2 shadow-sm"
                          style={{
                            borderRadius:
                              form.borderRadius === "sm"
                                ? 4
                                : form.borderRadius === "md"
                                  ? 8
                                  : form.borderRadius === "xl"
                                    ? 16
                                    : 12,
                          }}
                        >
                          <p className="text-[8px] text-[#9CA3AF]">{label}</p>
                          <p className="text-[11px] font-bold" style={{ color: form.primaryColor }}>
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ) : null}
        </div>

        <div className="rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[#5B21B6]">
            <InfoOutlined className="!text-[18px]" />
            About Theme & Branding
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-[#5B21B6]">
            <li>Changes apply across the staff portal, login screens, and branded emails.</li>
            <li>Use a high-quality logo (PNG/SVG) with transparent background for best results.</li>
            <li>Primary color drives buttons, active nav states, and key accents.</li>
            <li>Preview updates instantly; click Save Changes to persist for all users.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
