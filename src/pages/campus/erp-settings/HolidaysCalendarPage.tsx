import { useEffect, useMemo, useState } from "react";
import {
  AddOutlined,
  ApartmentOutlined,
  CalendarMonthOutlined,
  CheckCircleOutline,
  ChevronLeft,
  ChevronRight,
  CloudUploadOutlined,
  DeleteOutline,
  DownloadOutlined,
  EditOutlined,
  EventAvailableOutlined,
  FilterListOutlined,
  GroupsOutlined,
  InfoOutlined,
  SearchOutlined,
  AccessTimeOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { API_URL, apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type CalendarType = "GAZETTED" | "OPTIONAL" | "RESTRICTED";
type TabKey = "calendar" | "list" | "groups" | "import" | "settings";

type Holiday = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  dateLabel: string;
  dayLabel: string;
  description: string | null;
  calendarType: CalendarType;
  typeLabel: string;
  status: "ACTIVE" | "INACTIVE";
  statusLabel: string;
  repeatsAnnually: boolean;
  academicSessionId: string | null;
  groupId: string | null;
  groupName: string;
  groupColor: string;
};

type Setup = {
  stats: {
    totalHolidays: number;
    upcomingHolidays: number;
    workingDays: number;
    restrictedDays: number;
    sessionName: string;
    sessionRange: string;
  };
  sessions: Array<{
    id: string;
    name: string;
    isCurrent: boolean;
    startDate: string;
    endDate: string;
  }>;
  selectedSessionId: string | null;
  groups: Array<{
    id: string;
    name: string;
    description: string | null;
    color: string;
    isActive: boolean;
    holidayCount: number;
  }>;
  holidays: Holiday[];
  settings: {
    sundayIsHoliday: boolean;
    saturdayIsHoliday: boolean;
    autoApplyAttendance: boolean;
    notifyParentsOnHoliday: boolean;
    showOnPortal: boolean;
    defaultCalendarType: CalendarType;
  };
  legend: Array<{ key: string; label: string; color: string }>;
  about: string[];
};

const inputClass =
  "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-primary";

const PAGE_SIZE = 8;

function typeBadge(type: CalendarType) {
  if (type === "OPTIONAL") return "bg-sky-50 text-sky-700";
  if (type === "RESTRICTED") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

function typeDot(type: CalendarType) {
  if (type === "OPTIONAL") return "bg-sky-500";
  if (type === "RESTRICTED") return "bg-amber-500";
  return "bg-emerald-500";
}

function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function buildMonthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: Date | null; iso: string | null }> = [];
  for (let i = 0; i < startPad; i += 1) cells.push({ date: null, iso: null });
  for (let d = 1; d <= daysInMonth; d += 1) {
    const date = new Date(year, month, d);
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ date, iso });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, iso: null });
  return cells;
}

