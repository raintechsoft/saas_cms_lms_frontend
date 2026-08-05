import { useEffect, useMemo, useState, type FormEvent } from "react";
import { HomeWorkOutlined, HotelOutlined, PersonOutlined } from "@mui/icons-material";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
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

type Tab = "blocks" | "rooms" | "assign";

interface HostelBlock {
  id: string;
  name: string;
  gender: string | null;
  isActive: boolean;
  notes: string | null;
  _count: { rooms: number };
}

interface HostelRoom {
  id: string;
  name: string;
  capacity: number;
  isActive: boolean;
  notes: string | null;
  block: { id: string; name: string };
  _count: { students: number };
}

interface StudentOption {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
  hostelOptIn: boolean;
  hostelRoom: string | null;
  hostelRoomId: string | null;
}

const TAB_ROUTES: Record<Tab, string> = {
  blocks: "/hostel/blocks",
  rooms: "/hostel/rooms",
  assign: "/hostel/assign",
};

const TABS: Array<CmsIconTabItem<Tab>> = [
  { key: "blocks", label: "Blocks", icon: HomeWorkOutlined, tone: "amber" },
  { key: "rooms", label: "Rooms", icon: HotelOutlined, tone: "sky" },
  { key: "assign", label: "Assign students", icon: PersonOutlined, tone: "indigo" },
];

const PAGE_SIZE = 8;

function studentLabel(student: StudentOption) {
  return `${student.firstName} ${student.lastName ?? ""}`.trim();
}

function tabFromPath(pathname: string): Tab {
  if (pathname.startsWith("/hostel/rooms")) return "rooms";
  if (pathname.startsWith("/hostel/assign")) return "assign";
  return "blocks";
}

