import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";

interface PrintDocument {
  serialNumber: string;
  barcodeValue: string | null;
  generatedAt: string;
  tenant: { name: string; branding: Record<string, unknown> | null };
  template: {
    type: "ADMIT_CARD" | "MARKSHEET" | "CERTIFICATE" | "ID_CARD";
    name: string;
    width: number;
    height: number;
    backgroundUrl: string | null;
    config: Record<string, unknown>;
  };
  student: {
    firstName: string;
    lastName: string | null;
    admissionNumber: string;
    photoUrl: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
  } | null;
  staff: {
    employeeNumber: string;
    user: { firstName: string; lastName: string };
    department: { name: string } | null;
    designation: { name: string } | null;
  } | null;
  exam: { name: string; examGroup: { name: string } } | null;
  payload: {
    student?: {
      enrollments?: Array<{
        academicSession: { name: string };
        classSection: { academicClass: { name: string }; section: { name: string } };
      }>;
    };
    result?: {
      rank?: number;
      percentage?: number;
      grade?: string | null;
      passStatus?: string;
      marks: Array<{
        marksObtained: string;
        isAbsent: boolean;
        schedule: {
          maximumMarks: string;
          minimumMarks: string;
          classSubject: { subject: { name: string } };
        };
      }>;
    } | null;
    custom?: Record<string, unknown>;
  };
}

export function DocumentPrintPage() {
  const { id } = useParams();
  const { accessToken, isAuthenticated } = useAuth();
  const [document, setDocument] = useState<PrintDocument | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!id || !isAuthenticated) return;
    apiRequest<PrintDocument>(`/documents/generated/${id}`, accessToken)
      .then(setDocument)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load document"));
  }, [id, accessToken, isAuthenticated]);
  const person = document?.student
    ? `${document.student.firstName} ${document.student.lastName ?? ""}`
    : document?.staff
      ? `${document.staff.user.firstName} ${document.staff.user.lastName}`
      : "";
  const enrollment = document?.payload.student?.enrollments?.[0];
  const title = String(document?.template.config.title ?? document?.template.name ?? "Document");
  const barcode = useMemo(() => document?.barcodeValue ?? document?.serialNumber ?? "", [document]);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (error) return <p className="alert-error m-8">{error}</p>;
  if (!document) return <p className="p-8 text-center text-slate-500">Preparing document…</p>;
  return (
    <main className="min-h-screen bg-slate-200 p-6 print:bg-white print:p-0">
      <div className="print-controls mx-auto mb-5 flex max-w-4xl justify-between">
        <button className="button-secondary" onClick={() => history.back()}>Back</button>
        <button className="button-primary" onClick={() => window.print()}>Print / Save PDF</button>
      </div>
      <article
        className="relative mx-auto overflow-hidden bg-white p-12 shadow-xl print:shadow-none"
        style={{
          width: `min(100%, ${Math.min(document.template.width, 1000)}px)`,
          aspectRatio: `${document.template.width}/${document.template.height}`,
          backgroundImage: document.template.backgroundUrl ? `url(${document.template.backgroundUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="flex h-full flex-col rounded-2xl border-4 border-double border-indigo-700 p-8 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-indigo-700">{document.tenant.name}</p>
          <h1 className="mt-4 text-3xl font-serif font-bold">{title}</h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">{document.template.type.replaceAll("_", " ")}</p>
          <div className="mt-8 flex flex-1 flex-col items-center justify-center">
            {document.student?.photoUrl && <img src={document.student.photoUrl} alt="" className="mb-5 size-28 rounded-xl border object-cover" />}
            <p className="text-sm text-slate-500">{document.template.type === "CERTIFICATE" ? "This is proudly presented to" : "Issued to"}</p>
            <h2 className="mt-2 text-3xl font-serif font-semibold">{person}</h2>
            {document.student && <p className="mt-2 text-sm">Admission No. {document.student.admissionNumber}</p>}
            {document.staff && <p className="mt-2 text-sm">{document.staff.employeeNumber} · {document.staff.designation?.name ?? "Staff"}</p>}
            {enrollment && <p className="mt-2 text-sm">{enrollment.classSection.academicClass.name} · Section {enrollment.classSection.section.name} · {enrollment.academicSession.name}</p>}
            {document.exam && <p className="mt-5 text-lg font-semibold">{document.exam.examGroup.name} · {document.exam.name}</p>}
            {document.template.type === "CERTIFICATE" && <p className="mt-6 max-w-xl text-lg leading-relaxed">In recognition of outstanding achievement and sincere participation.</p>}
            {document.payload.result?.marks && (
              <div className="mt-7 w-full max-w-2xl">
                <div className="overflow-hidden rounded-xl border text-left">
                  {document.payload.result.marks.map((mark) => (
                    <div className="grid grid-cols-[1fr_120px] border-b p-3 last:border-b-0" key={mark.schedule.classSubject.subject.name}>
                      <span>{mark.schedule.classSubject.subject.name}</span>
                      <strong>{mark.isAbsent ? "Absent" : `${mark.marksObtained} / ${mark.schedule.maximumMarks}`}</strong>
                    </div>
                  ))}
                </div>
                {document.payload.result.percentage !== undefined && <div className="mt-4 flex justify-center gap-3 text-sm"><span className="badge">Rank #{document.payload.result.rank ?? "—"}</span><span className="badge">{document.payload.result.percentage}%</span><span className={document.payload.result.passStatus === "PASS" ? "badge-success" : "badge-danger"}>{document.payload.result.grade ?? document.payload.result.passStatus}</span></div>}
              </div>
            )}
          </div>
          <div className="mt-6 flex items-end justify-between gap-6 text-left">
            <div><p className="text-xs text-slate-500">Serial number</p><p className="text-sm font-semibold">{document.serialNumber}</p></div>
            <Barcode value={barcode} />
            <div className="text-right"><p className="text-xs text-slate-500">Issued</p><p className="text-sm font-semibold">{new Date(document.generatedAt).toLocaleDateString()}</p></div>
          </div>
        </div>
      </article>
    </main>
  );
}

function Barcode({ value }: { value: string }) {
  const bits = [...value].flatMap((character) =>
    character.charCodeAt(0).toString(2).padStart(8, "0").split(""),
  );
  return <div className="text-center"><div className="flex h-12 items-stretch bg-white px-1">{bits.map((bit, index) => <span key={index} style={{ width: bit === "1" ? 2 : 1, background: bit === "1" ? "#0f172a" : "transparent" }} />)}</div><p className="mt-1 max-w-48 truncate font-mono text-[9px]">{value}</p></div>;
}
