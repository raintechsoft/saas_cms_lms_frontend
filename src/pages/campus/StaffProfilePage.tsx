import { useEffect, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
import { PanelCard } from "../../components/charts/PremiumCharts";
import { assetUrl, updateAuthProfile, uploadAvatar } from "../../lib/api";
import {
  OpsPageHeader,
  OpsPanel,
  opsBtnPrimary,
} from "../super-admin/platformUi";

export function StaffProfilePage() {
  const { pathname } = useLocation();
  const isOps = pathname.startsWith("/admin");
  const { accessToken, user, completeLogin } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setPhone(user.phone ?? "");
    setAvatarUrl(user.avatarUrl ?? null);
  }, [user]);

  if (!user) return null;

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateAuthProfile(accessToken, {
        firstName,
        lastName,
        phone: phone || null,
      });
      setAvatarUrl(updated.avatarUrl);
      setMessage("Profile updated successfully.");
      completeLogin({
        accessToken,
        user: {
          ...user!,
          firstName: updated.firstName,
          lastName: updated.lastName,
          phone: updated.phone,
          avatarUrl: updated.avatarUrl,
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update profile");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const updated = await uploadAvatar(accessToken, file);
      setAvatarUrl(updated.avatarUrl);
      setMessage("Photo uploaded successfully.");
      completeLogin({
        accessToken,
        user: {
          ...user!,
          firstName: updated.firstName,
          lastName: updated.lastName,
          phone: updated.phone,
          avatarUrl: updated.avatarUrl,
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to upload photo");
    } finally {
      setUploading(false);
    }
  }

  const btnClass = isOps ? opsBtnPrimary : "button-primary";
  const Header = isOps ? (
    <OpsPageHeader
      eyebrow="Account"
      title="Update profile"
      description="Manage your ops console profile details and upload a photo."
    />
  ) : (
    <PageHeader
      eyebrow="Account"
      title="Update profile"
      description="Manage your staff profile details and upload a photo."
    />
  );

  const photoBody = (
    <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
      {avatarUrl ? (
        <img
          src={assetUrl(avatarUrl)}
          alt=""
          className={`size-28 object-cover ${isOps ? "rounded-lg ring-2 ring-zinc-200" : "rounded-2xl ring-4 ring-slate-100"}`}
        />
      ) : (
        <div
          className={`grid size-28 place-items-center text-3xl font-bold text-white ${
            isOps ? "rounded-lg bg-zinc-950 text-amber-400" : "rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950"
          }`}
        >
          {user.firstName[0]}
          {user.lastName?.[0] ?? ""}
        </div>
      )}
      <div>
        <p className={`text-sm ${isOps ? "text-zinc-500" : "text-slate-500"}`}>JPG, PNG or WebP · max 3MB</p>
        <label className={`${btnClass} mt-3 inline-flex cursor-pointer`}>
          {uploading ? "Uploading…" : "Upload photo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(event) => void handlePhoto(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>
    </div>
  );

  const formBody = (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSave}>
      <label className="block">
        <span className="label">First name</span>
        <input className="input" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </label>
      <label className="block">
        <span className="label">Last name</span>
        <input className="input" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </label>
      <label className="block">
        <span className="label">Email</span>
        <input className="input" value={user.email} disabled />
      </label>
      <label className="block">
        <span className="label">Phone</span>
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
      </label>
      {message && (
        <p
          className={`sm:col-span-2 px-4 py-3 text-sm ${
            isOps
              ? "rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "rounded-xl bg-emerald-50 text-emerald-700"
          }`}
        >
          {message}
        </p>
      )}
      {error && <p className="alert-error sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button className={btnClass} type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );

  return (
    <div className={isOps ? "mx-auto max-w-3xl space-y-6" : "page-main space-y-3"}>
      {Header}
      {isOps ? (
        <div className="space-y-6">
          <OpsPanel title="Profile photo" code="07">
            {photoBody}
          </OpsPanel>
          <OpsPanel title="Personal details" code="ID">
            {formBody}
          </OpsPanel>
        </div>
      ) : (
        <div className="space-y-3">
          <PanelCard title="Profile photo">{photoBody}</PanelCard>
          <PanelCard title="Personal details">{formBody}</PanelCard>
        </div>
      )}
    </div>
  );
}
