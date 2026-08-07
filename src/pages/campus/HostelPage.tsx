import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  BedOutlined,
  DeleteOutline,
  EditOutlined,
  HistoryOutlined,
  HomeWorkOutlined,
  HotelOutlined,
  MeetingRoomOutlined,
  PersonOutlined,
} from "@mui/icons-material";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
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

type Tab = "blocks" | "rooms" | "assign" | "history";

interface HostelBlock {
  id: string;
  name: string;
  gender: string | null;
  isActive: boolean;
  notes: string | null;
  _count: { rooms: number };
}

interface HostelBed {
  id: string;
  label: string;
  isActive: boolean;
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string | null;
  } | null;
}

interface HostelRoom {
  id: string;
  name: string;
  capacity: number;
  isActive: boolean;
  notes: string | null;
  block: { id: string; name: string; gender?: string | null };
  beds?: HostelBed[];
  _count: { students: number; beds?: number };
}

interface StudentOption {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
  gender?: string | null;
  hostelOptIn: boolean;
  hostelRoom: string | null;
  hostelRoomId: string | null;
  hostelBedId: string | null;
}

interface RoomStudent {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
  gender: string | null;
  hostelBedId: string | null;
  hostelBedRef: { id: string; label: string } | null;
}

interface AllocationLog {
  id: string;
  action: string;
  roomLabel: string | null;
  note: string | null;
  createdAt: string;
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string | null;
  };
  hostelRoom: {
    id: string;
    name: string;
    block: { name: string };
  } | null;
  assignedBy: { id: string; firstName: string; lastName: string | null } | null;
}

const TAB_ROUTES: Record<Tab, string> = {
  blocks: "/hostel/blocks",
  rooms: "/hostel/rooms",
  assign: "/hostel/assign",
  history: "/hostel/history",
};

const TABS: Array<CmsIconTabItem<Tab>> = [
  { key: "blocks", label: "Blocks", shortLabel: "Blocks", icon: HomeWorkOutlined, tone: "amber" },
  { key: "rooms", label: "Rooms & beds", shortLabel: "Rooms", icon: HotelOutlined, tone: "sky" },
  { key: "assign", label: "Assign students", shortLabel: "Assign", icon: PersonOutlined, tone: "indigo" },
  { key: "history", label: "History", shortLabel: "History", icon: HistoryOutlined, tone: "emerald" },
];

const PAGE_SIZE = 8;

function studentLabel(student: { firstName: string; lastName: string | null }) {
  return `${student.firstName} ${student.lastName ?? ""}`.trim();
}

function tabFromPath(pathname: string): Tab {
  if (pathname.startsWith("/hostel/rooms")) return "rooms";
  if (pathname.startsWith("/hostel/assign")) return "assign";
  if (pathname.startsWith("/hostel/history")) return "history";
  return "blocks";
}

function actionPill(action: string) {
  const upper = action.toUpperCase();
  if (upper === "ASSIGNED") return "nx-pill nx-pill-success";
  if (upper === "CLEARED") return "nx-pill nx-pill-neutral";
  if (upper === "UPDATED") return "nx-pill nx-pill-indigo";
  return "nx-pill nx-pill-warning";
}

