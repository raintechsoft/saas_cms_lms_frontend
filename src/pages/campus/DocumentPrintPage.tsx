import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest, assetUrl } from "../../lib/api";

interface MarkSubjectRow {
  name: string;
  obtainedMarks: number;
  maximumMarks: number;
  isAbsent?: boolean;
  linked?: boolean;
  bifurcationColumns?: number;
  parts?: Array<{
    name: string;
    obtainedMarks: number;
    maximumMarks: number;
    isAbsent?: boolean;
  }>;
}

interface AdmitScheduleRow {
  subject: string;
  examDate: string;
  startTime: string;
  endTime: string;
  room: string | null;
}

interface PrintDocument {
  id?: string;
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
      gpa?: number | null;
      passStatus?: string;
      subjects?: MarkSubjectRow[];
      marks?: Array<{
        marksObtained: string;
        isAbsent: boolean;
        schedule: {
          maximumMarks: string;
          minimumMarks: string;
          classSubject: { subject: { name: string } };
        };
      }>;
    } | null;
    schedule?: AdmitScheduleRow[];
    admit?: {
      rollNumber: string | null;
      classLabel: string;
      examName: string;
      examGroupName: string;
    } | null;
    tokens?: {
      table?: string;
      table1?: string;
      top_10_students?: string;
      comparative_analysis?: string;
      structured?: {
        table?: MarkSubjectRow[];
        table1?: MarkSubjectRow[];
        top_10_students?: Array<{
          rank: number;
          name: string;
          obtainedMarks: number;
          maximumMarks: number;
          percentage: number;
          gpa?: number | null;
          grade?: string | null;
        }>;
        comparative_analysis?: {
          student: {
            name: string;
            obtainedMarks: number;
            percentage: number;
            gpa?: number | null;
            grade?: string | null;
            rank?: number;
          };
          classAverageMarks: number;
          classAveragePercentage: number;
          topScore: {
            name: string;
            obtainedMarks: number;
            percentage: number;
            gpa?: number | null;
          } | null;
        };
      };
    };
    custom?: Record<string, unknown>;
  };
}

const TOKEN_KEYS = [
  "table",
  "table1",
  "top_10_students",
  "comparative_analysis",
] as const;

type TokenKey = (typeof TOKEN_KEYS)[number];

function replaceTokens(text: string, replacements: Partial<Record<TokenKey, string>>) {
  let next = text;
  for (const key of TOKEN_KEYS) {
    const value = replacements[key];
    if (value == null) continue;
    next = next.replaceAll(`[${key}]`, value);
  }
  return next;
}

function hasToken(text: string | undefined | null, key: TokenKey) {
  return Boolean(text && text.includes(`[${key}]`));
}

function MarksTable({ rows }: { rows: MarkSubjectRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border text-left">
      {rows.map((row) => (
        <div
          className="grid grid-cols-[1fr_120px] border-b p-3 last:border-b-0"
          key={`${row.name}-${row.obtainedMarks}-${row.maximumMarks}`}
        >
          <span>{row.name}</span>
          <strong>
            {row.isAbsent ? "Absent" : `${row.obtainedMarks} / ${row.maximumMarks}`}
          </strong>
        </div>
      ))}
    </div>
  );
}

