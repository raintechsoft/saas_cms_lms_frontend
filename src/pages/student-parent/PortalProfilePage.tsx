import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BloodtypeOutlined,
  CakeOutlined,
  CheckCircleRounded,
  DescriptionOutlined,
  EditOutlined,
  EmailOutlined,
  HomeOutlined,
  LocationOnOutlined,
  NotificationsOutlined,
  PersonOutlined,
  PhoneOutlined,
  ScheduleRounded,
  SchoolOutlined,
  VerifiedRounded,
} from "@mui/icons-material";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest, assetUrl, updateStudentProfile, uploadStudentPhoto } from "../../lib/api";
import { parseBranding } from "../../lib/branding";
import { isProductBucketAllowed } from "../../lib/productMode";
import {
  disableBrowserPush,
  enableBrowserPush,
  getPushPermission,
  isPushSupported,
  setPortalPushChoice,
} from "../../lib/push";
import { usePortal } from "./PortalContext";

const PRIMARY = "#534AB7";
const BORDER = "#E5E7EB";

type DetailTab = "basic" | "parent" | "address" | "academic" | "more";

type DocTeaser = {
  id: string;
  name: string;
  status: "Verified" | "Pending";
};

function Card({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section
      className={`rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)] ${className}`}
      style={{ borderColor: BORDER, ...style }}
    >
      {children}
    </section>
  );
}

function display(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function formatDate(value?: string | null, long = false) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: long ? "long" : "short",
    year: "numeric",
  });
}

function formatMonthYear(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-[#9CA3AF]">{label}</p>
      <p className="mt-1 text-[13px] font-semibold text-[#1A1A1A]">{value}</p>
    </div>
  );
}

