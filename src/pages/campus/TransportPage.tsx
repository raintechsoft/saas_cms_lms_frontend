import { useEffect, useMemo, useState, type FormEvent } from "react";
import { DirectionsBusOutlined } from "@mui/icons-material";
import { useAuth } from "../../auth/AuthContext";
import {
  CmsFooter,
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

type Tab = "routes" | "assign";

interface TransportRoute {
  id: string;
  name: string;
  code: string | null;
  vehicleNumber: string | null;
  driverName: string | null;
  driverPhone: string | null;
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
}

const TABS: Array<CmsIconTabItem<Tab>> = [
  { key: "routes", label: "Routes", icon: DirectionsBusOutlined, tone: "sky" },
  { key: "assign", label: "Assign students", icon: DirectionsBusOutlined, tone: "indigo" },
];

const PAGE_SIZE = 8;

function studentLabel(student: StudentOption) {
  return `${student.firstName} ${student.lastName ?? ""}`.trim();
}

export function TransportPage() {
  const { accessToken, user } = useAuth();
  const [tab, setTab] = useState<Tab>("routes");
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [fareAmount, setFareAmount] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [assignStudentId, setAssignStudentId] = useState("");
  const [assignRouteId, setAssignRouteId] = useState("");

  const canManage = user?.permissions.includes("transport.manage") ?? false;
  const pageRows = useMemo(() => paginateItems(routes, page, PAGE_SIZE), [routes, page]);

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
  }

  async function load() {
    try {
      const [routeRows, studentList] = await Promise.all([
        apiRequest<TransportRoute[]>("/transport/routes", accessToken),
        apiRequest<{ items: StudentOption[] }>("/students?limit=100&status=ACTIVE", accessToken),
      ]);
      setRoutes(routeRows);
      setStudents(studentList.items);
      setPage(1);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load transport data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

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
  }

  async function saveRoute(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setSubmitting(true);
    const payload = {
      name,
      code: code || null,
      vehicleNumber: vehicleNumber || null,
      driverName: driverName || null,
      driverPhone: driverPhone || null,
      fareAmount: fareAmount ? Number(fareAmount) : null,
      isActive,
      notes: notes || null,
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
        }),
      });
      notifySuccess(assignRouteId ? "Student assigned to route" : "Transport assignment cleared");
      setAssignStudentId("");
      setAssignRouteId("");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to assign student");
    } finally {
      setSubmitting(false);
    }
  }

  const activeRoutes = routes.filter((route) => route.isActive);

  return (
    <CmsPage>
      <CmsPageHeader
        title="Transport"
        description="Manage bus routes and assign students to transport."
      />
      <CmsIconTabs active={tab} onChange={setTab} items={TABS} />
      <CmsScrollBody className="space-y-4 pt-4">
        {tab === "routes" ? (
          <>
            {canManage ? (
              <CmsSectionCard className="p-5">
                <h2 className="text-base font-semibold text-slate-900">
                  {editingId ? "Edit route" : "Add route"}
                </h2>
                <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={saveRoute}>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Route name *</span>
                    <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} required />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Code</span>
                    <input className="input w-full" value={code} onChange={(e) => setCode(e.target.value)} />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Vehicle number</span>
                    <input className="input w-full" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Driver name</span>
                    <input className="input w-full" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Driver phone</span>
                    <input className="input w-full" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Fare (₹)</span>
                    <input className="input w-full" type="number" min="0" step="0.01" value={fareAmount} onChange={(e) => setFareAmount(e.target.value)} />
                  </label>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                    <span className="font-medium text-slate-700">Active route</span>
                  </label>
                  <label className="block text-sm sm:col-span-3">
                    <span className="mb-1 block font-medium text-slate-700">Notes</span>
                    <textarea className="input w-full" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </label>
                  <div className="flex flex-wrap gap-2 sm:col-span-3">
                    <button type="submit" className="btn-primary" disabled={submitting}>
                      {editingId ? "Update route" : "Create route"}
                    </button>
                    {editingId ? (
                      <button type="button" className="btn-secondary" onClick={resetForm}>
                        Cancel edit
                      </button>
                    ) : null}
                  </div>
                </form>
              </CmsSectionCard>
            ) : null}

            <CmsSectionCard className="overflow-hidden !p-0">
              {loading ? (
                <p className="p-8 text-center text-sm text-slate-500">Loading routes…</p>
              ) : !routes.length ? (
                <p className="p-8 text-center text-sm text-slate-500">No transport routes yet.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Route</th>
                          <th className="px-4 py-3">Vehicle</th>
                          <th className="px-4 py-3">Driver</th>
                          <th className="px-4 py-3">Students</th>
                          <th className="px-4 py-3">Status</th>
                          {canManage ? <th className="px-4 py-3">Actions</th> : null}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pageRows.map((route) => (
                          <tr key={route.id} className="hover:bg-slate-50/80">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-900">{route.name}</p>
                              {route.code ? <p className="text-xs text-slate-500">{route.code}</p> : null}
                            </td>
                            <td className="px-4 py-3 text-slate-700">{route.vehicleNumber ?? "—"}</td>
                            <td className="px-4 py-3 text-slate-700">
                              {route.driverName ?? "—"}
                              {route.driverPhone ? (
                                <p className="text-xs text-slate-500">{route.driverPhone}</p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-slate-700">{route._count.students}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  route.isActive
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {route.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            {canManage ? (
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button type="button" className="btn-secondary text-xs" onClick={() => startEdit(route)}>
                                    Edit
                                  </button>
                                  <button type="button" className="btn-danger text-xs" onClick={() => void remove(route.id)}>
                                    Delete
                                  </button>
                                </div>
                              </td>
                            ) : null}
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
        ) : (
          <CmsSectionCard className="p-5">
            <h2 className="text-base font-semibold text-slate-900">Assign student to route</h2>
            <p className="mt-1 text-sm text-slate-500">
              Pick a student and route. Leave route empty to clear transport assignment.
            </p>
            {canManage ? (
              <form className="mt-4 grid max-w-xl gap-3" onSubmit={assignStudent}>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Student *</span>
                  <select
                    className="input w-full"
                    value={assignStudentId}
                    onChange={(e) => setAssignStudentId(e.target.value)}
                    required
                  >
                    <option value="">Select student</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.admissionNumber} · {studentLabel(student)}
                        {student.transportRoute ? ` · ${student.transportRoute}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Route</span>
                  <select
                    className="input w-full"
                    value={assignRouteId}
                    onChange={(e) => setAssignRouteId(e.target.value)}
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
                <button type="submit" className="btn-primary w-fit" disabled={submitting}>
                  Save assignment
                </button>
              </form>
            ) : (
              <p className="mt-4 text-sm text-slate-500">You need transport.manage permission to assign students.</p>
            )}
          </CmsSectionCard>
        )}
      </CmsScrollBody>
      <CmsFooter />
    </CmsPage>
  );
}
