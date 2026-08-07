import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  AssessmentOutlined,
  DeleteOutline,
  DirectionsBusOutlined,
  EditOutlined,
  LocalShippingOutlined,
  MoreVertOutlined,
  PeopleOutlined,
  PersonOutlined,
  RouteOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import {
  CmsFooter,
  CmsPage,
  CmsPageHeader,
  CmsScrollBody,
  CmsSectionCard,
} from "../../components/cms/CmsLayout";
import { apiRequest } from "../../lib/api";
import { confirmDelete } from "../../lib/confirm";
import { notifyError, notifySuccess } from "../../lib/notify";

type Tab = "routes" | "vehicles" | "drivers" | "assign" | "reports";

interface TransportStop {
  name: string;
  sequence?: number;
  fare?: number | null;
  pickupTime?: string | null;
  dropTime?: string | null;
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
  enrollments?: Array<{
    status?: string;
    classSection?: {
      academicClass?: { name?: string };
      section?: { name?: string };
    };
  }>;
}

interface RouteMeta {
  vehicleType?: "Bus" | "Van";
  capacity?: number | null;
  vehicleStatus?: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
  insuranceExpiry?: string | null;
  licenseNumber?: string | null;
  licenseExpiry?: string | null;
  driverStatus?: "ACTIVE" | "ON_LEAVE";
}

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "routes", label: "Routes" },
  { key: "vehicles", label: "Vehicles" },
  { key: "drivers", label: "Drivers" },
  { key: "assign", label: "Student Assignment" },
  { key: "reports", label: "Reports" },
];

const META_PREFIX = "__transport_meta__:";

function studentLabel(student: { firstName: string; lastName: string | null }) {
  return `${student.firstName} ${student.lastName ?? ""}`.trim();
}

function classSectionLabel(student: StudentOption) {
  const enrollment = student.enrollments?.find((row) => row.status === "ACTIVE") ?? student.enrollments?.[0];
  const cls = enrollment?.classSection?.academicClass?.name;
  const sec = enrollment?.classSection?.section?.name;
  if (cls && sec) return `${cls} / ${sec}`;
  if (cls) return cls;
  if (sec) return sec;
  return "—";
}

function emptyStop(): TransportStop {
  return { name: "", sequence: 1, fare: null, pickupTime: "", dropTime: "" };
}

function parseMeta(notes: string | null | undefined): RouteMeta {
  if (!notes) return {};
  const line = notes.split("\n").find((row) => row.startsWith(META_PREFIX));
  if (!line) return {};
  try {
    return JSON.parse(line.slice(META_PREFIX.length)) as RouteMeta;
  } catch {
    return {};
  }
}

function writeMeta(notes: string | null | undefined, meta: RouteMeta): string {
  const cleaned = (notes ?? "")
    .split("\n")
    .filter((row) => !row.startsWith(META_PREFIX))
    .join("\n")
    .trim();
  const encoded = `${META_PREFIX}${JSON.stringify(meta)}`;
  return cleaned ? `${cleaned}\n${encoded}` : encoded;
}

