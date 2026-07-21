import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import { OpsPageHeader, OpsPanel, opsBtnPrimary } from "./platformUi";
import type { PlatformSettings } from "./types";

export function AdminSettingsPage() {
  const { accessToken } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#f59e0b");
  const [logoText, setLogoText] = useState("SaaS CMS LMS");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiRequest<PlatformSettings>("/platform/settings", accessToken)
      .then((data) => {
        setSettings(data);
        setPrimaryColor(data.brandingDefaults.primaryColor);
        setLogoText(data.brandingDefaults.logoText);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Failed to load settings"));
  }, [accessToken]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const next = await apiRequest<PlatformSettings>("/platform/settings", accessToken, {
        method: "PUT",
        body: JSON.stringify({ branding: { primaryColor, logoText } }),
      });
      setSettings(next);
      setMessage("Platform branding defaults saved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save settings");
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !settings) return <p className="alert-error">{error}</p>;
  if (!settings) return <p className="text-sm text-zinc-500">Loading settings…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <OpsPageHeader title="Platform Settings" description="Default branding and environment metadata" />
      {error && <p className="alert-error">{error}</p>}
      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>
      )}

      <OpsPanel title="Branding defaults" code="06">
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-zinc-700">
              Primary color
              <input className="input mt-1" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
            </label>
            <label className="text-sm font-medium text-zinc-700">
              Logo text
              <input className="input mt-1" required value={logoText} onChange={(e) => setLogoText(e.target.value)} />
            </label>
          </div>
          <button className={opsBtnPrimary} type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save defaults"}
          </button>
        </form>
      </OpsPanel>

      <OpsPanel title="Security" code="SEC">
        <div className="space-y-3 text-sm">
          <p>
            JWT expiry: <strong>{settings.security.jwtExpiresIn}</strong>
          </p>
          <ul className="list-disc space-y-1 pl-5 text-zinc-600">
            {settings.security.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </OpsPanel>

      <OpsPanel title="Environment" code="ENV">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">NODE_ENV</dt>
            <dd>{settings.environment.nodeEnv}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">API port</dt>
            <dd>{settings.environment.apiPort}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Web origin</dt>
            <dd>{settings.environment.webOrigin}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Version</dt>
            <dd>{settings.environment.version}</dd>
          </div>
        </dl>
      </OpsPanel>
    </div>
  );
}
