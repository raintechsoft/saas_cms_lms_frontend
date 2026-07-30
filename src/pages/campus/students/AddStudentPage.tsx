import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  CloseOutlined,
  CloudUploadOutlined,
  ExpandMoreOutlined,
  GroupsOutlined,
  InfoOutlined,
  InsertDriveFileOutlined,
  IosShareOutlined,
  PersonOutline,
  PhoneOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../../auth/AuthContext";
import { CmsFooter, CmsPage, CmsPageHeader, CmsScrollBody } from "../../../components/cms/CmsLayout";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";
import type { Setup } from "./types";

const today = new Date().toISOString().slice(0, 10);

const STEPS = [
  { key: "basic", label: "Basic Details" },
  { key: "guardian", label: "Parent/Guardian Details" },
  { key: "address", label: "Address & Additional" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

interface FormState {
  admissionNumber: string;
  admissionType: "REGULAR" | "TRANSFER";
  firstName: string;
  lastName: string;
  gender: string;
  admissionDate: string;
  dateOfBirth: string;
  classSectionId: string;
  rollNumber: string;
  categoryId: string;
  houseId: string;
  religion: string;
  caste: string;
  nationality: string;
  bloodGroup: string;
  height: string;
  weight: string;
  photoUrl: string;
  mobile: string;
  email: string;
  fatherName: string;
  fatherPhone: string;
  fatherEmail: string;
  fatherOccupation: string;
  motherName: string;
  motherPhone: string;
  motherEmail: string;
  motherOccupation: string;
  guardianName: string;
  guardianRelation: string;
  guardianPhone: string;
  guardianEmail: string;
  guardianOccupation: string;
  guardianDifferent: boolean;
  hasSibling: boolean;
  siblingName: string;
  siblingAdmissionNumber: string;
  currentAddress: string;
  permanentAddress: string;
  sameAsCurrent: boolean;
  state: string;
  postalCode: string;
  rteEnabled: boolean;
  rteSchemeName: string;
  rteCertificateNo: string;
  transportOptIn: boolean;
  transportRoute: string;
  hostelOptIn: boolean;
  hostelRoom: string;
  additionalNotes: string;
}

interface PendingDocument {
  id: string;
  name: string;
  sizeBytes: number;
}

const INITIAL_FORM: FormState = {
  admissionNumber: "",
  admissionType: "REGULAR",
  firstName: "",
  lastName: "",
  gender: "",
  admissionDate: today,
  dateOfBirth: "",
  classSectionId: "",
  rollNumber: "",
  categoryId: "",
  houseId: "",
  religion: "",
  caste: "",
  nationality: "",
  bloodGroup: "",
  height: "",
  weight: "",
  photoUrl: "",
  mobile: "",
  email: "",
  fatherName: "",
  fatherPhone: "",
  fatherEmail: "",
  fatherOccupation: "",
  motherName: "",
  motherPhone: "",
  motherEmail: "",
  motherOccupation: "",
  guardianName: "",
  guardianRelation: "",
  guardianPhone: "",
  guardianEmail: "",
  guardianOccupation: "",
  guardianDifferent: false,
  hasSibling: false,
  siblingName: "",
  siblingAdmissionNumber: "",
  currentAddress: "",
  permanentAddress: "",
  sameAsCurrent: false,
  state: "",
  postalCode: "",
  rteEnabled: false,
  rteSchemeName: "",
  rteCertificateNo: "",
  transportOptIn: false,
  transportRoute: "",
  hostelOptIn: false,
  hostelRoom: "",
  additionalNotes: "",
};

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="nx-label">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5">
      {label ? <span className="text-[12px] font-semibold text-slate-600">{label}</span> : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label || "Toggle"}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${
          checked ? "bg-indigo-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition ${
            checked ? "left-[18px]" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function AccordionSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-[13px] font-semibold text-slate-700"
      >
        {title}
        <ExpandMoreOutlined sx={{ fontSize: 18 }} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-slate-100 p-4">{children}</div>}
    </div>
  );
}

export function AddStudentPage() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [step, setStep] = useState<StepKey>("basic");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [busy, setBusy] = useState(false);
  const [openSection, setOpenSection] = useState<"transport" | "hostel" | "misc" | "">("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [documents, setDocuments] = useState<PendingDocument[]>([]);

  useEffect(() => {
    void apiRequest<Setup>("/students/setup", accessToken)
      .then(setSetup)
      .catch((cause) => notifyError(cause instanceof Error ? cause.message : "Unable to load setup"));
  }, [accessToken]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validateStep(target: StepKey) {
    if (target === "basic") {
      if (!form.firstName.trim()) return "First name is required";
      if (!form.lastName.trim()) return "Last name is required";
      if (!form.admissionDate) return "Admission date is required";
      if (!form.classSectionId) return "Section is required";
      if (!form.dateOfBirth) return "Date of birth is required";
      if (!form.gender) return "Gender is required";
      if (!form.mobile.trim()) return "Mobile number is required";
      if (!form.email.trim()) return "Email address is required";
    }
    return "";
  }

  function goNext() {
    const issue = validateStep(step);
    if (issue) {
      notifyError(issue);
      return;
    }
    const index = STEPS.findIndex((item) => item.key === step);
    if (index < STEPS.length - 1) setStep(STEPS[index + 1].key);
  }

  function goBack() {
    const index = STEPS.findIndex((item) => item.key === step);
    if (index > 0) setStep(STEPS[index - 1].key);
  }

  function handlePhotoFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notifyError("Please upload a JPG or PNG image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notifyError("Photo must be 5MB or smaller");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      setPhotoPreview(result);
      // Keep as data URL for preview; only send if it's a remote URL later
      update("photoUrl", result.startsWith("http") ? result : "");
    };
    reader.readAsDataURL(file);
  }

  function handleDocumentFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const next: PendingDocument[] = [];
    for (const file of Array.from(fileList)) {
      const okType =
        file.type === "application/pdf" ||
        file.type === "image/png" ||
        file.type === "image/jpeg" ||
        /\.(pdf|png|jpe?g)$/i.test(file.name);
      if (!okType) {
        notifyError("Documents must be PDF, PNG, or JPG");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        notifyError("Each document must be 10MB or smaller");
        return;
      }
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        sizeBytes: file.size,
      });
    }
    setDocuments((current) => {
      const seen = new Set(current.map((item) => item.id));
      return [...current, ...next.filter((item) => !seen.has(item.id))];
    });
  }

  function formatAddress(base: string) {
    const region = [form.state, form.postalCode].filter(Boolean).join(" ");
    return [base.trim(), region].filter(Boolean).join("\n") || undefined;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const issue = validateStep("basic");
    if (issue) {
      notifyError(issue);
      setStep("basic");
      return;
    }
    setBusy(true);
    try {
      const photoUrl =
        form.photoUrl && (form.photoUrl.startsWith("http://") || form.photoUrl.startsWith("https://"))
          ? form.photoUrl
          : undefined;
      const payload: Record<string, string | number | boolean | undefined> = {
        admissionNumber: form.admissionNumber || undefined,
        admissionType: form.admissionType,
        firstName: form.firstName,
        lastName: form.lastName || undefined,
        gender: form.gender || undefined,
        admissionDate: form.admissionDate,
        dateOfBirth: form.dateOfBirth || undefined,
        classSectionId: form.classSectionId,
        rollNumber: form.rollNumber || undefined,
        categoryId: form.categoryId || undefined,
        houseId: form.houseId || undefined,
        religion: form.religion || undefined,
        caste: form.caste || undefined,
        nationality: form.nationality || undefined,
        bloodGroup: form.bloodGroup || undefined,
        height: form.height ? Number(form.height) : undefined,
        weight: form.weight ? Number(form.weight) : undefined,
        photoUrl,
        mobile: form.mobile || undefined,
        email: form.email || undefined,
        fatherName: form.fatherName || undefined,
        fatherPhone: form.fatherPhone || undefined,
        fatherEmail: form.fatherEmail || undefined,
        fatherOccupation: form.fatherOccupation || undefined,
        motherName: form.motherName || undefined,
        motherPhone: form.motherPhone || undefined,
        motherEmail: form.motherEmail || undefined,
        motherOccupation: form.motherOccupation || undefined,
        guardianName: form.guardianDifferent ? form.guardianName || undefined : undefined,
        guardianRelation: form.guardianDifferent ? form.guardianRelation || undefined : undefined,
        guardianPhone: form.guardianDifferent ? form.guardianPhone || undefined : undefined,
        guardianEmail: form.guardianDifferent ? form.guardianEmail || undefined : undefined,
        guardianOccupation: form.guardianDifferent ? form.guardianOccupation || undefined : undefined,
        currentAddress: formatAddress(form.currentAddress),
        permanentAddress: formatAddress(
          form.sameAsCurrent ? form.currentAddress : form.permanentAddress,
        ),
        rteEnabled: form.rteEnabled,
        rteSchemeName: form.rteEnabled ? form.rteSchemeName || undefined : undefined,
        rteCertificateNo: form.rteEnabled ? form.rteCertificateNo || undefined : undefined,
        transportOptIn: form.transportOptIn,
        transportRoute: form.transportOptIn ? form.transportRoute || undefined : undefined,
        hostelOptIn: form.hostelOptIn,
        hostelRoom: form.hostelOptIn ? form.hostelRoom || undefined : undefined,
        additionalNotes: [
          form.additionalNotes,
          form.hasSibling && form.siblingName
            ? `Sibling: ${form.siblingName}${form.siblingAdmissionNumber ? ` (${form.siblingAdmissionNumber})` : ""}`
            : "",
          documents.length
            ? `Pending documents (attach after create): ${documents.map((d) => d.name).join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n") || undefined,
      };
      const created = await apiRequest<{
        id: string;
        credentials?: Array<{
          email: string;
          password: string;
          role: "STUDENT" | "PARENT";
          relation?: string | null;
          created: boolean;
        }>;
      }>("/students", accessToken, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      notifySuccess("Student added successfully");
      navigate(`/students/${created.id}`, {
        state: { justCreated: true, credentials: created.credentials ?? [] },
      });
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to add student");
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = STEPS.findIndex((item) => item.key === step);
  const previewSrc = photoPreview || (form.photoUrl.startsWith("http") ? form.photoUrl : "");

  return (
    <CmsPage>
      <CmsPageHeader
        title="Add new student"
        description="Enter student and parent details. Student and parent portal logins are created automatically."
        actions={
          <button
            type="button"
            className="nx-btn-secondary"
            onClick={() => navigate("/students", { state: { tab: "import" } })}
          >
            <IosShareOutlined sx={{ fontSize: 16 }} /> Import CSV
          </button>
        }
      />

      <CmsScrollBody>
      <form className="nx-card overflow-hidden" onSubmit={submit}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-[16px] font-bold text-slate-900">
              {step === "basic" && "Basic Details"}
              {step === "guardian" && "Parent/Guardian Details"}
              {step === "address" && "Address & Additional"}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              {step === "basic" && "Primary identification and academic information."}
              {step === "guardian" && "Father, mother, and guardian contact details."}
              {step === "address" && "RTE, documents, address, and additional options."}
            </p>
          </div>
          <span className="nx-pill nx-pill-indigo">STEP {stepIndex + 1} OF {STEPS.length}</span>
        </div>

        <div className="p-5">
          {step === "basic" && setup && (
            <div className="grid gap-x-5 gap-y-4 lg:grid-cols-3">
              {/* Left column */}
              <div className="space-y-4">
                <Field label="Admission No">
                  <input
                    className="nx-input bg-slate-50"
                    placeholder="Auto if blank"
                    value={form.admissionNumber}
                    onChange={(e) => update("admissionNumber", e.target.value)}
                  />
                </Field>
                <Field label="Roll No" required>
                  <input
                    className="nx-input"
                    placeholder="Enter roll number"
                    value={form.rollNumber}
                    onChange={(e) => update("rollNumber", e.target.value)}
                  />
                </Field>
                <Field label="First Name" required>
                  <input
                    className="nx-input"
                    placeholder="Enter first name"
                    value={form.firstName}
                    onChange={(e) => update("firstName", e.target.value)}
                  />
                </Field>
                <Field label="Gender" required>
                  <select className="nx-input" value={form.gender} onChange={(e) => update("gender", e.target.value)}>
                    <option value="">Select Gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>
                <Field label="Category" required>
                  <select className="nx-input" value={form.categoryId} onChange={(e) => update("categoryId", e.target.value)}>
                    <option value="">Select Category</option>
                    {setup.categories.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Blood Group">
                  <select className="nx-input" value={form.bloodGroup} onChange={(e) => update("bloodGroup", e.target.value)}>
                    <option value="">Select</option>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Mobile Number" required>
                  <input
                    className="nx-input"
                    placeholder="Mobile Number"
                    value={form.mobile}
                    onChange={(e) => update("mobile", e.target.value)}
                  />
                </Field>
              </div>

              {/* Middle column */}
              <div className="space-y-4">
                <div>
                  <span className="nx-label">Admission Type</span>
                  <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-slate-50 p-0.5">
                    {(["REGULAR", "TRANSFER"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => update("admissionType", type)}
                        className={`flex-1 rounded-md px-3 py-2 text-[13px] font-semibold transition ${
                          form.admissionType === type
                            ? "bg-indigo-100 text-indigo-700 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {type === "REGULAR" ? "Regular" : "Transfer"}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label="Section" required>
                  <select
                    className="nx-input"
                    value={form.classSectionId}
                    onChange={(e) => update("classSectionId", e.target.value)}
                  >
                    <option value="">Select Section</option>
                    {setup.classSections.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.academicClass.name} · {item.section.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Last Name" required>
                  <input
                    className="nx-input"
                    placeholder="Enter last name"
                    value={form.lastName}
                    onChange={(e) => update("lastName", e.target.value)}
                  />
                </Field>
                <Field label="Date of Birth" required>
                  <input
                    className="nx-input"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => update("dateOfBirth", e.target.value)}
                  />
                </Field>
                <Field label="Religion" required>
                  <input
                    className="nx-input"
                    placeholder="Religion"
                    value={form.religion}
                    onChange={(e) => update("religion", e.target.value)}
                  />
                </Field>
                <Field label="House">
                  <select className="nx-input" value={form.houseId} onChange={(e) => update("houseId", e.target.value)}>
                    <option value="">Blue, Red, Green...</option>
                    {setup.houses.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Email Address" required>
                  <input
                    className="nx-input"
                    type="email"
                    placeholder="Student login email (e.g. anwin7x@gmail.com)"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    This becomes the student portal login email.
                  </p>
                </Field>
              </div>

              {/* Right column */}
              <div className="space-y-4">
                <div>
                  <span className="nx-label">Photo</span>
                  <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-center">
                    {previewSrc ? (
                      <img src={previewSrc} alt="" className="mb-3 size-20 rounded-full object-cover" />
                    ) : (
                      <div className="mb-3 grid size-20 place-items-center rounded-full bg-slate-200 text-slate-400">
                        <PersonOutline sx={{ fontSize: 36 }} />
                      </div>
                    )}
                    <p className="text-[13px] font-semibold text-slate-700">Drop student photo here</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      JPG, PNG up to 5MB
                    </p>
                    <label className="nx-btn-secondary mt-3 cursor-pointer !px-3 !py-1.5 text-[12px]">
                      <CloudUploadOutlined sx={{ fontSize: 15 }} /> Upload Photo
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        className="hidden"
                        onChange={(e) => handlePhotoFile(e.target.files?.[0])}
                      />
                    </label>
                    <input
                      className="nx-input mt-3 text-[12px]"
                      placeholder="Or paste photo URL (https://…)"
                      value={form.photoUrl.startsWith("http") ? form.photoUrl : ""}
                      onChange={(e) => {
                        update("photoUrl", e.target.value);
                        setPhotoPreview("");
                      }}
                    />
                  </div>
                </div>
                <Field label="Caste">
                  <input
                    className="nx-input"
                    placeholder="Caste"
                    value={form.caste}
                    onChange={(e) => update("caste", e.target.value)}
                  />
                </Field>
                <Field label="Admission Date" required>
                  <input
                    className="nx-input"
                    type="date"
                    value={form.admissionDate}
                    onChange={(e) => update("admissionDate", e.target.value)}
                  />
                </Field>
                <Field label="Height (CM)">
                  <input
                    className="nx-input"
                    type="number"
                    min="0"
                    placeholder="150"
                    value={form.height}
                    onChange={(e) => update("height", e.target.value)}
                  />
                </Field>
                <Field label="Weight (KG)">
                  <input
                    className="nx-input"
                    type="number"
                    min="0"
                    placeholder="45"
                    value={form.weight}
                    onChange={(e) => update("weight", e.target.value)}
                  />
                </Field>
              </div>
            </div>
          )}
          {step === "basic" && !setup && (
            <p className="py-10 text-center text-sm text-slate-500">Loading setup…</p>
          )}

          {step === "guardian" && (
            <div className="space-y-5">
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Father */}
                <div className="space-y-3.5">
                  <h3 className="text-[13px] font-bold text-slate-800">Father Details</h3>
                  <Field label="Father Name">
                    <input
                      className="nx-input"
                      placeholder="Father name"
                      value={form.fatherName}
                      onChange={(e) => update("fatherName", e.target.value)}
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      className="nx-input"
                      placeholder="Phone"
                      value={form.fatherPhone}
                      onChange={(e) => update("fatherPhone", e.target.value)}
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      className="nx-input"
                      type="email"
                      placeholder="Parent login email"
                      value={form.fatherEmail}
                      onChange={(e) => update("fatherEmail", e.target.value)}
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Used for parent portal login (preferred). Mother/guardian email used if empty.
                    </p>
                  </Field>
                  <Field label="Occupation">
                    <input
                      className="nx-input"
                      placeholder="Occupation"
                      value={form.fatherOccupation}
                      onChange={(e) => update("fatherOccupation", e.target.value)}
                    />
                  </Field>
                </div>

                {/* Mother */}
                <div className="space-y-3.5">
                  <h3 className="text-[13px] font-bold text-slate-800">Mother Details</h3>
                  <Field label="Mother Name">
                    <input
                      className="nx-input"
                      placeholder="Mother name"
                      value={form.motherName}
                      onChange={(e) => update("motherName", e.target.value)}
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      className="nx-input"
                      placeholder="Phone"
                      value={form.motherPhone}
                      onChange={(e) => update("motherPhone", e.target.value)}
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      className="nx-input"
                      type="email"
                      placeholder="Email"
                      value={form.motherEmail}
                      onChange={(e) => update("motherEmail", e.target.value)}
                    />
                  </Field>
                  <Field label="Occupation">
                    <input
                      className="nx-input"
                      placeholder="Occupation"
                      value={form.motherOccupation}
                      onChange={(e) => update("motherOccupation", e.target.value)}
                    />
                  </Field>
                </div>

                {/* Guardian */}
                <div className={`space-y-3.5 ${form.guardianDifferent ? "" : "opacity-50"}`}>
                  <h3 className="text-[13px] font-bold text-slate-800">Guardian Details</h3>
                  <Field label="Guardian Name">
                    <input
                      className="nx-input"
                      placeholder="Guardian name"
                      disabled={!form.guardianDifferent}
                      value={form.guardianName}
                      onChange={(e) => update("guardianName", e.target.value)}
                    />
                  </Field>
                  <Field label="Phone">
                    <div className="relative">
                      <PhoneOutlined
                        sx={{ fontSize: 16 }}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        className="nx-input pl-9"
                        placeholder="Phone"
                        disabled={!form.guardianDifferent}
                        value={form.guardianPhone}
                        onChange={(e) => update("guardianPhone", e.target.value)}
                      />
                    </div>
                  </Field>
                  <Field label="Email">
                    <input
                      className="nx-input"
                      type="email"
                      placeholder="Email"
                      disabled={!form.guardianDifferent}
                      value={form.guardianEmail}
                      onChange={(e) => update("guardianEmail", e.target.value)}
                    />
                  </Field>
                  <Field label="Occupation">
                    <input
                      className="nx-input"
                      placeholder="Occupation"
                      disabled={!form.guardianDifferent}
                      value={form.guardianOccupation}
                      onChange={(e) => update("guardianOccupation", e.target.value)}
                    />
                  </Field>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <Toggle
                  label="Guardian is different person"
                  checked={form.guardianDifferent}
                  onChange={(value) => {
                    update("guardianDifferent", value);
                    if (!value) {
                      update("guardianName", "");
                      update("guardianPhone", "");
                      update("guardianEmail", "");
                      update("guardianOccupation", "");
                      update("guardianRelation", "");
                    } else {
                      update("guardianRelation", form.guardianRelation || "Guardian");
                    }
                  }}
                />
              </div>

              {/* Sibling Information */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                      <GroupsOutlined sx={{ fontSize: 22 }} />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-slate-800">Sibling Information</p>
                      <p className="text-[12px] text-slate-500">Link an existing sibling enrolment if any.</p>
                    </div>
                  </div>
                  <Toggle
                    label="HAS SIBLING?"
                    checked={form.hasSibling}
                    onChange={(value) => update("hasSibling", value)}
                  />
                </div>
                {form.hasSibling && (
                  <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-2">
                    <Field label="Sibling Name">
                      <input
                        className="nx-input"
                        placeholder="Sibling full name"
                        value={form.siblingName}
                        onChange={(e) => update("siblingName", e.target.value)}
                      />
                    </Field>
                    <Field label="Sibling Admission No">
                      <input
                        className="nx-input"
                        placeholder="Existing admission number"
                        value={form.siblingAdmissionNumber}
                        onChange={(e) => update("siblingAdmissionNumber", e.target.value)}
                      />
                    </Field>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "address" && (
            <div className="grid gap-5 lg:grid-cols-2">
              {/* RTE Details */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-bold text-slate-800">RTE Details</p>
                    <p className="mt-0.5 text-[12px] text-slate-500">Right to Education eligibility.</p>
                  </div>
                  <Toggle
                    checked={form.rteEnabled}
                    onChange={(value) => update("rteEnabled", value)}
                  />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label="Scheme Name">
                    <input
                      className="nx-input"
                      placeholder="Enter scheme"
                      value={form.rteSchemeName}
                      onChange={(e) => update("rteSchemeName", e.target.value)}
                    />
                  </Field>
                  <Field label="Certificate Number">
                    <input
                      className="nx-input"
                      placeholder="Enter number"
                      value={form.rteCertificateNo}
                      onChange={(e) => update("rteCertificateNo", e.target.value)}
                    />
                  </Field>
                </div>
                <div className="mt-4 flex gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2.5 text-[12px] text-sky-800">
                  <InfoOutlined sx={{ fontSize: 16 }} className="mt-0.5 shrink-0 text-sky-600" />
                  <span>Ensure valid documentation is uploaded for RTE verified status.</span>
                </div>
              </div>

              {/* Document Upload */}
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-[13px] font-bold text-slate-800">Document Upload</p>
                <p className="mt-0.5 text-[12px] text-slate-500">Upload mandatory identification files.</p>
                <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40">
                  <input
                    type="file"
                    className="sr-only"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                    onChange={(e) => {
                      handleDocumentFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <div className="grid size-11 place-items-center rounded-full bg-indigo-50 text-indigo-600">
                    <CloudUploadOutlined sx={{ fontSize: 22 }} />
                  </div>
                  <p className="mt-3 text-[13px] font-semibold text-slate-700">
                    Click to upload or drag &amp; drop
                  </p>
                  <p className="mt-1 text-[11.5px] text-slate-500">PDF, PNG, JPG (Max 10MB)</p>
                </label>
                {documents.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {documents.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <InsertDriveFileOutlined sx={{ fontSize: 18 }} className="shrink-0 text-indigo-500" />
                          <span className="truncate text-[12.5px] font-medium text-slate-700">{doc.name}</span>
                        </div>
                        <button
                          type="button"
                          className="grid size-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Remove ${doc.name}`}
                          onClick={() => setDocuments((current) => current.filter((item) => item.id !== doc.id))}
                        >
                          <CloseOutlined sx={{ fontSize: 16 }} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Address Details */}
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-[13px] font-bold text-slate-800">Address Details</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px]">
                  <Field label="Current Address">
                    <textarea
                      className="nx-input min-h-[96px] resize-y"
                      placeholder="Enter current address…"
                      value={form.currentAddress}
                      onChange={(e) => update("currentAddress", e.target.value)}
                    />
                  </Field>
                  <div className="space-y-3">
                    <Field label="State & Postal Code">
                      <input
                        className="nx-input"
                        placeholder="State"
                        value={form.state}
                        onChange={(e) => update("state", e.target.value)}
                      />
                    </Field>
                    <input
                      className="nx-input"
                      placeholder="Postal code"
                      value={form.postalCode}
                      onChange={(e) => update("postalCode", e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="nx-label !mb-0">Permanent Address</span>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] font-medium text-slate-600">
                      <input
                        type="checkbox"
                        className="size-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        checked={form.sameAsCurrent}
                        onChange={(e) => update("sameAsCurrent", e.target.checked)}
                      />
                      Same as current
                    </label>
                  </div>
                  <textarea
                    className="nx-input min-h-[96px] resize-y"
                    placeholder="Enter permanent address…"
                    disabled={form.sameAsCurrent}
                    value={form.sameAsCurrent ? form.currentAddress : form.permanentAddress}
                    onChange={(e) => update("permanentAddress", e.target.value)}
                  />
                </div>
              </div>

              {/* Additional Information */}
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-[13px] font-bold text-slate-800">Additional Information</p>
                <div className="mt-4 space-y-2.5">
                  <AccordionSection
                    title="Transport"
                    open={openSection === "transport"}
                    onToggle={() => setOpenSection((current) => (current === "transport" ? "" : "transport"))}
                  >
                    <label className="mb-3 flex items-center gap-2 text-[13px] font-medium text-slate-600">
                      <input
                        type="checkbox"
                        className="size-3.5 rounded border-slate-300 text-indigo-600"
                        checked={form.transportOptIn}
                        onChange={(e) => update("transportOptIn", e.target.checked)}
                      />
                      Student uses school transport
                    </label>
                    {form.transportOptIn && (
                      <Field label="Route">
                        <input
                          className="nx-input"
                          placeholder="e.g. Route #14"
                          value={form.transportRoute}
                          onChange={(e) => update("transportRoute", e.target.value)}
                        />
                      </Field>
                    )}
                  </AccordionSection>
                  <AccordionSection
                    title="Hostel"
                    open={openSection === "hostel"}
                    onToggle={() => setOpenSection((current) => (current === "hostel" ? "" : "hostel"))}
                  >
                    <label className="mb-3 flex items-center gap-2 text-[13px] font-medium text-slate-600">
                      <input
                        type="checkbox"
                        className="size-3.5 rounded border-slate-300 text-indigo-600"
                        checked={form.hostelOptIn}
                        onChange={(e) => update("hostelOptIn", e.target.checked)}
                      />
                      Student resides in hostel
                    </label>
                    {form.hostelOptIn && (
                      <Field label="Room">
                        <input
                          className="nx-input"
                          placeholder="e.g. Block A - 204"
                          value={form.hostelRoom}
                          onChange={(e) => update("hostelRoom", e.target.value)}
                        />
                      </Field>
                    )}
                  </AccordionSection>
                  <AccordionSection
                    title="Miscellaneous"
                    open={openSection === "misc"}
                    onToggle={() => setOpenSection((current) => (current === "misc" ? "" : "misc"))}
                  >
                    <Field label="Notes">
                      <textarea
                        className="nx-input min-h-[80px]"
                        placeholder="Any other information…"
                        value={form.additionalNotes}
                        onChange={(e) => update("additionalNotes", e.target.value)}
                      />
                    </Field>
                  </AccordionSection>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          {stepIndex === 0 ? (
            <button className="nx-btn-secondary" type="button" onClick={() => navigate("/students")}>
              Cancel
            </button>
          ) : (
            <button className="nx-btn-secondary" type="button" onClick={goBack}>
              Back
            </button>
          )}
          {step === "address" ? (
            <button className="nx-btn-primary" type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create"}
            </button>
          ) : (
            <button className="nx-btn-primary" type="button" onClick={goNext}>
              Next →
            </button>
          )}
        </div>
      </form>
      </CmsScrollBody>

      <CmsFooter />
    </CmsPage>
  );
}
