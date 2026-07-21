import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { applyBrandingToDocument, parseBranding } from "../../lib/branding";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

interface AdmissionForm {
  tenant: {
    name: string;
    slug: string;
    branding: Record<string, unknown> | null;
  };
  currentSession: { id: string; name: string } | null;
  classSections: Array<{ id: string; label: string }>;
  customFields: Array<{
    key: string;
    label: string;
    type: string;
    isRequired: boolean;
    options: unknown;
  }>;
}

export function OnlineAdmissionPage() {
  const { tenantSlug = "" } = useParams();
  const [form, setForm] = useState<AdmissionForm | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState({
    firstName: "",
    lastName: "",
    gender: "",
    dateOfBirth: "",
    mobile: "",
    email: "",
    fatherName: "",
    motherName: "",
    guardianPhone: "",
    currentAddress: "",
    classSectionId: "",
  });
  const [custom, setCustom] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!tenantSlug) return;
    fetch(`${API_URL}/public/tenants/${encodeURIComponent(tenantSlug)}/admission`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error?.message ?? "Unable to load admission form");
        return payload.data as AdmissionForm;
      })
      .then((data) => {
        setForm(data);
        applyBrandingToDocument(parseBranding(data.tenant.branding));
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load form"));
  }, [tenantSlug]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!tenantSlug) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/public/tenants/${encodeURIComponent(tenantSlug)}/admission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          gender: values.gender || null,
          dateOfBirth: values.dateOfBirth || null,
          classSectionId: values.classSectionId || null,
          payload: custom,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? "Unable to submit application");
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit application");
    } finally {
      setSubmitting(false);
    }
  }

  const branding = parseBranding(form?.tenant.branding);

  if (error && !form) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 px-6">
        <p className="alert-error max-w-lg">{error}</p>
      </main>
    );
  }

  if (!form) {
    return <main className="grid min-h-screen place-items-center text-sm text-slate-500">Loading admission form…</main>;
  }

  if (done) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 px-6">
        <div className="card max-w-lg p-8 text-center">
          <h1 className="text-2xl font-semibold">Application submitted</h1>
          <p className="mt-3 text-sm text-slate-600">
            Thank you. {form.tenant.name} will review your online admission application.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <p className="text-sm font-semibold" style={{ color: branding.primaryColor }}>{branding.logoText || form.tenant.name}</p>
          <h1 className="mt-2 text-3xl font-semibold">Online admission</h1>
          <p className="mt-2 text-sm text-slate-600">
            {form.currentSession ? `Applying for ${form.currentSession.name}` : "Submit your application for review."}
          </p>
        </div>
        {error && <p className="alert-error mb-4">{error}</p>}
        <form className="card space-y-4 p-6" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">First name<input className="input mt-1" required value={values.firstName} onChange={(e) => setValues({ ...values, firstName: e.target.value })} /></label>
            <label className="text-sm">Last name<input className="input mt-1" value={values.lastName} onChange={(e) => setValues({ ...values, lastName: e.target.value })} /></label>
            <label className="text-sm">Gender
              <select className="input mt-1" value={values.gender} onChange={(e) => setValues({ ...values, gender: e.target.value })}>
                <option value="">Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="text-sm">Date of birth<input className="input mt-1" type="date" value={values.dateOfBirth} onChange={(e) => setValues({ ...values, dateOfBirth: e.target.value })} /></label>
            <label className="text-sm">Mobile<input className="input mt-1" value={values.mobile} onChange={(e) => setValues({ ...values, mobile: e.target.value })} /></label>
            <label className="text-sm">Email<input className="input mt-1" type="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} /></label>
            <label className="text-sm">Father name<input className="input mt-1" value={values.fatherName} onChange={(e) => setValues({ ...values, fatherName: e.target.value })} /></label>
            <label className="text-sm">Mother name<input className="input mt-1" value={values.motherName} onChange={(e) => setValues({ ...values, motherName: e.target.value })} /></label>
            <label className="text-sm">Guardian phone<input className="input mt-1" value={values.guardianPhone} onChange={(e) => setValues({ ...values, guardianPhone: e.target.value })} /></label>
            <label className="text-sm">Preferred class
              <select className="input mt-1" value={values.classSectionId} onChange={(e) => setValues({ ...values, classSectionId: e.target.value })}>
                <option value="">Select class</option>
                {form.classSections.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
          </div>
          <label className="block text-sm">Address<textarea className="input mt-1" rows={3} value={values.currentAddress} onChange={(e) => setValues({ ...values, currentAddress: e.target.value })} /></label>
          {form.customFields.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {form.customFields.map((field) => (
                <label key={field.key} className="text-sm">
                  {field.label}{field.isRequired ? " *" : ""}
                  <input
                    className="input mt-1"
                    required={field.isRequired}
                    value={custom[field.key] ?? ""}
                    onChange={(e) => setCustom({ ...custom, [field.key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
          )}
          <button className="button-primary" type="submit" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit application"}
          </button>
        </form>
      </div>
    </main>
  );
}
