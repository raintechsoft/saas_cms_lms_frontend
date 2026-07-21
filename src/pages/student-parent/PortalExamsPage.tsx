import { usePortal } from "./PortalContext";

export function PortalExamsPage() {
  const { child } = usePortal();

  if (!child) {
    return <p className="text-sm text-slate-500">No student profile linked.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Exams</h1>
        <p className="mt-1 text-sm text-slate-500">Published exam results.</p>
      </div>

      {child.exams.length === 0 ? (
        <section className="card p-6">
          <p className="text-sm text-slate-500">No published results yet.</p>
        </section>
      ) : (
        <div className="space-y-4">
          {child.exams.map((exam) => (
            <article className="card p-5" key={exam.examId}>
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {exam.groupName} · {exam.examName}
                  </p>
                  <p className="text-sm text-slate-500">
                    {exam.obtainedMarks} / {exam.maximumMarks} · {exam.percentage}%
                  </p>
                </div>
                <span className={exam.passStatus === "PASS" ? "badge-success" : "badge-danger"}>{exam.passStatus}</span>
              </div>
              <div className="mt-3 divide-y divide-slate-100">
                {exam.subjects.map((subject, index) => (
                  <div className="flex justify-between py-2 text-sm" key={index}>
                    <span>{subject.subject}</span>
                    <span>{subject.isAbsent ? "Absent" : `${subject.marksObtained} / ${subject.maximumMarks}`}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
