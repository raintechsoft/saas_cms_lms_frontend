import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { PanelCard } from "../../components/charts/PremiumCharts";
import { assetUrl, updateStudentProfile, uploadStudentPhoto } from "../../lib/api";
import { usePortal } from "./PortalContext";

export function PortalProfilePage() {
  const { accessToken, completeLogin, user } = useAuth();
  const { child, reload, role } = usePortal();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [currentAddress, setCurrentAddress] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!child) return;
    setFirstName(child.student.firstName);
    setLastName(child.student.lastName ?? "");
    setMobile(child.student.mobile ?? "");
    setEmail(child.student.email ?? "");
    setCurrentAddress(child.student.currentAddress ?? "");
    setPhotoUrl(child.student.photoUrl);
    setMessage("");
    setError("");
  }, [child]);

  if (!child) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        No student profile linked.
      </div>
    );
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateStudentProfile(accessToken, child!.student.id, {
        firstName,
        lastName: lastName || null,
        mobile: mobile || null,
        email: email || null,
        currentAddress: currentAddress || null,
      });
      setPhotoUrl(updated.photoUrl);
      setMessage("Profile updated successfully.");
      await reload();
      if (user && role === "STUDENT") {
        completeLogin({
          accessToken,
          user: {
            ...user,
            firstName: updated.firstName,
            lastName: updated.lastName ?? user.lastName,
            avatarUrl: updated.photoUrl ?? user.avatarUrl,
          },
        });
      }
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
      const updated = await uploadStudentPhoto(accessToken, child!.student.id, file);
      setPhotoUrl(updated.photoUrl);
      setMessage("Photo uploaded successfully.");
      await reload();
      if (user && role === "STUDENT") {
        completeLogin({
          accessToken,
          user: { ...user, avatarUrl: updated.photoUrl ?? user.avatarUrl },
        });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to upload photo");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-semibold text-teal-600">Update profile</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          {role === "PARENT" ? "Student profile" : "My profile"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Update contact details and profile photo for {child.student.firstName}.
        </p>
      </div>

      <PanelCard title="Profile photo">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="relative">
            {photoUrl ? (
              <img
                src={assetUrl(photoUrl)}
                alt=""
                className="size-28 rounded-2xl object-cover ring-4 ring-slate-100"
              />
            ) : (
              <div className="grid size-28 place-items-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 text-3xl font-bold text-white">
                {child.student.firstName[0]}
                {child.student.lastName?.[0] ?? ""}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-slate-500">JPG, PNG or WebP · max 3MB</p>
            <label className="button-primary mt-3 inline-flex cursor-pointer">
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
      </PanelCard>

      <PanelCard title="Personal details">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSave}>
          <label className="block">
            <span className="label">First name</span>
            <input className="input" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Last name</span>
            <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Mobile</span>
            <input className="input" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Optional" />
          </label>
          <label className="block">
            <span className="label">Email</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Current address</span>
            <textarea
              className="input min-h-24"
              value={currentAddress}
              onChange={(e) => setCurrentAddress(e.target.value)}
              placeholder="Optional"
            />
          </label>
          {message && <p className="sm:col-span-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}
          {error && <p className="alert-error sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <button className="button-primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      </PanelCard>
    </div>
  );
}
