import { useEffect, useMemo, useState } from "react";
import {
  AddOutlined,
  DirectionsBusOutlined,
  DeleteOutline,
  EditOutlined,
  HelpOutlineOutlined,
  InfoOutlined,
  ListAltOutlined,
  LocationOnOutlined,
  PeopleOutline,
  SaveOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type Settings = {
  moduleEnabled: boolean;
  pickupWindowValue: string;
  pickupWindowUnit: "HOURS" | "MINUTES";
  dropWindowValue: string;
  dropWindowUnit: "HOURS" | "MINUTES";
  allowParentTracking: boolean;
  feeType: "ANNUAL" | "MONTHLY" | "QUARTERLY";
  feeCollectionMode: "IN_ADVANCE" | "IN_ARREARS";
  feeDueDay: number;
  lateFeeAmount: number;
  markAttendanceOnPickup: boolean;
  markAttendanceOnDrop: boolean;
  notifyParentOnPickupDrop: boolean;
};

type Stop = {
  sequence: number;
  name: string;
  location: string;
  pickupTime: string;
  dropTime: string;
  fare: number | null;
};

type Route = {
  id: string;
  name: string;
  code: string | null;
  displayLabel: string;
  color: string;
  driverName: string | null;
  attendantName: string | null;
  vehicleNumber: string | null;
  isActive: boolean;
  studentCount: number;
  stops: Stop[];
};

type Vehicle = {
  id: string;
  registrationNo: string;
  label: string;
  vehicleType: string;
  capacity: number;
  status: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
  statusLabel: string;
  routeId: string | null;
  routeName: string | null;
};

type Setup = {
  settings: Settings;
  routes: Route[];
  vehicles: Vehicle[];
  staffOptions: Array<{ id: string; label: string }>;
  stats: {
    totalStudents: number;
    totalStudentsDisplay: number;
    totalRoutes: number;
    totalStops: number;
    totalVehicles: number;
  };
  note: string;
};

const inputClass =
  "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-primary";

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        checked ? "bg-primary" : "bg-[#D1D5DB]"
      } disabled:opacity-50`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function vehicleStatusClass(status: Vehicle["status"]) {
  if (status === "MAINTENANCE") return "bg-amber-50 text-amber-700";
  if (status === "INACTIVE") return "bg-rose-50 text-rose-700";
  return "bg-emerald-50 text-emerald-700";
}

export function TransportSettingsPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Transport Settings";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["erp.manage", "settings.manage", "transport.manage"].includes(p),
    ),
  );

  const [setup, setSetup] = useState<Setup | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [routeDraft, setRouteDraft] = useState<{
    name: string;
    code: string;
    driverName: string;
    attendantName: string;
    isActive: boolean;
    color: string;
    stops: Stop[];
  } | null>(null);

  const [routeModal, setRouteModal] = useState(false);
  const [newRouteName, setNewRouteName] = useState("");
  const [stopModal, setStopModal] = useState(false);
  const [editingStopIndex, setEditingStopIndex] = useState<number | null>(null);
  const [stopForm, setStopForm] = useState({
    name: "",
    location: "",
    pickupTime: "07:00 AM",
    dropTime: "02:45 PM",
  });

  const [vehicleModal, setVehicleModal] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vehicleForm, setVehicleForm] = useState({
    registrationNo: "",
    label: "",
    capacity: 40,
    status: "ACTIVE" as Vehicle["status"],
    routeId: "",
  });

  function applySetup(data: Setup, keepRouteId?: string) {
    setSetup(data);
    setForm({ ...data.settings });
    const nextId =
      keepRouteId && data.routes.some((r) => r.id === keepRouteId)
        ? keepRouteId
        : data.routes[0]?.id || "";
    setSelectedRouteId(nextId);
    const selected = data.routes.find((r) => r.id === nextId) || null;
    setRouteDraft(
      selected
        ? {
            name: selected.name,
            code: selected.code || "",
            driverName: selected.driverName || "",
            attendantName: selected.attendantName || "",
            isActive: selected.isActive,
            color: selected.color,
            stops: selected.stops.map((s) => ({ ...s })),
          }
        : null,
    );
  }

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/transport-settings", accessToken);
      applySetup(data);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load transport settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const selectedRoute = useMemo(
    () => setup?.routes.find((r) => r.id === selectedRouteId) || null,
    [setup, selectedRouteId],
  );

  function selectRoute(route: Route) {
    setSelectedRouteId(route.id);
    setRouteDraft({
      name: route.name,
      code: route.code || "",
      driverName: route.driverName || "",
      attendantName: route.attendantName || "",
      isActive: route.isActive,
      color: route.color,
      stops: route.stops.map((s) => ({ ...s })),
    });
  }

  async function saveSettings() {
    if (!accessToken || !canManage || !form) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/transport-settings", accessToken, {
        method: "PUT",
        body: JSON.stringify(form),
      });
      applySetup(data, selectedRouteId);
      notifySuccess("Transport configuration saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function saveRoute() {
    if (!accessToken || !canManage || !routeDraft || !selectedRoute) return;
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/transport-settings/routes", accessToken, {
        method: "PUT",
        body: JSON.stringify({
          id: selectedRoute.id,
          name: routeDraft.name,
          code: routeDraft.code || null,
          driverName: routeDraft.driverName || null,
          attendantName: routeDraft.attendantName || null,
          color: routeDraft.color,
          isActive: routeDraft.isActive,
          stops: routeDraft.stops.map((s, index) => ({
            name: s.name,
            location: s.location === "—" ? null : s.location,
            pickupTime: s.pickupTime === "—" ? null : s.pickupTime,
            dropTime: s.dropTime === "—" ? null : s.dropTime,
            sequence: index + 1,
            fare: s.fare,
          })),
        }),
      });
      applySetup(data, selectedRoute.id);
      notifySuccess("Route updated");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save route");
    } finally {
      setSaving(false);
    }
  }

  async function createRoute() {
    if (!accessToken || !canManage || !newRouteName.trim()) {
      notifyError("Route name is required");
      return;
    }
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/transport-settings/routes", accessToken, {
        method: "POST",
        body: JSON.stringify({
          name: newRouteName.trim(),
          code: `RT${String((setup?.routes.length || 0) + 1).padStart(2, "0")}`,
          isActive: true,
          color: "#7C3AED",
          stops: [],
        }),
      });
      const created = data.routes.find((r) => r.name === newRouteName.trim());
      applySetup(data, created?.id);
      setRouteModal(false);
      setNewRouteName("");
      notifySuccess("Route added");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to add route");
    } finally {
      setSaving(false);
    }
  }

  async function removeRoute(id: string) {
    if (!accessToken || !canManage) return;
    if (!window.confirm("Delete this route?")) return;
    try {
      const data = await apiRequest<Setup>(`/erp/transport-settings/routes/${id}`, accessToken, {
        method: "DELETE",
      });
      applySetup(data);
      notifySuccess("Route deleted");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete route");
    }
  }

  function openStop(index: number | null) {
    setEditingStopIndex(index);
    if (index != null && routeDraft) {
      const stop = routeDraft.stops[index];
      setStopForm({
        name: stop.name,
        location: stop.location === "—" ? "" : stop.location,
        pickupTime: stop.pickupTime === "—" ? "07:00 AM" : stop.pickupTime,
        dropTime: stop.dropTime === "—" ? "02:45 PM" : stop.dropTime,
      });
    } else {
      setStopForm({
        name: "",
        location: "",
        pickupTime: "07:00 AM",
        dropTime: "02:45 PM",
      });
    }
    setStopModal(true);
  }

  function applyStop() {
    if (!routeDraft || !stopForm.name.trim()) {
      notifyError("Stop name is required");
      return;
    }
    const next = [...routeDraft.stops];
    const row: Stop = {
      sequence: (editingStopIndex ?? next.length) + 1,
      name: stopForm.name.trim(),
      location: stopForm.location.trim() || "—",
      pickupTime: stopForm.pickupTime,
      dropTime: stopForm.dropTime,
      fare: null,
    };
    if (editingStopIndex != null) next[editingStopIndex] = row;
    else next.push(row);
    setRouteDraft({ ...routeDraft, stops: next.map((s, i) => ({ ...s, sequence: i + 1 })) });
    setStopModal(false);
  }

  function removeStop(index: number) {
    if (!routeDraft) return;
    setRouteDraft({
      ...routeDraft,
      stops: routeDraft.stops.filter((_, i) => i !== index).map((s, i) => ({ ...s, sequence: i + 1 })),
    });
  }

  function openVehicle(vehicle?: Vehicle) {
    if (vehicle) {
      setEditingVehicleId(vehicle.id);
      setVehicleForm({
        registrationNo: vehicle.registrationNo,
        label: vehicle.label,
        capacity: vehicle.capacity,
        status: vehicle.status,
        routeId: vehicle.routeId || "",
      });
    } else {
      setEditingVehicleId(null);
      setVehicleForm({
        registrationNo: "",
        label: "",
        capacity: 40,
        status: "ACTIVE",
        routeId: "",
      });
    }
    setVehicleModal(true);
  }

  async function saveVehicle() {
    if (!accessToken || !canManage) return;
    if (!vehicleForm.registrationNo.trim()) {
      notifyError("Registration number is required");
      return;
    }
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/transport-settings/vehicles", accessToken, {
        method: editingVehicleId ? "PUT" : "POST",
        body: JSON.stringify({
          id: editingVehicleId || undefined,
          registrationNo: vehicleForm.registrationNo.trim(),
          label: vehicleForm.label || null,
          capacity: vehicleForm.capacity,
          status: vehicleForm.status,
          routeId: vehicleForm.routeId || null,
        }),
      });
      applySetup(data, selectedRouteId);
      setVehicleModal(false);
      notifySuccess(editingVehicleId ? "Vehicle updated" : "Vehicle added");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save vehicle");
    } finally {
      setSaving(false);
    }
  }

  async function removeVehicle(id: string) {
    if (!accessToken || !canManage) return;
    if (!window.confirm("Delete this vehicle?")) return;
    try {
      const data = await apiRequest<Setup>(
        `/erp/transport-settings/vehicles/${id}`,
        accessToken,
        { method: "DELETE" },
      );
      applySetup(data, selectedRouteId);
      notifySuccess("Vehicle deleted");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete vehicle");
    }
  }

  if (loading || !setup || !form) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading transport settings…</div>;
  }

  const visibleVehicles = setup.vehicles.slice(0, 4);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            Operations <span className="mx-1">/</span>{" "}
            <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">Transport Settings</h1>
          <p className="text-xs text-[#6B7280]">
            Manage transport, routes, vehicles, stops and related preferences.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => notifySuccess("Transport changes are saved to the audit trail")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151]"
          >
            <ListAltOutlined className="!text-[18px]" />
            Audit Log
          </button>
          <button
            type="button"
            onClick={() =>
              notifySuccess("Configure module, fees, safety, then manage routes and vehicles")
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151]"
          >
            <HelpOutlineOutlined className="!text-[18px]" />
            Help
          </button>
          <button
            type="button"
            disabled={!canManage || saving}
            onClick={() => void saveSettings()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <SaveOutlined className="!text-[18px]" />
            {saving ? "Saving…" : "Save Configuration"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="mb-4 grid gap-4 xl:grid-cols-3">
          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-[#1A1A1A]">1. Transport Configuration</h2>
            <p className="mb-3 text-xs text-[#6B7280]">
              Enable transport module and configure basic preferences.
            </p>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#1A1A1A]">Enable Transport Module</p>
              </div>
              <Toggle
                checked={form.moduleEnabled}
                disabled={!canManage}
                onChange={() => setForm({ ...form, moduleEnabled: !form.moduleEnabled })}
              />
            </div>
            <label className="mb-3 block text-xs font-semibold text-[#6B7280]">
              Default Pickup Window (Before First Period)
              <div className="mt-1 flex gap-2">
                <input
                  className={inputClass}
                  value={form.pickupWindowValue}
                  disabled={!canManage}
                  onChange={(e) => setForm({ ...form, pickupWindowValue: e.target.value })}
                />
                <select
                  className={`${inputClass} w-28`}
                  value={form.pickupWindowUnit}
                  disabled={!canManage}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      pickupWindowUnit: e.target.value as Settings["pickupWindowUnit"],
                    })
                  }
                >
                  <option value="HOURS">Hours</option>
                  <option value="MINUTES">Minutes</option>
                </select>
              </div>
            </label>
            <label className="mb-3 block text-xs font-semibold text-[#6B7280]">
              Default Drop Window (After Last Period)
              <div className="mt-1 flex gap-2">
                <input
                  className={inputClass}
                  value={form.dropWindowValue}
                  disabled={!canManage}
                  onChange={(e) => setForm({ ...form, dropWindowValue: e.target.value })}
                />
                <select
                  className={`${inputClass} w-28`}
                  value={form.dropWindowUnit}
                  disabled={!canManage}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      dropWindowUnit: e.target.value as Settings["dropWindowUnit"],
                    })
                  }
                >
                  <option value="HOURS">Hours</option>
                  <option value="MINUTES">Minutes</option>
                </select>
              </div>
            </label>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#1A1A1A]">Allow Parent Tracking</p>
                <p className="text-xs text-[#9CA3AF]">
                  Parents can track their child&apos;s bus in real-time.
                </p>
              </div>
              <Toggle
                checked={form.allowParentTracking}
                disabled={!canManage}
                onChange={() =>
                  setForm({ ...form, allowParentTracking: !form.allowParentTracking })
                }
              />
            </div>
          </section>

          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-[#1A1A1A]">2. Fee &amp; Payment Settings</h2>
            <p className="mb-3 text-xs text-[#6B7280]">
              Configure transport fee collection preferences.
            </p>
            <p className="mb-2 text-xs font-semibold text-[#6B7280]">Transport Fee Type</p>
            <div className="mb-3 space-y-2 text-sm">
              {(
                [
                  ["ANNUAL", "One-time (Annual)"],
                  ["MONTHLY", "Monthly"],
                  ["QUARTERLY", "Quarterly"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="feeType"
                    checked={form.feeType === value}
                    disabled={!canManage}
                    onChange={() => setForm({ ...form, feeType: value })}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="mb-2 text-xs font-semibold text-[#6B7280]">Fee Collection Mode</p>
            <div className="mb-3 space-y-2 text-sm">
              {(
                [
                  ["IN_ADVANCE", "In Advance"],
                  ["IN_ARREARS", "In Arrears"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="feeMode"
                    checked={form.feeCollectionMode === value}
                    disabled={!canManage}
                    onChange={() => setForm({ ...form, feeCollectionMode: value })}
                  />
                  {label}
                </label>
              ))}
            </div>
            <label className="mb-3 block text-xs font-semibold text-[#6B7280]">
              Fee Due Day (Monthly)
              <input
                type="number"
                className={`${inputClass} mt-1`}
                value={form.feeDueDay}
                disabled={!canManage}
                onChange={(e) => setForm({ ...form, feeDueDay: Number(e.target.value) || 1 })}
              />
            </label>
            <label className="block text-xs font-semibold text-[#6B7280]">
              Late Fee (₹)
              <input
                type="number"
                className={`${inputClass} mt-1`}
                value={form.lateFeeAmount}
                disabled={!canManage}
                onChange={(e) =>
                  setForm({ ...form, lateFeeAmount: Number(e.target.value) || 0 })
                }
              />
              <span className="mt-1 block text-[11px] font-normal text-[#9CA3AF]">
                Late fee after due date.
              </span>
            </label>
          </section>

          <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-[#1A1A1A]">3. Safety &amp; Attendance Settings</h2>
            <p className="mb-3 text-xs text-[#6B7280]">
              Configure safety features and attendance rules.
            </p>
            {(
              [
                [
                  "markAttendanceOnPickup",
                  "Mark Attendance on Pickup",
                  "Attendance will be marked when student boards the bus.",
                ],
                [
                  "markAttendanceOnDrop",
                  "Mark Attendance on Drop",
                  "Attendance will be marked when student reaches drop point.",
                ],
                [
                  "notifyParentOnPickupDrop",
                  "Notify Parent on Pickup / Drop",
                  "Send SMS/Push notification to parents.",
                ],
              ] as const
            ).map(([key, label, hint]) => (
              <div
                key={key}
                className="mb-3 flex items-start justify-between gap-3 border-b border-[#F3F4F6] pb-3 last:mb-0 last:border-b-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">{label}</p>
                  <p className="text-xs text-[#9CA3AF]">{hint}</p>
                </div>
                <Toggle
                  checked={form[key]}
                  disabled={!canManage}
                  onChange={() => setForm({ ...form, [key]: !form[key] })}
                />
              </div>
            ))}
          </section>
        </div>

        <section className="mb-4 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-[#1A1A1A]">4. Routes &amp; Stops</h2>
              <p className="text-xs text-[#6B7280]">Manage transport routes and associated stops.</p>
            </div>
            <button
              type="button"
              disabled={!canManage}
              onClick={() => setRouteModal(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-50"
            >
              <AddOutlined className="!text-[16px]" />
              Add Route
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <div className="space-y-1 rounded-xl border border-[#E5E7EB] p-2">
              {setup.routes.map((route) => (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => selectRoute(route)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                    selectedRouteId === route.id
                      ? "border-l-4 border-primary bg-primary/5 font-semibold text-primary"
                      : "text-[#374151] hover:bg-[#F9FAFB]"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: route.color }}
                  />
                  <span className="truncate">
                    {route.displayLabel} {route.name}
                  </span>
                </button>
              ))}
            </div>

            {routeDraft && selectedRoute ? (
              <div className="rounded-xl border border-[#E5E7EB] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#1A1A1A]">
                    {selectedRoute.displayLabel}: {routeDraft.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#6B7280]">Active</span>
                    <Toggle
                      checked={routeDraft.isActive}
                      disabled={!canManage}
                      onChange={() =>
                        setRouteDraft({ ...routeDraft, isActive: !routeDraft.isActive })
                      }
                    />
                  </div>
                </div>
                <div className="mb-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-[#6B7280]">
                    Route Name
                    <input
                      className={`${inputClass} mt-1`}
                      value={routeDraft.name}
                      disabled={!canManage}
                      onChange={(e) => setRouteDraft({ ...routeDraft, name: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs font-semibold text-[#6B7280]">
                    Route Code
                    <input
                      className={`${inputClass} mt-1`}
                      value={routeDraft.code}
                      disabled={!canManage}
                      onChange={(e) => setRouteDraft({ ...routeDraft, code: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs font-semibold text-[#6B7280]">
                    Driver
                    <input
                      className={`${inputClass} mt-1`}
                      list="transport-staff"
                      value={routeDraft.driverName}
                      disabled={!canManage}
                      onChange={(e) =>
                        setRouteDraft({ ...routeDraft, driverName: e.target.value })
                      }
                    />
                  </label>
                  <label className="block text-xs font-semibold text-[#6B7280]">
                    Attendant
                    <input
                      className={`${inputClass} mt-1`}
                      list="transport-staff"
                      value={routeDraft.attendantName}
                      disabled={!canManage}
                      onChange={(e) =>
                        setRouteDraft({ ...routeDraft, attendantName: e.target.value })
                      }
                    />
                  </label>
                  <datalist id="transport-staff">
                    {setup.staffOptions.map((s) => (
                      <option key={s.id} value={s.label} />
                    ))}
                  </datalist>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-[#E5E7EB] text-xs uppercase text-[#9CA3AF]">
                      <tr>
                        <th className="px-2 py-2 font-semibold">#</th>
                        <th className="px-2 py-2 font-semibold">Stop Name</th>
                        <th className="px-2 py-2 font-semibold">Location</th>
                        <th className="px-2 py-2 font-semibold">Pickup Time</th>
                        <th className="px-2 py-2 font-semibold">Drop Time</th>
                        <th className="px-2 py-2 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routeDraft.stops.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-2 py-6 text-center text-[#9CA3AF]">
                            No stops yet.
                          </td>
                        </tr>
                      ) : (
                        routeDraft.stops.map((stop, index) => (
                          <tr key={`${stop.name}-${index}`} className="border-b border-[#F3F4F6]">
                            <td className="px-2 py-2.5">{index + 1}</td>
                            <td className="px-2 py-2.5 font-semibold text-[#1A1A1A]">
                              {stop.name}
                            </td>
                            <td className="px-2 py-2.5 text-[#374151]">{stop.location}</td>
                            <td className="px-2 py-2.5 text-[#374151]">{stop.pickupTime}</td>
                            <td className="px-2 py-2.5 text-[#374151]">{stop.dropTime}</td>
                            <td className="px-2 py-2.5">
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  disabled={!canManage}
                                  onClick={() => openStop(index)}
                                  className="rounded p-1 text-primary hover:bg-primary/10"
                                >
                                  <EditOutlined className="!text-[18px]" />
                                </button>
                                <button
                                  type="button"
                                  disabled={!canManage}
                                  onClick={() => removeStop(index)}
                                  className="rounded p-1 text-rose-600 hover:bg-rose-50"
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
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => openStop(null)}
                    className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary"
                  >
                    <AddOutlined className="!text-[16px]" />
                    Add Stop
                  </button>
                  <button
                    type="button"
                    disabled={!canManage || saving}
                    onClick={() => void saveRoute()}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Save Route
                  </button>
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => void removeRoute(selectedRoute.id)}
                    className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600"
                  >
                    Delete Route
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#E5E7EB] p-8 text-center text-sm text-[#9CA3AF]">
                Select or add a route to manage stops.
              </div>
            )}
          </div>
        </section>

        <section className="mb-4 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-[#1A1A1A]">5. Vehicles</h2>
              <p className="text-xs text-[#6B7280]">Manage institution transport vehicles.</p>
            </div>
            <button
              type="button"
              disabled={!canManage}
              onClick={() => openVehicle()}
              className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-sm font-semibold text-primary"
            >
              <AddOutlined className="!text-[16px]" />
              Add Vehicle
            </button>
          </div>
          <div className="space-y-2">
            {visibleVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] px-3 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <DirectionsBusOutlined className="!text-[20px]" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#1A1A1A]">{vehicle.registrationNo}</p>
                    <p className="text-xs text-[#9CA3AF]">
                      {vehicle.label} | {vehicle.capacity} Seats
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${vehicleStatusClass(vehicle.status)}`}
                  >
                    {vehicle.statusLabel}
                  </span>
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => openVehicle(vehicle)}
                    className="rounded p-1 text-primary hover:bg-primary/10"
                  >
                    <EditOutlined className="!text-[18px]" />
                  </button>
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => void removeVehicle(vehicle.id)}
                    className="rounded p-1 text-rose-600 hover:bg-rose-50"
                  >
                    <DeleteOutline className="!text-[18px]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {setup.vehicles.length > 4 ? (
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-primary"
              onClick={() => notifySuccess(`Showing all ${setup.vehicles.length} vehicles in list`)}
            >
              View All Vehicles →
            </button>
          ) : null}
        </section>

        <section className="mb-4 rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-sm font-bold text-[#1A1A1A]">6. Transport Summary</h2>
          <p className="mb-3 text-xs text-[#6B7280]">
            Overview of transport usage and statistics.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Total Students",
                value: String(setup.stats.totalStudentsDisplay).padStart(2, "0"),
                hint: "Using Transport",
                icon: <PeopleOutline className="!text-[22px] text-primary" />,
              },
              {
                label: "Total Routes",
                value: String(setup.stats.totalRoutes).padStart(2, "0"),
                hint: "Active Routes",
                icon: <DirectionsBusOutlined className="!text-[22px] text-sky-600" />,
              },
              {
                label: "Total Stops",
                value: String(setup.stats.totalStops).padStart(2, "0"),
                hint: "Across All Routes",
                icon: <LocationOnOutlined className="!text-[22px] text-amber-600" />,
              },
              {
                label: "Total Vehicles",
                value: String(setup.stats.totalVehicles).padStart(2, "0"),
                hint: "Registered Vehicles",
                icon: <DirectionsBusOutlined className="!text-[22px] text-emerald-600" />,
              },
            ].map((card) => (
              <div key={card.label} className="rounded-xl border border-[#E5E7EB] p-4">
                <div className="mb-2">{card.icon}</div>
                <p className="text-xs font-semibold uppercase text-[#9CA3AF]">{card.label}</p>
                <p className="text-2xl font-bold text-[#1A1A1A]">{card.value}</p>
                <p className="text-xs text-[#9CA3AF]">{card.hint}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <InfoOutlined className="mt-0.5 !text-[18px]" />
          <p>{setup.note}</p>
        </div>
      </div>

      {routeModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold">Add Route</h3>
            <input
              className={`${inputClass} mt-3`}
              placeholder="Route name"
              value={newRouteName}
              onChange={(e) => setNewRouteName(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold"
                onClick={() => setRouteModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
                onClick={() => void createRoute()}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {stopModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold">
              {editingStopIndex != null ? "Edit Stop" : "Add Stop"}
            </h3>
            <div className="mt-3 space-y-3">
              <input
                className={inputClass}
                placeholder="Stop name"
                value={stopForm.name}
                onChange={(e) => setStopForm({ ...stopForm, name: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder="Location"
                value={stopForm.location}
                onChange={(e) => setStopForm({ ...stopForm, location: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={inputClass}
                  placeholder="Pickup time"
                  value={stopForm.pickupTime}
                  onChange={(e) => setStopForm({ ...stopForm, pickupTime: e.target.value })}
                />
                <input
                  className={inputClass}
                  placeholder="Drop time"
                  value={stopForm.dropTime}
                  onChange={(e) => setStopForm({ ...stopForm, dropTime: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold"
                onClick={() => setStopModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
                onClick={applyStop}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {vehicleModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-bold">
              {editingVehicleId ? "Edit Vehicle" : "Add Vehicle"}
            </h3>
            <div className="mt-3 space-y-3">
              <input
                className={inputClass}
                placeholder="Registration no"
                value={vehicleForm.registrationNo}
                onChange={(e) =>
                  setVehicleForm({ ...vehicleForm, registrationNo: e.target.value })
                }
              />
              <input
                className={inputClass}
                placeholder="Label (e.g. Bus - 1)"
                value={vehicleForm.label}
                onChange={(e) => setVehicleForm({ ...vehicleForm, label: e.target.value })}
              />
              <input
                type="number"
                className={inputClass}
                placeholder="Capacity"
                value={vehicleForm.capacity}
                onChange={(e) =>
                  setVehicleForm({ ...vehicleForm, capacity: Number(e.target.value) || 1 })
                }
              />
              <select
                className={inputClass}
                value={vehicleForm.status}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    status: e.target.value as Vehicle["status"],
                  })
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <select
                className={inputClass}
                value={vehicleForm.routeId}
                onChange={(e) => setVehicleForm({ ...vehicleForm, routeId: e.target.value })}
              >
                <option value="">No route</option>
                {setup.routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.displayLabel} {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold"
                onClick={() => setVehicleModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white"
                onClick={() => void saveVehicle()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
