import { useEffect, useMemo, useState } from "react";
import { InfoOutlined, SearchOutlined } from "@mui/icons-material";
import { InitialsAvatar } from "../../../components/InitialsAvatar";
import { apiRequest } from "../../../lib/api";
import { notifySuccess } from "../../../lib/notify";
import { InOutReportPanel } from "./InOutReportPanel";
import { staffName, type HrSetup, type Staff } from "./types";

const today = new Date().toISOString().slice(0, 10);

const MARK_OPTIONS = [
  ["PRESENT", "Present"],
  ["LATE", "Late"],
  ["ABSENT", "Absent"],
  ["HALF_DAY", "Half-day"],
] as const;

const ACTIVE_MARK_CLASS: Record<string, string> = {
  PRESENT: "border-emerald-300 bg-emerald-50 text-emerald-700",
  LATE: "border-amber-300 bg-amber-50 text-amber-700",
  ABSENT: "border-rose-300 bg-rose-50 text-rose-700",
  HALF_DAY: "border-slate-300 bg-slate-100 text-slate-700",
  HOLIDAY: "border-indigo-300 bg-indigo-50 text-indigo-700",
};

interface SavedRecord {
  id: string;
  attendanceDate: string;
  status: string;
  inTime: string | null;
  outTime: string | null;
  note?: string | null;
  staff: Staff;
}

