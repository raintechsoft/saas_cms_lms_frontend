import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { InfoOutlined, SaveOutlined } from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type LanguageCode =
  | "en"
  | "hi"
  | "bn"
  | "es"
  | "fr"
  | "ar"
  | "ta"
  | "te"
  | "mr"
  | "gu"
  | "kn"
  | "ml";

type TenantLanguage = {
  code: string;
  name: string;
  isEnabled: boolean;
  isDefault: boolean;
};

type SettingsPayload = {
  currency: string;
  timezone: string;
  dateFormat: string;
};

const LANGUAGE_CATALOG: Array<{
  code: LanguageCode;
  name: string;
  nativeLabel: string;
  workingLabel: string;
}> = [
  { code: "en", name: "English", nativeLabel: "English", workingLabel: "English (United States)" },
  { code: "hi", name: "Hindi", nativeLabel: "हिंदी", workingLabel: "Hindi (India)" },
  { code: "bn", name: "Bengali", nativeLabel: "বাংলা", workingLabel: "Bengali (India)" },
  { code: "es", name: "Spanish", nativeLabel: "Español", workingLabel: "Spanish" },
  { code: "fr", name: "French", nativeLabel: "Français", workingLabel: "French" },
  { code: "ar", name: "Arabic", nativeLabel: "العربية", workingLabel: "Arabic" },
  { code: "ta", name: "Tamil", nativeLabel: "தமிழ்", workingLabel: "Tamil (India)" },
  { code: "te", name: "Telugu", nativeLabel: "తెలుగు", workingLabel: "Telugu (India)" },
  { code: "mr", name: "Marathi", nativeLabel: "मराठी", workingLabel: "Marathi (India)" },
  { code: "gu", name: "Gujarati", nativeLabel: "ગુજરાતી", workingLabel: "Gujarati (India)" },
  { code: "kn", name: "Kannada", nativeLabel: "ಕನ್ನಡ", workingLabel: "Kannada (India)" },
  { code: "ml", name: "Malayalam", nativeLabel: "മലയാളം", workingLabel: "Malayalam (India)" },
];

const PREVIEW: Record<LanguageCode, { hello: string; welcome: string; thankYou: string }> = {
  en: { hello: "Hello", welcome: "Welcome", thankYou: "Thank you" },
  hi: { hello: "नमस्ते", welcome: "स्वागत है", thankYou: "धन्यवाद" },
  bn: { hello: "হ্যালো", welcome: "স্বাগতম", thankYou: "ধন্যবাদ" },
  es: { hello: "Hola", welcome: "Bienvenido", thankYou: "Gracias" },
  fr: { hello: "Bonjour", welcome: "Bienvenue", thankYou: "Merci" },
  ar: { hello: "مرحبا", welcome: "أهلاً بك", thankYou: "شكراً لك" },
  ta: { hello: "வணக்கம்", welcome: "வரவேற்கிறோம்", thankYou: "நன்றி" },
  te: { hello: "హలో", welcome: "స్వాగతం", thankYou: "ధన్యవాదాలు" },
  mr: { hello: "नमस्कार", welcome: "स्वागत आहे", thankYou: "धन्यवाद" },
  gu: { hello: "નમસ્તે", welcome: "સ્વાગત છે", thankYou: "આભાર" },
  kn: { hello: "ನಮಸ್ಕಾರ", welcome: "ಸ್ವಾಗತ", thankYou: "ಧನ್ಯವಾದಗಳು" },
  ml: { hello: "ഹലോ", welcome: "സ്വാഗതം", thankYou: "നന്ദി" },
};

const DATE_FORMATS = [
  { value: "DD/MM/YYYY", api: "dd/MM/yyyy" },
  { value: "MM/DD/YYYY", api: "MM/dd/yyyy" },
  { value: "YYYY-MM-DD", api: "yyyy-MM-dd" },
  { value: "DD-MM-YYYY", api: "dd-MM-yyyy" },
];

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "(UTC+05:30) Asia/Kolkata" },
  { value: "Asia/Dubai", label: "(UTC+04:00) Asia/Dubai" },
  { value: "Asia/Singapore", label: "(UTC+08:00) Asia/Singapore" },
  { value: "UTC", label: "(UTC+00:00) UTC" },
  { value: "Europe/London", label: "(UTC+00:00) Europe/London" },
  { value: "America/New_York", label: "(UTC-05:00) America/New_York" },
];