function statusPill(kind: "green" | "amber" | "gray" | "red", label: string) {
  const map = {
    green: "nx-pill nx-pill-success",
    amber: "nx-pill nx-pill-warning",
    gray: "nx-pill nx-pill-neutral",
    red: "nx-pill nx-pill-danger",
  } as const;
  return <span className={map[kind]}>{label}</span>;
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
    <div className="flex flex-col items-center justify-center gap-nx-1 px-nx-3 py-nx-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

function CardShell({
  title,
  subtitle,
  action,
  children,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <CmsSectionCard className="overflow-hidden !rounded-[12px] !border-border !bg-white !p-0 shadow-none">
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-nx-2 border-b border-border px-nx-2 py-nx-2">
          <div>
            <h2 className="text-sm font-bold text-ink">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={title ? "" : "p-nx-2"}>{children}</div>
    </CmsSectionCard>
  );
}

export function TransportPage() {
  const { accessToken, user } = useAuth();
  const [tab, setTab] = useState<Tab>("routes");
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [showRouteForm, setShowRouteForm] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [routeName, setRouteName] = useState("");
  const [routeVehicle, setRouteVehicle] = useState("");
  const [routeDriver, setRouteDriver] = useState("");
  const [stops, setStops] = useState<TransportStop[]>([emptyStop()]);
  const [viewStopsId, setViewStopsId] = useState<string | null>(null);

  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicleRouteId, setEditingVehicleRouteId] = useState<string | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState<"Bus" | "Van">("Bus");
  const [vehicleCapacity, setVehicleCapacity] = useState("");
  const [vehicleRouteId, setVehicleRouteId] = useState("");
  const [vehicleStatus, setVehicleStatus] = useState<"ACTIVE" | "MAINTENANCE" | "INACTIVE">("ACTIVE");
  const [insuranceExpiry, setInsuranceExpiry] = useState("");
  const [registrationName, setRegistrationName] = useState("");

  const [showDriverForm, setShowDriverForm] = useState(false);
  const [editingDriverRouteId, setEditingDriverRouteId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [driverStatus, setDriverStatus] = useState<"ACTIVE" | "ON_LEAVE">("ACTIVE");
  const [driverVehicleRouteId, setDriverVehicleRouteId] = useState("");
  const [driverPhotoName, setDriverPhotoName] = useState("");
  const [driverDocName, setDriverDocName] = useState("");

  const [showAssignForm, setShowAssignForm] = useState(false);
  const [filterClass, setFilterClass] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterRoute, setFilterRoute] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [assignStudentId, setAssignStudentId] = useState("");
  const [assignRouteId, setAssignRouteId] = useState("");
  const [assignStopName, setAssignStopName] = useState("");

  const canManage = user?.permissions.includes("transport.manage") ?? false;

  const vehicleOptions = useMemo(() => {
    const seen = new Set<string>();
    return routes
      .filter((route) => route.vehicleNumber)
      .map((route) => route.vehicleNumber!.trim())
      .filter((value) => {
        const key = value.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [routes]);

  const driverOptions = useMemo(() => {
    const seen = new Set<string>();
    return routes
      .filter((route) => route.driverName)
      .map((route) => route.driverName!.trim())
      .filter((value) => {
        const key = value.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [routes]);

  const classOptions = useMemo(() => {
    const set = new Set<string>();
    for (const student of students) {
      const enrollment = student.enrollments?.find((row) => row.status === "ACTIVE") ?? student.enrollments?.[0];
      const name = enrollment?.classSection?.academicClass?.name;
      if (name) set.add(name);
    }
    return [...set].sort();
  }, [students]);

  const sectionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const student of students) {
      const enrollment = student.enrollments?.find((row) => row.status === "ACTIVE") ?? student.enrollments?.[0];
      const cls = enrollment?.classSection?.academicClass?.name;
      const sec = enrollment?.classSection?.section?.name;
      if (!sec) continue;
      if (filterClass && cls !== filterClass) continue;
      set.add(sec);
    }
    return [...set].sort();
  }, [students, filterClass]);

  const assignedStudents = useMemo(() => {
    return students.filter((student) => {
      if (!student.transportRouteId && !student.transportOptIn) return false;
      if (filterRoute && student.transportRouteId !== filterRoute) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        const hay = `${studentLabel(student)} ${student.admissionNumber}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const label = classSectionLabel(student);
      if (filterClass && !label.startsWith(filterClass)) return false;
      if (filterSection && !label.includes(`/ ${filterSection}`) && label !== filterSection) return false;
      return Boolean(student.transportRouteId);
    });
  }, [students, filterRoute, filterSearch, filterClass, filterSection]);

  const selectedAssignRoute = useMemo(
    () => routes.find((route) => route.id === assignRouteId) ?? null,
    [routes, assignRouteId],
  );

  async function load() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const routeRows = await apiRequest<TransportRoute[]>("/transport/routes", accessToken);
      setRoutes(
        routeRows.map((route) => ({
          ...route,
          stops: Array.isArray(route.stops) ? route.stops : [],
        })),
      );
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load transport routes");
      setRoutes([]);
    }

    try {
      // Backend students listQuery max limit is 100
      const studentList = await apiRequest<{ items: StudentOption[] }>(
        "/students?limit=100&status=ACTIVE&page=1",
        accessToken,
      );
      setStudents(studentList.items ?? []);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load students");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  function resetRouteForm() {
    setEditingRouteId(null);
    setRouteName("");
    setRouteVehicle("");
    setRouteDriver("");
    setStops([emptyStop()]);
    setShowRouteForm(false);
  }

  function startEditRoute(route: TransportRoute) {
    setEditingRouteId(route.id);
    setRouteName(route.name);
    setRouteVehicle(route.vehicleNumber ?? "");
    setRouteDriver(route.driverName ?? "");
    setStops(route.stops.length ? route.stops.map((stop) => ({ ...stop })) : [emptyStop()]);
    setShowRouteForm(true);
    setTab("routes");
  }

  async function saveRoute(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setSubmitting(true);
    try {
      const payload = {
        name: routeName.trim(),
        vehicleNumber: routeVehicle.trim() || null,
        driverName: routeDriver.trim() || null,
        stops: stops
          .filter((stop) => stop.name.trim())
          .map((stop, index) => ({
            name: stop.name.trim(),
            sequence: index + 1,
            pickupTime: stop.pickupTime || null,
            dropTime: stop.dropTime || null,
            fare: stop.fare ?? null,
          })),
      };
      if (editingRouteId) {
        await apiRequest(`/transport/routes/${editingRouteId}`, accessToken, {
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
      resetRouteForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save route");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeRoute(id: string) {
    if (!canManage) return;
    const ok = await confirmDelete({
      text: "Delete this route? Students will be unassigned.",
      confirmText: "Yes, delete route",
    });
    if (!ok) return;
    try {
      await apiRequest(`/transport/routes/${id}`, accessToken, { method: "DELETE" });
      notifySuccess("Route deleted");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete route");
    }
  }

  function resetVehicleForm() {
    setEditingVehicleRouteId(null);
    setVehicleNumber("");
    setVehicleType("Bus");
    setVehicleCapacity("");
    setVehicleRouteId("");
    setVehicleStatus("ACTIVE");
    setInsuranceExpiry("");
    setRegistrationName("");
    setShowVehicleForm(false);
  }

  function startEditVehicle(route: TransportRoute) {
    const meta = parseMeta(route.notes);
    setEditingVehicleRouteId(route.id);
    setVehicleNumber(route.vehicleNumber ?? "");
    setVehicleType(meta.vehicleType ?? "Bus");
    setVehicleCapacity(meta.capacity != null ? String(meta.capacity) : "");
    setVehicleRouteId(route.id);
    setVehicleStatus(meta.vehicleStatus ?? (route.isActive ? "ACTIVE" : "INACTIVE"));
    setInsuranceExpiry(meta.insuranceExpiry ?? "");
    setRegistrationName("");
    setShowVehicleForm(true);
    setTab("vehicles");
  }

  async function saveVehicle(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    const targetId = editingVehicleRouteId || vehicleRouteId;
    if (!targetId) {
      notifyError("Select a route to assign this vehicle");
      return;
    }
    const route = routes.find((row) => row.id === targetId);
    if (!route) return;
    setSubmitting(true);
    try {
      const meta: RouteMeta = {
        ...parseMeta(route.notes),
        vehicleType,
        capacity: vehicleCapacity ? Number(vehicleCapacity) : null,
        vehicleStatus,
        insuranceExpiry: insuranceExpiry || null,
      };
      await apiRequest(`/transport/routes/${targetId}`, accessToken, {
        method: "PUT",
        body: JSON.stringify({
          name: route.name,
          vehicleNumber: vehicleNumber.trim() || null,
          isActive: vehicleStatus !== "INACTIVE",
          notes: writeMeta(route.notes, meta),
        }),
      });
      notifySuccess(editingVehicleRouteId ? "Vehicle updated" : "Vehicle saved");
      resetVehicleForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save vehicle");
    } finally {
      setSubmitting(false);
    }
  }

  function resetDriverForm() {
    setEditingDriverRouteId(null);
    setDriverName("");
    setDriverPhone("");
    setLicenseNumber("");
    setLicenseExpiry("");
    setDriverStatus("ACTIVE");
    setDriverVehicleRouteId("");
    setDriverPhotoName("");
    setDriverDocName("");
    setShowDriverForm(false);
  }

  function startEditDriver(route: TransportRoute) {
    const meta = parseMeta(route.notes);
    setEditingDriverRouteId(route.id);
    setDriverName(route.driverName ?? "");
    setDriverPhone(route.driverPhone ?? "");
    setLicenseNumber(meta.licenseNumber ?? "");
    setLicenseExpiry(meta.licenseExpiry ?? "");
    setDriverStatus(meta.driverStatus ?? "ACTIVE");
    setDriverVehicleRouteId(route.id);
    setShowDriverForm(true);
    setTab("drivers");
  }

  async function saveDriver(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    const targetId = editingDriverRouteId || driverVehicleRouteId;
    if (!targetId) {
      notifyError("Select an assigned vehicle/route");
      return;
    }
    const route = routes.find((row) => row.id === targetId);
    if (!route) return;
    setSubmitting(true);
    try {
      const meta: RouteMeta = {
        ...parseMeta(route.notes),
        licenseNumber: licenseNumber || null,
        licenseExpiry: licenseExpiry || null,
        driverStatus,
      };
      await apiRequest(`/transport/routes/${targetId}`, accessToken, {
        method: "PUT",
        body: JSON.stringify({
          name: route.name,
          driverName: driverName.trim() || null,
          driverPhone: driverPhone.trim() || null,
          notes: writeMeta(route.notes, meta),
        }),
      });
      notifySuccess(editingDriverRouteId ? "Driver updated" : "Driver saved");
      resetDriverForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save driver");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveAssignment(event: FormEvent) {
    event.preventDefault();
    if (!canManage || !assignStudentId) return;
    setSubmitting(true);
    try {
      await apiRequest("/transport/assign", accessToken, {
        method: "POST",
        body: JSON.stringify({
          studentId: assignStudentId,
          routeId: assignRouteId || null,
          stopName: assignStopName || null,
        }),
      });
      notifySuccess(assignRouteId ? "Student assigned" : "Assignment cleared");
      setShowAssignForm(false);
      setAssignStudentId("");
      setAssignRouteId("");
      setAssignStopName("");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to assign student");
    } finally {
      setSubmitting(false);
    }
  }

  async function clearAssignment(studentId: string) {
    if (!canManage) return;
    const ok = await confirmDelete({
      text: "Remove this student from transport?",
      confirmText: "Yes, remove",
    });
    if (!ok) return;
    try {
      await apiRequest("/transport/assign", accessToken, {
        method: "POST",
        body: JSON.stringify({ studentId, routeId: null, stopName: null }),
      });
      notifySuccess("Assignment removed");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to remove assignment");
    }
  }

  function generateReport() {
    const rows = [
      ["Student Name", "Admission No", "Class/Section", "Route", "Stop Point"],
      ...students
        .filter((student) => student.transportRouteId)
        .map((student) => [
          studentLabel(student),
          student.admissionNumber,
          classSectionLabel(student),
          student.transportRoute ?? "",
          student.transportStopName ?? "",
        ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "student-transport-report.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    notifySuccess("Student Transport Report generated");
  }

  const primaryAction =
    canManage && tab === "routes" ? (
      <button
        type="button"
        className="nx-btn-primary"
        onClick={() => {
          if (showRouteForm && !editingRouteId) resetRouteForm();
          else {
            resetRouteForm();
            setShowRouteForm(true);
          }
        }}
      >
        <AddOutlined sx={{ fontSize: 16 }} />
        {showRouteForm && !editingRouteId ? "Close form" : "+ Add route"}
      </button>
    ) : canManage && tab === "vehicles" ? (
      <button
        type="button"
        className="nx-btn-primary"
        onClick={() => {
          if (showVehicleForm && !editingVehicleRouteId) resetVehicleForm();
          else {
            resetVehicleForm();
            setShowVehicleForm(true);
          }
        }}
      >
        <AddOutlined sx={{ fontSize: 16 }} />
        {showVehicleForm && !editingVehicleRouteId ? "Close form" : "+ Add vehicle"}
      </button>
    ) : canManage && tab === "drivers" ? (
      <button
        type="button"
        className="nx-btn-primary"
        onClick={() => {
          if (showDriverForm && !editingDriverRouteId) resetDriverForm();
          else {
            resetDriverForm();
            setShowDriverForm(true);
          }
        }}
      >
        <AddOutlined sx={{ fontSize: 16 }} />
        {showDriverForm && !editingDriverRouteId ? "Close form" : "+ Add driver"}
      </button>
    ) : canManage && tab === "assign" ? (
      <button
        type="button"
        className="nx-btn-primary"
        onClick={() => setShowAssignForm((open) => !open)}
      >
        <AddOutlined sx={{ fontSize: 16 }} />
        {showAssignForm ? "Close form" : "+ Assign student"}
      </button>
    ) : null;

  return (
    <CmsPage>
      <CmsPageHeader
        title="Transportation"
        description="Manage routes, vehicles, drivers, and student transport assignments."
        actions={primaryAction}
      />

      <div className="nx-tabs shrink-0" role="tablist" aria-label="Transportation sections">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={`nx-tab ${tab === item.key ? "nx-tab-active" : ""}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <CmsScrollBody className="space-y-nx-2 pt-nx-2">
        {tab === "routes" ? (
          <>
            {canManage && showRouteForm ? (
              <CardShell
                title={editingRouteId ? "Edit route" : "Add route"}
                subtitle="Route name, stop points, vehicle, and driver."
              >
                <form className="grid gap-nx-2 p-nx-2 sm:grid-cols-2" onSubmit={saveRoute}>
                  <label className="sm:col-span-2">
                    <span className="nx-label">Route Name</span>
                    <input className="nx-input w-full" value={routeName} onChange={(e) => setRouteName(e.target.value)} required />
                  </label>

                  <div className="rounded-[12px] border border-border bg-background p-nx-2 sm:col-span-2">
                    <div className="mb-nx-2 flex items-center justify-between gap-nx-2">
                      <span className="text-sm font-semibold text-ink">Stop Points</span>
                      <button
                        type="button"
                        className="text-sm font-semibold text-primary"
                        onClick={() => setStops((prev) => [...prev, { ...emptyStop(), sequence: prev.length + 1 }])}
                      >
                        + Add stop
                      </button>
                    </div>
                    <div className="space-y-nx-1">
                      {stops.map((stop, index) => (
                        <div key={index} className="grid gap-nx-1 rounded-[8px] border border-border bg-white p-nx-1 sm:grid-cols-12">
                          <input
                            className="nx-input sm:col-span-4"
                            placeholder="Stop Name"
                            value={stop.name}
                            onChange={(e) => {
                              const next = [...stops];
                              next[index] = { ...stop, name: e.target.value };
                              setStops(next);
                            }}
                          />
                          <input
                            className="nx-input sm:col-span-3"
                            type="time"
                            title="Pickup Time"
                            value={stop.pickupTime ?? ""}
                            onChange={(e) => {
                              const next = [...stops];
                              next[index] = { ...stop, pickupTime: e.target.value };
                              setStops(next);
                            }}
                          />
                          <input
                            className="nx-input sm:col-span-3"
                            type="time"
                            title="Drop Time"
                            value={stop.dropTime ?? ""}
                            onChange={(e) => {
                              const next = [...stops];
                              next[index] = { ...stop, dropTime: e.target.value };
                              setStops(next);
                            }}
                          />
                          <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-[8px] border border-border p-2 text-ink-muted hover:text-ink sm:col-span-2"
                            onClick={() =>
                              setStops((prev) => (prev.length === 1 ? [emptyStop()] : prev.filter((_, i) => i !== index)))
                            }
                          >
                            <DeleteOutline sx={{ fontSize: 16 }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <label>
                    <span className="nx-label">Vehicle</span>
                    <input
                      className="nx-input w-full"
                      list="transport-vehicle-options"
                      value={routeVehicle}
                      onChange={(e) => setRouteVehicle(e.target.value)}
                      placeholder="Select or type vehicle number"
                    />
                    <datalist id="transport-vehicle-options">
                      {vehicleOptions.map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    <span className="nx-label">Driver</span>
                    <input
                      className="nx-input w-full"
                      list="transport-driver-options"
                      value={routeDriver}
                      onChange={(e) => setRouteDriver(e.target.value)}
                      placeholder="Select or type driver name"
                    />
                    <datalist id="transport-driver-options">
                      {driverOptions.map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                  </label>

                  <div className="flex flex-wrap gap-nx-1 sm:col-span-2">
                    <button type="submit" className="nx-btn-primary" disabled={submitting}>
                      Save
                    </button>
                    <button type="button" className="nx-btn-secondary" onClick={resetRouteForm}>
                      Cancel
                    </button>
                  </div>
                </form>
              </CardShell>
            ) : null}

            <CardShell title="Routes" subtitle={`${routes.length} configured`}>
              {loading ? (
                <EmptyState icon={<RouteOutlined />} title="Loading routes…" />
              ) : !routes.length ? (
                <EmptyState
                  icon={<DirectionsBusOutlined />}
                  title="No routes yet"
                  hint={canManage ? "Add a route with stop points, vehicle, and driver." : undefined}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="nx-table min-w-full">
                    <thead>
                      <tr>
                        <th>Route Name</th>
                        <th>Stop Points</th>
                        <th>Vehicle Assigned</th>
                        <th>Driver Assigned</th>
                        <th>Students Enrolled</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routes.map((route) => (
                        <tr key={route.id} className="h-14">
                          <td className="font-semibold text-ink">{route.name}</td>
                          <td className="text-ink-muted">{route.stops.length}</td>
                          <td className="text-ink">{route.vehicleNumber ?? "—"}</td>
                          <td className="text-ink">{route.driverName ?? "—"}</td>
                          <td className="text-ink">{route._count.students}</td>
                          <td>
                            <div className="flex flex-wrap items-center gap-1">
                              {canManage ? (
                                <button type="button" className="nx-btn-secondary !px-2 !py-1 text-xs" onClick={() => startEditRoute(route)}>
                                  <EditOutlined sx={{ fontSize: 14 }} /> Edit
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="nx-btn-secondary !px-2 !py-1 text-xs"
                                onClick={() => setViewStopsId((id) => (id === route.id ? null : route.id))}
                              >
                                <VisibilityOutlined sx={{ fontSize: 14 }} /> View Stops
                              </button>
                              {canManage ? (
                                <button type="button" className="nx-btn-secondary !px-2 !py-1 text-xs" onClick={() => void removeRoute(route.id)}>
                                  <MoreVertOutlined sx={{ fontSize: 14 }} />
                                </button>
                              ) : null}
                            </div>
                            {viewStopsId === route.id ? (
                              <div className="mt-2 rounded-[8px] border border-border bg-background p-nx-1 text-xs text-ink-muted">
                                {route.stops.length ? (
                                  <ul className="space-y-1">
                                    {route.stops.map((stop, index) => (
                                      <li key={`${stop.name}-${index}`}>
                                        <span className="font-semibold text-ink">{stop.name}</span>
                                        {stop.pickupTime ? ` · Pickup ${stop.pickupTime}` : ""}
                                        {stop.dropTime ? ` · Drop ${stop.dropTime}` : ""}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  "No stops configured."
                                )}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardShell>
          </>
        ) : null}

        {tab === "vehicles" ? (
          <>
            {canManage && showVehicleForm ? (
              <CardShell title={editingVehicleRouteId ? "Edit vehicle" : "Add vehicle"}>
                <form className="grid gap-nx-2 p-nx-2 sm:grid-cols-2" onSubmit={saveVehicle}>
                  <label>
                    <span className="nx-label">Vehicle Number</span>
                    <input className="nx-input w-full" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} required />
                  </label>
                  <label>
                    <span className="nx-label">Type</span>
                    <select className="nx-input w-full" value={vehicleType} onChange={(e) => setVehicleType(e.target.value as "Bus" | "Van")}>
                      <option value="Bus">Bus</option>
                      <option value="Van">Van</option>
                    </select>
                  </label>
                  <label>
                    <span className="nx-label">Capacity</span>
                    <input className="nx-input w-full" type="number" min="1" value={vehicleCapacity} onChange={(e) => setVehicleCapacity(e.target.value)} />
                  </label>
                  <label>
                    <span className="nx-label">Assigned Route</span>
                    <select className="nx-input w-full" value={vehicleRouteId} onChange={(e) => setVehicleRouteId(e.target.value)} required={!editingVehicleRouteId}>
                      <option value="">Select route</option>
                      {routes.map((route) => (
                        <option key={route.id} value={route.id}>
                          {route.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="nx-label">Status</span>
                    <select
                      className="nx-input w-full"
                      value={vehicleStatus}
                      onChange={(e) => setVehicleStatus(e.target.value as "ACTIVE" | "MAINTENANCE" | "INACTIVE")}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </label>
                  <label>
                    <span className="nx-label">Insurance Expiry</span>
                    <input className="nx-input w-full" type="date" value={insuranceExpiry} onChange={(e) => setInsuranceExpiry(e.target.value)} />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="nx-label">Registration Document</span>
                    <input
                      className="nx-input w-full"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => setRegistrationName(e.target.files?.[0]?.name ?? "")}
                    />
                    {registrationName ? <p className="mt-1 text-xs text-ink-muted">Selected: {registrationName}</p> : null}
                  </label>
                  <div className="flex flex-wrap gap-nx-1 sm:col-span-2">
                    <button type="submit" className="nx-btn-primary" disabled={submitting}>
                      Save
                    </button>
                    <button type="button" className="nx-btn-secondary" onClick={resetVehicleForm}>
                      Cancel
                    </button>
                  </div>
                </form>
              </CardShell>
            ) : null}

            <CardShell title="Vehicles">
              {loading ? (
                <EmptyState icon={<LocalShippingOutlined />} title="Loading vehicles…" />
              ) : !routes.some((route) => route.vehicleNumber) ? (
                <EmptyState icon={<LocalShippingOutlined />} title="No vehicles yet" hint="Add a vehicle and link it to a route." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="nx-table min-w-full">
                    <thead>
                      <tr>
                        <th>Vehicle Number</th>
                        <th>Type</th>
                        <th>Capacity</th>
                        <th>Assigned Route</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routes
                        .filter((route) => route.vehicleNumber)
                        .map((route) => {
                          const meta = parseMeta(route.notes);
                          const status = meta.vehicleStatus ?? (route.isActive ? "ACTIVE" : "INACTIVE");
                          return (
                            <tr key={route.id} className="h-14">
                              <td className="font-semibold text-ink">{route.vehicleNumber}</td>
                              <td>
                                <span className="nx-pill nx-pill-indigo">{meta.vehicleType ?? "Bus"}</span>
                              </td>
                              <td className="text-ink-muted">{meta.capacity ?? "—"}</td>
                              <td className="text-ink">{route.name}</td>
                              <td>
                                {status === "ACTIVE"
                                  ? statusPill("green", "Active")
                                  : status === "MAINTENANCE"
                                    ? statusPill("amber", "Maintenance")
                                    : statusPill("gray", "Inactive")}
                              </td>
                              <td>
                                {canManage ? (
                                  <button type="button" className="nx-btn-secondary !px-2 !py-1 text-xs" onClick={() => startEditVehicle(route)}>
                                    <EditOutlined sx={{ fontSize: 14 }} /> Edit
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardShell>
          </>
        ) : null}

        {tab === "drivers" ? (
          <>
            {canManage && showDriverForm ? (
              <CardShell title={editingDriverRouteId ? "Edit driver" : "Add driver"}>
                <form className="grid gap-nx-2 p-nx-2 sm:grid-cols-2" onSubmit={saveDriver}>
                  <label>
                    <span className="nx-label">Name</span>
                    <input className="nx-input w-full" value={driverName} onChange={(e) => setDriverName(e.target.value)} required />
                  </label>
                  <label>
                    <span className="nx-label">License Number</span>
                    <input className="nx-input w-full" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
                  </label>
                  <label>
                    <span className="nx-label">Phone</span>
                    <input className="nx-input w-full" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
                  </label>
                  <label>
                    <span className="nx-label">License Expiry</span>
                    <input className="nx-input w-full" type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} />
                  </label>
                  <label>
                    <span className="nx-label">Assigned Vehicle / Route</span>
                    <select
                      className="nx-input w-full"
                      value={driverVehicleRouteId}
                      onChange={(e) => setDriverVehicleRouteId(e.target.value)}
                      required={!editingDriverRouteId}
                    >
                      <option value="">Select route</option>
                      {routes.map((route) => (
                        <option key={route.id} value={route.id}>
                          {[route.vehicleNumber, route.name].filter(Boolean).join(" · ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="nx-label">Status</span>
                    <select
                      className="nx-input w-full"
                      value={driverStatus}
                      onChange={(e) => setDriverStatus(e.target.value as "ACTIVE" | "ON_LEAVE")}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="ON_LEAVE">On Leave</option>
                    </select>
                  </label>
                  <label>
                    <span className="nx-label">Photo</span>
                    <input
                      className="nx-input w-full"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setDriverPhotoName(e.target.files?.[0]?.name ?? "")}
                    />
                    {driverPhotoName ? <p className="mt-1 text-xs text-ink-muted">Selected: {driverPhotoName}</p> : null}
                  </label>
                  <label>
                    <span className="nx-label">Document</span>
                    <input
                      className="nx-input w-full"
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={(e) => setDriverDocName(e.target.files?.[0]?.name ?? "")}
                    />
                    {driverDocName ? <p className="mt-1 text-xs text-ink-muted">Selected: {driverDocName}</p> : null}
                  </label>
                  <div className="flex flex-wrap gap-nx-1 sm:col-span-2">
                    <button type="submit" className="nx-btn-primary" disabled={submitting}>
                      Save
                    </button>
                    <button type="button" className="nx-btn-secondary" onClick={resetDriverForm}>
                      Cancel
                    </button>
                  </div>
                </form>
              </CardShell>
            ) : null}

            <CardShell title="Drivers">
              {loading ? (
                <EmptyState icon={<PersonOutlined />} title="Loading drivers…" />
              ) : !routes.some((route) => route.driverName) ? (
                <EmptyState icon={<PersonOutlined />} title="No drivers yet" hint="Add a driver and link them to a vehicle/route." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="nx-table min-w-full">
                    <thead>
                      <tr>
                        <th>Driver</th>
                        <th>License Number</th>
                        <th>Phone</th>
                        <th>Assigned Vehicle/Route</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routes
                        .filter((route) => route.driverName)
                        .map((route) => {
                          const meta = parseMeta(route.notes);
                          const status = meta.driverStatus ?? "ACTIVE";
                          const initials = route.driverName!.slice(0, 2).toUpperCase();
                          return (
                            <tr key={route.id} className="h-14">
                              <td>
                                <div className="flex items-center gap-nx-1">
                                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                    {initials}
                                  </span>
                                  <span className="font-semibold text-ink">{route.driverName}</span>
                                </div>
                              </td>
                              <td className="text-ink-muted">{meta.licenseNumber ?? "—"}</td>
                              <td className="text-ink-muted">{route.driverPhone ?? "—"}</td>
                              <td className="text-ink">
                                {[route.vehicleNumber, route.name].filter(Boolean).join(" · ")}
                              </td>
                              <td>
                                {status === "ACTIVE" ? statusPill("green", "Active") : statusPill("amber", "On Leave")}
                              </td>
                              <td>
                                {canManage ? (
                                  <button type="button" className="nx-btn-secondary !px-2 !py-1 text-xs" onClick={() => startEditDriver(route)}>
                                    <EditOutlined sx={{ fontSize: 14 }} /> Edit
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardShell>
          </>
        ) : null}

        {tab === "assign" ? (
          <>
            <div className="flex flex-wrap items-end gap-nx-1 rounded-[12px] border border-border bg-white p-nx-2">
              <label className="min-w-[140px] flex-1">
                <span className="nx-label">Class</span>
                <select className="nx-input w-full" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
                  <option value="">All classes</option>
                  {classOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-[140px] flex-1">
                <span className="nx-label">Section</span>
                <select className="nx-input w-full" value={filterSection} onChange={(e) => setFilterSection(e.target.value)}>
                  <option value="">All sections</option>
                  {sectionOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-[160px] flex-1">
                <span className="nx-label">Route</span>
                <select className="nx-input w-full" value={filterRoute} onChange={(e) => setFilterRoute(e.target.value)}>
                  <option value="">All routes</option>
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-[180px] flex-[1.4]">
                <span className="nx-label">Search</span>
                <input
                  className="nx-input w-full"
                  placeholder="Student name or admission no"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                />
              </label>
            </div>

            {canManage && showAssignForm ? (
              <CardShell title="Assign student">
                <form className="grid gap-nx-2 p-nx-2 sm:grid-cols-2" onSubmit={saveAssignment}>
                  <label className="sm:col-span-2">
                    <span className="nx-label">Student</span>
                    <select className="nx-input w-full" value={assignStudentId} onChange={(e) => setAssignStudentId(e.target.value)} required>
                      <option value="">Search / select student</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {studentLabel(student)} ({student.admissionNumber}) · {classSectionLabel(student)}
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
                      <option value="">No route (clear)</option>
                      {routes.filter((route) => route.isActive).map((route) => (
                        <option key={route.id} value={route.id}>
                          {route.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="nx-label">Stop Point</span>
                    <select
                      className="nx-input w-full"
                      value={assignStopName}
                      onChange={(e) => setAssignStopName(e.target.value)}
                      disabled={!selectedAssignRoute}
                    >
                      <option value="">Select stop</option>
                      {(selectedAssignRoute?.stops ?? []).map((stop) => (
                        <option key={stop.name} value={stop.name}>
                          {stop.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="rounded-[8px] border border-border bg-background px-nx-2 py-nx-1 text-xs text-ink-muted sm:col-span-2">
                    Transport fee is billed via the &quot;Transportation Bus Fees&quot; fee type — configure in Fees &gt; Structure Setup.
                  </p>
                  <div className="flex flex-wrap gap-nx-1 sm:col-span-2">
                    <button type="submit" className="nx-btn-primary" disabled={submitting}>
                      Save
                    </button>
                    <button type="button" className="nx-btn-secondary" onClick={() => setShowAssignForm(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </CardShell>
            ) : null}

            <CardShell title="Student assignments" subtitle={`${assignedStudents.length} assigned`}>
              {!assignedStudents.length ? (
                <EmptyState icon={<PeopleOutlined />} title="No assigned students" hint="Use Assign student to map learners to routes and stops." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="nx-table min-w-full">
                    <thead>
                      <tr>
                        <th>Student Name</th>
                        <th>Class/Section</th>
                        <th>Assigned Route</th>
                        <th>Stop Point</th>
                        <th>Transport Fee Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedStudents.map((student) => (
                        <tr key={student.id} className="h-14">
                          <td className="font-semibold text-ink">{studentLabel(student)}</td>
                          <td className="text-ink-muted">{classSectionLabel(student)}</td>
                          <td className="text-ink">{student.transportRoute ?? "—"}</td>
                          <td className="text-ink-muted">{student.transportStopName ?? "—"}</td>
                          <td>{statusPill("amber", "Due")}</td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {canManage ? (
                                <>
                                  <button
                                    type="button"
                                    className="nx-btn-secondary !px-2 !py-1 text-xs"
                                    onClick={() => {
                                      setAssignStudentId(student.id);
                                      setAssignRouteId(student.transportRouteId ?? "");
                                      setAssignStopName(student.transportStopName ?? "");
                                      setShowAssignForm(true);
                                    }}
                                  >
                                    Reassign
                                  </button>
                                  <button
                                    type="button"
                                    className="nx-btn-secondary !px-2 !py-1 text-xs"
                                    onClick={() => void clearAssignment(student.id)}
                                  >
                                    Remove
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
              )}
            </CardShell>
          </>
        ) : null}

        {tab === "reports" ? (
          <CardShell>
            <div className="flex flex-wrap items-center gap-nx-3 p-nx-3">
              <div className="flex size-12 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
                <AssessmentOutlined sx={{ fontSize: 24 }} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-ink">Student Transport Report</h2>
                <p className="mt-1 text-sm text-ink-muted">Students with their stop points and route details</p>
              </div>
              <button type="button" className="nx-btn-primary" onClick={generateReport}>
                Generate
              </button>
            </div>
          </CardShell>
        ) : null}
      </CmsScrollBody>

      <CmsFooter />
    </CmsPage>
  );
}
