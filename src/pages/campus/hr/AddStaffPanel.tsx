import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  ArrowBackOutlined,
  CloudUploadOutlined,
  ContentCopyOutlined,
  DeleteOutline,
  KeyOutlined,
} from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import { FieldError as FormFieldError } from "../../../components/forms/Field";
import {
  applyApiFieldErrors,
  clearFieldError,
  type FieldErrors,
  validateEmail,
  validateRequired,
} from "../../../lib/formErrors";
import { notifyInfo, notifySuccess } from "../../../lib/notify";
import type { HrSetup } from "./types";

const DRAFT_KEY = "hr-add-staff-draft";
const today = new Date().toISOString().slice(0, 10);

const ROLE_OPTIONS = [
  ["TEACHER", "Teacher"],
  ["ACCOUNTANT", "Accountant"],
  ["STAFF", "Office Staff"],
  ["INSTITUTION_ADMIN", "Institution Admin"],
] as const;

const DOC_SLOTS = ["Resume", "Joining Letter", "Other Documents"] as const;

interface FormState {
  employeeNumber: string;
  roleCode: string;
  designationId: string;
  departmentId: string;
  firstName: string;
  lastName: string;
  gender: string;
  maritalStatus: string;
  dateOfBirth: string;
  joiningDate: string;
  phone: string;
  emergencyContact: string;
  email: string;
  epfNumber: string;
  basicSalary: string;
  contractType: string;
  workShift: string;
  workLocation: string;
  leaveAllowance: string;
  bankAccountTitle: string;
  bankAccountNumber: string;
  bankName: string;
  bankIfsc: string;
  bankBranch: string;
  address: string;
  permanentAddress: string;
  sameAsCurrent: boolean;
}

interface PayRow {
  name: string;
  type: "EARNING" | "DEDUCTION";
  amount: string;
}

interface FilePayload {
  name: string;
  dataUrl: string;
}

const emptyForm: FormState = {
  employeeNumber: "",
  roleCode: "",
  designationId: "",
  departmentId: "",
  firstName: "",
  lastName: "",
  gender: "",
  maritalStatus: "",
  dateOfBirth: "",
  joiningDate: today,
  phone: "",
  emergencyContact: "",
  email: "",
  epfNumber: "",
  basicSalary: "",
  contractType: "",
  workShift: "",
  workLocation: "",
  leaveAllowance: "",
  bankAccountTitle: "",
  bankAccountNumber: "",
  bankName: "",
  bankIfsc: "",
  bankBranch: "",
  address: "",
  permanentAddress: "",
  sameAsCurrent: false,
};

const defaultPayRows: PayRow[] = [
  { name: "House Rent Allowance", type: "EARNING", amount: "0" },
  { name: "Conveyance Allowance", type: "EARNING", amount: "0" },
  { name: "Provident Fund", type: "DEDUCTION", amount: "0" },
  { name: "Professional Tax", type: "DEDUCTION", amount: "0" },
  { name: "Income Tax", type: "DEDUCTION", amount: "0" },
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}