export function HolidaysCalendarPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Holidays Calendar";
  const canManage = Boolean(
    user?.permissions.some((p) => ["erp.manage", "settings.manage"].includes(p)),
  );

  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabKey>("calendar");
  const [sessionId, setSessionId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | CalendarType>("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    startDate: "",
    endDate: "",
    calendarType: "GAZETTED" as CalendarType,
    groupId: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    description: "",
    repeatsAnnually: true,
  });

  const [groupForm, setGroupForm] = useState({
    id: "",
    name: "",
    description: "",
    color: "#7C3AED",
  });
  const [settingsForm, setSettingsForm] = useState<Setup["settings"] | null>(null);

  async function load(nextSessionId?: string) {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = nextSessionId || sessionId;
      const path = q
        ? `/erp/holidays-calendar?sessionId=${encodeURIComponent(q)}`
        : "/erp/holidays-calendar";
      const data = await apiRequest<Setup>(path, accessToken);
      setSetup(data);
      setSessionId(data.selectedSessionId || "");
      setSettingsForm(data.settings);
      if (data.holidays.length) {
        const first = data.holidays[0];
        const [y, m] = first.startDate.split("-").map(Number);
        if (!Number.isNaN(y) && !Number.isNaN(m)) {
          setCursor({ year: y, month: m - 1 });
        }
      }
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load holidays calendar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, Holiday[]>();
    for (const h of setup?.holidays || []) {
      const list = map.get(h.startDate) || [];
      list.push(h);
      map.set(h.startDate, list);
    }
    return map;
  }, [setup]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (setup?.holidays || []).filter((h) => {
      if (typeFilter && h.calendarType !== typeFilter) return false;
      if (!q) return true;
      return (
        h.title.toLowerCase().includes(q) ||
        h.groupName.toLowerCase().includes(q) ||
        h.typeLabel.toLowerCase().includes(q)
      );
    });
  }, [setup, search, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, sessionId]);

  function openCreate(dateIso?: string) {
    setEditingId(null);
    setForm({
      title: "",
      startDate: dateIso || selectedDate || "",
      endDate: dateIso || selectedDate || "",
      calendarType: setup?.settings.defaultCalendarType || "GAZETTED",
      groupId: setup?.groups[0]?.id || "",
      status: "ACTIVE",
      description: "",
      repeatsAnnually: true,
    });
    setModalOpen(true);
  }

  function openEdit(item: Holiday) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      startDate: item.startDate,
      endDate: item.endDate,
      calendarType: item.calendarType,
      groupId: item.groupId || "",
      status: item.status,
      description: item.description || "",
      repeatsAnnually: item.repeatsAnnually,
    });
    setModalOpen(true);
  }

  async function saveHoliday() {
    if (!accessToken || !canManage) return;
    if (!form.title.trim() || !form.startDate) {
      notifyError("Holiday name and date are required");
      return;
    }
    setSaving(true);
    try {
      const body = {
        academicSessionId: sessionId || null,
        groupId: form.groupId || null,
        title: form.title.trim(),
        startDate: form.startDate,
        endDate: form.endDate || form.startDate,
        calendarType: form.calendarType,
        status: form.status,
        description: form.description || null,
        repeatsAnnually: form.repeatsAnnually,
      };
      const data = editingId
        ? await apiRequest<Setup>(`/erp/holidays-calendar/holidays/${editingId}`, accessToken, {
            method: "PUT",
            body: JSON.stringify(body),
          })
        : await apiRequest<Setup>("/erp/holidays-calendar/holidays", accessToken, {
            method: "POST",
            body: JSON.stringify(body),
          });
      setSetup(data);
      setSettingsForm(data.settings);
      setModalOpen(false);
      notifySuccess(editingId ? "Holiday updated" : "Holiday added");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save holiday");
    } finally {
      setSaving(false);
    }
  }

  async function removeHoliday(item: Holiday) {
    if (!accessToken || !canManage) return;
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    try {
      const q = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
      const data = await apiRequest<Setup>(
        `/erp/holidays-calendar/holidays/${item.id}${q}`,
        accessToken,
        { method: "DELETE" },
      );
      setSetup(data);
      notifySuccess("Holiday deleted");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete holiday");
    }
  }

  async function saveGroup() {
    if (!accessToken || !canManage) return;
    if (!groupForm.name.trim()) {
      notifyError("Group name is required");
      return;
    }
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/holidays-calendar/groups", accessToken, {
        method: groupForm.id ? "PUT" : "POST",
        body: JSON.stringify({
          id: groupForm.id || undefined,
          name: groupForm.name.trim(),
          description: groupForm.description || null,
          color: groupForm.color,
        }),
      });
      setSetup(data);
      setGroupForm({ id: "", name: "", description: "", color: "#7C3AED" });
      notifySuccess(groupForm.id ? "Group updated" : "Group created");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save group");
    } finally {
      setSaving(false);
    }
  }

  async function removeGroup(id: string) {
    if (!accessToken || !canManage) return;
    if (!window.confirm("Delete this holiday group?")) return;
    try {
      const data = await apiRequest<Setup>(`/erp/holidays-calendar/groups/${id}`, accessToken, {
        method: "DELETE",
      });
      setSetup(data);
      notifySuccess("Group deleted");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete group");
    }
  }

  async function saveSettings() {
    if (!accessToken || !canManage || !settingsForm) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/holidays-calendar/settings", accessToken, {
        method: "PUT",
        body: JSON.stringify(settingsForm),
      });
      setSetup(data);
      setSettingsForm(data.settings);
      notifySuccess("Holiday settings saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function exportCalendar() {
    if (!accessToken) return;
    try {
      const q = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
      const response = await fetch(`${API_URL}/erp/holidays-calendar/export${q}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "holidays_calendar.csv";
      a.click();
      URL.revokeObjectURL(url);
      notifySuccess("Calendar exported");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to export");
    }
  }

  if (loading || !setup) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading holidays calendar…</div>;
  }

  const cells = buildMonthCells(cursor.year, cursor.month);
  const listSource = tab === "calendar" && selectedDate
    ? filtered.filter((h) => h.startDate === selectedDate)
    : filtered;
  const tableRows =
    tab === "calendar" && selectedDate
      ? listSource.slice(0, 20)
      : pageRows;

  const stats = [
    {
      label: "Total Holidays",
      value: String(setup.stats.totalHolidays),
      hint: "All holidays",
      icon: <CalendarMonthOutlined className="!text-[22px] text-primary" />,
      bg: "bg-violet-50",
    },
    {
      label: "Upcoming Holidays",
      value: String(setup.stats.upcomingHolidays),
      hint: "Next 60 days",
      icon: <EventAvailableOutlined className="!text-[22px] text-emerald-600" />,
      bg: "bg-emerald-50",
    },
    {
      label: "Total Working Days",
      value: String(setup.stats.workingDays),
      hint: "This Academic Session",
      icon: <CalendarMonthOutlined className="!text-[22px] text-sky-600" />,
      bg: "bg-sky-50",
    },
    {
      label: "Total Restricted Days",
      value: String(setup.stats.restrictedDays),
      hint: "Partial working days",
      icon: <AccessTimeOutlined className="!text-[22px] text-amber-600" />,
      bg: "bg-amber-50",
    },
    {
      label: "Academic Session",
      value: setup.stats.sessionName,
      hint: setup.stats.sessionRange,
      icon: <ApartmentOutlined className="!text-[22px] text-fuchsia-600" />,
      bg: "bg-fuchsia-50",
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">Holidays Calendar</h1>
          <p className="text-xs text-[#6B7280]">Manage and view holidays for the academic year.</p>
        </div>
        <button
          type="button"
          disabled={!canManage}
          onClick={() => openCreate()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <AddOutlined className="!text-[18px]" />
          Add Holiday
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm"
            >
              <div className={`mb-3 inline-flex rounded-lg p-2 ${card.bg}`}>{card.icon}</div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">
                {card.label}
              </p>
              <p className="mt-1 text-xl font-bold text-[#1A1A1A]">{card.value}</p>
              <p className="text-xs text-[#9CA3AF]">{card.hint}</p>
            </div>
          ))}
        </div>

        <section className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] px-4 pt-2 sm:px-5">
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["calendar", "Calendar View"],
                  ["list", "List View"],
                  ["groups", "Holiday Groups"],
                  ["import", "Import Holidays"],
                  ["settings", "Settings"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`border-b-2 px-3 py-3 text-xs font-semibold ${
                    tab === id
                      ? "border-primary text-primary"
                      : "border-transparent text-[#6B7280]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 pb-2">
              <select
                className={`${inputClass} w-auto`}
                value={sessionId}
                onChange={(e) => {
                  setSessionId(e.target.value);
                  void load(e.target.value);
                }}
              >
                {setup.sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {(tab === "calendar" || tab === "list") && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      setCursor({ year: now.getFullYear(), month: now.getMonth() });
                      setSelectedDate(
                        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
                      );
                    }}
                    className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs font-semibold text-[#374151]"
                  >
                    Today
                  </button>
                  <div className="inline-flex overflow-hidden rounded-lg border border-[#E5E7EB]">
                    <button
                      type="button"
                      className="px-2 py-2 hover:bg-[#F9FAFB]"
                      onClick={() =>
                        setCursor((prev) => {
                          const d = new Date(prev.year, prev.month - 1, 1);
                          return { year: d.getFullYear(), month: d.getMonth() };
                        })
                      }
                    >
                      <ChevronLeft className="!text-[18px]" />
                    </button>
                    <button
                      type="button"
                      className="px-2 py-2 hover:bg-[#F9FAFB]"
                      onClick={() =>
                        setCursor((prev) => {
                          const d = new Date(prev.year, prev.month + 1, 1);
                          return { year: d.getFullYear(), month: d.getMonth() };
                        })
                      }
                    >
                      <ChevronRight className="!text-[18px]" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFilters((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] px-3 py-2 text-xs font-semibold text-[#374151]"
                  >
                    <FilterListOutlined className="!text-[16px]" />
                    Filters
                  </button>
                </>
              )}
            </div>
          </div>

          {showFilters && (tab === "calendar" || tab === "list") ? (
            <div className="flex flex-wrap gap-2 border-b border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3 sm:px-5">
              {(
                [
                  ["", "All Types"],
                  ["GAZETTED", "Gazetted"],
                  ["OPTIONAL", "Optional"],
                  ["RESTRICTED", "Restricted"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setTypeFilter(value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    typeFilter === value
                      ? "bg-primary text-white"
                      : "bg-white text-[#6B7280] ring-1 ring-[#E5E7EB]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {(tab === "calendar" || tab === "list") && (
            <div
              className={`grid gap-0 ${
                tab === "calendar" ? "xl:grid-cols-[340px_minmax(0,1fr)]" : ""
              }`}
            >
              {tab === "calendar" ? (
                <div className="border-b border-[#E5E7EB] p-4 xl:border-b-0 xl:border-r">
                  <h3 className="mb-3 text-center text-sm font-bold text-[#1A1A1A]">
                    {monthLabel(cursor.year, cursor.month)}
                  </h3>
                  <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[#9CA3AF]">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                      <div key={d} className={d === "Sun" ? "text-rose-500" : ""}>
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-1">
                    {cells.map((cell, index) => {
                      if (!cell.date || !cell.iso) {
                        return <div key={`e-${index}`} className="h-10" />;
                      }
                      const isSunday = cell.date.getDay() === 0;
                      const items = holidaysByDate.get(cell.iso) || [];
                      const selected = selectedDate === cell.iso;
                      return (
                        <button
                          key={cell.iso}
                          type="button"
                          onClick={() => {
                            setSelectedDate(cell.iso);
                          }}
                          onDoubleClick={() => openCreate(cell.iso!)}
                          className={`flex h-10 flex-col items-center justify-center rounded-full text-sm ${
                            selected
                              ? "bg-primary font-bold text-white"
                              : isSunday
                                ? "font-semibold text-rose-500 hover:bg-rose-50"
                                : "text-[#1A1A1A] hover:bg-[#F3F4F6]"
                          }`}
                        >
                          {cell.date.getDate()}
                          <span className="mt-0.5 flex gap-0.5">
                            {items.slice(0, 3).map((h) => (
                              <span
                                key={h.id}
                                className={`h-1 w-1 rounded-full ${
                                  selected ? "bg-white" : typeDot(h.calendarType)
                                }`}
                              />
                            ))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 space-y-1.5 text-xs text-[#6B7280]">
                    {setup.legend.map((item) => (
                      <div key={item.key} className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.label}
                      </div>
                    ))}
                    <p className="pt-2 text-[11px] text-[#9CA3AF]">
                      Click on a date to view or add holiday.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="p-4 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#1A1A1A]">
                    {tab === "calendar" && selectedDate
                      ? `Holidays on ${selectedDate}`
                      : "Holiday List"}
                  </h3>
                  <div className="relative">
                    <SearchOutlined className="pointer-events-none absolute left-2 top-1/2 !text-[18px] -translate-y-1/2 text-[#9CA3AF]" />
                    <input
                      className={`${inputClass} w-56 pl-8`}
                      placeholder="Search holidays…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-[#E5E7EB] text-xs uppercase text-[#9CA3AF]">
                      <tr>
                        <th className="px-2 py-2 font-semibold">Date</th>
                        <th className="px-2 py-2 font-semibold">Day</th>
                        <th className="px-2 py-2 font-semibold">Holiday Name</th>
                        <th className="px-2 py-2 font-semibold">Type</th>
                        <th className="px-2 py-2 font-semibold">Holiday Group</th>
                        <th className="px-2 py-2 font-semibold">Status</th>
                        <th className="px-2 py-2 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-2 py-8 text-center text-[#9CA3AF]">
                            No holidays found.
                            {selectedDate && canManage ? (
                              <>
                                {" "}
                                <button
                                  type="button"
                                  className="font-semibold text-primary"
                                  onClick={() => openCreate(selectedDate)}
                                >
                                  Add one
                                </button>
                              </>
                            ) : null}
                          </td>
                        </tr>
                      ) : (
                        tableRows.map((item) => (
                          <tr key={item.id} className="border-b border-[#F3F4F6]">
                            <td className="px-2 py-2.5 whitespace-nowrap text-[#374151]">
                              {item.dateLabel}
                            </td>
                            <td className="px-2 py-2.5 text-[#374151]">{item.dayLabel}</td>
                            <td className="px-2 py-2.5 font-semibold text-[#1A1A1A]">
                              {item.title}
                            </td>
                            <td className="px-2 py-2.5">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeBadge(item.calendarType)}`}
                              >
                                {item.typeLabel}
                              </span>
                            </td>
                            <td className="px-2 py-2.5 text-[#374151]">{item.groupName}</td>
                            <td className="px-2 py-2.5">
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                {item.statusLabel}
                              </span>
                            </td>
                            <td className="px-2 py-2.5">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={!canManage}
                                  onClick={() => openEdit(item)}
                                  className="rounded p-1 text-primary hover:bg-primary/10 disabled:opacity-40"
                                >
                                  <EditOutlined className="!text-[18px]" />
                                </button>
                                <button
                                  type="button"
                                  disabled={!canManage}
                                  onClick={() => void removeHoliday(item)}
                                  className="rounded p-1 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                                >
                                  <DeleteOutline className="!text-[18px]" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {!(tab === "calendar" && selectedDate) ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7280]">
                    <p>
                      Showing{" "}
                      {filtered.length
                        ? `${(page - 1) * PAGE_SIZE + 1} to ${Math.min(page * PAGE_SIZE, filtered.length)}`
                        : "0"}{" "}
                      of {filtered.length} entries
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="rounded border border-[#E5E7EB] px-2 py-1 disabled:opacity-40"
                      >
                        <ChevronLeft className="!text-[16px]" />
                      </button>
                      {Array.from({ length: Math.min(4, totalPages) }, (_, i) => i + 1).map(
                        (n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setPage(n)}
                            className={`min-w-7 rounded px-2 py-1 font-semibold ${
                              page === n
                                ? "bg-primary text-white"
                                : "border border-[#E5E7EB] text-[#374151]"
                            }`}
                          >
                            {n}
                          </button>
                        ),
                      )}
                      <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="rounded border border-[#E5E7EB] px-2 py-1 disabled:opacity-40"
                      >
                        <ChevronRight className="!text-[16px]" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {tab === "groups" ? (
            <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="rounded-xl border border-[#E5E7EB] p-4">
                <h3 className="mb-3 text-sm font-bold text-[#1A1A1A]">
                  {groupForm.id ? "Edit Group" : "Add Holiday Group"}
                </h3>
                <div className="space-y-3">
                  <input
                    className={inputClass}
                    placeholder="Group name"
                    value={groupForm.name}
                    onChange={(e) => setGroupForm((p) => ({ ...p, name: e.target.value }))}
                  />
                  <textarea
                    className={inputClass}
                    rows={3}
                    placeholder="Description"
                    value={groupForm.description}
                    onChange={(e) =>
                      setGroupForm((p) => ({ ...p, description: e.target.value }))
                    }
                  />
                  <label className="block text-xs font-semibold text-[#6B7280]">
                    Color
                    <input
                      type="color"
                      className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-[#E5E7EB]"
                      value={groupForm.color}
                      onChange={(e) => setGroupForm((p) => ({ ...p, color: e.target.value }))}
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!canManage || saving}
                      onClick={() => void saveGroup()}
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {groupForm.id ? "Update" : "Add Group"}
                    </button>
                    {groupForm.id ? (
                      <button
                        type="button"
                        onClick={() =>
                          setGroupForm({ id: "", name: "", description: "", color: "#7C3AED" })
                        }
                        className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {setup.groups.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: g.color }}
                      />
                      <div>
                        <p className="text-sm font-semibold text-[#1A1A1A]">{g.name}</p>
                        <p className="text-xs text-[#9CA3AF]">
                          {g.holidayCount} holidays · {g.description || "No description"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={!canManage}
                        onClick={() =>
                          setGroupForm({
                            id: g.id,
                            name: g.name,
                            description: g.description || "",
                            color: g.color,
                          })
                        }
                        className="rounded p-1 text-primary hover:bg-primary/10"
                      >
                        <EditOutlined className="!text-[18px]" />
                      </button>
                      <button
                        type="button"
                        disabled={!canManage}
                        onClick={() => void removeGroup(g.id)}
                        className="rounded p-1 text-rose-600 hover:bg-rose-50"
                      >
                        <DeleteOutline className="!text-[18px]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {tab === "import" ? (
            <div className="p-4 sm:p-5">
              <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#FAFAFA] px-4 py-12 text-center">
                <CloudUploadOutlined className="mb-2 !text-[40px] text-primary" />
                <p className="text-sm font-semibold text-[#1A1A1A]">Import holidays from CSV</p>
                <p className="mt-1 text-xs text-[#9CA3AF]">
                  Columns: title, startDate, endDate, type, group
                </p>
                <button
                  type="button"
                  onClick={() =>
                    notifySuccess("CSV import parser will map rows into this academic session")
                  }
                  className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
                >
                  Choose CSV File
                </button>
              </div>
            </div>
          ) : null}

          {tab === "settings" && settingsForm ? (
            <div className="space-y-3 p-4 sm:p-5">
              {(
                [
                  ["sundayIsHoliday", "Treat Sunday as weekly holiday"],
                  ["saturdayIsHoliday", "Treat Saturday as weekly holiday"],
                  ["autoApplyAttendance", "Auto-apply holidays to attendance"],
                  ["notifyParentsOnHoliday", "Notify parents on holiday declaration"],
                  ["showOnPortal", "Show holidays on student/parent portal"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-[#374151]">
                  <input
                    type="checkbox"
                    checked={settingsForm[key]}
                    disabled={!canManage}
                    onChange={(e) =>
                      setSettingsForm((prev) =>
                        prev ? { ...prev, [key]: e.target.checked } : prev,
                      )
                    }
                    className="accent-primary"
                  />
                  {label}
                </label>
              ))}
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-semibold text-[#6B7280]">
                  Default Holiday Type
                </span>
                <select
                  className={inputClass}
                  value={settingsForm.defaultCalendarType}
                  disabled={!canManage}
                  onChange={(e) =>
                    setSettingsForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            defaultCalendarType: e.target.value as CalendarType,
                          }
                        : prev,
                    )
                  }
                >
                  <option value="GAZETTED">Gazetted</option>
                  <option value="OPTIONAL">Optional</option>
                  <option value="RESTRICTED">Restricted</option>
                </select>
              </label>
              <button
                type="button"
                disabled={!canManage || saving}
                onClick={() => void saveSettings()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save Settings
              </button>
            </div>
          ) : null}
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <InfoOutlined className="!text-[18px] text-sky-600" />
              <h2 className="text-sm font-bold text-[#1A1A1A]">About Holidays Calendar</h2>
            </div>
            <ul className="space-y-2 text-sm text-[#374151]">
              {setup.about.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <CheckCircleOutline className="mt-0.5 !text-[16px] text-emerald-500" />
                  {line}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!canManage}
                onClick={() => openCreate()}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm font-semibold text-primary"
              >
                <AddOutlined className="!text-[18px]" />
                Add Holiday
              </button>
              <button
                type="button"
                onClick={() => setTab("import")}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm font-semibold text-primary"
              >
                <CloudUploadOutlined className="!text-[18px]" />
                Import Holidays
              </button>
              <button
                type="button"
                onClick={() => void exportCalendar()}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm font-semibold text-primary"
              >
                <DownloadOutlined className="!text-[18px]" />
                Export Calendar
              </button>
              <button
                type="button"
                onClick={() => setTab("groups")}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm font-semibold text-primary"
              >
                <GroupsOutlined className="!text-[18px]" />
                Holiday Groups
              </button>
            </div>
          </section>
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold text-[#1A1A1A]">
              {editingId ? "Edit Holiday" : "Add Holiday"}
            </h3>
            <div className="mt-4 space-y-3">
              <input
                className={inputClass}
                placeholder="Holiday name"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-semibold text-[#6B7280]">
                  Start Date
                  <input
                    type="date"
                    className={`${inputClass} mt-1`}
                    value={form.startDate}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        startDate: e.target.value,
                        endDate: p.endDate || e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="block text-xs font-semibold text-[#6B7280]">
                  End Date
                  <input
                    type="date"
                    className={`${inputClass} mt-1`}
                    value={form.endDate}
                    onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className={inputClass}
                  value={form.calendarType}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      calendarType: e.target.value as CalendarType,
                    }))
                  }
                >
                  <option value="GAZETTED">Gazetted</option>
                  <option value="OPTIONAL">Optional</option>
                  <option value="RESTRICTED">Restricted</option>
                </select>
                <select
                  className={inputClass}
                  value={form.groupId}
                  onChange={(e) => setForm((p) => ({ ...p, groupId: e.target.value }))}
                >
                  <option value="">No group</option>
                  {setup.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <select
                className={inputClass}
                value={form.status}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    status: e.target.value as "ACTIVE" | "INACTIVE",
                  }))
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <textarea
                className={inputClass}
                rows={3}
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.repeatsAnnually}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, repeatsAnnually: e.target.checked }))
                  }
                />
                Repeats annually
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveHoliday()}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : editingId ? "Update" : "Add Holiday"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
