import { useEffect, useMemo, useState } from "react";
import { InfoOutlined, SearchOutlined } from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import type { AcademicSetup, TimetableEntry, Weekday } from "./types";
import { WEEKDAYS, WEEKDAY_LABELS } from "./utils";

function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;
  return `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} ${suffix}`;
}

export function TeacherTimetablePanel({
  setup,
  token,
  onError,
}: {
  setup: AcademicSetup;
  token: string;
  onError: (message: string) => void;
}) {
  const [teacherId, setTeacherId] = useState(setup.teachers[0]?.id ?? "");
  const [weekday, setWeekday] = useState<Weekday>("MONDAY");
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const sessionId = setup.currentSession?.id ?? "";

  async function load() {
    if (!teacherId || !sessionId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<{ entries: TimetableEntry[] }>(
        `/academics/timetable/setup?sessionId=${encodeURIComponent(sessionId)}&teacherId=${encodeURIComponent(teacherId)}`,
        token,
      );
      setEntries(data.entries ?? []);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load teacher timetable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, sessionId, token]);

  const dayEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.weekday === weekday)
        .sort((left, right) => left.startTime.localeCompare(right.startTime)),
    [entries, weekday],
  );

  return (
    <section className="mt-5 space-y-4">
      <div className="nx-card flex flex-wrap items-end gap-5 p-4">
        <label className="min-w-[220px] sm:max-w-[260px]">
          <span className="nx-label !normal-case !tracking-normal">Teacher</span>
          <select
            className="nx-input bg-white"
            value={teacherId}
            onChange={(event) => setTeacherId(event.target.value)}
          >
            <option value="">Select teacher</option>
            {setup.teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.firstName} {teacher.lastName}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="nx-btn-secondary border-indigo-300 bg-white text-indigo-700"
          disabled={!teacherId || !sessionId || loading}
          onClick={() => void load()}
        >
          <SearchOutlined sx={{ fontSize: 17 }} />
          {loading ? "Searching…" : "Search"}
        </button>
        {!sessionId ? (
          <p className="w-full text-[12px] text-amber-700">No active academic session.</p>
        ) : null}
      </div>

      <div className="nx-card overflow-hidden">
        <div className="flex max-w-[450px] overflow-x-auto border-b border-slate-100 px-3 pt-3">
          {WEEKDAYS.map((day) => (
            <button
              key={day}
              type="button"
              className={`min-w-[60px] rounded-t-md px-4 py-2.5 text-[11px] font-semibold transition ${
                weekday === day ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100"
              }`}
              onClick={() => setWeekday(day)}
            >
              {WEEKDAY_LABELS[day].slice(0, 3)}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto p-3">
          <table className="nx-table !min-w-[760px] border border-slate-200">
            <thead>
              <tr>
                <th className="text-center">Period</th>
                <th>Class / Section</th>
                <th>Subject</th>
                <th>Time From</th>
                <th>Time To</th>
                <th>Room No</th>
              </tr>
            </thead>
            <tbody>
              {dayEntries.map((entry, index) => (
                <tr key={entry.id}>
                  <td className="text-center font-semibold text-slate-700">{index + 1}</td>
                  <td className="font-semibold text-slate-800">
                    {entry.classSection.academicClass.name} - {entry.classSection.section.name}
                  </td>
                  <td className="font-semibold text-slate-800">{entry.classSubject.subject.name}</td>
                  <td className="font-medium text-slate-700">{formatTime(entry.startTime)}</td>
                  <td className="font-medium text-slate-700">{formatTime(entry.endTime)}</td>
                  <td className="font-medium text-slate-700">{entry.room || "—"}</td>
                  </tr>
              ))}
              {!dayEntries.length ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    {loading
                      ? "Loading…"
                      : teacherId
                        ? `No periods scheduled on ${WEEKDAY_LABELS[weekday]}.`
                        : "Select a teacher."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mx-3 mb-3 flex items-center gap-2 rounded border border-blue-100 bg-blue-50/60 px-3 py-2.5 text-[11px] font-medium text-blue-700">
          <InfoOutlined sx={{ fontSize: 16 }} />
          This is a read-only view of the teacher&apos;s timetable.
        </div>
      </div>
    </section>
  );
}