export function AddStaffPanel({
  setup,
  token,
  onCancel,
  onSaved,
  onError,
}: {
  setup: HrSetup;
  token: string;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [form, setForm] = useState<FormState>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) return { ...emptyForm, ...(JSON.parse(raw) as Partial<FormState>) };
    } catch {
      // Ignore corrupt drafts.
    }
    return emptyForm;
  });
  const [payRows, setPayRows] = useState<PayRow[]>(() => {
    const params = (setup.payParameters ?? []).filter(
      (item) => item.name.trim().toLowerCase() !== "basic salary",
    );
    if (params.length) {
      return params.map((item) => ({
        name: item.name,
        type: item.type,
        amount: String(Number(item.defaultAmount)),
      }));
    }
    return defaultPayRows;
  });
  const [photo, setPhoto] = useState<FilePayload | null>(null);
  const [docs, setDocs] = useState<Record<string, FilePayload>>({});
  const [draftSaved, setDraftSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(
    null,
  );
  const photoInputRef = useRef<HTMLInputElement>(null);

  const numbering = setup.staffNumbering;
  const autoId = numbering?.auto ?? false;
  const previewId = autoId ? `${numbering?.prefix ?? "STF-"}${numbering?.next ?? 1}` : "";

  useEffect(() => {
    const basicParam = (setup.payParameters ?? []).find(
      (item) => item.name.trim().toLowerCase() === "basic salary",
    );
    if (basicParam) {
      setForm((current) =>
        current.basicSalary
          ? current
          : { ...current, basicSalary: String(Number(basicParam.defaultAmount)) },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
        setDraftSaved(true);
      } catch {
        // Storage full — skip draft.
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [form]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setFieldErrors((prev) => clearFieldError(prev, key));
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onPickPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/image\/(png|jpe?g)/i.test(file.type)) {
      onError("Photo must be a PNG or JPG image");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      onError("Photo must be 2MB or smaller");
      return;
    }
    try {
      setPhoto({ name: file.name, dataUrl: await readFileAsDataUrl(file) });
    } catch {
      onError("Unable to read the selected photo");
    }
  }

  async function onPickDoc(label: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      onError("Documents must be 5MB or smaller");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setDocs((current) => ({ ...current, [label]: { name: file.name, dataUrl } }));
    } catch {
      onError("Unable to read the selected document");
    }
  }

  const totals = useMemo(() => {
    const basic = Number(form.basicSalary) || 0;
    let earnings = basic;
    let deductions = 0;
    for (const row of payRows) {
      const amount = Number(row.amount) || 0;
      if (row.type === "EARNING") earnings += amount;
      else deductions += amount;
    }
    return { earnings, deductions, net: earnings - deductions };
  }, [form.basicSalary, payRows]);

  async function save() {
    const emailErr = validateEmail(form.email);
    const next = validateRequired(
      {
        firstName: form.firstName,
        roleCode: form.roleCode,
        designationId: form.designationId,
        employeeNumber: autoId ? "ok" : form.employeeNumber,
      },
      [
        { key: "firstName", label: "First name" },
        { key: "roleCode", label: "Role" },
        { key: "designationId", label: "Designation" },
        ...(autoId ? [] : [{ key: "employeeNumber", label: "Staff ID" as const }]),
      ],
    );
    if (emailErr) next.email = emailErr;
    setFieldErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const created = await apiRequest<{
        tempPassword?: string | null;
        user: { email: string };
      }>("/hr/staff", token, {
        method: "POST",
        body: JSON.stringify({
          newUser: {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim(),
            roleCode: form.roleCode,
          },
          employeeNumber: autoId ? undefined : form.employeeNumber.trim(),
          departmentId: form.departmentId || null,
          designationId: form.designationId || null,
          joiningDate: form.joiningDate || today,
          dateOfBirth: form.dateOfBirth || null,
          phone: form.phone || null,
          emergencyContact: form.emergencyContact || null,
          gender: form.gender || null,
          maritalStatus: form.maritalStatus || null,
          epfNumber: form.epfNumber || null,
          basicSalary: Number(form.basicSalary) || 0,
          contractType: form.contractType || null,
          workShift: form.workShift || null,
          workLocation: form.workLocation || null,
          leaveAllowance: form.leaveAllowance ? Number(form.leaveAllowance) : null,
          bankAccountTitle: form.bankAccountTitle || null,
          bankAccountNumber: form.bankAccountNumber || null,
          bankName: form.bankName || null,
          bankIfsc: form.bankIfsc || null,
          bankBranch: form.bankBranch || null,
          address: form.address || null,
          permanentAddress: form.sameAsCurrent
            ? form.address || null
            : form.permanentAddress || null,
          photoUrl: photo?.dataUrl ?? null,
          documents: Object.entries(docs).map(([label, file]) => ({
            label,
            name: file.name,
            dataUrl: file.dataUrl,
          })),
          adjustments: payRows
            .filter((row) => (Number(row.amount) || 0) > 0)
            .map((row) => ({
              name: row.name,
              type: row.type,
              amount: Number(row.amount),
              isRecurring: true,
            })),
        }),
      });
      localStorage.removeItem(DRAFT_KEY);
      notifySuccess("Staff record created");
      if (created.tempPassword) {
        // Show the login credentials once before returning to the list.
        setCredentials({ email: created.user.email, password: created.tempPassword });
      } else {
        await onSaved();
      }
    } catch (cause) {
      if (!applyApiFieldErrors(cause, setFieldErrors)) {
        onError(cause instanceof Error ? cause.message : "Unable to save staff");
      }
    } finally {
      setBusy(false);
    }
  }

  const saveButton = (
    <button type="button" className="nx-btn-primary" disabled={busy} onClick={() => void save()}>
      {busy ? "Saving…" : "Save staff"}
    </button>
  );

  return (
    <section className="mt-1">
      <p className="text-[11.5px] text-slate-400">
        Dashboard / HR / Staff List / <span className="font-semibold text-indigo-600">Add Staff</span>
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            className="mt-0.5 grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            title="Back to staff list"
            onClick={onCancel}
          >
            <ArrowBackOutlined sx={{ fontSize: 18 }} />
          </button>
          <div>
            <h2 className="text-[20px] font-bold text-slate-900">Add new staff</h2>
            <p className="text-[12.5px] text-slate-500">
              Enter staff details to create a new record.
            </p>
          </div>
        </div>
        {saveButton}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <SectionCard title="Basic details">
            <FieldGrid>
              <Field label="Staff ID" error={fieldErrors.employeeNumber}>
                <input
                  className={`nx-input w-full${fieldErrors.employeeNumber ? " is-invalid" : ""}`}
                  value={autoId ? previewId : form.employeeNumber}
                  disabled={autoId}
                  placeholder={autoId ? previewId : "Enter staff ID"}
                  onChange={(e) => set("employeeNumber", e.target.value)}
                />
              </Field>
              <Field label="Role" error={fieldErrors.roleCode}>
                <select
                  className={`nx-input w-full${fieldErrors.roleCode ? " is-invalid" : ""}`}
                  value={form.roleCode}
                  onChange={(e) => set("roleCode", e.target.value)}
                >
                  <option value="">Select role</option>
                  {ROLE_OPTIONS.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Designation" error={fieldErrors.designationId}>
                <select
                  className={`nx-input w-full${fieldErrors.designationId ? " is-invalid" : ""}`}
                  value={form.designationId}
                  onChange={(e) => set("designationId", e.target.value)}
                >
                  <option value="">Select designation</option>
                  {setup.designations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Department">
                <select
                  className="nx-input w-full"
                  value={form.departmentId}
                  onChange={(e) => set("departmentId", e.target.value)}
                >
                  <option value="">Select department</option>
                  {setup.departments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="First Name" error={fieldErrors.firstName}>
                <input
                  className={`nx-input w-full${fieldErrors.firstName ? " is-invalid" : ""}`}
                  placeholder="Enter first name"
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                />
              </Field>
              <Field label="Last Name">
                <input
                  className="nx-input w-full"
                  placeholder="Enter last name"
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                />
              </Field>
              <Field label="Gender">
                <select
                  className="nx-input w-full"
                  value={form.gender}
                  onChange={(e) => set("gender", e.target.value)}
                >
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Marital Status">
                <select
                  className="nx-input w-full"
                  value={form.maritalStatus}
                  onChange={(e) => set("maritalStatus", e.target.value)}
                >
                  <option value="">Select status</option>
                  <option value="SINGLE">Single</option>
                  <option value="MARRIED">Married</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Date of Birth">
                <input
                  className="nx-input w-full"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => set("dateOfBirth", e.target.value)}
                />
              </Field>
              <Field label="Date of Joining">
                <input
                  className="nx-input w-full"
                  type="date"
                  value={form.joiningDate}
                  onChange={(e) => set("joiningDate", e.target.value)}
                />
              </Field>
              <Field label="Phone">
                <input
                  className="nx-input w-full"
                  placeholder="Enter phone number"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </Field>
              <Field label="Emergency Contact">
                <input
                  className="nx-input w-full"
                  placeholder="Enter emergency contact"
                  value={form.emergencyContact}
                  onChange={(e) => set("emergencyContact", e.target.value)}
                />
              </Field>
              <Field label="Email" error={fieldErrors.email}>
                <input
                  className={`nx-input w-full${fieldErrors.email ? " is-invalid" : ""}`}
                  type="email"
                  placeholder="Enter email address"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
            </FieldGrid>
          </SectionCard>

          <SectionCard title="Employment details">
            <FieldGrid>
              <Field label="EPF No">
                <input
                  className="nx-input w-full"
                  placeholder="Enter EPF number"
                  value={form.epfNumber}
                  onChange={(e) => set("epfNumber", e.target.value)}
                />
              </Field>
              <Field label="Basic Salary">
                <input
                  className="nx-input w-full"
                  type="number"
                  min="0"
                  placeholder="Enter basic salary"
                  value={form.basicSalary}
                  onChange={(e) => set("basicSalary", e.target.value)}
                />
              </Field>
              <Field label="Contract Type">
                <select
                  className="nx-input w-full"
                  value={form.contractType}
                  onChange={(e) => set("contractType", e.target.value)}
                >
                  <option value="">Select contract type</option>
                  <option value="PERMANENT">Permanent</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="PROBATION">Probation</option>
                  <option value="PART_TIME">Part-time</option>
                </select>
              </Field>
              <Field label="Work Shift">
                <select
                  className="nx-input w-full"
                  value={form.workShift}
                  onChange={(e) => set("workShift", e.target.value)}
                >
                  <option value="">Select work shift</option>
                  <option value="MORNING">Morning</option>
                  <option value="DAY">Day</option>
                  <option value="EVENING">Evening</option>
                  <option value="NIGHT">Night</option>
                </select>
              </Field>
              <Field label="Location">
                <input
                  className="nx-input w-full"
                  placeholder="Enter location"
                  value={form.workLocation}
                  onChange={(e) => set("workLocation", e.target.value)}
                />
              </Field>
              <Field label="Number of Leaves" hint="Leave types must exist first — configure in HR > Setup">
                <input
                  className="nx-input w-full"
                  type="number"
                  min="0"
                  placeholder="Enter number of leaves"
                  value={form.leaveAllowance}
                  onChange={(e) => set("leaveAllowance", e.target.value)}
                />
              </Field>
            </FieldGrid>
          </SectionCard>

          <SectionCard title="Bank details">
            <FieldGrid>
              <Field label="Account Title">
                <input
                  className="nx-input w-full"
                  placeholder="Enter account title"
                  value={form.bankAccountTitle}
                  onChange={(e) => set("bankAccountTitle", e.target.value)}
                />
              </Field>
              <Field label="Account Number">
                <input
                  className="nx-input w-full"
                  placeholder="Enter account number"
                  value={form.bankAccountNumber}
                  onChange={(e) => set("bankAccountNumber", e.target.value)}
                />
              </Field>
              <Field label="Bank Name">
                <input
                  className="nx-input w-full"
                  placeholder="Enter bank name"
                  value={form.bankName}
                  onChange={(e) => set("bankName", e.target.value)}
                />
              </Field>
              <Field label="IFSC Code">
                <input
                  className="nx-input w-full"
                  placeholder="Enter IFSC code"
                  value={form.bankIfsc}
                  onChange={(e) => set("bankIfsc", e.target.value)}
                />
              </Field>
              <Field label="Branch Name">
                <input
                  className="nx-input w-full"
                  placeholder="Enter branch name"
                  value={form.bankBranch}
                  onChange={(e) => set("bankBranch", e.target.value)}
                />
              </Field>
            </FieldGrid>
          </SectionCard>

          <SectionCard title="Address">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="nx-label">Current Address</span>
                <textarea
                  className="nx-input mt-1 w-full"
                  rows={3}
                  placeholder="Enter current address"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                />
              </label>
              <label className="block">
                <span className="nx-label">Permanent Address</span>
                <textarea
                  className="nx-input mt-1 w-full disabled:bg-slate-100"
                  rows={3}
                  placeholder="Enter permanent address"
                  value={form.sameAsCurrent ? form.address : form.permanentAddress}
                  disabled={form.sameAsCurrent}
                  onChange={(e) => set("permanentAddress", e.target.value)}
                />
              </label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-[13px] text-slate-600">
              <input
                type="checkbox"
                checked={form.sameAsCurrent}
                onChange={(e) => set("sameAsCurrent", e.target.checked)}
              />
              Same as current
            </label>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Photo upload">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => void onPickPhoto(e)}
            />
            {photo ? (
              <div className="flex items-center gap-3">
                <img
                  src={photo.dataUrl}
                  alt="Staff"
                  className="size-16 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-slate-700">
                    {photo.name}
                  </p>
                  <button
                    type="button"
                    className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-rose-500 hover:underline"
                    onClick={() => setPhoto(null)}
                  >
                    <DeleteOutline sx={{ fontSize: 14 }} /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 px-4 py-8 transition hover:bg-indigo-50"
                onClick={() => photoInputRef.current?.click()}
              >
                <CloudUploadOutlined className="text-indigo-500" sx={{ fontSize: 28 }} />
                <span className="text-[13px] font-semibold text-indigo-600">Upload photo</span>
                <span className="text-[11.5px] text-slate-400">PNG or JPG, max 2MB</span>
              </button>
            )}
          </SectionCard>

          <SectionCard
            title="Earning & deduction (Optional)"
            subtitle="Auto-populated from HR > Setup parameters — adjust per staff if needed."
          >
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
                  <th className="py-2 text-left">Parameter</th>
                  <th className="py-2 text-left">Type</th>
                  <th className="py-2 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <tr>
                  <td className="py-2 text-slate-600">Basic Salary</td>
                  <td className="py-2 text-slate-400">Earning</td>
                  <td className="py-2 text-right">
                    <input
                      className="nx-input w-24 !px-2 !py-1 text-right"
                      type="number"
                      min="0"
                      value={form.basicSalary}
                      onChange={(e) => set("basicSalary", e.target.value)}
                    />
                  </td>
                </tr>
                {payRows.map((row, index) => (
                  <tr key={row.name}>
                    <td className="py-2 text-slate-600">{row.name}</td>
                    <td className="py-2 text-slate-400">
                      {row.type === "EARNING" ? "Earning" : "Deduction"}
                    </td>
                    <td className="py-2 text-right">
                      <input
                        className="nx-input w-24 !px-2 !py-1 text-right"
                        type="number"
                        min="0"
                        value={row.amount}
                        onChange={(e) =>
                          setPayRows((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, amount: e.target.value } : item,
                            ),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[12.5px]">
              <span className="text-slate-500">Estimated net monthly</span>
              <strong className="text-slate-900">₹{totals.net.toLocaleString()}</strong>
            </div>
          </SectionCard>

          <SectionCard title="Documents" subtitle="PDF, DOC, DOCX, JPG (max 5MB each).">
            <div className="space-y-3">
              {DOC_SLOTS.map((label) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-medium text-slate-600">{label}</span>
                  {docs[label] ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="max-w-36 truncate text-[12px] text-slate-500">
                        {docs[label].name}
                      </span>
                      <button
                        type="button"
                        className="text-rose-500 hover:text-rose-600"
                        title="Remove"
                        onClick={() =>
                          setDocs((current) => {
                            const next = { ...current };
                            delete next[label];
                            return next;
                          })
                        }
                      >
                        <DeleteOutline sx={{ fontSize: 16 }} />
                      </button>
                    </span>
                  ) : (
                    <label className="nx-btn-secondary cursor-pointer !px-3 !py-1.5 text-[12px]">
                      Choose file
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={(e) => void onPickDoc(label, e)}
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="nx-card mt-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-[12.5px] text-slate-500">
          <span
            className={`size-2 rounded-full ${draftSaved ? "bg-emerald-500" : "bg-slate-300"}`}
          />
          {draftSaved ? "Draft auto-saved" : "Draft not saved yet"}
        </span>
        <div className="flex gap-2">
          <button type="button" className="nx-btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          {saveButton}
        </div>
      </div>

      {credentials ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <KeyOutlined sx={{ fontSize: 20 }} />
              </span>
              <div>
                <h3 className="text-[16px] font-bold text-slate-900">Staff login credentials</h3>
                <p className="text-[12px] text-slate-500">
                  Shown only once — share them securely with the staff member.
                </p>
              </div>
            </div>
            <div className="space-y-3 px-5 py-4">
              {(
                [
                  ["Email", credentials.email],
                  ["Temporary password", credentials.password],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    {label}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <span className="min-w-0 truncate font-mono text-[13.5px] text-slate-800">
                      {value}
                    </span>
                    <button
                      type="button"
                      title={`Copy ${label.toLowerCase()}`}
                      className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-600"
                      onClick={() => {
                        void navigator.clipboard.writeText(value);
                        notifyInfo(`${label} copied`);
                      }}
                    >
                      <ContentCopyOutlined sx={{ fontSize: 15 }} />
                    </button>
                  </div>
                </div>
              ))}
              <p className="rounded-lg bg-indigo-50 px-3 py-2 text-[12px] text-indigo-700">
                The staff member can sign in with these credentials and change the password from
                their profile page. If email delivery is configured, the credentials were also
                sent to their inbox.
              </p>
            </div>
            <div className="flex justify-end border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                className="nx-btn-primary"
                onClick={() => {
                  setCredentials(null);
                  void onSaved();
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="nx-card p-5">
      <h3 className="text-[13.5px] font-bold text-slate-900">{title}</h3>
      {subtitle ? <p className="mt-0.5 text-[12px] text-slate-500">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function FieldGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-2">
      <span className="text-[12.5px] font-medium text-slate-500">{label}</span>
      <div className="min-w-0">
        {children}
        {error ? (
          <FormFieldError error={error} />
        ) : hint ? (
          <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