const CURRENCIES = [
  { value: "INR", label: "INR (₹) - Indian Rupee" },
  { value: "USD", label: "USD ($) - US Dollar" },
  { value: "EUR", label: "EUR (€) - Euro" },
  { value: "GBP", label: "GBP (£) - British Pound" },
  { value: "AED", label: "AED (د.إ) - UAE Dirham" },
];

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-4 text-sm font-bold text-[#1A1A1A]">{title}</h2>
      {children}
    </section>
  );
}

function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <span className="block text-[12px] font-semibold text-[#6B7280]">{children}</span>
      {hint ? <span className="mt-0.5 block text-[11px] text-[#9CA3AF]">{hint}</span> : null}
    </div>
  );
}

function toUiDateFormat(apiValue: string) {
  const normalized = apiValue.replace(/-/g, "/").toLowerCase();
  if (normalized === "dd/mm/yyyy") return "DD/MM/YYYY";
  if (normalized === "mm/dd/yyyy") return "MM/DD/YYYY";
  if (normalized === "yyyy/mm/dd" || apiValue.toLowerCase() === "yyyy-mm-dd") return "YYYY-MM-DD";
  if (apiValue.toLowerCase() === "dd-mm-yyyy") return "DD-MM-YYYY";
  return "DD/MM/YYYY";
}

function toApiDateFormat(uiValue: string) {
  return DATE_FORMATS.find((item) => item.value === uiValue)?.api ?? "dd/MM/yyyy";
}

function formatPreviewDate(uiFormat: string) {
  const day = "31";
  const month = "05";
  const year = "2026";
  if (uiFormat === "MM/DD/YYYY") return `${month}/${day}/${year}`;
  if (uiFormat === "YYYY-MM-DD") return `${year}-${month}-${day}`;
  if (uiFormat === "DD-MM-YYYY") return `${day}-${month}-${year}`;
  return `${day}/${month}/${year}`;
}