export function HostelPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = tabFromPath(location.pathname);
  const { accessToken, user } = useAuth();
  const [blocks, setBlocks] = useState<HostelBlock[]>([]);
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [blockName, setBlockName] = useState("");
  const [blockGender, setBlockGender] = useState("");
  const [blockActive, setBlockActive] = useState(true);
  const [blockNotes, setBlockNotes] = useState("");
  const [roomBlockId, setRoomBlockId] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomCapacity, setRoomCapacity] = useState("1");
  const [roomActive, setRoomActive] = useState(true);
  const [roomNotes, setRoomNotes] = useState("");
  const [roomFilterBlockId, setRoomFilterBlockId] = useState("");
  const [assignStudentId, setAssignStudentId] = useState("");
  const [assignRoomId, setAssignRoomId] = useState("");

  const canManage = user?.permissions.includes("hostel.manage") ?? false;

  const filteredRooms = useMemo(
    () => (roomFilterBlockId ? rooms.filter((room) => room.block.id === roomFilterBlockId) : rooms),
    [rooms, roomFilterBlockId],
  );
  const pageRows = useMemo(() => {
    if (tab === "blocks") return paginateItems(blocks, page, PAGE_SIZE);
    if (tab === "rooms") return paginateItems(filteredRooms, page, PAGE_SIZE);
    return [];
  }, [tab, blocks, filteredRooms, page]);
  const totalItems = tab === "blocks" ? blocks.length : tab === "rooms" ? filteredRooms.length : 0;

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    if (page > maxPage) setPage(maxPage);
  }, [totalItems, page]);

  function resetBlockForm() {
    setEditingBlockId(null);
    setBlockName("");
    setBlockGender("");
    setBlockActive(true);
    setBlockNotes("");
  }

  function resetRoomForm() {
    setEditingRoomId(null);
    setRoomBlockId("");
    setRoomName("");
    setRoomCapacity("1");
    setRoomActive(true);
    setRoomNotes("");
  }

  async function load() {
    try {
      const [blockRows, roomRows, studentList] = await Promise.all([
        apiRequest<HostelBlock[]>("/hostel/blocks", accessToken),
        apiRequest<HostelRoom[]>("/hostel/rooms", accessToken),
        apiRequest<{ items: StudentOption[] }>("/students?limit=100&status=ACTIVE", accessToken),
      ]);
      setBlocks(blockRows);
      setRooms(roomRows);
      setStudents(studentList.items);
      setPage(1);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load hostel data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  function startEditBlock(block: HostelBlock) {
    setEditingBlockId(block.id);
    setBlockName(block.name);
    setBlockGender(block.gender ?? "");
    setBlockActive(block.isActive);
    setBlockNotes(block.notes ?? "");
  }

  function startEditRoom(room: HostelRoom) {
    setEditingRoomId(room.id);
    setRoomBlockId(room.block.id);
    setRoomName(room.name);
    setRoomCapacity(String(room.capacity));
    setRoomActive(room.isActive);
    setRoomNotes(room.notes ?? "");
  }

  async function saveBlock(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setSubmitting(true);
    const payload = {
      name: blockName,
      gender: blockGender || null,
      isActive: blockActive,
      notes: blockNotes || null,
    };
    try {
      if (editingBlockId) {
        await apiRequest(`/hostel/blocks/${editingBlockId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        notifySuccess("Block updated");
      } else {
        await apiRequest("/hostel/blocks", accessToken, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        notifySuccess("Block created");
      }
      resetBlockForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save block");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveRoom(event: FormEvent) {
    event.preventDefault();
    if (!canManage || !roomBlockId) return;
    setSubmitting(true);
    const payload = {
      blockId: roomBlockId,
      name: roomName,
      capacity: Number(roomCapacity) || 1,
      isActive: roomActive,
      notes: roomNotes || null,
    };
    try {
      if (editingRoomId) {
        await apiRequest(`/hostel/rooms/${editingRoomId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        notifySuccess("Room updated");
      } else {
        await apiRequest("/hostel/rooms", accessToken, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        notifySuccess("Room created");
      }
      resetRoomForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save room");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeBlock(id: string) {
    if (!canManage) return;
    const ok = await confirmDelete({
      title: "Delete block?",
      text: "All rooms in this block and student assignments will be removed.",
    });
    if (!ok) return;
    try {
      await apiRequest(`/hostel/blocks/${id}`, accessToken, { method: "DELETE" });
      if (editingBlockId === id) resetBlockForm();
      notifySuccess("Block deleted");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete block");
    }
  }

  async function removeRoom(id: string) {
    if (!canManage) return;
    const ok = await confirmDelete({
      title: "Delete room?",
      text: "Students in this room will be unassigned.",
    });
    if (!ok) return;
    try {
      await apiRequest(`/hostel/rooms/${id}`, accessToken, { method: "DELETE" });
      if (editingRoomId === id) resetRoomForm();
      notifySuccess("Room deleted");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete room");
    }
  }

  async function assignStudent(event: FormEvent) {
    event.preventDefault();
    if (!canManage || !assignStudentId) return;
    setSubmitting(true);
    try {
      await apiRequest("/hostel/assign", accessToken, {
        method: "POST",
        body: JSON.stringify({
          studentId: assignStudentId,
          roomId: assignRoomId || null,
        }),
      });
      notifySuccess(assignRoomId ? "Student assigned to room" : "Hostel assignment cleared");
      setAssignStudentId("");
      setAssignRoomId("");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to assign student");
    } finally {
      setSubmitting(false);
    }
  }

  const activeRooms = rooms.filter((room) => room.isActive);

  if (location.pathname === "/hostel") {
    return <Navigate to="/hostel/blocks" replace />;
  }

  return (
    <CmsPage>
      <CmsPageHeader title="Hostel" description="Manage hostel blocks, rooms, and student assignments." />
      <CmsIconTabs
        active={tab}
        onChange={(next) => navigate(TAB_ROUTES[next])}
        items={TABS}
      />
      <CmsScrollBody className="space-y-4 pt-4">
        {tab === "blocks" ? (
          <>
            {canManage ? (
              <CmsSectionCard className="p-5">
                <h2 className="text-base font-semibold text-slate-900">
                  {editingBlockId ? "Edit block" : "Add block"}
                </h2>
                <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={saveBlock}>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Block name *</span>
                    <input className="input w-full" value={blockName} onChange={(e) => setBlockName(e.target.value)} required />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Gender</span>
                    <input className="input w-full" placeholder="Boys / Girls / Mixed" value={blockGender} onChange={(e) => setBlockGender(e.target.value)} />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={blockActive} onChange={(e) => setBlockActive(e.target.checked)} />
                    <span className="font-medium text-slate-700">Active block</span>
                  </label>
                  <label className="block text-sm sm:col-span-3">
                    <span className="mb-1 block font-medium text-slate-700">Notes</span>
                    <textarea className="input w-full" rows={2} value={blockNotes} onChange={(e) => setBlockNotes(e.target.value)} />
                  </label>
                  <div className="flex flex-wrap gap-2 sm:col-span-3">
                    <button type="submit" className="btn-primary" disabled={submitting}>
                      {editingBlockId ? "Update block" : "Create block"}
                    </button>
                    {editingBlockId ? (
                      <button type="button" className="btn-secondary" onClick={resetBlockForm}>
                        Cancel edit
                      </button>
                    ) : null}
                  </div>
                </form>
              </CmsSectionCard>
            ) : null}
            <CmsSectionCard className="overflow-hidden !p-0">
              {loading ? (
                <p className="p-8 text-center text-sm text-slate-500">Loading blocks…</p>
              ) : !blocks.length ? (
                <p className="p-8 text-center text-sm text-slate-500">No hostel blocks yet.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Block</th>
                          <th className="px-4 py-3">Gender</th>
                          <th className="px-4 py-3">Rooms</th>
                          <th className="px-4 py-3">Status</th>
                          {canManage ? <th className="px-4 py-3">Actions</th> : null}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(pageRows as HostelBlock[]).map((block) => (
                          <tr key={block.id} className="hover:bg-slate-50/80">
                            <td className="px-4 py-3 font-semibold text-slate-900">{block.name}</td>
                            <td className="px-4 py-3 text-slate-700">{block.gender ?? "—"}</td>
                            <td className="px-4 py-3 text-slate-700">{block._count.rooms}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${block.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                                {block.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            {canManage ? (
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button type="button" className="btn-secondary text-xs" onClick={() => startEditBlock(block)}>
                                    Edit
                                  </button>
                                  <button type="button" className="btn-danger text-xs" onClick={() => void removeBlock(block.id)}>
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
                  <ListPagination page={page} pageSize={PAGE_SIZE} total={blocks.length} onPageChange={setPage} />
                </>
              )}
            </CmsSectionCard>
          </>
        ) : null}

        {tab === "rooms" ? (
          <>
            {canManage ? (
              <CmsSectionCard className="p-5">
                <h2 className="text-base font-semibold text-slate-900">
                  {editingRoomId ? "Edit room" : "Add room"}
                </h2>
                <form className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={saveRoom}>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Block *</span>
                    <select className="input w-full" value={roomBlockId} onChange={(e) => setRoomBlockId(e.target.value)} required>
                      <option value="">Select block</option>
                      {blocks.map((block) => (
                        <option key={block.id} value={block.id}>{block.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Room name *</span>
                    <input className="input w-full" value={roomName} onChange={(e) => setRoomName(e.target.value)} required />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Capacity</span>
                    <input className="input w-full" type="number" min="1" max="50" value={roomCapacity} onChange={(e) => setRoomCapacity(e.target.value)} />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={roomActive} onChange={(e) => setRoomActive(e.target.checked)} />
                    <span className="font-medium text-slate-700">Active room</span>
                  </label>
                  <div className="flex flex-wrap gap-2 sm:col-span-4">
                    <button type="submit" className="btn-primary" disabled={submitting}>
                      {editingRoomId ? "Update room" : "Create room"}
                    </button>
                    {editingRoomId ? (
                      <button type="button" className="btn-secondary" onClick={resetRoomForm}>
                        Cancel edit
                      </button>
                    ) : null}
                  </div>
                </form>
              </CmsSectionCard>
            ) : null}
            <CmsSectionCard className="overflow-hidden !p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">All rooms</h2>
                <select
                  className="input text-sm"
                  value={roomFilterBlockId}
                  onChange={(e) => {
                    setRoomFilterBlockId(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All blocks</option>
                  {blocks.map((block) => (
                    <option key={block.id} value={block.id}>{block.name}</option>
                  ))}
                </select>
              </div>
              {loading ? (
                <p className="p-8 text-center text-sm text-slate-500">Loading rooms…</p>
              ) : !filteredRooms.length ? (
                <p className="p-8 text-center text-sm text-slate-500">No rooms yet.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Block</th>
                          <th className="px-4 py-3">Room</th>
                          <th className="px-4 py-3">Occupied</th>
                          <th className="px-4 py-3">Status</th>
                          {canManage ? <th className="px-4 py-3">Actions</th> : null}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(pageRows as HostelRoom[]).map((room) => (
                          <tr key={room.id} className="hover:bg-slate-50/80">
                            <td className="px-4 py-3 text-slate-700">{room.block.name}</td>
                            <td className="px-4 py-3 font-semibold text-slate-900">{room.name}</td>
                            <td className="px-4 py-3 text-slate-700">
                              {room._count.students} / {room.capacity}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${room.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                                {room.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            {canManage ? (
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button type="button" className="btn-secondary text-xs" onClick={() => startEditRoom(room)}>
                                    Edit
                                  </button>
                                  <button type="button" className="btn-danger text-xs" onClick={() => void removeRoom(room.id)}>
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
                  <ListPagination page={page} pageSize={PAGE_SIZE} total={filteredRooms.length} onPageChange={setPage} />
                </>
              )}
            </CmsSectionCard>
          </>
        ) : null}

        {tab === "assign" ? (
          <CmsSectionCard className="p-5">
            <h2 className="text-base font-semibold text-slate-900">Assign student to room</h2>
            <p className="mt-1 text-sm text-slate-500">
              Capacity is enforced per room. Leave room empty to clear hostel assignment.
            </p>
            {canManage ? (
              <form className="mt-4 grid max-w-xl gap-3" onSubmit={assignStudent}>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Student *</span>
                  <select className="input w-full" value={assignStudentId} onChange={(e) => setAssignStudentId(e.target.value)} required>
                    <option value="">Select student</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.admissionNumber} · {studentLabel(student)}
                        {student.hostelRoom ? ` · ${student.hostelRoom}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Room</span>
                  <select className="input w-full" value={assignRoomId} onChange={(e) => setAssignRoomId(e.target.value)}>
                    <option value="">No hostel / clear assignment</option>
                    {activeRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.block.name} · {room.name} ({room._count.students}/{room.capacity})
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="btn-primary w-fit" disabled={submitting}>
                  Save assignment
                </button>
              </form>
            ) : (
              <p className="mt-4 text-sm text-slate-500">You need hostel.manage permission to assign students.</p>
            )}
          </CmsSectionCard>
        ) : null}
      </CmsScrollBody>
      <CmsFooter />
    </CmsPage>
  );
}
