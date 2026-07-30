import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { PageHeader } from "../../components/AppShell";
import { apiRequest } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";

type Weekday = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
interface Named { id: string; name: string }
interface Teacher { id: string; firstName: string; lastName: string }
interface ClassSection {
  id: string;
  academicSessionId: string;
  academicClass: Named;
  section: Named;
  subjects: Array<{ id: string; subject: Named; teacher: Teacher | null }>;
}
interface Entry {
  id: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  room: string | null;
  classSection: ClassSection;
  classSubject: { id: string; subject: Named };
  teacher: Teacher | null;
}
interface Setup {
  currentSession: Named | null;
  sessions: Named[];
  classSections: ClassSection[];
  teachers: Teacher[];
  entries: Entry[];
}

const weekdays: Weekday[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

export function TimetablePage() {
  const { accessToken, user } = useAuth();
  const canManage = Boolean(user?.permissions.includes("timetable.manage"));
  const [setup, setSetup] = useState<Setup | null>(null);
  const [filter, setFilter] = useState({ classSectionId: "", teacherId: "" });
  const [form, setForm] = useState({
    academicSessionId: "",
    classSectionId: "",
    classSubjectId: "",
    teacherId: "",
    weekday: "MONDAY" as Weekday,
    startTime: "09:00",
    endTime: "10:00",
    room: "",
  });
  const [free, setFree] = useState<ClassSection[]>([]);
  const section = setup?.classSections.find(({ id }) => id === form.classSectionId);
  const visible = useMemo(
    () => setup?.entries.filter((entry) =>
      (!filter.classSectionId || entry.classSection.id === filter.classSectionId) &&
      (!filter.teacherId || entry.teacher?.id === filter.teacherId)) ?? [],
    [setup, filter],
  );

  async function load() {
    try {
      const next = await apiRequest<Setup>("/timetable/setup", accessToken);
      setSetup(next);
      setForm((current) => ({
        ...current,
        academicSessionId: current.academicSessionId || next.currentSession?.id || "",
      }));
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load timetable");
    }
  }
  useEffect(() => { void load(); }, [accessToken]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/timetable/entries", accessToken, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          teacherId: form.teacherId || null,
          room: form.room || null,
        }),
      });
      notifySuccess("Timetable period added");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to add timetable period");
    }
  }

  async function remove(id: string) {
    try {
      await apiRequest(`/timetable/entries/${id}`, accessToken, { method: "DELETE" });
      notifySuccess("Timetable period deleted");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete timetable period");
    }
  }

  async function findFree() {
    if (!form.academicSessionId) return;
    try {
      const query = new URLSearchParams({
        sessionId: form.academicSessionId,
        weekday: form.weekday,
        startTime: form.startTime,
        endTime: form.endTime,
      });
      setFree(await apiRequest<ClassSection[]>(`/timetable/reports/free-periods?${query}`, accessToken));
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to generate free-period report");
    }
  }

  return (
    <main className="page-main">
      <PageHeader
        eyebrow="Shared academics"
        title="Class and teacher timetable"
        description="Schedule periods with automatic class and teacher conflict checks."
        action={<span className="badge">{setup?.currentSession?.name ?? "No current session"}</span>}
      />
      <div className="page-scroll">
      <section className={`mt-8 grid gap-5 ${canManage ? "lg:grid-cols-[360px_1fr]" : ""}`}>
        {canManage && <form className="card p-5" onSubmit={submit}>
          <h2 className="font-semibold">Add period</h2>
          <select className="input mt-4" required value={form.academicSessionId} onChange={(e) => setForm({ ...form, academicSessionId: e.target.value })}>
            <option value="">Academic session</option>{setup?.sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select className="input mt-3" required value={form.classSectionId} onChange={(e) => setForm({ ...form, classSectionId: e.target.value, classSubjectId: "", teacherId: "" })}>
            <option value="">Class section</option>{setup?.classSections.map((item) => <option key={item.id} value={item.id}>{item.academicClass.name} · {item.section.name}</option>)}
          </select>
          <select className="input mt-3" required value={form.classSubjectId} onChange={(e) => {
            const subject = section?.subjects.find(({ id }) => id === e.target.value);
            setForm({ ...form, classSubjectId: e.target.value, teacherId: subject?.teacher?.id ?? "" });
          }}>
            <option value="">Subject</option>{section?.subjects.map((item) => <option key={item.id} value={item.id}>{item.subject.name}</option>)}
          </select>
          <select className="input mt-3" value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
            <option value="">Assigned teacher</option>{setup?.teachers.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}
          </select>
          <select className="input mt-3" value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value as Weekday })}>
            {weekdays.map((day) => <option key={day} value={day}>{day[0]}{day.slice(1).toLowerCase()}</option>)}
          </select>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <input className="input" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            <input className="input" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </div>
          <input className="input mt-3" placeholder="Room" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
          <div className="mt-4 flex gap-2"><button className="button-primary">Add period</button><button className="button-secondary" type="button" onClick={() => void findFree()}>Find free classes</button></div>
          {free.length > 0 && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm"><p className="font-semibold">Free classes</p>{free.map((item) => <p key={item.id}>{item.academicClass.name} · {item.section.name}</p>)}</div>}
        </form>}

        <div>
          <div className="card grid gap-3 p-4 sm:grid-cols-2">
            <select className="input" value={filter.classSectionId} onChange={(e) => setFilter({ ...filter, classSectionId: e.target.value })}><option value="">All classes</option>{setup?.classSections.map((item) => <option key={item.id} value={item.id}>{item.academicClass.name} · {item.section.name}</option>)}</select>
            <select className="input" value={filter.teacherId} onChange={(e) => setFilter({ ...filter, teacherId: e.target.value })}><option value="">All teachers</option>{setup?.teachers.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}</select>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {weekdays.map((day) => {
              const entries = visible.filter((entry) => entry.weekday === day);
              return <div className="card overflow-hidden" key={day}>
                <div className="border-b border-slate-100 px-5 py-4 font-semibold">{day[0]}{day.slice(1).toLowerCase()}</div>
                <div className="divide-y divide-slate-100">{entries.map((entry) => <div className="flex justify-between gap-3 p-4" key={entry.id}><div><p className="font-medium">{entry.startTime}–{entry.endTime} · {entry.classSubject.subject.name}</p><p className="text-sm text-slate-500">{entry.classSection.academicClass.name} {entry.classSection.section.name} · {entry.teacher ? `${entry.teacher.firstName} ${entry.teacher.lastName}` : "No teacher"} · {entry.room ?? "No room"}</p></div><button className="text-sm font-semibold text-rose-600" onClick={() => void remove(entry.id)}>Delete</button></div>)}{!entries.length && <p className="p-5 text-sm text-slate-500">No periods.</p>}</div>
              </div>;
            })}
          </div>
        </div>
      </section>
      </div>
    </main>
  );
}
