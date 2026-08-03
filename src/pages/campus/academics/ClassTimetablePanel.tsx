import { useEffect, useMemo, useState } from "react";
import {
  AddOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutline,
  MoreVert,
  SaveOutlined,
  SearchOutlined,
} from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifySuccess } from "../../../lib/notify";
import type { AcademicSetup, TimetableEntry, Weekday } from "./types";
import { WEEKDAYS, WEEKDAY_LABELS } from "./utils";

interface Draft {
  classSubjectId: string;
  teacherId: string;
  startTime: string;
  endTime: string;
  room: string;
}

const emptyDraft: Draft = { classSubjectId: "", teacherId: "", startTime: "08:00", endTime: "08:45", room: "" };

function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;
  return `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} ${suffix}`;
}

export function ClassTimetablePanel({
  setup,
  token,
  canManage,
  onError,
}: {
  setup: AcademicSetup;
  token: string;
  canManage: boolean;
  onError: (message: string) => void;
}) {
  const initialClassSection = setup.classSections[0];
  const [classId, setClassId] = useState(initialClassSection?.academicClass.id ?? "");
  const [classSectionId, setClassSectionId] = useState(initialClassSection?.id ?? "");
  const [subjectGroupId, setSubjectGroupId] = useState("");
  const [weekday, setWeekday] = useState<Weekday>("MONDAY");
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [addingNew, setAddingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingTimetable, setSavingTimetable] = useState(false);
  const [busyKey, setBusyKey] = useState("");

  const classSection = setup.classSections.find((cs) => cs.id === classSectionId);
  const sessionId = setup.currentSession?.id ?? "";
  const classSections = useMemo(
    () => setup.classSections.filter((item) => item.academicClass.id === classId),
    [setup.classSections, classId],
  );
  const subjectGroups = useMemo(
    () => setup.subjectGroups.filter((group) => group.classSectionId === classSectionId),
    [setup.subjectGroups, classSectionId],
  );
  const subjectChoices = useMemo(() => {
    const subjects = classSection?.subjects ?? [];
    if (!subjectGroupId) return subjects;
    const group = subjectGroups.find((item) => item.id === subjectGroupId);
    const allowed = new Set(group?.items.map((item) => item.classSubject.id) ?? []);
    return subjects.filter((item) => allowed.has(item.id));
  }, [classSection, subjectGroupId, subjectGroups]);

  async function load() {
    if (!classSectionId || !sessionId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<{ entries: TimetableEntry[] }>(
        `/academics/timetable/setup?sessionId=${encodeURIComponent(sessionId)}&classSectionId=${encodeURIComponent(classSectionId)}`,
        token,
      );
      setEntries(data.entries ?? []);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load timetable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSubjectGroupId(subjectGroups[0]?.id ?? "");
  }, [classSectionId, subjectGroups]);

  const dayEntries = useMemo(
    () =>
      entries
        .filter((e) => e.weekday === weekday)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [entries, weekday],
  );

  function startAdd() {
    setAddingNew(true);
    setEditingId(null);
    setDraft(emptyDraft);
  }

  function startEdit(entry: TimetableEntry) {
    setEditingId(entry.id);
    setAddingNew(false);
    setDraft({
      classSubjectId: entry.classSubjectId,
      teacherId: entry.teacherId ?? "",
      startTime: entry.startTime,
      endTime: entry.endTime,
      room: entry.room ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setAddingNew(false);
    setDraft(emptyDraft);
  }

  async function saveNew() {
    if (!classSectionId || !sessionId) {
      onError("Select a class section (requires an active session).");
      return;
    }
    if (!draft.classSubjectId) {
      onError("Select a subject for this period.");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/academics/timetable/entries", token, {
        method: "POST",
        body: JSON.stringify({
          academicSessionId: sessionId,
          classSectionId,
          classSubjectId: draft.classSubjectId,
          teacherId: draft.teacherId || null,
          weekday,
          startTime: draft.startTime,
          endTime: draft.endTime,
          room: draft.room.trim() || null,
        }),
      });
      notifySuccess("Period added.");
      cancelEdit();
      await load();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save period");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(entry: TimetableEntry) {
    if (!draft.classSubjectId) {
      onError("Select a subject for this period.");
      return;
    }
    setSaving(true);
    try {
      await apiRequest(`/academics/timetable/entries/${entry.id}`, token, {
        method: "PUT",
        body: JSON.stringify({
          academicSessionId: entry.academicSessionId,
          classSectionId: entry.classSectionId,
          classSubjectId: draft.classSubjectId,
          teacherId: draft.teacherId || null,
          weekday,
          startTime: draft.startTime,
          endTime: draft.endTime,
          room: draft.room.trim() || null,
        }),
      });
      notifySuccess("Period updated.");
      cancelEdit();
      await load();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to update period");
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry: TimetableEntry) {
    const ok = await confirmDelete({
      title: "Delete period?",
      text: `${entry.classSubject.subject.name} on ${WEEKDAY_LABELS[entry.weekday]} will be removed.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    setBusyKey(`delete-${entry.id}`);
    try {
      await apiRequest(`/academics/timetable/entries/${entry.id}`, token, { method: "DELETE" });
      notifySuccess("Period deleted.");
      await load();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to delete period");
    } finally {
      setBusyKey("");
    }
  }

  async function saveTimetable() {
    setSavingTimetable(true);
    try {
      await load();
      notifySuccess("Timetable saved.");
    } finally {
      setSavingTimetable(false);
    }
  }

  return (
    <section className="mt-5 space-y-4">
      <div className="nx-card flex flex-wrap items-end gap-4 p-4">
        <label className="min-w-[140px] flex-1 sm:max-w-[180px]">
          <span className="nx-label !normal-case !tracking-normal">Class</span>
          <select
            className="nx-input bg-white"
            value={classId}
            onChange={(event) => {
              const nextClassId = event.target.value;
              const firstSection = setup.classSections.find(
                (item) => item.academicClass.id === nextClassId,
              );
              setClassId(nextClassId);
              setClassSectionId(firstSection?.id ?? "");
              setEntries([]);
              cancelEdit();
            }}
          >
            <option value="">Select class</option>
            {setup.classes.map((academicClass) => (
              <option key={academicClass.id} value={academicClass.id}>
                {academicClass.name}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-[140px] flex-1 sm:max-w-[180px]">
          <span className="nx-label !normal-case !tracking-normal">Section</span>
          <select
            className="nx-input bg-white"
            value={classSectionId}
            disabled={!classId}
            onChange={(event) => {
              setClassSectionId(event.target.value);
              setEntries([]);
              cancelEdit();
            }}
          >
            <option value="">Select section</option>
            {classSections.map((item) => (
              <option key={item.id} value={item.id}>
                {item.section.name}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-[170px] flex-1 sm:max-w-[220px]">
          <span className="nx-label !normal-case !tracking-normal">Subject Group</span>
          <select
            className="nx-input bg-white"
            value={subjectGroupId}
            disabled={!classSectionId}
            onChange={(event) => setSubjectGroupId(event.target.value)}
          >
            <option value="">All subjects</option>
            {subjectGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="nx-btn-secondary border-indigo-300 bg-white text-indigo-700"
          disabled={!classSectionId || loading}
          onClick={() => void load()}
        >
          <SearchOutlined sx={{ fontSize: 17 }} />
          {loading ? "Searching…" : "Search"}
        </button>

        <div className="min-w-0 flex-1" />

        {canManage ? (
          <button
            type="button"
            className="nx-btn-primary min-w-[150px]"
            disabled={!classSectionId || !sessionId || savingTimetable}
            onClick={() => void saveTimetable()}
          >
            <SaveOutlined sx={{ fontSize: 17 }} />
            {savingTimetable ? "Saving…" : "Save Timetable"}
          </button>
        ) : null}

        {!sessionId ? (
          <p className="w-full text-[12px] text-amber-700">Activate an academic session to manage timetable.</p>
        ) : null}
      </div>

      <div className="nx-card overflow-hidden">
        <div className="flex max-w-[430px] overflow-x-auto border-b border-slate-100 px-3 pt-3">
          {WEEKDAYS.map((day) => (
            <button
              key={day}
              type="button"
              className={`min-w-[60px] rounded-t-md px-4 py-2.5 text-[11px] font-semibold transition ${
                weekday === day ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100"
              }`}
              onClick={() => {
                setWeekday(day);
                cancelEdit();
              }}
            >
              {WEEKDAY_LABELS[day].slice(0, 3)}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto p-3">
          <table className="nx-table !min-w-[820px] border border-slate-200">
            <thead>
              <tr>
                <th className="text-center">Period</th>
                <th>Subject</th>
                <th>Teacher</th>
                <th>Time From</th>
                <th>Time To</th>
                <th>Room No</th>
                {canManage ? <th aria-label="Actions" /> : null}
              </tr>
            </thead>
            <tbody>
              {dayEntries.map((entry, index) => {
                const isEditing = editingId === entry.id;
                if (isEditing) {
                  return (
                    <tr key={entry.id} className="bg-indigo-50/30">
                      <td className="text-center font-semibold text-slate-700">{index + 1}</td>
                      <td>
                        <select
                          className="nx-input bg-white !py-1.5"
                          value={draft.classSubjectId}
                          onChange={(e) => setDraft({ ...draft, classSubjectId: e.target.value })}
                        >
                          <option value="">Select subject</option>
                          {subjectChoices.map((cs) => (
                            <option key={cs.id} value={cs.id}>
                              {cs.subject.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="nx-input bg-white !py-1.5"
                          value={draft.teacherId}
                          onChange={(e) => setDraft({ ...draft, teacherId: e.target.value })}
                        >
                          <option value="">Default</option>
                          {setup.teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.firstName} {t.lastName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="nx-input bg-white !py-1.5"
                          type="time"
                          value={draft.startTime}
                          onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className="nx-input bg-white !py-1.5"
                          type="time"
                          value={draft.endTime}
                          onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className="nx-input bg-white !py-1.5"
                          placeholder="Room"
                          value={draft.room}
                          onChange={(e) => setDraft({ ...draft, room: e.target.value })}
                        />
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
                            disabled={saving}
                            onClick={() => void saveEdit(entry)}
                            aria-label="Save"
                          >
                            <CheckOutlined sx={{ fontSize: 18 }} />
                          </button>
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
                            onClick={cancelEdit}
                            aria-label="Cancel"
                          >
                            <CloseOutlined sx={{ fontSize: 18 }} />
                          </button>
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-rose-500 hover:bg-rose-50"
                            disabled={busyKey === `delete-${entry.id}`}
                            onClick={() => void remove(entry)}
                            aria-label="Delete"
                          >
                            <DeleteOutline sx={{ fontSize: 18 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={entry.id} className={index === 3 ? "!bg-indigo-50/60" : ""}>
                    <td className="text-center font-semibold text-slate-700">{index + 1}</td>
                    <td className="font-semibold text-slate-800">{entry.classSubject.subject.name}</td>
                    <td className="font-medium text-slate-700">
                      {entry.teacher ? `${entry.teacher.firstName} ${entry.teacher.lastName}` : "—"}
                    </td>
                    <td className="font-medium text-slate-700">{formatTime(entry.startTime)}</td>
                    <td className="font-medium text-slate-700">{formatTime(entry.endTime)}</td>
                    <td className="font-medium text-slate-700">{entry.room || "—"}</td>
                    {canManage ? (
                      <td className="text-center">
                        <button
                          type="button"
                          className="rounded p-1.5 text-slate-700 hover:bg-slate-100"
                          onClick={() => startEdit(entry)}
                          aria-label="Edit period"
                        >
                          <MoreVert sx={{ fontSize: 18 }} />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}

              {addingNew ? (
                <tr className="bg-indigo-50/30">
                  <td className="text-center font-semibold text-slate-700">{dayEntries.length + 1}</td>
                  <td>
                    <select
                      className="nx-input bg-white !py-1.5"
                      value={draft.classSubjectId}
                      onChange={(e) => setDraft({ ...draft, classSubjectId: e.target.value })}
                    >
                      <option value="">Select subject</option>
                      {subjectChoices.map((cs) => (
                        <option key={cs.id} value={cs.id}>
                          {cs.subject.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="nx-input bg-white !py-1.5"
                      value={draft.teacherId}
                      onChange={(e) => setDraft({ ...draft, teacherId: e.target.value })}
                    >
                      <option value="">Default</option>
                      {setup.teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.firstName} {t.lastName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className="nx-input bg-white !py-1.5"
                      type="time"
                      value={draft.startTime}
                      onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="nx-input bg-white !py-1.5"
                      type="time"
                      value={draft.endTime}
                      onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="nx-input bg-white !py-1.5"
                      placeholder="Room"
                      value={draft.room}
                      onChange={(e) => setDraft({ ...draft, room: e.target.value })}
                    />
                  </td>
                  <td>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
                        disabled={saving}
                        onClick={() => void saveNew()}
                        aria-label="Save"
                      >
                        <CheckOutlined sx={{ fontSize: 18 }} />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
                        onClick={cancelEdit}
                        aria-label="Cancel"
                      >
                        <CloseOutlined sx={{ fontSize: 18 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}

              {!dayEntries.length && !addingNew ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                    {loading
                      ? "Loading…"
                      : entries.length
                        ? `No periods on ${WEEKDAY_LABELS[weekday]} yet.`
                        : "Select filters and click Search to load the timetable."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {canManage && !addingNew ? (
          <div className="border-t border-slate-100 px-4 py-3">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-700 hover:text-indigo-900"
              disabled={!classSectionId || !sessionId}
              onClick={startAdd}
            >
              <AddOutlined sx={{ fontSize: 17 }} /> Add Period
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
