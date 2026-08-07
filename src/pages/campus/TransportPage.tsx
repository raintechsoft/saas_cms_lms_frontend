import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  DirectionsBusOutlined,
  HistoryOutlined,
  LocalShippingOutlined,
  PeopleOutlined,
  PlaceOutlined,
  RouteOutlined,
  DeleteOutline,
  EditOutlined,
  PersonPinCircleOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import {
  CmsFooter,
  CmsKpiCard,
  CmsKpiGrid,
  CmsPage,
  CmsPageHeader,
  CmsScrollBody,
  CmsSectionCard,
} from "../../components/cms/CmsLayout";
import { CmsIconTabs, type CmsIconTabItem } from "../../components/cms/CmsIconTabs";
import { ListPagination, paginateItems } from "../../components/ListPagination";
import { apiRequest } from "../../lib/api";
import { confirmDelete } from "../../lib/confirm";
import { notifyError, notifySuccess } from "../../lib/notify";

type Tab = "routes" | "roster" | "assign" | "history";

interface TransportStop {
  name: string;
  sequence?: number;
  fare?: number | null;
}

interface TransportRoute {
  id: string;
  name: string;
  code: string | null;
  vehicleNumber: string | null;
  driverName: string | null;
  driverPhone: string | null;
  stops: TransportStop[];
  fareAmount: string | null;
  isActive: boolean;
  notes: string | null;
  _count: { students: number };
}

interface StudentOption {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
  transportOptIn: boolean;
  transportRoute: string | null;
  transportRouteId: string | null;
  transportStopName: string | null;
}

interface RouteStudent {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
  transportStopName: string | null;
}

interface AssignmentLog {
  id: string;
  action: string;
  stopName: string | null;
  note: string | null;
  createdAt: string;
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string | null;
  };
  transportRoute: { id: string; name: string } | null;
  assignedBy: { id: string; firstName: string; lastName: string | null } | null;
}

const TABS: Array<CmsIconTabItem<Tab>> = [
  { key: "routes", label: "Routes & stops", shortLabel: "Routes", icon: RouteOutlined, tone: "sky" },
  { key: "roster", label: "Route roster", shortLabel: "Roster", icon: PeopleOutlined, tone: "emerald" },
  { key: "assign", label: "Assign students", shortLabel: "Assign", icon: DirectionsBusOutlined, tone: "indigo" },
  { key: "history", label: "History", shortLabel: "History", icon: HistoryOutlined, tone: "amber" },
];

const PAGE_SIZE = 8;

function studentLabel(student: { firstName: string; lastName: string | null }) {
  return `${student.firstName} ${student.lastName ?? ""}`.trim();
}

function emptyStop(): TransportStop {
  return { name: "", sequence: 1, fare: null };
}

function actionPill(action: string) {
  const upper = action.toUpperCase();
  if (upper === "ASSIGNED") return "nx-pill nx-pill-success";
  if (upper === "CLEARED") return "nx-pill nx-pill-neutral";
  if (upper === "UPDATED") return "nx-pill nx-pill-indigo";
  return "nx-pill nx-pill-warning";
}