export function StaffAttendancePanel({
  setup,
  token,
  onSaved,
  onError,
}: {
  setup: HrSetup;
  token: string;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [subTab, setSubTab] = useState<"mark" | "report">("mark");
  const [roleId, setRoleId] = useState("");
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const [holiday, setHoliday] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [inTimes, setInTimes] = useState<Record<string, string>>({});
  const [outTimes, setOutTimes] = useState<Record<string, string>>({});
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  const activeStaff = useMemo(
    () => setup.staff.filter((member) => member.status === "ACTIVE"),
    [setup.staff],
  );

  const visibleStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activeStaff.filter((member) => {
      if (roleId && member.designation?.id !== roleId) return false;
      if (!query) return true;
      return `${staffName(member)} ${member.employeeNumber}`.toLowerCase().includes(query);
    });
  }, [activeStaff, roleId, search]);

  useEffect(() => {
    let cancelled = false;
    async function loadForDate() {
      try {
        const records = await apiRequest<SavedRecord[]>(
          `/hr/attendance?from=${date}&to=${date}`,
          token,
        );
        if (cancelled) return;
        const nextStatuses: Record<string, string> = {};
        const nextNotes: Record<string, string> = {};
        const nextIn: Record<string, string> = {};
        const nextOut: Record<string, string> = {};
        for (const member of activeStaff) {
          nextStatuses[member.id] = "PRESENT";
          nextNotes[member.id] = "";
          nextIn[member.id] = "";
          nextOut[member.id] = "";
        }
        for (const record of records) {
          nextStatuses[record.staff.id] = record.status;
          nextNotes[record.staff.id] = record.note ?? "";
          nextIn[record.staff.id] = record.inTime ?? "";
          nextOut[record.staff.id] = record.outTime ?? "";
        }
        setStatuses(nextStatuses);
        setNotes(nextNotes);
        setInTimes(nextIn);
        setOutTimes(nextOut);
        setAlreadySubmitted(records.length > 0);
        setHoliday(
          records.length > 0 && records.every((record) => record.status === "HOLIDAY"),
        );
      } catch (cause) {
        if (!cancelled) {
          onError(cause instanceof Error ? cause.message : "Unable to load attendance");
        }
      }
    }
    void loadForDate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, token, activeStaff]);

  function toggleHoliday(next: boolean) {
    setHoliday(next);
    setStatuses((current) => {
      const updated = { ...current };
      for (const member of visibleStaff) {
        updated[member.id] = next ? "HOLIDAY" : "PRESENT";
      }
      return updated;
    });
  }

  async function save() {
    if (!visibleStaff.length) return;
    setBusy(true);
    try {
      await apiRequest("/hr/attendance", token, {
        method: "POST",
        body: JSON.stringify({
          attendanceDate: date,
          records: visibleStaff.map((member) => {
            const status = statuses[member.id] ?? "PRESENT";
            const timed = status !== "ABSENT" && status !== "HOLIDAY";
            return {
              staffId: member.id,
              status,
              inTime: timed ? inTimes[member.id] || null : null,
              outTime: timed ? outTimes[member.id] || null : null,
              note: notes[member.id]?.trim() || null,
            };
          }),
        }),
      });
      notifySuccess("Attendance saved");
      setAlreadySubmitted(true);
      await onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save attendance");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4">
      <div className="nx-card overflow-hidden">
        <div className="flex border-b border-slate-100">
          {(
            [
              ["mark", "Mark Attendance"],
              ["report", "In/Out Time Report"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`border-b-2 px-5 py-3 text-[13px] font-semibold transition ${
                subTab === key
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
              onClick={() => setSubTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {subTab === "mark" ? (
          <>
            <div className="flex flex-wrap items-end gap-3 px-4 py-4">
              <label className="block w-44">
                <span className="nx-label">Staff Role</span>
                <select
                  className="nx-input mt-1 w-full"
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                >
                  <option value="">All Roles</option>
                  {setup.designations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block w-44">
                <span className="nx-label">Date</span>
                <input
                  className="nx-input mt-1 w-full"
                  type="date"
                  value={date}
                  max={today}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label className="block min-w-0 flex-1 basis-52">
                <span className="nx-label">Search staff</span>
                <div className="relative mt-1">
                  <input
                    className="nx-input w-full pr-9"
                    placeholder="Search by name or ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <SearchOutlined
                    sx={{ fontSize: 17 }}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </label>
              <label className="mb-2 ml-auto flex items-center gap-2 text-[13px] font-medium text-slate-600">
                Mark as holiday
                <button
                  type="button"
                  role="switch"
                  aria-checked={holiday}
                  className={`relative w-10 rounded-full transition ${
                    holiday ? "bg-indigo-600" : "bg-slate-200"
                  }`}
                  style={{ height: 22 }}
                  onClick={() => toggleHoliday(!holiday)}
                >
                  <span
                    className="absolute top-0.5 size-[18px] rounded-full bg-white shadow transition-all"
                    style={{ left: holiday ? 20 : 2 }}
                  />
                </button>
              </label>
            </div>

            <div className="overflow-x-auto">
              <table className="nx-table min-w-[900px]">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    <th className="w-12 px-4 py-3 text-left">#</th>
                    <th className="px-3 py-3 text-left">Staff Photo &amp; Name</th>
                    <th className="px-3 py-3 text-left">Role</th>
                    <th className="px-3 py-3 text-left">Attendance</th>
                    <th className="w-28 px-3 py-3 text-left">In Time</th>
                    <th className="w-28 px-3 py-3 text-left">Out Time</th>
                    <th className="w-56 px-4 py-3 text-left">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleStaff.map((member, index) => {
                    const current = statuses[member.id] ?? "PRESENT";
                    return (
                      <tr key={member.id} className="transition hover:bg-indigo-50/30">
                        <td className="px-4 py-3 text-slate-400">{index + 1}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <InitialsAvatar
                              name={staffName(member)}
                              photoUrl={member.photoUrl ?? member.user.avatarUrl}
                              size={38}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">
                                {staffName(member)}
                              </p>
                              <p className="truncate text-[12px] text-slate-400">
                                {member.employeeNumber}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {member.designation?.name ?? "—"}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {MARK_OPTIONS.map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition ${
                                  current === value
                                    ? ACTIVE_MARK_CLASS[value]
                                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                                }`}
                                onClick={() =>
                                  setStatuses({ ...statuses, [member.id]: value })
                                }
                              >
                                {label}
                              </button>
                            ))}
                            {current === "HOLIDAY" ? (
                              <span
                                className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold ${ACTIVE_MARK_CLASS.HOLIDAY}`}
                              >
                                Holiday
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <input
                            className="nx-input w-full !px-2"
                            type="time"
                            disabled={current === "ABSENT" || current === "HOLIDAY"}
                            value={inTimes[member.id] ?? ""}
                            onChange={(e) =>
                              setInTimes({ ...inTimes, [member.id]: e.target.value })
                            }
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            className="nx-input w-full !px-2"
                            type="time"
                            disabled={current === "ABSENT" || current === "HOLIDAY"}
                            value={outTimes[member.id] ?? ""}
                            onChange={(e) =>
                              setOutTimes({ ...outTimes, [member.id]: e.target.value })
                            }
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            className="nx-input w-full"
                            placeholder="Add note (optional)"
                            value={notes[member.id] ?? ""}
                            onChange={(e) =>
                              setNotes({ ...notes, [member.id]: e.target.value })
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!visibleStaff.length ? (
                <p className="px-5 py-10 text-center text-sm text-slate-500">
                  No active staff match the current filters.
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-indigo-600">
                <InfoOutlined sx={{ fontSize: 15 }} />
                {alreadySubmitted
                  ? "Attendance already submitted for this date — saving will update it."
                  : "If already submitted, you can only edit."}
              </span>
              <button
                type="button"
                className="nx-btn-primary"
                disabled={busy || !visibleStaff.length}
                onClick={() => void save()}
              >
                {busy ? "Saving…" : "Save attendance"}
              </button>
            </div>
          </>
        ) : (
          <InOutReportPanel setup={setup} token={token} onError={onError} />
        )}
      </div>
    </section>
  );
}