export function RegionalLanguagePage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Regional & Language";
  const canManage = Boolean(
    user?.permissions.some((p) => ["erp.manage", "settings.manage"].includes(p)),
  );

  const [workingLanguage, setWorkingLanguage] = useState<LanguageCode>("en");
  const [enabledLanguages, setEnabledLanguages] = useState<Set<LanguageCode>>(
    () => new Set(["en", "hi", "bn"]),
  );
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [currency, setCurrency] = useState("INR");
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
        const [settings, languages] = await Promise.all([
          apiRequest<SettingsPayload>("/settings", accessToken),
          apiRequest<TenantLanguage[]>("/erp/languages", accessToken).catch(() => [] as TenantLanguage[]),
        ]);
        if (cancelled) return;

        setDateFormat(toUiDateFormat(settings.dateFormat || "dd-MM-yyyy"));
        setTimezone(settings.timezone || "Asia/Kolkata");
        setCurrency((settings.currency || "INR").toUpperCase());

        const defaultLang = languages.find((item) => item.isDefault)?.code as LanguageCode | undefined;
        const enabled = languages
          .filter((item) => item.isEnabled)
          .map((item) => item.code as LanguageCode)
          .filter((code) => LANGUAGE_CATALOG.some((item) => item.code === code));

        const nextWorking = defaultLang && LANGUAGE_CATALOG.some((item) => item.code === defaultLang)
          ? defaultLang
          : "en";
        setWorkingLanguage(nextWorking);
        setEnabledLanguages(
          new Set(enabled.length ? [...enabled, nextWorking] : ["en", "hi", "bn", nextWorking]),
        );
      } catch (cause) {
        if (!cancelled) {
          notifyError(cause instanceof Error ? cause.message : "Unable to load regional settings");
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

  function toggleLanguage(code: LanguageCode) {
    if (code === workingLanguage) return;
    setEnabledLanguages((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function onWorkingLanguageChange(code: LanguageCode) {
    setWorkingLanguage(code);
    setEnabledLanguages((prev) => {
      const next = new Set(prev);
      next.add(code);
      return next;
    });
  }

  const previewRows = useMemo(() => {
    const codes = Array.from(
      new Set<LanguageCode>([workingLanguage, ...Array.from(enabledLanguages)]),
    );
    return codes
      .map((code) => LANGUAGE_CATALOG.find((item) => item.code === code))
      .filter(Boolean)
      .map((item) => {
        const preview = PREVIEW[item!.code];
        return {
          code: item!.code,
          label:
            item!.code === "en"
              ? "English"
              : `${item!.name} (${item!.nativeLabel})`,
          hello: preview.hello,
          welcome: preview.welcome,
          thankYou: preview.thankYou,
        };
      });
  }, [enabledLanguages, workingLanguage]);

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    setSaving(true);
    try {
      await Promise.all([
        apiRequest("/settings", accessToken, {
          method: "PUT",
          body: JSON.stringify({
            dateFormat: toApiDateFormat(dateFormat),
            timezone,
            currency,
          }),
        }),
        apiRequest("/erp/languages/sync", accessToken, {
          method: "PUT",
          body: JSON.stringify({
            defaultCode: workingLanguage,
            languages: LANGUAGE_CATALOG.map((item) => ({
              code: item.code,
              name: item.name,
              isEnabled: item.code === workingLanguage || enabledLanguages.has(item.code),
            })),
          }),
        }),
      ]);
      notifySuccess("Regional & language settings saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save regional settings");
    } finally {
      setSaving(false);
    }
  }

  const dateExample = formatPreviewDate(dateFormat);

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
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">Regional & Language</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Configure language, date, timezone and currency preferences.
            {loading ? " Loading…" : null}
          </p>
        </div>

        <div className="space-y-4">
          <Card title="Language Settings">
            <label className="mb-5 block max-w-xl">
              <FieldLabel hint="This language will be used throughout the system.">
                Working Language
              </FieldLabel>
              <select
                className="nx-input w-full"
                value={workingLanguage}
                disabled={!canManage || saving}
                onChange={(e) => onWorkingLanguageChange(e.target.value as LanguageCode)}
              >
                {LANGUAGE_CATALOG.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.workingLabel}
                  </option>
                ))}
              </select>
            </label>

            <p className="mb-2 text-[12px] font-semibold text-[#6B7280]">Additional Languages</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {LANGUAGE_CATALOG.map((item) => {
                const checked = enabledLanguages.has(item.code) || item.code === workingLanguage;
                const locked = item.code === workingLanguage;
                return (
                  <label
                    key={item.code}
                    className={[
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                      checked ? "border-primary/30 bg-primary/[0.03]" : "border-[#E5E7EB] bg-white",
                      locked || !canManage ? "opacity-90" : "cursor-pointer",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--color-primary,#7C3AED)]"
                      checked={checked}
                      disabled={!canManage || saving || locked}
                      onChange={() => toggleLanguage(item.code)}
                    />
                    <span className="font-medium text-[#1A1A1A]">{item.name}</span>
                  </label>
                );
              })}
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
              <InfoOutlined sx={{ fontSize: 18 }} className="mt-0.5 shrink-0 text-sky-600" />
              <p>Selected additional languages will be available for translations and user selection.</p>
            </div>
          </Card>

          <Card title="Regional Settings">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <FieldLabel hint="How dates appear across the system">Date Format</FieldLabel>
                <select
                  className="nx-input w-full"
                  value={dateFormat}
                  disabled={!canManage || saving}
                  onChange={(e) => setDateFormat(e.target.value)}
                >
                  {DATE_FORMATS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <FieldLabel hint="Select the default time zone">Time Zone</FieldLabel>
                <select
                  className="nx-input w-full"
                  value={timezone}
                  disabled={!canManage || saving}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  {!TIMEZONES.some((item) => item.value === timezone) ? (
                    <option value={timezone}>{timezone}</option>
                  ) : null}
                  {TIMEZONES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <FieldLabel hint="Default currency for fees and reports">Currency</FieldLabel>
                <select
                  className="nx-input w-full"
                  value={currency}
                  disabled={!canManage || saving}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {!CURRENCIES.some((item) => item.value === currency) ? (
                    <option value={currency}>{currency}</option>
                  ) : null}
                  {CURRENCIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Card>

          <Card title="Language Preview">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                    <th className="px-3 py-2.5">Language</th>
                    <th className="px-3 py-2.5">Hello</th>
                    <th className="px-3 py-2.5">Welcome</th>
                    <th className="px-3 py-2.5">Thank You</th>
                    <th className="px-3 py-2.5">Date Example</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={row.code} className="border-b border-[#F3F4F6] last:border-b-0">
                      <td className="px-3 py-3 font-semibold text-[#1A1A1A]">{row.label}</td>
                      <td className="px-3 py-3 text-[#6B7280]">{row.hello}</td>
                      <td className="px-3 py-3 text-[#6B7280]">{row.welcome}</td>
                      <td className="px-3 py-3 text-[#6B7280]">{row.thankYou}</td>
                      <td className="px-3 py-3 text-[#6B7280]">{dateExample}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