function occupancyTone(occupied: number, capacity: number) {
  const ratio = capacity <= 0 ? 0 : occupied / capacity;
  if (ratio >= 1) return { bar: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50" };
  if (ratio >= 0.75) return { bar: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" };
  return { bar: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" };
}

function EmptyState({
  icon,
  title,
  hint,
  tone = "amber",
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  tone?: "amber" | "sky" | "indigo" | "emerald";
}) {
  const tones = {
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    sky: "bg-sky-50 text-sky-700 ring-sky-100",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  };
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className={`flex size-12 items-center justify-center rounded-2xl ring-1 ${tones[tone]}`}>
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
    <div className="mb-0 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-bold tracking-tight text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function HostelPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = tabFromPath(location.pathname);
  const { accessToken, user } = useAuth();
  const [blocks, setBlocks] = useState<HostelBlock[]>([]);
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [logs, setLogs] = useState<AllocationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [showRoomForm, setShowRoomForm] = useState(false);
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
  const [detailRoomId, setDetailRoomId] = useState("");
  const [roomStudents, setRoomStudents] = useState<RoomStudent[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newBedLabel, setNewBedLabel] = useState("");
  const [assignStudentId, setAssignStudentId] = useState("");
  const [assignRoomId, setAssignRoomId] = useState("");
  const [assignBedId, setAssignBedId] = useState("");
  const [assignNote, setAssignNote] = useState("");
  const [enforceGender, setEnforceGender] = useState(true);

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
  const activeRooms = useMemo(() => rooms.filter((room) => room.isActive), [rooms]);
  const selectedAssignRoom = useMemo(
    () => activeRooms.find((room) => room.id === assignRoomId) ?? null,
    [activeRooms, assignRoomId],
  );
  const freeBeds = useMemo(() => {
    if (!selectedAssignRoom?.beds) return [];
    return selectedAssignRoom.beds.filter(
      (bed) => bed.isActive && (!bed.student || bed.student.id === assignStudentId),
    );
  }, [selectedAssignRoom, assignStudentId]);

  const totalOccupied = useMemo(
    () => rooms.reduce((sum, room) => sum + room._count.students, 0),
    [rooms],
  );
  const totalCapacity = useMemo(
    () => rooms.reduce((sum, room) => sum + room.capacity, 0),
    [rooms],
  );
  const totalBeds = useMemo(
    () => rooms.reduce((sum, room) => sum + (room._count.beds ?? room.beds?.length ?? 0), 0),
    [rooms],
  );

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
    setShowBlockForm(false);
  }

  function resetRoomForm() {
    setEditingRoomId(null);
    setRoomBlockId("");
    setRoomName("");
    setRoomCapacity("1");
    setRoomActive(true);
    setRoomNotes("");
    setShowRoomForm(false);
  }

  async function load() {
    try {
      const [blockRows, roomRows, studentList, logRows] = await Promise.all([
        apiRequest<HostelBlock[]>("/hostel/blocks", accessToken),
        apiRequest<HostelRoom[]>("/hostel/rooms", accessToken),
        apiRequest<{ items: StudentOption[] }>("/students?limit=100&status=ACTIVE", accessToken),
        apiRequest<AllocationLog[]>("/hostel/logs?take=100", accessToken),
      ]);
      setBlocks(blockRows);
      setRooms(roomRows);
      setStudents(studentList.items);
      setLogs(logRows);
      setPage(1);
      if (!detailRoomId && roomRows[0]) setDetailRoomId(roomRows[0].id);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load hostel data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  useEffect(() => {
    if (!detailRoomId) {
      setRoomStudents([]);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void apiRequest<{ students: RoomStudent[]; room: HostelRoom }>(
      `/hostel/rooms/${detailRoomId}/students`,
      accessToken,
    )
      .then((data) => {
        if (!cancelled) {
          setRoomStudents(data.students);
          setRooms((prev) =>
            prev.map((room) => (room.id === detailRoomId ? { ...room, beds: data.room.beds } : room)),
          );
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          notifyError(cause instanceof Error ? cause.message : "Unable to load room roster");
          setRoomStudents([]);
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, detailRoomId]);

  function startEditBlock(block: HostelBlock) {
    setEditingBlockId(block.id);
    setBlockName(block.name);
    setBlockGender(block.gender ?? "");
    setBlockActive(block.isActive);
    setBlockNotes(block.notes ?? "");
    setShowBlockForm(true);
  }

  function startEditRoom(room: HostelRoom) {
    setEditingRoomId(room.id);
    setRoomBlockId(room.block.id);
    setRoomName(room.name);
    setRoomCapacity(String(room.capacity));
    setRoomActive(room.isActive);
    setRoomNotes(room.notes ?? "");
    setShowRoomForm(true);
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
      if (detailRoomId === id) setDetailRoomId("");
      notifySuccess("Room deleted");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete room");
    }
  }

  async function addBed() {
    if (!canManage || !detailRoomId || !newBedLabel.trim()) return;
    setSubmitting(true);
    try {
      await apiRequest("/hostel/beds", accessToken, {
        method: "POST",
        body: JSON.stringify({ roomId: detailRoomId, label: newBedLabel.trim() }),
      });
      notifySuccess("Bed added");
      setNewBedLabel("");
      const current = detailRoomId;
      await load();
      setDetailRoomId(current);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to add bed");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeBed(id: string) {
    if (!canManage) return;
    const ok = await confirmDelete({
      title: "Delete bed?",
      text: "Any student on this bed will keep the room but lose the bed link.",
    });
    if (!ok) return;
    try {
      await apiRequest(`/hostel/beds/${id}`, accessToken, { method: "DELETE" });
      notifySuccess("Bed deleted");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete bed");
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
          bedId: assignRoomId ? assignBedId || null : null,
          note: assignNote || null,
          enforceGender,
        }),
      });
      notifySuccess(assignRoomId ? "Student assigned to room" : "Hostel assignment cleared");
      setAssignStudentId("");
      setAssignRoomId("");
      setAssignBedId("");
      setAssignNote("");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to assign student");
    } finally {
      setSubmitting(false);
    }
  }

  if (location.pathname === "/hostel") {
    return <Navigate to="/hostel/blocks" replace />;
  }

  const detailRoom = rooms.find((room) => room.id === detailRoomId) ?? null;
  const detailTone = detailRoom
    ? occupancyTone(detailRoom._count.students, detailRoom.capacity)
    : null;

  return (
    <CmsPage>
      <CmsPageHeader
        title="Hostel"
        description="Blocks, rooms, beds, and student allocations."
        actions={
          canManage && tab === "blocks" ? (
            <button
              type="button"
              className="nx-btn-primary"
              onClick={() => {
                if (showBlockForm && !editingBlockId) resetBlockForm();
                else {
                  setEditingBlockId(null);
                  setShowBlockForm(true);
                }
              }}
            >
              <AddOutlined sx={{ fontSize: 16 }} />
              {showBlockForm && !editingBlockId ? "Close form" : "Add block"}
            </button>
          ) : canManage && tab === "rooms" ? (
            <button
              type="button"
              className="nx-btn-primary"
              onClick={() => {
                if (showRoomForm && !editingRoomId) resetRoomForm();
                else {
                  setEditingRoomId(null);
                  setShowRoomForm(true);
                }
              }}
            >
              <AddOutlined sx={{ fontSize: 16 }} />
              {showRoomForm && !editingRoomId ? "Close form" : "Add room"}
            </button>
          ) : null
        }
      />

      <CmsKpiGrid>
        <CmsKpiCard
          icon={<HomeWorkOutlined sx={{ fontSize: 20 }} />}
          label="Blocks"
          value={blocks.filter((b) => b.isActive).length}
          tint="#d97706"
        />
        <CmsKpiCard
          icon={<MeetingRoomOutlined sx={{ fontSize: 20 }} />}
          label="Rooms"
          value={activeRooms.length}
          tint="#0284c7"
        />
        <CmsKpiCard
          icon={<BedOutlined sx={{ fontSize: 20 }} />}
          label="Beds"
          value={totalBeds}
          tint="#4f46e5"
        />
        <CmsKpiCard
          icon={<PersonOutlined sx={{ fontSize: 20 }} />}
          label="Occupancy"
          value={totalCapacity ? `${totalOccupied}/${totalCapacity}` : totalOccupied}
          tint="#059669"
        />
      </CmsKpiGrid>

      <CmsIconTabs
        ariaLabel="Hostel sections"
        value={tab}
        onChange={(next) => navigate(TAB_ROUTES[next])}
        columnsClass="grid-cols-2 sm:grid-cols-4"
        items={TABS}
      />

      <CmsScrollBody className="space-y-4 pt-4">
        {tab === "blocks" ? (
          <>
            {canManage && showBlockForm ? (
              <CmsSectionCard className="overflow-hidden !p-0">
                <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50 via-white to-orange-50/40 px-5 py-4">
                  <SectionTitle
                    title={editingBlockId ? "Edit block" : "New block"}
                    subtitle="Gender policy applies when assigning students to rooms in this block."
                  />
                </div>
                <form className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3" onSubmit={saveBlock}>
                  <label>
                    <span className="nx-label">Block name *</span>
                    <input className="nx-input w-full" value={blockName} onChange={(e) => setBlockName(e.target.value)} required />
                  </label>
                  <label>
                    <span className="nx-label">Gender</span>
                    <select className="nx-input w-full" value={blockGender} onChange={(e) => setBlockGender(e.target.value)}>
                      <option value="">Not set</option>
                      <option value="Boys">Boys</option>
                      <option value="Girls">Girls</option>
                      <option value="Mixed">Mixed</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 pt-6 text-sm">
                    <input type="checkbox" checked={blockActive} onChange={(e) => setBlockActive(e.target.checked)} />
                    <span className="font-medium text-slate-700">Active block</span>
                  </label>
                  <label className="sm:col-span-3">
                    <span className="nx-label">Notes</span>
                    <textarea className="nx-input w-full" rows={2} value={blockNotes} onChange={(e) => setBlockNotes(e.target.value)} />
                  </label>
                  <div className="flex flex-wrap gap-2 sm:col-span-3">
                    <button type="submit" className="nx-btn-primary" disabled={submitting}>
                      {editingBlockId ? "Update block" : "Create block"}
                    </button>
                    <button type="button" className="nx-btn-secondary" onClick={resetBlockForm}>
                      Cancel
                    </button>
                  </div>
                </form>
              </CmsSectionCard>
            ) : null}

            <CmsSectionCard className="overflow-hidden !p-0">
              <div className="border-b border-slate-100 px-5 py-3.5">
                <SectionTitle title="Hostel blocks" subtitle={`${blocks.length} block${blocks.length === 1 ? "" : "s"}`} />
              </div>
              {loading ? (
                <EmptyState icon={<HomeWorkOutlined />} title="Loading blocks…" />
              ) : !blocks.length ? (
                <EmptyState
                  icon={<HomeWorkOutlined />}
                  title="No hostel blocks yet"
                  hint={canManage ? "Create a block (Boys / Girls / Mixed), then add rooms." : undefined}
                />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="nx-table min-w-full text-left">
                      <thead>
                        <tr>
                          <th>Block</th>
                          <th>Gender</th>
                          <th>Rooms</th>
                          <th>Status</th>
                          {canManage ? <th>Actions</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {(pageRows as HostelBlock[]).map((block) => (
                          <tr key={block.id}>
                            <td className="font-semibold text-slate-900">{block.name}</td>
                            <td>
                              {block.gender ? (
                                <span className="nx-pill nx-pill-indigo">{block.gender}</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td>
                              <span className="inline-flex min-w-[2rem] items-center justify-center rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
                                {block._count.rooms}
                              </span>
                            </td>
                            <td>
                              <span className={block.isActive ? "nx-pill nx-pill-success" : "nx-pill nx-pill-neutral"}>
                                {block.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            {canManage ? (
                              <td>
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    className="nx-btn-secondary !px-2 !py-1 text-xs"
                                    onClick={() => startEditBlock(block)}
                                  >
                                    <EditOutlined sx={{ fontSize: 14 }} />
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-rose-600 hover:bg-rose-100"
                                    onClick={() => void removeBlock(block.id)}
                                  >
                                    <DeleteOutline sx={{ fontSize: 14 }} />
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
            {canManage && showRoomForm ? (
              <CmsSectionCard className="overflow-hidden !p-0">
                <div className="border-b border-sky-100 bg-gradient-to-r from-sky-50 via-white to-cyan-50/40 px-5 py-4">
                  <SectionTitle
                    title={editingRoomId ? "Edit room" : "New room"}
                    subtitle="Beds are created automatically up to the room capacity."
                  />
                </div>
                <form className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4" onSubmit={saveRoom}>
                  <label>
                    <span className="nx-label">Block *</span>
                    <select className="nx-input w-full" value={roomBlockId} onChange={(e) => setRoomBlockId(e.target.value)} required>
                      <option value="">Select block</option>
                      {blocks.map((block) => (
                        <option key={block.id} value={block.id}>{block.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="nx-label">Room name *</span>
                    <input className="nx-input w-full" value={roomName} onChange={(e) => setRoomName(e.target.value)} required />
                  </label>
                  <label>
                    <span className="nx-label">Capacity</span>
                    <input className="nx-input w-full" type="number" min="1" max="50" value={roomCapacity} onChange={(e) => setRoomCapacity(e.target.value)} />
                  </label>
                  <label className="flex items-center gap-2 pt-6 text-sm">
                    <input type="checkbox" checked={roomActive} onChange={(e) => setRoomActive(e.target.checked)} />
                    <span className="font-medium text-slate-700">Active room</span>
                  </label>
                  <div className="flex flex-wrap gap-2 sm:col-span-4">
                    <button type="submit" className="nx-btn-primary" disabled={submitting}>
                      {editingRoomId ? "Update room" : "Create room"}
                    </button>
                    <button type="button" className="nx-btn-secondary" onClick={resetRoomForm}>
                      Cancel
                    </button>
                  </div>
                </form>
              </CmsSectionCard>
            ) : null}

            <CmsSectionCard className="overflow-hidden !p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
                <SectionTitle title="Rooms" subtitle={`${filteredRooms.length} room${filteredRooms.length === 1 ? "" : "s"}`} />
                <select
                  className="nx-input w-full max-w-xs text-sm"
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
                <EmptyState icon={<HotelOutlined />} title="Loading rooms…" tone="sky" />
              ) : !filteredRooms.length ? (
                <EmptyState icon={<HotelOutlined />} title="No rooms yet" hint="Add a room under a block to start allocating beds." tone="sky" />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="nx-table min-w-full text-left">
                      <thead>
                        <tr>
                          <th>Block</th>
                          <th>Room</th>
                          <th>Occupancy</th>
                          <th>Beds</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(pageRows as HostelRoom[]).map((room) => {
                          const tone = occupancyTone(room._count.students, room.capacity);
                          const pct = room.capacity
                            ? Math.min(100, Math.round((room._count.students / room.capacity) * 100))
                            : 0;
                          return (
                            <tr key={room.id} className={detailRoomId === room.id ? "bg-sky-50/50" : undefined}>
                              <td className="text-slate-700">{room.block.name}</td>
                              <td className="font-semibold text-slate-900">{room.name}</td>
                              <td>
                                <div className="min-w-[120px]">
                                  <div className="mb-1 flex items-center justify-between text-xs">
                                    <span className={`font-bold ${tone.text}`}>
                                      {room._count.students}/{room.capacity}
                                    </span>
                                    <span className="text-slate-400">{pct}%</span>
                                  </div>
                                  <div className={`h-1.5 overflow-hidden rounded-full ${tone.bg}`}>
                                    <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">
                                  <BedOutlined sx={{ fontSize: 12 }} />
                                  {room._count.beds ?? room.beds?.length ?? "—"}
                                </span>
                              </td>
                              <td>
                                <span className={room.isActive ? "nx-pill nx-pill-success" : "nx-pill nx-pill-neutral"}>
                                  {room.isActive ? "Active" : "Inactive"}
                                </span>
                              </td>
                              <td>
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    className="nx-btn-secondary !px-2 !py-1 text-xs"
                                    onClick={() => setDetailRoomId(room.id)}
                                  >
                                    Beds
                                  </button>
                                  {canManage ? (
                                    <>
                                      <button
                                        type="button"
                                        className="nx-btn-secondary !px-2 !py-1 text-xs"
                                        onClick={() => startEditRoom(room)}
                                      >
                                        <EditOutlined sx={{ fontSize: 14 }} />
                                      </button>
                                      <button
                                        type="button"
                                        className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-rose-600 hover:bg-rose-100"
                                        onClick={() => void removeRoom(room.id)}
                                      >
                                        <DeleteOutline sx={{ fontSize: 14 }} />
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <ListPagination page={page} pageSize={PAGE_SIZE} total={filteredRooms.length} onPageChange={setPage} />
                </>
              )}
            </CmsSectionCard>

            {detailRoom ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <CmsSectionCard className="overflow-hidden !p-0">
                  <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 via-white to-white px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <SectionTitle
                        title={`${detailRoom.block.name} · ${detailRoom.name}`}
                        subtitle="Bed map"
                      />
                      <select
                        className="nx-input w-full max-w-[200px] text-sm"
                        value={detailRoomId}
                        onChange={(e) => setDetailRoomId(e.target.value)}
                      >
                        {rooms.map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.block.name} · {room.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {detailTone ? (
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-xs">
                          <span className={`font-bold ${detailTone.text}`}>
                            {detailRoom._count.students}/{detailRoom.capacity} occupied
                          </span>
                        </div>
                        <div className={`h-2 overflow-hidden rounded-full ${detailTone.bg}`}>
                          <div
                            className={`h-full rounded-full ${detailTone.bar}`}
                            style={{
                              width: `${detailRoom.capacity ? Math.min(100, (detailRoom._count.students / detailRoom.capacity) * 100) : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {canManage ? (
                    <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 px-5 py-3">
                      <label className="min-w-[160px] flex-1">
                        <span className="nx-label">Add bed</span>
                        <input
                          className="nx-input w-full"
                          value={newBedLabel}
                          onChange={(e) => setNewBedLabel(e.target.value)}
                          placeholder="e.g. Bed A"
                        />
                      </label>
                      <button
                        type="button"
                        className="nx-btn-primary"
                        disabled={submitting || !newBedLabel.trim()}
                        onClick={() => void addBed()}
                      >
                        <BedOutlined sx={{ fontSize: 16 }} /> Add
                      </button>
                    </div>
                  ) : null}

                  {detailLoading ? (
                    <EmptyState icon={<BedOutlined />} title="Loading beds…" tone="indigo" />
                  ) : (
                    <div className="grid gap-2 p-4 sm:grid-cols-2">
                      {(detailRoom.beds ?? []).map((bed) => (
                        <div
                          key={bed.id}
                          className={`rounded-xl border p-3 ${
                            bed.student
                              ? "border-indigo-200 bg-indigo-50/50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{bed.label}</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {bed.student ? studentLabel(bed.student) : "Vacant"}
                              </p>
                              {bed.student ? (
                                <p className="font-mono text-[11px] text-slate-500">{bed.student.admissionNumber}</p>
                              ) : (
                                <span className="mt-1 inline-flex nx-pill nx-pill-success">Available</span>
                              )}
                            </div>
                            {canManage ? (
                              <button
                                type="button"
                                className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                                onClick={() => void removeBed(bed.id)}
                              >
                                <DeleteOutline sx={{ fontSize: 14 }} />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                      {!detailRoom.beds?.length ? (
                        <p className="col-span-full py-6 text-center text-sm text-slate-500">
                          No beds yet — raise capacity or add a bed.
                        </p>
                      ) : null}
                    </div>
                  )}
                </CmsSectionCard>

                <CmsSectionCard className="overflow-hidden !p-0">
                  <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-white px-5 py-4">
                    <SectionTitle title="Students in room" subtitle={`${roomStudents.length} allocated`} />
                  </div>
                  {detailLoading ? (
                    <EmptyState icon={<PersonOutlined />} title="Loading…" tone="emerald" />
                  ) : !roomStudents.length ? (
                    <EmptyState icon={<PersonOutlined />} title="No students in this room" tone="emerald" />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="nx-table min-w-full text-left">
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Bed</th>
                            <th>Gender</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roomStudents.map((student) => (
                            <tr key={student.id}>
                              <td>
                                <p className="font-semibold text-slate-900">{studentLabel(student)}</p>
                                <p className="font-mono text-[11px] text-slate-500">{student.admissionNumber}</p>
                              </td>
                              <td>
                                {student.hostelBedRef?.label ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
                                    <BedOutlined sx={{ fontSize: 12 }} />
                                    {student.hostelBedRef.label}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="text-slate-600">{student.gender ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CmsSectionCard>
              </div>
            ) : null}
          </>
        ) : null}

        {tab === "assign" ? (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <CmsSectionCard className="p-5">
              <SectionTitle
                title="Assign student"
                subtitle="Room capacity and block gender rules are enforced."
              />
              {canManage ? (
                <form className="mt-3 grid gap-3" onSubmit={assignStudent}>
                  <label>
                    <span className="nx-label">Student *</span>
                    <select
                      className="nx-input w-full"
                      value={assignStudentId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setAssignStudentId(id);
                        const student = students.find((s) => s.id === id);
                        if (student?.hostelRoomId) {
                          setAssignRoomId(student.hostelRoomId);
                          setAssignBedId(student.hostelBedId ?? "");
                        }
                      }}
                      required
                    >
                      <option value="">Select student</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.admissionNumber} · {studentLabel(student)}
                          {student.hostelRoom ? ` · ${student.hostelRoom}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="nx-label">Room</span>
                    <select
                      className="nx-input w-full"
                      value={assignRoomId}
                      onChange={(e) => {
                        setAssignRoomId(e.target.value);
                        setAssignBedId("");
                      }}
                    >
                      <option value="">No hostel / clear assignment</option>
                      {activeRooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.block.name} · {room.name} ({room._count.students}/{room.capacity})
                          {room.block.gender ? ` · ${room.block.gender}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  {assignRoomId ? (
                    <label>
                      <span className="nx-label">Bed</span>
                      <select
                        className="nx-input w-full"
                        value={assignBedId}
                        onChange={(e) => setAssignBedId(e.target.value)}
                      >
                        <option value="">Auto-assign free bed</option>
                        {freeBeds.map((bed) => (
                          <option key={bed.id} value={bed.id}>
                            {bed.label}
                            {bed.student ? " (current)" : " (vacant)"}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label>
                    <span className="nx-label">Note</span>
                    <input className="nx-input w-full" value={assignNote} onChange={(e) => setAssignNote(e.target.value)} placeholder="Optional" />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={enforceGender}
                      onChange={(e) => setEnforceGender(e.target.checked)}
                    />
                    <span className="font-medium text-slate-700">Enforce block gender match</span>
                  </label>
                  <button type="submit" className="nx-btn-primary w-fit" disabled={submitting}>
                    Save assignment
                  </button>
                </form>
              ) : (
                <p className="mt-4 text-sm text-slate-500">You need hostel.manage permission to assign students.</p>
              )}
            </CmsSectionCard>

            <CmsSectionCard className="overflow-hidden !p-0">
              <div className="border-b border-slate-100 bg-gradient-to-br from-amber-50 to-white px-5 py-4">
                <SectionTitle title="Allocation guide" subtitle="How hostel assignment works" />
              </div>
              <div className="space-y-3 p-5 text-sm text-slate-600">
                <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <MeetingRoomOutlined className="shrink-0 text-sky-500" sx={{ fontSize: 22 }} />
                  <p>Capacity is checked per room. Full rooms cannot accept new students.</p>
                </div>
                <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                  <BedOutlined className="shrink-0 text-indigo-500" sx={{ fontSize: 22 }} />
                  <p>Leave bed blank to auto-pick the next vacant bed in that room.</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs font-semibold text-emerald-800">
                  {students.filter((s) => s.hostelOptIn || s.hostelRoomId).length} students currently in hostel
                </div>
              </div>
            </CmsSectionCard>
          </div>
        ) : null}

        {tab === "history" ? (
          <CmsSectionCard className="overflow-hidden !p-0">
            <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-white px-5 py-3.5">
              <SectionTitle title="Allocation history" subtitle="Latest hostel room and bed changes" />
            </div>
            {!logs.length ? (
              <EmptyState icon={<HistoryOutlined />} title="No allocation history yet" tone="emerald" />
            ) : (
              <div className="overflow-x-auto">
                <table className="nx-table min-w-full text-left">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Student</th>
                      <th>Action</th>
                      <th>Room / bed</th>
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
                          <p className="text-slate-800">
                            {log.roomLabel
                              ?? (log.hostelRoom
                                ? `${log.hostelRoom.block.name} · ${log.hostelRoom.name}`
                                : "—")}
                          </p>
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
