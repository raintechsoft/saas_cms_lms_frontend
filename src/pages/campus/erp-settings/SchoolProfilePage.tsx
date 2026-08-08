import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ChevronRightOutlined,
  CloudUploadOutlined,
  EditOutlined,
  EventOutlined,
  GroupsOutlined,
  PeopleOutlined,
  SaveOutlined,
  VerifiedOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { assetUrl, apiRequest } from "../../../lib/api";
import { applyBrandingToDocument, parseBranding } from "../../../lib/branding";
import { notifyError, notifySuccess } from "../../../lib/notify";

interface SchoolProfile {
  institutionName: string;
  frontDisplayName: string;
  tagline: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  establishedYear: string | null;
  affiliation: string | null;
  schoolCode: string | null;
  logoUrl: string | null;
  status: string;
  stats: {
    students: number;
    staff: number;
    sessionName: string | null;
  };
}

type OutletCtx = { activeLabel?: string };

function RequiredLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
      {children} <span className="text-rose-500">*</span>
    </span>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-[#1A1A1A]">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-[#6B7280]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[#E5E7EB] py-2.5 text-sm last:border-b-0">
      <dt className="text-[#6B7280]">{label}</dt>
      <dd className="font-medium text-[#1A1A1A]">{value || "—"}</dd>
    </div>
  );
}

function QuickRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  tone: string;
}) {
  return (
    <div className="flex w-full items-center gap-3 rounded-[10px] border border-[#E5E7EB] px-3 py-2.5">
      <span className={`inline-flex size-9 items-center justify-center rounded-[10px] ${tone}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-[#6B7280]">{label}</span>
        <span className="block text-sm font-semibold text-[#1A1A1A]">{value}</span>
      </span>
      <ChevronRightOutlined sx={{ fontSize: 18 }} className="text-[#9CA3AF]" />
    </div>
  );
}

function emptyProfile(tenantName = "Your Institution"): SchoolProfile {
  return {
    institutionName: tenantName,
    frontDisplayName: tenantName,
    tagline: "",
    address: null,
    email: null,
    phone: null,
    website: null,
    establishedYear: null,
    affiliation: null,
    schoolCode: null,
    logoUrl: null,
    status: "ACTIVE",
    stats: { students: 0, staff: 0, sessionName: null },
  };
}

export function SchoolProfilePage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "School Profile";

  const fallback = useMemo(
    () => emptyProfile(user?.tenant?.name || "Your Institution"),
    [user?.tenant?.name],
  );

  const [profile, setProfile] = useState<SchoolProfile>(fallback);
  const [loading, setLoading] = useState(true);
  const [editingSummary, setEditingSummary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    setProfile((current) => ({
      ...current,
      institutionName: current.institutionName || fallback.institutionName,
      frontDisplayName: current.frontDisplayName || fallback.frontDisplayName,
    }));
  }, [fallback.institutionName, fallback.frontDisplayName]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!accessToken) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await apiRequest<SchoolProfile>("/settings/school-profile", accessToken);
        if (cancelled) return;
        setProfile(data);
        setLogoPreview(data.logoUrl ? assetUrl(data.logoUrl) : null);
      } catch (cause) {
        if (!cancelled) {
          notifyError(cause instanceof Error ? cause.message : "Unable to load school profile");
          setProfile(fallback);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, fallback]);

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      const saved = await apiRequest<SchoolProfile>("/settings/school-profile", accessToken, {
        method: "PUT",
        body: JSON.stringify({
          institutionName: profile.institutionName,
          frontDisplayName: profile.frontDisplayName,
          tagline: profile.tagline,
          address: profile.address,
          email: profile.email,
          phone: profile.phone,
          website: profile.website,
          establishedYear: profile.establishedYear,
          affiliation: profile.affiliation,
          schoolCode: profile.schoolCode,
          logoUrl: profile.logoUrl,
        }),
      });
      setProfile(saved);
      setEditingSummary(false);
      notifySuccess("School profile saved");
      if (user?.tenant) {
        applyBrandingToDocument(
          parseBranding({
            ...(user.tenant.branding ?? {}),
            frontDisplayName: saved.frontDisplayName,
            tagline: saved.tagline,
            logoUrl: saved.logoUrl ?? undefined,
            logoText: saved.tagline || saved.frontDisplayName,
          }),
        );
      }
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save school profile");
    } finally {
      setSaving(false);
    }
  }

  function onLogoFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notifyError("Please choose a PNG or JPG image");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      setLogoPreview(dataUrl);
      setProfile((prev) => ({ ...prev, logoUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  }

  const initials = (profile.frontDisplayName || profile.institutionName || "SC")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

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
          disabled={saving || loading}
        >
          <SaveOutlined sx={{ fontSize: 16 }} />
          {saving ? "Saving…" : "Save configuration"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">School Profile</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Manage your institution basic information and contact details.
            {loading ? " Loading latest data…" : null}
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
          <Card title="Institution Information">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <RequiredLabel>Institution Name</RequiredLabel>
                <input
                  className="nx-input w-full"
                  required
                  value={profile.institutionName}
                  onChange={(e) => setProfile({ ...profile, institutionName: e.target.value })}
                />
              </label>
              <label className="block sm:col-span-2">
                <RequiredLabel>Front Display Name</RequiredLabel>
                <input
                  className="nx-input w-full"
                  required
                  value={profile.frontDisplayName}
                  onChange={(e) => setProfile({ ...profile, frontDisplayName: e.target.value })}
                />
              </label>
              <label className="block sm:col-span-2">
                <RequiredLabel>Display Line / Tagline</RequiredLabel>
                <input
                  className="nx-input w-full"
                  value={profile.tagline}
                  onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
                  placeholder="Nurturing Minds. Building Futures."
                />
              </label>
              <label className="block sm:col-span-2">
                <RequiredLabel>Address</RequiredLabel>
                <textarea
                  className="nx-input min-h-24 w-full"
                  value={profile.address ?? ""}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value || null })}
                />
              </label>
              <label className="block">
                <RequiredLabel>Contact Email</RequiredLabel>
                <input
                  className="nx-input w-full"
                  type="email"
                  value={profile.email ?? ""}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value || null })}
                />
              </label>
              <label className="block">
                <RequiredLabel>Contact Phone</RequiredLabel>
                <input
                  className="nx-input w-full"
                  value={profile.phone ?? ""}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value || null })}
                />
              </label>
            </div>
          </Card>

          <Card title="School Logo" subtitle="Recommended size: 512 × 512 px (PNG/JPG)">
            <div className="flex flex-col items-center gap-4">
              <div className="flex size-36 items-center justify-center overflow-hidden rounded-full border border-[#E5E7EB] bg-[#F6F7F9]">
                {logoPreview ? (
                  <img src={logoPreview} alt="School logo" className="size-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-primary">{initials || "SC"}</span>
                )}
              </div>
              <label className="flex w-full cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-[#E5E7EB] px-4 py-5 text-center hover:bg-[#F6F7F9]">
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  <CloudUploadOutlined sx={{ fontSize: 18 }} />
                  Change Logo
                </span>
                <span className="text-xs text-[#6B7280]">or drag and drop your file here</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </Card>

          <Card title="Profile Summary">
            {!editingSummary ? (
              <>
                <dl>
                  <SummaryRow label="Institution Name" value={profile.institutionName} />
                  <SummaryRow label="Front Display Name" value={profile.frontDisplayName} />
                  <SummaryRow label="Tagline" value={profile.tagline} />
                  <SummaryRow label="Address" value={profile.address ?? ""} />
                  <SummaryRow label="Contact Email" value={profile.email ?? ""} />
                  <SummaryRow label="Contact Phone" value={profile.phone ?? ""} />
                  <SummaryRow label="Website" value={profile.website ?? ""} />
                  <SummaryRow label="Established Year" value={profile.establishedYear ?? ""} />
                  <SummaryRow label="Affiliation / Board" value={profile.affiliation ?? ""} />
                  <SummaryRow label="School Code" value={profile.schoolCode ?? ""} />
                </dl>
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#1A1A1A] hover:bg-[#F6F7F9]"
                    onClick={() => setEditingSummary(true)}
                  >
                    <EditOutlined sx={{ fontSize: 16 }} />
                    Edit Summary
                  </button>
                </div>
              </>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">Website</span>
                  <input
                    className="nx-input w-full"
                    value={profile.website ?? ""}
                    onChange={(e) => setProfile({ ...profile, website: e.target.value || null })}
                    placeholder="https://"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                    Established Year
                  </span>
                  <input
                    className="nx-input w-full"
                    value={profile.establishedYear ?? ""}
                    onChange={(e) =>
                      setProfile({ ...profile, establishedYear: e.target.value || null })
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                    Affiliation / Board
                  </span>
                  <input
                    className="nx-input w-full"
                    value={profile.affiliation ?? ""}
                    onChange={(e) => setProfile({ ...profile, affiliation: e.target.value || null })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
                    School Code
                  </span>
                  <input
                    className="nx-input w-full"
                    value={profile.schoolCode ?? ""}
                    onChange={(e) => setProfile({ ...profile, schoolCode: e.target.value || null })}
                  />
                </label>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <button
                    type="button"
                    className="inline-flex items-center rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
                    onClick={() => void save()}
                  >
                    Save summary
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#1A1A1A]"
                    onClick={() => setEditingSummary(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Card>

          <Card title="Quick Info">
            <div className="space-y-2">
              <QuickRow
                icon={<PeopleOutlined sx={{ fontSize: 18 }} />}
                label="Total Students"
                value={profile.stats.students.toLocaleString()}
                tone="bg-primary/10 text-primary"
              />
              <QuickRow
                icon={<GroupsOutlined sx={{ fontSize: 18 }} />}
                label="Total Staff"
                value={profile.stats.staff.toLocaleString()}
                tone="bg-emerald-50 text-emerald-700"
              />
              <QuickRow
                icon={<EventOutlined sx={{ fontSize: 18 }} />}
                label="Academic Session"
                value={profile.stats.sessionName ?? "—"}
                tone="bg-sky-50 text-sky-700"
              />
              <QuickRow
                icon={<VerifiedOutlined sx={{ fontSize: 18 }} />}
                label="School Status"
                value={
                  <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    {profile.status === "ACTIVE" ? "Active" : profile.status}
                  </span>
                }
                tone="bg-amber-50 text-amber-700"
              />
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
