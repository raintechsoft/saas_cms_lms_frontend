import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AddOutlined, SchoolOutlined } from "@mui/icons-material";
import { InitialsAvatar } from "../../../components/InitialsAvatar";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";
import {
  studentDisplayName,
  type ClassSection,
  type Setup,
  type StudentDetail,
  type StudentList,
  type StudentListItem,
} from "./types";

function classLabel(cs: ClassSection) {
  return `${cs.academicClass.name} - ${cs.section.name}`;
}

export function MultiClassPanel({
  setup,
  token,
  tenantType,
}: {
  setup: Setup;
  token: string;
  tenantType: string | null | undefined;
}) {
  const isCoaching = tenantType === "COACHING_CENTER";
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<StudentListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [classSectionId, setClassSectionId] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [multiClassStudents, setMultiClassStudents] = useState<StudentListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const enrolledSectionIds = useMemo(
    () => new Set((detail?.enrollments ?? []).map((item) => item.classSection.id)),
    [detail],
  );

  const availableSections = useMemo(
    () => setup.classSections.filter((item) => !enrolledSectionIds.has(item.id)),
    [setup.classSections, enrolledSectionIds],
  );

  async function loadMultiClassList() {
    setLoadingList(true);
    try {
      const data = await apiRequest<StudentList>("/students?limit=100&status=ACTIVE", token);
      setMultiClassStudents((data?.items ?? []).filter((item) => item.enrollments.length > 1));
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load multi-class students");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    void loadMultiClassList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function runSearch(event?: FormEvent) {
    event?.preventDefault();
    setSearching(true);
    try {
      const params = new URLSearchParams({
        limit: "20",
        status: "ACTIVE",
        search: search.trim(),
      });
      const data = await apiRequest<StudentList>(`/students?${params}`, token);
      setResults(data?.items ?? []);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to search students");
    } finally {
      setSearching(false);
    }
  }

  async function selectStudent(id: string) {
    setSelectedId(id);
    setClassSectionId("");
    setRollNumber("");
    try {
      const next = await apiRequest<StudentDetail>(`/students/${id}`, token);
      setDetail(next);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load student");
    }
  }

  async function addClass(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !classSectionId) return;
    setSaving(true);
    try {
      await apiRequest(`/students/${selectedId}/enrollments`, token, {
        method: "POST",
        body: JSON.stringify({
          classSectionId,
          rollNumber: rollNumber.trim() || null,
        }),
      });
      notifySuccess("Student enrolled in additional class");
      await selectStudent(selectedId);
      await loadMultiClassList();
      setClassSectionId("");
      setRollNumber("");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to add class enrollment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-4 space-y-5">
      {!isCoaching ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          Multi-class enrollment is intended for <strong>coaching / training centers</strong>. This
          institute type is <strong>{tenantType || "SCHOOL"}</strong>, so adding a second class in the
          same session is blocked by the API (schools/colleges use one class per session).
        </div>
      ) : (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-[13px] text-indigo-900">
          Coaching mode: a student can be admitted to multiple class sections in the same session.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="nx-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-[15px] font-bold text-slate-900">Add student to another class</h3>
            <p className="mt-1 text-[12.5px] text-slate-500">
              Search a student, then enroll them in an additional class section.
            </p>
          </div>

          <form className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-4" onSubmit={runSearch}>
            <input
              className="nx-input min-w-[220px] flex-1"
              placeholder="Search by name, admission no, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="nx-btn-secondary" disabled={searching}>
              {searching ? "Searching…" : "Search"}
            </button>
          </form>

          <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
            {results.map((student) => {
              const name = studentDisplayName(student);
              const active = selectedId === student.id;
              return (
                <button
                  key={student.id}
                  type="button"
                  className={`flex w-full items-center gap-3 px-5 py-3 text-left transition ${
                    active ? "bg-indigo-50" : "hover:bg-slate-50"
                  }`}
                  onClick={() => void selectStudent(student.id)}
                >
                  <InitialsAvatar name={name} photoUrl={student.photoUrl ?? undefined} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-900">{name}</p>
                    <p className="truncate text-[12px] text-slate-500">
                      #{student.admissionNumber}
                      {student.enrollments[0]
                        ? ` · ${classLabel(student.enrollments[0].classSection)}`
                        : ""}
                      {student.enrollments.length > 1
                        ? ` · +${student.enrollments.length - 1} more`
                        : ""}
                    </p>
                  </div>
                </button>
              );
            })}
            {!results.length ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                Search and select a student to continue.
              </p>
            ) : null}
          </div>

          {detail ? (
            <form className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4" onSubmit={addClass}>
              <div>
                <p className="text-[13px] font-semibold text-slate-900">
                  {studentDisplayName(detail)} — current enrollments
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detail.enrollments.map((enrollment) => (
                    <span key={enrollment.id} className="nx-pill nx-pill-indigo">
                      {classLabel(enrollment.classSection)}
                      {enrollment.rollNumber ? ` · Roll ${enrollment.rollNumber}` : ""}
                      {enrollment.academicSession?.name
                        ? ` · ${enrollment.academicSession.name}`
                        : ""}
                    </span>
                  ))}
                  {!detail.enrollments.length ? (
                    <span className="text-[12px] text-slate-500">No enrollments</span>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-[12px] font-medium text-slate-600">
                  Add class section
                  <select
                    className="nx-input mt-1"
                    value={classSectionId}
                    onChange={(e) => setClassSectionId(e.target.value)}
                    required
                    disabled={!isCoaching}
                  >
                    <option value="">Select class section</option>
                    {availableSections.map((item) => (
                      <option key={item.id} value={item.id}>
                        {classLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[12px] font-medium text-slate-600">
                  Roll number (optional)
                  <input
                    className="nx-input mt-1"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="e.g. 12"
                    disabled={!isCoaching}
                  />
                </label>
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!isCoaching || saving || !classSectionId}
              >
                <AddOutlined sx={{ fontSize: 16 }} />
                {saving ? "Adding…" : "Add to class"}
              </button>
              {!isCoaching ? (
                <p className="text-[12px] text-amber-700">
                  Switch institute type to Coaching Center to enable multi-class enrollment.
                </p>
              ) : null}
            </form>
          ) : null}
        </div>

        <div className="nx-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-[15px] font-bold text-slate-900">Students in multiple classes</h3>
            <p className="mt-1 text-[12.5px] text-slate-500">
              Active students already enrolled in more than one class section.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {loadingList ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">Loading…</p>
            ) : multiClassStudents.length ? (
              multiClassStudents.map((student) => (
                <div key={student.id} className="flex items-start gap-3 px-5 py-3.5">
                  <span className="mt-0.5 grid size-9 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
                    <SchoolOutlined sx={{ fontSize: 18 }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/students/${student.id}`}
                      className="text-[13px] font-semibold text-indigo-700 hover:underline"
                    >
                      {studentDisplayName(student)}
                    </Link>
                    <p className="text-[12px] text-slate-500">#{student.admissionNumber}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {student.enrollments.map((enrollment) => (
                        <span key={enrollment.id} className="nx-pill nx-pill-neutral">
                          {classLabel(enrollment.classSection)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="nx-btn-secondary !px-2.5 !py-1.5 text-[12px]"
                    onClick={() => void selectStudent(student.id)}
                  >
                    Manage
                  </button>
                </div>
              ))
            ) : (
              <p className="px-5 py-10 text-center text-sm text-slate-500">
                No multi-class students yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