function BifurcatedTable({ rows }: { rows: MarkSubjectRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border text-left">
      {rows.map((row) => (
        <div className="border-b p-3 last:border-b-0" key={`bif-${row.name}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{row.name}</p>
              {row.parts?.length ? (
                <div
                  className="mt-1 grid gap-1 text-xs text-slate-600"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(1, row.bifurcationColumns ?? 2)}, minmax(0, 1fr))`,
                  }}
                >
                  {row.parts.map((part) => (
                    <span key={`${row.name}-${part.name}`}>
                      {part.name}:{" "}
                      {part.isAbsent ? "Absent" : `${part.obtainedMarks}/${part.maximumMarks}`}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <strong>
              {row.isAbsent ? "Absent" : `${row.obtainedMarks} / ${row.maximumMarks}`}
            </strong>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatAdmitDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function DocumentArticle({ document: doc }: { document: PrintDocument }) {
  const person = doc.student
    ? `${doc.student.firstName} ${doc.student.lastName ?? ""}`
    : doc.staff
      ? `${doc.staff.user.firstName} ${doc.staff.user.lastName}`
      : "";
  const enrollment = doc.payload.student?.enrollments?.[0];
  const config = doc.template.config ?? {};
  const tokens = doc.payload.tokens;
  const structured = tokens?.structured;
  const placeholder = String(config.marksTablePlaceholder ?? "[table]");
  const footerNote = typeof config.footerNote === "string" ? config.footerNote : "";
  const titleRaw = String(config.title ?? doc.template.name ?? "Document");
  const tokenPlain: Partial<Record<TokenKey, string>> = {
    table: "[Marks table]",
    table1: "[Linked marks table]",
    top_10_students: "[Top 10 students]",
    comparative_analysis: "[Comparative analysis]",
  };
  const title = replaceTokens(titleRaw, tokenPlain);
  const footerDisplay = replaceTokens(footerNote, tokenPlain);
  const subjectRows: MarkSubjectRow[] =
    structured?.table ??
    doc.payload.result?.subjects ??
    (doc.payload.result?.marks ?? []).map((mark) => ({
      name: mark.schedule.classSubject.subject.name,
      obtainedMarks: Number(mark.marksObtained),
      maximumMarks: Number(mark.schedule.maximumMarks),
      isAbsent: mark.isAbsent,
    }));
  const table1Rows: MarkSubjectRow[] =
    structured?.table1 ??
    subjectRows.filter((row) => row.linked || (row.parts && row.parts.length > 0));
  const showTable =
    hasToken(titleRaw, "table") ||
    hasToken(footerNote, "table") ||
    placeholder === "[table]" ||
    (!hasToken(titleRaw, "table1") &&
      !hasToken(footerNote, "table1") &&
      placeholder !== "[table1]");
  const showTable1 =
    hasToken(titleRaw, "table1") ||
    hasToken(footerNote, "table1") ||
    placeholder === "[table1]";
  const showTop10 =
    hasToken(titleRaw, "top_10_students") || hasToken(footerNote, "top_10_students");
  const showComparative =
    hasToken(titleRaw, "comparative_analysis") ||
    hasToken(footerNote, "comparative_analysis");
  const showSchedule =
    doc.template.type === "ADMIT_CARD" && config.showSchedule !== false;
  const scheduleRows = doc.payload.schedule ?? [];
  const admit = doc.payload.admit;
  const barcode = doc.barcodeValue ?? doc.serialNumber ?? "";

  return (
    <article
      className="relative mx-auto overflow-hidden bg-white p-12 shadow-xl print:shadow-none print:break-after-page"
      style={{
        width: `min(100%, ${Math.min(doc.template.width, 1000)}px)`,
        aspectRatio: `${doc.template.width}/${doc.template.height}`,
        backgroundImage: doc.template.backgroundUrl
          ? `url(${doc.template.backgroundUrl})`
          : undefined,
        backgroundColor:
          !doc.template.backgroundUrl && typeof doc.template.config.backgroundColor === "string"
            ? doc.template.config.backgroundColor
            : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="flex h-full flex-col rounded-2xl border-4 border-double border-indigo-700 p-8 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-indigo-700">
          {doc.tenant.name}
        </p>
        <h1 className="mt-4 text-3xl font-serif font-bold">{title}</h1>
        <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">
          {doc.template.type.replaceAll("_", " ")}
        </p>
        <div className="mt-8 flex flex-1 flex-col items-center justify-center">
          {doc.student?.photoUrl && doc.template.config.showPhoto !== false ? (
            <img
              src={assetUrl(doc.student.photoUrl)}
              alt=""
              className="mb-5 size-28 rounded-xl border object-cover"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          {doc.template.config.showLogo !== false &&
          typeof doc.tenant.branding?.logoUrl === "string" ? (
            <img
              src={assetUrl(String(doc.tenant.branding.logoUrl))}
              alt=""
              className="mb-4 h-12 object-contain"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          <p className="text-sm text-slate-500">
            {doc.template.type === "CERTIFICATE" ? "This is proudly presented to" : "Issued to"}
          </p>
          <h2 className="mt-2 text-3xl font-serif font-semibold">{person}</h2>
          {doc.student ? (
            <p className="mt-2 text-sm">Admission No. {doc.student.admissionNumber}</p>
          ) : null}
          {admit?.rollNumber ? (
            <p className="mt-1 text-sm">Roll No. {admit.rollNumber}</p>
          ) : null}
          {doc.staff ? (
            <p className="mt-2 text-sm">
              {doc.staff.employeeNumber} · {doc.staff.designation?.name ?? "Staff"}
            </p>
          ) : null}
          {admit?.classLabel ? (
            <p className="mt-2 text-sm">{admit.classLabel}</p>
          ) : enrollment ? (
            <p className="mt-2 text-sm">
              {enrollment.classSection.academicClass.name} · Section{" "}
              {enrollment.classSection.section.name} · {enrollment.academicSession.name}
            </p>
          ) : null}
          {doc.exam ? (
            <p className="mt-5 text-lg font-semibold">
              {doc.exam.examGroup.name} · {doc.exam.name}
            </p>
          ) : null}
          {doc.student && doc.template.config.showGuardian !== false && doc.student.guardianName ? (
            <p className="mt-2 text-sm text-slate-600">
              Guardian: {doc.student.guardianName}
              {doc.student.guardianPhone ? ` · ${doc.student.guardianPhone}` : ""}
            </p>
          ) : null}
          {doc.template.type === "CERTIFICATE" ? (
            <p className="mt-6 max-w-xl text-lg leading-relaxed">
              In recognition of outstanding achievement and sincere participation.
            </p>
          ) : null}
          {showSchedule && scheduleRows.length > 0 ? (
            <div className="mt-6 w-full max-w-2xl overflow-hidden rounded-xl border text-left text-sm">
              <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.7fr] bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <span>Subject</span>
                <span>Date</span>
                <span>Time</span>
                <span>Room</span>
              </div>
              {scheduleRows.map((row) => (
                <div
                  key={`${row.subject}-${row.examDate}-${row.startTime}`}
                  className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.7fr] border-t px-3 py-2"
                >
                  <span className="font-medium">{row.subject}</span>
                  <span>{formatAdmitDate(row.examDate)}</span>
                  <span>
                    {row.startTime}–{row.endTime}
                  </span>
                  <span>{row.room || "—"}</span>
                </div>
              ))}
            </div>
          ) : null}
          {(doc.payload.result?.marks || doc.payload.result?.subjects) && (
            <div className="mt-7 w-full max-w-2xl space-y-5">
              {showTable && subjectRows.length > 0 ? <MarksTable rows={subjectRows} /> : null}
              {showTable1 && (table1Rows.length > 0 ? table1Rows : subjectRows).length > 0 ? (
                <div>
                  {showTable ? (
                    <p className="mb-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Linked / bifurcated marks
                    </p>
                  ) : null}
                  <BifurcatedTable rows={table1Rows.length > 0 ? table1Rows : subjectRows} />
                </div>
              ) : null}
              {showTop10 && structured?.top_10_students?.length ? (
                <div>
                  <p className="mb-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Top 10 students
                  </p>
                  <div className="overflow-hidden rounded-xl border text-left">
                    {structured.top_10_students.map((item) => (
                      <div
                        className="grid grid-cols-[40px_1fr_120px] border-b p-3 last:border-b-0"
                        key={`${item.rank}-${item.name}`}
                      >
                        <span>#{item.rank}</span>
                        <span>{item.name}</span>
                        <strong>
                          {item.gpa != null
                            ? `GPA ${item.gpa}`
                            : `${item.obtainedMarks}/${item.maximumMarks}`}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {showComparative && structured?.comparative_analysis ? (
                <div>
                  <p className="mb-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Comparative analysis
                  </p>
                  <div className="overflow-hidden rounded-xl border text-left text-sm">
                    <div className="grid grid-cols-[140px_1fr] border-b p-3">
                      <span>Student</span>
                      <strong>
                        {structured.comparative_analysis.student.name} —{" "}
                        {structured.comparative_analysis.student.gpa != null
                          ? `GPA ${structured.comparative_analysis.student.gpa}`
                          : `${structured.comparative_analysis.student.obtainedMarks} (${structured.comparative_analysis.student.percentage}%)`}
                      </strong>
                    </div>
                    <div className="grid grid-cols-[140px_1fr] border-b p-3">
                      <span>Class average</span>
                      <strong>
                        {structured.comparative_analysis.classAverageMarks} (
                        {structured.comparative_analysis.classAveragePercentage}%)
                      </strong>
                    </div>
                    <div className="grid grid-cols-[140px_1fr] p-3">
                      <span>Top score</span>
                      <strong>
                        {structured.comparative_analysis.topScore
                          ? `${structured.comparative_analysis.topScore.name} — ${
                              structured.comparative_analysis.topScore.gpa != null
                                ? `GPA ${structured.comparative_analysis.topScore.gpa}`
                                : `${structured.comparative_analysis.topScore.obtainedMarks} (${structured.comparative_analysis.topScore.percentage}%)`
                            }`
                          : "—"}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : null}
              {doc.payload.result?.percentage !== undefined ? (
                <div className="mt-4 flex justify-center gap-3 text-sm">
                  {doc.template.config.showRank !== false ? (
                    <span className="badge">Rank #{doc.payload.result.rank ?? "—"}</span>
                  ) : null}
                  <span className="badge">{doc.payload.result.percentage}%</span>
                  {doc.payload.result.gpa != null ? (
                    <span className="badge">GPA {doc.payload.result.gpa}</span>
                  ) : null}
                  {doc.template.config.showGrade !== false ? (
                    <span
                      className={
                        doc.payload.result.passStatus === "PASS"
                          ? "badge-success"
                          : "badge-danger"
                      }
                    >
                      {doc.payload.result.grade ?? doc.payload.result.passStatus}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
          {footerDisplay ? (
            <p className="mt-6 max-w-xl text-sm text-slate-500">{footerDisplay}</p>
          ) : null}
        </div>
        <div className="mt-6 flex items-end justify-between gap-6 text-left">
          <div>
            <p className="text-xs text-slate-500">Serial number</p>
            <p className="text-sm font-semibold">{doc.serialNumber}</p>
          </div>
          {doc.template.config.showBarcode !== false ? <Barcode value={barcode} /> : <div />}
          <div className="text-right">
            <p className="text-xs text-slate-500">Issued</p>
            <p className="text-sm font-semibold">
              {new Date(doc.generatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function DocumentPrintPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { accessToken, isAuthenticated } = useAuth();
  const [documents, setDocuments] = useState<PrintDocument[]>([]);
  const [error, setError] = useState("");

  const ids = useMemo(() => {
    const fromQuery = (searchParams.get("ids") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (fromQuery.length) return fromQuery;
    return id ? [id] : [];
  }, [id, searchParams]);

  function handleBack() {
    // Print tabs opened via window.open() can close themselves.
    if (window.opener && !window.opener.closed) {
      window.close();
      return;
    }
    window.close();
    window.setTimeout(() => {
      if (window.history.length > 1) {
        navigate(-1);
        return;
      }
      const type = documents[0]?.template.type;
      navigate(type === "ADMIT_CARD" || type === "MARKSHEET" ? "/exams" : "/documents");
    }, 150);
  }

  useEffect(() => {
    if (!ids.length || !isAuthenticated) return;
    let cancelled = false;
    Promise.all(
      ids.map((documentId) =>
        apiRequest<PrintDocument>(`/documents/generated/${documentId}`, accessToken),
      ),
    )
      .then((rows) => {
        if (!cancelled) setDocuments(rows);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Unable to load document");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ids, accessToken, isAuthenticated]);

  useEffect(() => {
    if (!documents.length) return;
    if (new URLSearchParams(window.location.search).get("autoprint")) {
      const timer = window.setTimeout(() => window.print(), 700);
      return () => window.clearTimeout(timer);
    }
  }, [documents]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!ids.length) return <p className="alert-error m-8">No document selected for printing.</p>;
  if (error) return <p className="alert-error m-8">{error}</p>;
  if (!documents.length) return <p className="p-8 text-center text-slate-500">Preparing document…</p>;

  return (
    <main className="min-h-screen bg-slate-200 p-6 print:bg-white print:p-0">
      <div className="print-controls mx-auto mb-5 flex max-w-4xl justify-between print:hidden">
        <button className="button-secondary" onClick={handleBack} type="button">
          Back
        </button>
        <button className="button-primary" onClick={() => window.print()} type="button">
          Print / Save PDF
        </button>
      </div>
      <div className="space-y-8 print:space-y-0">
        {documents.map((doc) => (
          <DocumentArticle key={doc.id ?? doc.serialNumber} document={doc} />
        ))}
      </div>
    </main>
  );
}

function Barcode({ value }: { value: string }) {
  const bits = [...value].flatMap((character) =>
    character.charCodeAt(0).toString(2).padStart(8, "0").split(""),
  );
  return (
    <div className="text-center">
      <div className="flex h-12 items-stretch bg-white px-1">
        {bits.map((bit, index) => (
          <span
            key={index}
            style={{
              width: bit === "1" ? 2 : 1,
              background: bit === "1" ? "#0f172a" : "transparent",
            }}
          />
        ))}
      </div>
      <p className="mt-1 max-w-48 truncate font-mono text-[9px]">{value}</p>
    </div>
  );
}