function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
        {icon}
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-bold tracking-tight text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function TransportPage() {
  const { accessToken, user } = useAuth();
  const [tab, setTab] = useState<Tab>("routes");
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [logs, setLogs] = useState<AssignmentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [fareAmount, setFareAmount] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [stops, setStops] = useState<TransportStop[]>([emptyStop()]);
  const [assignStudentId, setAssignStudentId] = useState("");
  const [assignRouteId, setAssignRouteId] = useState("");
  const [assignStopName, setAssignStopName] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [rosterRouteId, setRosterRouteId] = useState("");
  const [rosterStudents, setRosterStudents] = useState<RouteStudent[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  const canManage = user?.permissions.includes("transport.manage") ?? false;
  const pageRows = useMemo(() => paginateItems(routes, page, PAGE_SIZE), [routes, page]);
  const activeRoutes = useMemo(() => routes.filter((route) => route.isActive), [routes]);
  const selectedAssignRoute = useMemo(
    () => activeRoutes.find((route) => route.id === assignRouteId) ?? null,
    [activeRoutes, assignRouteId],
  );
  const totalStudents = useMemo(
    () => routes.reduce((sum, route) => sum + route._count.students, 0),
    [routes],
  );
  const totalStops = useMemo(
    () => routes.reduce((sum, route) => sum + (route.stops?.length ?? 0), 0),
    [routes],
  );

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(routes.length / PAGE_SIZE));
    if (page > maxPage) setPage(maxPage);
  }, [routes.length, page]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setCode("");
    setVehicleNumber("");
    setDriverName("");
    setDriverPhone("");
    setFareAmount("");
    setIsActive(true);
    setNotes("");
    setStops([emptyStop()]);
    setShowForm(false);
  }

  async function load() {
    try {
      const [routeRows, studentList, logRows] = await Promise.all([
        apiRequest<TransportRoute[]>("/transport/routes", accessToken),
        apiRequest<{ items: StudentOption[] }>("/students?limit=100&status=ACTIVE", accessToken),
        apiRequest<AssignmentLog[]>("/transport/logs?take=100", accessToken),
      ]);
      setRoutes(
        routeRows.map((route) => ({
          ...route,
          stops: Array.isArray(route.stops) ? route.stops : [],
        })),
      );
      setStudents(studentList.items);
      setLogs(logRows);
      setPage(1);
      if (!rosterRouteId && routeRows[0]) setRosterRouteId(routeRows[0].id);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load transport data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  useEffect(() => {
    if (!rosterRouteId) {
      setRosterStudents([]);
      return;
    }
    let cancelled = false;
    setRosterLoading(true);
    void apiRequest<{ students: RouteStudent[] }>(
      `/transport/routes/${rosterRouteId}/students`,
      accessToken,
    )
      .then((data) => {
        if (!cancelled) setRosterStudents(data.students);
      })
      .catch((cause) => {
        if (!cancelled) {
          notifyError(cause instanceof Error ? cause.message : "Unable to load roster");
          setRosterStudents([]);
        }
      })
      .finally(() => {
        if (!cancelled) setRosterLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, rosterRouteId]);

  function startEdit(route: TransportRoute) {
    setEditingId(route.id);
    setName(route.name);
    setCode(route.code ?? "");
    setVehicleNumber(route.vehicleNumber ?? "");
    setDriverName(route.driverName ?? "");
    setDriverPhone(route.driverPhone ?? "");
    setFareAmount(route.fareAmount ?? "");
    setIsActive(route.isActive);
    setNotes(route.notes ?? "");
    setStops(route.stops.length ? route.stops.map((s) => ({ ...s })) : [emptyStop()]);
    setShowForm(true);
  }

  async function saveRoute(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setSubmitting(true);
    const cleanedStops = stops
      .map((stop, index) => ({
        name: stop.name.trim(),
        sequence: stop.sequence ?? index + 1,
        fare: stop.fare == null ? null : Number(stop.fare),
      }))
      .filter((stop) => stop.name);
    const payload = {
      name,
      code: code || null,
      vehicleNumber: vehicleNumber || null,
      driverName: driverName || null,
      driverPhone: driverPhone || null,
      fareAmount: fareAmount ? Number(fareAmount) : null,
      isActive,
      notes: notes || null,
      stops: cleanedStops,
    };
    try {
      if (editingId) {
        await apiRequest(`/transport/routes/${editingId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        notifySuccess("Route updated");
      } else {
        await apiRequest("/transport/routes", accessToken, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        notifySuccess("Route created");
      }
      resetForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save route");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!canManage) return;
    const ok = await confirmDelete({
      title: "Delete route?",
      text: "Students on this route will be unassigned.",
    });
    if (!ok) return;
    try {
      await apiRequest(`/transport/routes/${id}`, accessToken, { method: "DELETE" });
      if (editingId === id) resetForm();
      if (rosterRouteId === id) setRosterRouteId("");
      notifySuccess("Route deleted");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete route");
    }
  }

  async function assignStudent(event: FormEvent) {
    event.preventDefault();
    if (!canManage || !assignStudentId) return;
    setSubmitting(true);
    try {
      await apiRequest("/transport/assign", accessToken, {
        method: "POST",
        body: JSON.stringify({
          studentId: assignStudentId,
          routeId: assignRouteId || null,
          stopName: assignRouteId ? assignStopName || null : null,
          note: assignNote || null,
        }),
      });
      notifySuccess(assignRouteId ? "Student assigned to route" : "Transport assignment cleared");
      setAssignStudentId("");
      setAssignRouteId("");
      setAssignStopName("");
      setAssignNote("");
      await load();
      if (assignRouteId && rosterRouteId === assignRouteId) {
        const data = await apiRequest<{ students: RouteStudent[] }>(
          `/transport/routes/${assignRouteId}/students`,
          accessToken,
        );
        setRosterStudents(data.students);
      }
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to assign student");
    } finally {
      setSubmitting(false);
    }
  }

  const rosterRoute = routes.find((r) => r.id === rosterRouteId) ?? null;

  return (
    <CmsPage>
      <CmsPageHeader
        title="Transport"
        description="Manage bus routes, pickup stops, and student assignments."
        actions={
          canManage && tab === "routes" ? (
            <button
              type="button"
              className="nx-btn-primary"
              onClick={() => {
                if (showForm && !editingId) resetForm();
                else {
                  setEditingId(null);
                  setShowForm(true);
                }
              }}
            >
              <AddOutlined sx={{ fontSize: 16 }} />
              {showForm && !editingId ? "Close form" : "Add route"}
            </button>
          ) : null
        }
      />

      <CmsKpiGrid>
        <CmsKpiCard
          icon={<RouteOutlined sx={{ fontSize: 20 }} />}
          label="Active routes"
          value={activeRoutes.length}
          tint="#0284c7"
        />
        <CmsKpiCard
          icon={<PeopleOutlined sx={{ fontSize: 20 }} />}
          label="Students on transport"
          value={totalStudents}
          tint="#059669"
        />
        <CmsKpiCard
          icon={<PlaceOutlined sx={{ fontSize: 20 }} />}
          label="Pickup stops"
          value={totalStops}
          tint="#4f46e5"
        />
        <CmsKpiCard
          icon={<HistoryOutlined sx={{ fontSize: 20 }} />}
          label="Recent changes"
          value={logs.length}
          tint="#d97706"
        />
      </CmsKpiGrid>

      <CmsIconTabs
        ariaLabel="Transport sections"
        value={tab}
        onChange={setTab}
        columnsClass="grid-cols-2 sm:grid-cols-4"
        items={TABS}
      />

      <CmsScrollBody className="space-y-4 pt-4">
        {tab === "routes" ? (
          <>
            {canManage && showForm ? (
              <CmsSectionCard className="overflow-hidden !p-0">
                <div className="border-b border-sky-100 bg-gradient-to-r from-sky-50 via-white to-indigo-50/40 px-5 py-4">
                  <SectionTitle
                    title={editingId ? "Edit route" : "New route"}
                    subtitle="Vehicle, driver, fare, and ordered pickup stops."
                  />
                </div>
                <form className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3" onSubmit={saveRoute}>
                  <label>
                    <span className="nx-label">Route name *</span>
                    <input className="nx-input w-full" value={name} onChange={(e) => setName(e.target.value)} required />
                  </label>
                  <label>
                    <span className="nx-label">Code</span>
                    <input className="nx-input w-full" value={code} onChange={(e) => setCode(e.target.value)} placeholder="R-01" />
                  </label>
                  <label>
                    <span className="nx-label">Vehicle number</span>
                    <input className="nx-input w-full" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="KL-07-AB-1234" />
                  </label>
                  <label>
                    <span className="nx-label">Driver name</span>
                    <input className="nx-input w-full" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
                  </label>
                  <label>
                    <span className="nx-label">Driver phone</span>
                    <input className="nx-input w-full" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
                  </label>
                  <label>
                    <span className="nx-label">Default fare (₹)</span>
                    <input className="nx-input w-full" type="number" min="0" step="0.01" value={fareAmount} onChange={(e) => setFareAmount(e.target.value)} />
                  </label>
                  <label className="flex items-center gap-2 pt-6 text-sm sm:col-span-2">
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                    <span className="font-medium text-slate-700">Active route</span>
                  </label>
                  <label className="sm:col-span-3">
                    <span className="nx-label">Notes</span>
                    <textarea className="nx-input w-full" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </label>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:col-span-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <PlaceOutlined sx={{ fontSize: 18 }} className="text-sky-600" />
                        <span className="text-sm font-semibold text-slate-800">Pickup stops</span>
                      </div>
                      <button
                        type="button"
                        className="nx-btn-secondary text-xs"
                        onClick={() =>
                          setStops((prev) => [
                            ...prev,
                            { name: "", sequence: prev.length + 1, fare: null },
                          ])
                        }
                      >
                        <AddOutlined sx={{ fontSize: 14 }} /> Add stop
                      </button>
                    </div>
                    <div className="space-y-2">
                      {stops.map((stop, index) => (
                        <div
                          key={index}
                          className="grid items-center gap-2 rounded-lg border border-white bg-white p-2 shadow-sm sm:grid-cols-12"
                        >
                          <input
                            className="nx-input sm:col-span-1"
                            type="number"
                            min="1"
                            title="Sequence"
                            value={stop.sequence ?? index + 1}
                            onChange={(e) => {
                              const next = [...stops];
                              next[index] = { ...stop, sequence: Number(e.target.value) || index + 1 };
                              setStops(next);
                            }}
                          />
                          <input
                            className="nx-input sm:col-span-7"
                            placeholder="Stop name"
                            value={stop.name}
                            onChange={(e) => {
                              const next = [...stops];
                              next[index] = { ...stop, name: e.target.value };
                              setStops(next);
                            }}
                          />
                          <input
                            className="nx-input sm:col-span-3"
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Fare"
                            value={stop.fare ?? ""}
                            onChange={(e) => {
                              const next = [...stops];
                              next[index] = {
                                ...stop,
                                fare: e.target.value === "" ? null : Number(e.target.value),
                              };
                              setStops(next);
                            }}
                          />
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-600 hover:bg-rose-100 sm:col-span-1"
                            onClick={() =>
                              setStops((prev) =>
                                prev.length === 1 ? [emptyStop()] : prev.filter((_, i) => i !== index),
                              )
                            }
                          >
                            <DeleteOutline sx={{ fontSize: 16 }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:col-span-3">
                    <button type="submit" className="nx-btn-primary" disabled={submitting}>
                      {editingId ? "Update route" : "Create route"}
                    </button>
                    <button type="button" className="nx-btn-secondary" onClick={resetForm}>
                      Cancel
                    </button>
                  </div>
                </form>
              </CmsSectionCard>
            ) : null}

            <CmsSectionCard className="overflow-hidden !p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
                <SectionTitle title="All routes" subtitle={`${routes.length} route${routes.length === 1 ? "" : "s"} configured`} />
              </div>
              {loading ? (
                <EmptyState icon={<LocalShippingOutlined />} title="Loading routes…" />
              ) : !routes.length ? (
                <EmptyState
                  icon={<DirectionsBusOutlined />}
                  title="No transport routes yet"
                  hint={canManage ? "Create a route with vehicle details and pickup stops." : undefined}
                />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="nx-table min-w-full text-left">
                      <thead>
                        <tr>
                          <th>Route</th>
                          <th>Vehicle / driver</th>
                          <th>Stops</th>
                          <th>Students</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((route) => (
                          <tr key={route.id}>
                            <td>
                              <p className="font-semibold text-slate-900">{route.name}</p>
                              {route.code ? (
                                <span className="mt-1 inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                                  {route.code}
                                </span>
                              ) : null}
                            </td>
                            <td>
                              <p className="font-medium text-slate-800">{route.vehicleNumber ?? "—"}</p>
                              {route.driverName ? (
                                <p className="text-xs text-slate-500">
                                  {route.driverName}
                                  {route.driverPhone ? ` · ${route.driverPhone}` : ""}
                                </p>
                              ) : null}
                            </td>
                            <td>
                              {route.stops.length ? (
                                <div className="flex max-w-xs flex-wrap gap-1">
                                  {route.stops.slice(0, 4).map((stop) => (
                                    <span
                                      key={stop.name}
                                      className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-100"
                                    >
                                      <PlaceOutlined sx={{ fontSize: 11 }} />
                                      {stop.name}
                                    </span>
                                  ))}
                                  {route.stops.length > 4 ? (
                                    <span className="text-[10px] font-semibold text-slate-500">
                                      +{route.stops.length - 4}
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-slate-400">No stops</span>
                              )}
                            </td>
                            <td>
                              <span className="inline-flex min-w-[2rem] items-center justify-center rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                                {route._count.students}
                              </span>
                            </td>
                            <td>
                              <span className={route.isActive ? "nx-pill nx-pill-success" : "nx-pill nx-pill-neutral"}>
                                {route.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td>
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  className="nx-btn-secondary !px-2 !py-1 text-xs"
                                  onClick={() => {
                                    setRosterRouteId(route.id);
                                    setTab("roster");
                                  }}
                                  title="View roster"
                                >
                                  <PeopleOutlined sx={{ fontSize: 14 }} />
                                </button>
                                {canManage ? (
                                  <>
                                    <button
                                      type="button"
                                      className="nx-btn-secondary !px-2 !py-1 text-xs"
                                      onClick={() => startEdit(route)}
                                    >
                                      <EditOutlined sx={{ fontSize: 14 }} />
                                    </button>
                                    <button
                                      type="button"
                                      className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-rose-600 hover:bg-rose-100"
                                      onClick={() => void remove(route.id)}
                                    >
                                      <DeleteOutline sx={{ fontSize: 14 }} />
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ListPagination page={page} pageSize={PAGE_SIZE} total={routes.length} onPageChange={setPage} />
                </>
              )}
            </CmsSectionCard>
          </>
        ) : null}

        {tab === "roster" ? (
          <CmsSectionCard className="overflow-hidden !p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-white px-5 py-3.5">
              <SectionTitle
                title="Route roster"
                subtitle={
                  rosterRoute
                    ? `${rosterRoute.name} · ${rosterStudents.length} student${rosterStudents.length === 1 ? "" : "s"}`
                    : "Select a route to view assigned students"
                }
              />
              <select
                className="nx-input w-full max-w-xs text-sm"
                value={rosterRouteId}
                onChange={(e) => setRosterRouteId(e.target.value)}
              >
                <option value="">Select route</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name} ({route._count.students})
                  </option>
                ))}
              </select>
            </div>
            {rosterLoading ? (
              <EmptyState icon={<PeopleOutlined />} title="Loading roster…" />
            ) : !rosterRouteId ? (
              <EmptyState icon={<RouteOutlined />} title="Select a route" hint="Pick a route above to see students and their stops." />
            ) : !rosterStudents.length ? (
              <EmptyState
                icon={<PeopleOutlined />}
                title="No students on this route"
                hint="Assign students from the Assign tab."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="nx-table min-w-full text-left">
                  <thead>
                    <tr>
                      <th>Admission #</th>
                      <th>Student</th>
                      <th>Pickup stop</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rosterStudents.map((student) => (
                      <tr key={student.id}>
                        <td className="font-mono text-xs text-slate-600">{student.admissionNumber}</td>
                        <td className="font-semibold text-slate-900">{studentLabel(student)}</td>
                        <td>
                          {student.transportStopName ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-100">
                              <PersonPinCircleOutlined sx={{ fontSize: 14 }} />
                              {student.transportStopName}
                            </span>
                          ) : (
                            <span className="text-slate-400">Not set</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CmsSectionCard>
        ) : null}

        {tab === "assign" ? (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <CmsSectionCard className="p-5">
              <SectionTitle
                title="Assign student"
                subtitle="Link a student to a route and optional pickup stop."
              />
              {canManage ? (
                <form className="mt-2 grid gap-3" onSubmit={assignStudent}>
                  <label>
                    <span className="nx-label">Student *</span>
                    <select
                      className="nx-input w-full"
                      value={assignStudentId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setAssignStudentId(id);
                        const student = students.find((s) => s.id === id);
                        if (student?.transportRouteId) {
                          setAssignRouteId(student.transportRouteId);
                          setAssignStopName(student.transportStopName ?? "");
                        }
                      }}
                      required
                    >
                      <option value="">Select student</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.admissionNumber} · {studentLabel(student)}
                          {student.transportRoute
                            ? ` · ${student.transportRoute}${student.transportStopName ? ` @ ${student.transportStopName}` : ""}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="nx-label">Route</span>
                    <select
                      className="nx-input w-full"
                      value={assignRouteId}
                      onChange={(e) => {
                        setAssignRouteId(e.target.value);
                        setAssignStopName("");
                      }}
                    >
                      <option value="">No transport / clear assignment</option>
                      {activeRoutes.map((route) => (
                        <option key={route.id} value={route.id}>
                          {route.name}
                          {route.vehicleNumber ? ` · ${route.vehicleNumber}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedAssignRoute && selectedAssignRoute.stops.length > 0 ? (
                    <label>
                      <span className="nx-label">Pickup stop</span>
                      <select
                        className="nx-input w-full"
                        value={assignStopName}
                        onChange={(e) => setAssignStopName(e.target.value)}
                      >
                        <option value="">No specific stop</option>
                        {selectedAssignRoute.stops.map((stop) => (
                          <option key={stop.name} value={stop.name}>
                            {stop.sequence ? `${stop.sequence}. ` : ""}
                            {stop.name}
                            {stop.fare != null ? ` (₹${stop.fare})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label>
                    <span className="nx-label">Note</span>
                    <input
                      className="nx-input w-full"
                      value={assignNote}
                      onChange={(e) => setAssignNote(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                  <button type="submit" className="nx-btn-primary w-fit" disabled={submitting}>
                    Save assignment
                  </button>
                </form>
              ) : (
                <p className="mt-4 text-sm text-slate-500">You need transport.manage permission to assign students.</p>
              )}
            </CmsSectionCard>

            <CmsSectionCard className="overflow-hidden !p-0">
              <div className="border-b border-slate-100 bg-gradient-to-br from-indigo-50 to-white px-5 py-4">
                <SectionTitle title="Quick tip" subtitle="Leave route empty to clear transport for a student." />
              </div>
              <div className="space-y-3 p-5 text-sm text-slate-600">
                <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <DirectionsBusOutlined className="shrink-0 text-indigo-500" sx={{ fontSize: 22 }} />
                  <p>Assignments are logged automatically under History for audit.</p>
                </div>
                <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <PlaceOutlined className="shrink-0 text-sky-500" sx={{ fontSize: 22 }} />
                  <p>Stops only appear when the selected route has pickup points defined.</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs font-semibold text-emerald-800">
                  {students.filter((s) => s.transportOptIn || s.transportRouteId).length} students currently on transport
                </div>
              </div>
            </CmsSectionCard>
          </div>
        ) : null}

        {tab === "history" ? (
          <CmsSectionCard className="overflow-hidden !p-0">
            <div className="border-b border-slate-100 bg-gradient-to-r from-amber-50/80 via-white to-white px-5 py-3.5">
              <SectionTitle title="Assignment history" subtitle="Latest route changes across the campus" />
            </div>
            {!logs.length ? (
              <EmptyState icon={<HistoryOutlined />} title="No assignment history yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="nx-table min-w-full text-left">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Student</th>
                      <th>Action</th>
                      <th>Route / stop</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className="whitespace-nowrap text-xs text-slate-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td>
                          <p className="font-semibold text-slate-900">{studentLabel(log.student)}</p>
                          <p className="font-mono text-[11px] text-slate-500">{log.student.admissionNumber}</p>
                        </td>
                        <td>
                          <span className={actionPill(log.action)}>{log.action}</span>
                        </td>
                        <td>
                          <p className="text-slate-800">{log.transportRoute?.name ?? "—"}</p>
                          {log.stopName ? (
                            <p className="text-xs text-sky-700">{log.stopName}</p>
                          ) : null}
                          {log.note ? <p className="text-xs text-slate-400">{log.note}</p> : null}
                        </td>
                        <td className="text-slate-600">
                          {log.assignedBy ? studentLabel(log.assignedBy) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CmsSectionCard>
        ) : null}
      </CmsScrollBody>
      <CmsFooter />
    </CmsPage>
  );
}