function ContactRow({
  Icon,
  children,
}: {
  Icon: typeof EmailOutlined;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 text-[13px] text-[#4B5563]">
      <Icon sx={{ fontSize: 18, color: "#9CA3AF", marginTop: "1px" }} />
      <span className="min-w-0 break-words font-medium">{children}</span>
    </div>
  );
}

export function PortalProfilePage() {
  const { accessToken, completeLogin, user } = useAuth();
  const { child, reload, role, basePath, productMode } = usePortal();
  const branding = parseBranding(user?.tenant?.branding as Record<string, unknown> | null);
  const schoolName =
    branding.logoText ||
    (user?.tenant as { name?: string } | undefined)?.name ||
    "Your School Name";
  const showCms = isProductBucketAllowed(productMode, "CMS");

  const [tab, setTab] = useState<DetailTab>("basic");
  const [editing, setEditing] = useState(false);
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
  const [docs, setDocs] = useState<DocTeaser[]>([]);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const [pushError, setPushError] = useState("");

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

  useEffect(() => {
    setPushEnabled(getPushPermission() === "granted");
  }, []);

  useEffect(() => {
    if (!child || !showCms) {
      setDocs([]);
      return;
    }
    apiRequest<{ documents: Array<{ id: string; name: string }> }>(
      `/portal/children/${child.student.id}/documents`,
      accessToken,
    )
      .then((data) => {
        setDocs(
          (data.documents ?? []).slice(0, 4).map((doc) => ({
            id: doc.id,
            name: doc.name,
            status: "Verified" as const,
          })),
        );
      })
      .catch(() => setDocs([]));
  }, [accessToken, child?.student.id, showCms]);

  const fullName = useMemo(() => {
    if (!child) return "";
    return [child.student.firstName, child.student.lastName].filter(Boolean).join(" ");
  }, [child]);

  const classLabel = child?.enrollment
    ? `Class ${child.enrollment.className} - ${child.enrollment.section}`
    : "—";

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!child) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateStudentProfile(accessToken, child.student.id, {
        firstName,
        lastName: lastName || null,
        mobile: mobile || null,
        email: email || null,
        currentAddress: currentAddress || null,
      });
      setPhotoUrl(updated.photoUrl);
      setMessage("Profile updated successfully.");
      setEditing(false);
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
    if (!file || !child) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const updated = await uploadStudentPhoto(accessToken, child.student.id, file);
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

  async function handleEnablePush() {
    if (!user) return;
    setPushBusy(true);
    setPushError("");
    setPushMessage("");
    try {
      await enableBrowserPush(accessToken);
      setPortalPushChoice(user.id, "enabled");
      setPushEnabled(true);
      setPushMessage("Browser notifications enabled.");
    } catch (cause) {
      setPushError(cause instanceof Error ? cause.message : "Unable to enable notifications");
    } finally {
      setPushBusy(false);
    }
  }

  async function handleDisablePush() {
    if (!user) return;
    setPushBusy(true);
    setPushError("");
    setPushMessage("");
    try {
      await disableBrowserPush(accessToken);
      setPortalPushChoice(user.id, "dismissed");
      setPushEnabled(false);
      setPushMessage("Browser notifications disabled.");
    } catch (cause) {
      setPushError(cause instanceof Error ? cause.message : "Unable to disable notifications");
    } finally {
      setPushBusy(false);
    }
  }

  if (!child) {
    return <p className="text-sm text-[#6B7280]">No student profile linked.</p>;
  }

  const s = child.student;
  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: "basic", label: "Basic Details" },
    { id: "parent", label: "Parent / Guardian" },
    { id: "address", label: "Address" },
    { id: "academic", label: "Academic Details" },
    { id: "more", label: "More Information" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-[#1A1A1A]">
          {role === "PARENT" ? "Student Profile" : "My Profile"}
        </h1>
        <p className="mt-1 text-[12px] text-[#9CA3AF]">
          <Link to={basePath} className="hover:text-[#6B7280]">
            Dashboard
          </Link>
          <span className="mx-1.5">›</span>
          <span className="font-medium text-[#6B7280]">Profile</span>
        </p>
      </div>

      {(message || error) && (
        <p
          className={`rounded-xl px-4 py-2 text-[13px] font-medium ${
            error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {error || message}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <Card>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="relative mx-auto shrink-0 sm:mx-0">
              {photoUrl ? (
                <img
                  src={assetUrl(photoUrl)}
                  alt=""
                  className="size-28 rounded-full object-cover ring-4 ring-[#EEF0FD]"
                />
              ) : (
                <div className="grid size-28 place-items-center rounded-full bg-gradient-to-br from-[#534AB7] to-[#3F3A9A] text-3xl font-bold text-white ring-4 ring-[#EEF0FD]">
                  {s.firstName[0]}
                  {s.lastName?.[0] ?? ""}
                </div>
              )}
              <label className="absolute bottom-1 right-1 grid size-8 cursor-pointer place-items-center rounded-full bg-white text-[#534AB7] shadow ring-1 ring-[#E5E7EB]">
                <EditOutlined sx={{ fontSize: 16 }} />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => void handlePhoto(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                <h2 className="text-[22px] font-bold text-[#1A1A1A]">{fullName}</h2>
                {s.status === "ACTIVE" ? (
                  <VerifiedRounded sx={{ fontSize: 20, color: "#2563EB" }} titleAccess="Active" />
                ) : null}
              </div>
              <p className="mt-1 text-[13px] font-semibold text-[#6B7280]">
                {classLabel}
                {child.enrollment?.rollNumber ? ` · Roll No. ${child.enrollment.rollNumber}` : ""}
              </p>
              <p className="mt-0.5 text-[12px] text-[#9CA3AF]">Adm. No. {s.admissionNumber}</p>

              <div className="mt-4 grid gap-2.5 text-left sm:grid-cols-2">
                <ContactRow Icon={EmailOutlined}>{display(s.email)}</ContactRow>
                <ContactRow Icon={PhoneOutlined}>{display(s.mobile)}</ContactRow>
                <ContactRow Icon={CakeOutlined}>{formatDate(s.dateOfBirth)}</ContactRow>
                <ContactRow Icon={LocationOnOutlined}>{display(s.currentAddress)}</ContactRow>
              </div>

              <button
                type="button"
                className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white"
                style={{ background: PRIMARY }}
                onClick={() => setEditing(true)}
              >
                <EditOutlined sx={{ fontSize: 18 }} />
                Edit Profile
              </button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-bold text-[#1A1A1A]">Documents</h3>
            {showCms ? (
              <Link to={`${basePath}/documents`} className="text-[12px] font-bold text-[#534AB7] hover:underline">
                View All
              </Link>
            ) : null}
          </div>
          {!showCms ? (
            <p className="text-[13px] text-[#6B7280]">Documents are available when CMS is enabled.</p>
          ) : docs.length === 0 ? (
            <p className="text-[13px] text-[#6B7280]">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-3">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EEF0FD] text-[#534AB7]">
                    <DescriptionOutlined sx={{ fontSize: 20 }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-[#1A1A1A]">{doc.name}</p>
                    <p
                      className={`text-[11px] font-semibold ${
                        doc.status === "Verified" ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      {doc.status}
                    </p>
                  </div>
                  {doc.status === "Verified" ? (
                    <CheckCircleRounded sx={{ fontSize: 18, color: "#059669" }} />
                  ) : (
                    <ScheduleRounded sx={{ fontSize: 18, color: "#D97706" }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.75fr)]">
        <Card className="!p-0 overflow-hidden">
          <div className="flex gap-1 overflow-x-auto border-b border-[#E5E7EB] px-3 pt-2">
            {tabs.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`shrink-0 border-b-2 px-3 py-3 text-[12px] font-bold transition ${
                    active
                      ? "border-[#534AB7] text-[#534AB7]"
                      : "border-transparent text-[#6B7280] hover:text-[#1A1A1A]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="p-5">
            {tab === "basic" ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full Name" value={fullName} />
                <Field label="Class & Section" value={classLabel} />
                <Field label="Admission Number" value={display(s.admissionNumber)} />
                <Field label="Roll Number" value={display(child.enrollment?.rollNumber)} />
                <Field label="Date of Birth" value={formatDate(s.dateOfBirth, true)} />
                <Field label="Nationality" value={display(s.nationality)} />
                <Field label="Gender" value={display(s.gender)} />
                <Field label="Religion" value={display(s.religion)} />
                <Field label="Blood Group" value={display(s.bloodGroup)} />
                <Field label="Mobile Number" value={display(s.mobile)} />
              </div>
            ) : null}

            {tab === "parent" ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Father Name" value={display(s.fatherName)} />
                <Field label="Father Phone" value={display(s.fatherPhone)} />
                <Field label="Father Email" value={display(s.fatherEmail)} />
                <Field label="Father Occupation" value={display(s.fatherOccupation)} />
                <Field label="Mother Name" value={display(s.motherName)} />
                <Field label="Mother Phone" value={display(s.motherPhone)} />
                <Field label="Mother Email" value={display(s.motherEmail)} />
                <Field label="Mother Occupation" value={display(s.motherOccupation)} />
                <Field label="Guardian Name" value={display(s.guardianName)} />
                <Field label="Guardian Relation" value={display(s.guardianRelation)} />
                <Field label="Guardian Phone" value={display(s.guardianPhone)} />
                <Field label="Guardian Email" value={display(s.guardianEmail)} />
              </div>
            ) : null}

            {tab === "address" ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Current Address" value={display(s.currentAddress)} />
                <Field label="Permanent Address" value={display(s.permanentAddress)} />
                <Field label="Email" value={display(s.email)} />
                <Field label="Mobile" value={display(s.mobile)} />
              </div>
            ) : null}

            {tab === "academic" ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Class & Section" value={classLabel} />
                <Field label="Roll Number" value={display(child.enrollment?.rollNumber)} />
                <Field label="Session" value={display(child.enrollment?.session)} />
                <Field label="Class Teacher" value={display(child.enrollment?.classTeacher)} />
                <Field label="Admission Type" value={display(s.admissionType)} />
                <Field label="Category" value={display(s.category)} />
                <Field label="House" value={display(s.house)} />
                <Field label="Admission Date" value={formatDate(s.admissionDate, true)} />
              </div>
            ) : null}

            {tab === "more" ? (
              <div className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Caste" value={display(s.caste)} />
                  <Field
                    label="Transport"
                    value={
                      s.transportOptIn
                        ? [
                            s.transport?.routeName ?? s.transportRoute,
                            s.transport?.stopName ?? s.transportStopName,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Yes"
                        : "No"
                    }
                  />
                  <Field
                    label="Hostel"
                    value={
                      s.hostelOptIn
                        ? [
                            s.hostel
                              ? `${s.hostel.blockName} · ${s.hostel.roomName}`
                              : s.hostelRoom,
                            s.hostel?.bedLabel,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Yes"
                        : "No"
                    }
                  />
                  <Field label="Notes" value={display(s.additionalNotes)} />
                </div>

                {isPushSupported() ? (
                  <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <NotificationsOutlined sx={{ fontSize: 18, color: PRIMARY }} />
                      <p className="text-[13px] font-bold text-[#1A1A1A]">Browser notifications</p>
                    </div>
                    <p className="text-[12px] text-[#6B7280]">
                      Allow alerts for fees, notices, and important updates when the portal is closed.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-xl px-3 py-2 text-[12px] font-bold text-white disabled:opacity-60"
                        style={{ background: PRIMARY }}
                        disabled={pushBusy || pushEnabled}
                        onClick={() => void handleEnablePush()}
                      >
                        {pushBusy ? "Working…" : pushEnabled ? "Notifications on" : "Allow notifications"}
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-[12px] font-bold text-[#6B7280] disabled:opacity-60"
                        disabled={pushBusy || !pushEnabled}
                        onClick={() => void handleDisablePush()}
                      >
                        Turn off
                      </button>
                    </div>
                    {pushMessage ? (
                      <p className="mt-2 text-[12px] font-medium text-emerald-700">{pushMessage}</p>
                    ) : null}
                    {pushError ? (
                      <p className="mt-2 text-[12px] font-medium text-rose-700">{pushError}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-[15px] font-bold text-[#1A1A1A]">Quick Info</h3>
          <div className="space-y-3.5">
            {[
              { label: "School Name", value: schoolName, Icon: SchoolOutlined, bg: "#EEF0FD", fg: PRIMARY },
              {
                label: "Session",
                value: display(child.enrollment?.session),
                Icon: ScheduleRounded,
                bg: "#ECFDF5",
                fg: "#059669",
              },
              { label: "Email", value: display(s.email), Icon: EmailOutlined, bg: "#DBEAFE", fg: "#2563EB" },
              { label: "House", value: display(s.house), Icon: HomeOutlined, bg: "#FFF7ED", fg: "#D97706" },
              {
                label: "Student Since",
                value: formatMonthYear(s.admissionDate),
                Icon: PersonOutlined,
                bg: "#FCE7F3",
                fg: "#DB2777",
              },
              {
                label: "Blood Group",
                value: display(s.bloodGroup),
                Icon: BloodtypeOutlined,
                bg: "#FEE2E2",
                fg: "#E11D48",
              },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3">
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-full"
                  style={{ background: row.bg, color: row.fg }}
                >
                  <row.Icon sx={{ fontSize: 18 }} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-[#9CA3AF]">{row.label}</p>
                  <p className="truncate text-[13px] font-bold text-[#1A1A1A]">{row.value}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <footer className="flex flex-col gap-2 border-t border-[#E5E7EB] pt-4 text-[11px] text-[#9CA3AF] sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {schoolName}. All rights reserved.
        </p>
        <div className="flex flex-wrap gap-4 font-medium">
          <Link to={`${basePath}/help`} className="hover:text-[#6B7280]">
            Privacy Policy
          </Link>
          <Link to={`${basePath}/help`} className="hover:text-[#6B7280]">
            Terms of Use
          </Link>
          <Link to={`${basePath}/help`} className="hover:text-[#6B7280]">
            Help & Support
          </Link>
        </div>
      </footer>

      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setEditing(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[20px] bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[18px] font-bold text-[#1A1A1A]">Edit Profile</h2>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-[12px] font-bold text-[#6B7280] hover:bg-[#F6F7F9]"
                onClick={() => setEditing(false)}
              >
                Close
              </button>
            </div>
            <p className="mb-4 text-[12px] text-[#6B7280]">
              You can update contact details and address. School-managed fields (class, DOB, parents) are
              read-only.
            </p>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSave}>
              <label className="block text-[12px] font-semibold text-[#6B7280]">
                First name
                <input
                  className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-[13px] font-semibold text-[#1A1A1A] outline-none focus:border-[#534AB7]"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </label>
              <label className="block text-[12px] font-semibold text-[#6B7280]">
                Last name
                <input
                  className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-[13px] font-semibold text-[#1A1A1A] outline-none focus:border-[#534AB7]"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </label>
              <label className="block text-[12px] font-semibold text-[#6B7280]">
                Mobile
                <input
                  className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-[13px] font-semibold text-[#1A1A1A] outline-none focus:border-[#534AB7]"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                />
              </label>
              <label className="block text-[12px] font-semibold text-[#6B7280]">
                Email
                <input
                  type="email"
                  className="mt-1 w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-[13px] font-semibold text-[#1A1A1A] outline-none focus:border-[#534AB7]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="block text-[12px] font-semibold text-[#6B7280] sm:col-span-2">
                Current address
                <textarea
                  className="mt-1 min-h-24 w-full rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-[13px] font-semibold text-[#1A1A1A] outline-none focus:border-[#534AB7]"
                  value={currentAddress}
                  onChange={(e) => setCurrentAddress(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button
                  type="submit"
                  className="rounded-xl px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
                  style={{ background: PRIMARY }}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-[#E5E7EB] px-4 py-2.5 text-[13px] font-bold text-[#6B7280]"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
