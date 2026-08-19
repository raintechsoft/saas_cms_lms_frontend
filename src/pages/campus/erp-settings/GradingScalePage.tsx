import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  DeleteOutline,
  EditOutlined,
  InfoOutlined,
  SaveOutlined,
  Star,
  StarBorder,
  WarningAmberOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

interface NamedClass {
  id: string;
  name: string;
  sortOrder?: number;
}

interface GradeBand {
  id: string;
  grade: string;
  gradePoint: number;
  fromPercent: number;
  toPercent: number;
  gradeName: string | null;
  remarks: string | null;
  sortOrder: number;
}

interface ScaleItem {
  id: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  applicableClassesLabel: string;
  classes: NamedClass[];
  grades: GradeBand[];
}

interface ClassGroup {
  key: string;
  label: string;
  classIds: string[];
  scaleId: string | null;
  scaleName: string | null;
}

interface SetupPayload {
  scales: ScaleItem[];
  classes: NamedClass[];
  classGroups: ClassGroup[];
}

function Card({
  title,
  children,
  actions,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-[#1A1A1A]">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="mb-1 block text-[12px] font-semibold text-[#6B7280]">
      {children}
      {required ? <span className="text-rose-500"> *</span> : null}
    </span>
  );
}

function InfoBox({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2.5 text-xs leading-relaxed text-[#1E40AF]">
      {children}
    </div>
  );
}

export function GradingScalePage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Grading Scale";
  const canManage = Boolean(
    user?.permissions.some((p) =>
      ["erp.manage", "settings.manage", "exams.manage", "academics.manage"].includes(p),
    ),
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState<SetupPayload | null>(null);
  const [selectedScaleId, setSelectedScaleId] = useState("");

  const [scaleFormOpen, setScaleFormOpen] = useState(false);
  const [editingScaleId, setEditingScaleId] = useState<string | null>(null);
  const [scaleName, setScaleName] = useState("");
  const [scaleClassIds, setScaleClassIds] = useState<string[]>([]);
  const [scaleIsDefault, setScaleIsDefault] = useState(false);
  const [scaleIsActive, setScaleIsActive] = useState(true);

  const [gradeFormOpen, setGradeFormOpen] = useState(false);
  const [editingGradeId, setEditingGradeId] = useState<string | null>(null);
  const [gradeCode, setGradeCode] = useState("");
  const [gradePoint, setGradePoint] = useState("10");
  const [fromPercent, setFromPercent] = useState("91");
  const [toPercent, setToPercent] = useState("100");
  const [gradeName, setGradeName] = useState("");
  const [remarks, setRemarks] = useState("");

  const [changingGroupKey, setChangingGroupKey] = useState<string | null>(null);
  const [changeScaleId, setChangeScaleId] = useState("");

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<SetupPayload>("/erp/grading-scale-setup", accessToken);
      setPayload(data);
      setSelectedScaleId((prev) => {
        if (prev && data.scales.some((s) => s.id === prev)) return prev;
        return data.scales.find((s) => s.isDefault)?.id || data.scales[0]?.id || "";
      });
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load grading scales");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const scales = payload?.scales ?? [];
  const classes = payload?.classes ?? [];
  const classGroups = payload?.classGroups ?? [];
  const selectedScale = useMemo(
    () => scales.find((item) => item.id === selectedScaleId) ?? null,
    [scales, selectedScaleId],
  );

  function resetScaleForm() {
    setScaleFormOpen(false);
    setEditingScaleId(null);
    setScaleName("");
    setScaleClassIds([]);
    setScaleIsDefault(false);
    setScaleIsActive(true);
  }

  function startAddScale() {
    setScaleFormOpen(true);
    setEditingScaleId(null);
    setScaleName("");
    setScaleClassIds([]);
    setScaleIsDefault(scales.length === 0);
    setScaleIsActive(true);
  }

  function startEditScale(item: ScaleItem) {
    setScaleFormOpen(true);
    setEditingScaleId(item.id);
    setScaleName(item.name);
    setScaleClassIds(item.classes.map((c) => c.id));
    setScaleIsDefault(item.isDefault);
    setScaleIsActive(item.isActive);
    setSelectedScaleId(item.id);
  }

  function resetGradeForm() {
    setGradeFormOpen(false);
    setEditingGradeId(null);
    setGradeCode("");
    setGradePoint("10");
    setFromPercent("91");
    setToPercent("100");
    setGradeName("");
    setRemarks("");
  }

  function startAddGrade() {
    if (!selectedScaleId) {
      notifyError("Select a grading scale first.");
      return;
    }
    setGradeFormOpen(true);
    setEditingGradeId(null);
    setGradeCode("");
    setGradePoint("10");
    setFromPercent("91");
    setToPercent("100");
    setGradeName("");
    setRemarks("");
  }

  function startEditGrade(item: GradeBand) {
    setGradeFormOpen(true);
    setEditingGradeId(item.id);
    setGradeCode(item.grade);
    setGradePoint(String(item.gradePoint));
    setFromPercent(String(item.fromPercent));
    setToPercent(String(item.toPercent));
    setGradeName(item.gradeName ?? "");
    setRemarks(item.remarks ?? "");
  }

  function toggleScaleClass(id: string) {
    setScaleClassIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  async function saveScale(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage) return;
    const name = scaleName.trim();
    if (!name) {
      notifyError("Scale name is required.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name,
        isDefault: scaleIsDefault,
        isActive: scaleIsActive,
        classIds: scaleClassIds,
      };
      if (editingScaleId) {
        await apiRequest(`/erp/grading-scales/${editingScaleId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        notifySuccess("Grading scale updated");
      } else {
        const created = await apiRequest<ScaleItem>("/erp/grading-scales", accessToken, {
          method: "POST",
          body: JSON.stringify(body),
        });
        setSelectedScaleId(created.id);
        notifySuccess("Grading scale added");
      }
      resetScaleForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save scale");
    } finally {
      setSaving(false);
    }
  }

  async function deleteScale(item: ScaleItem) {
    if (!accessToken || !canManage) return;
    if (item.isDefault) {
      notifyError("Cannot delete the default grading scale.");
      return;
    }
    const ok = await confirmDelete({ text: `Delete scale "${item.name}"?` });
    if (!ok) return;
    setSaving(true);
    try {
      await apiRequest(`/erp/grading-scales/${item.id}`, accessToken, { method: "DELETE" });
      notifySuccess("Grading scale deleted");
      if (editingScaleId === item.id) resetScaleForm();
      if (selectedScaleId === item.id) setSelectedScaleId("");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete scale");
    } finally {
      setSaving(false);
    }
  }

  async function setDefaultScale(item: ScaleItem) {
    if (!accessToken || !canManage || item.isDefault) return;
    setSaving(true);
    try {
      await apiRequest(`/erp/grading-scales/${item.id}`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ isDefault: true }),
      });
      notifySuccess("Default grading scale updated");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to set default");
    } finally {
      setSaving(false);
    }
  }

  async function saveGrade(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || !canManage || !selectedScaleId) return;
    const grade = gradeCode.trim();
    if (!grade) {
      notifyError("Grade is required.");
      return;
    }
    const point = Number(gradePoint);
    const from = Number(fromPercent);
    const to = Number(toPercent);
    if (!Number.isFinite(point) || point < 0) {
      notifyError("Grade point must be a valid number.");
      return;
    }
    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
      notifyError("Percent range is invalid.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        grade,
        gradePoint: point,
        fromPercent: from,
        toPercent: to,
        gradeName: gradeName.trim() || null,
        remarks: remarks.trim() || null,
      };
      if (editingGradeId) {
        await apiRequest(`/erp/grading-scale-grades/${editingGradeId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        notifySuccess("Grade updated");
      } else {
        await apiRequest(`/erp/grading-scales/${selectedScaleId}/grades`, accessToken, {
          method: "POST",
          body: JSON.stringify(body),
        });
        notifySuccess("Grade added");
      }
      resetGradeForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save grade");
    } finally {
      setSaving(false);
    }
  }

  async function deleteGrade(item: GradeBand) {
    if (!accessToken || !canManage) return;
    const ok = await confirmDelete({ text: `Delete grade "${item.grade}"?` });
    if (!ok) return;
    setSaving(true);
    try {
      await apiRequest(`/erp/grading-scale-grades/${item.id}`, accessToken, { method: "DELETE" });
      notifySuccess("Grade deleted");
      if (editingGradeId === item.id) resetGradeForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete grade");
    } finally {
      setSaving(false);
    }
  }

  async function applyGroupScale(group: ClassGroup) {
    if (!accessToken || !canManage || !changeScaleId) return;
    setSaving(true);
    try {
      await apiRequest("/erp/grading-scale-assignments", accessToken, {
        method: "PUT",
        body: JSON.stringify({ scaleId: changeScaleId, classIds: group.classIds }),
      });
      notifySuccess("Class assignment updated");
      setChangingGroupKey(null);
      setChangeScaleId("");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to assign scale");
    } finally {
      setSaving(false);
    }
  }

  async function saveConfiguration() {
    if (scaleFormOpen && (editingScaleId || scaleName.trim())) {
      await saveScale();
      return;
    }
    if (gradeFormOpen && (editingGradeId || gradeCode.trim())) {
      await saveGrade();
      return;
    }
    notifySuccess("Configuration is up to date");
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-6">
        <p className="text-xs text-[#6B7280]">
          Dashboard <span className="mx-1 text-[#9CA3AF]">/</span> ERP Settings{" "}
          <span className="mx-1 text-[#9CA3AF]">/</span>{" "}
          <span className="font-semibold text-[#1A1A1A]">{activeLabel}</span>
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving || loading || !canManage}
          onClick={() => void saveConfiguration()}
        >
          <SaveOutlined sx={{ fontSize: 16 }} />
          {saving ? "Saving…" : "Save configuration"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">Grading Scale</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Define grading scales, grade bands, and assign them to classes.
            {loading ? " Loading…" : null}
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            <Card
              title="1. Grading Scales"
              actions={
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-primary px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
                  disabled={!canManage || saving}
                  onClick={startAddScale}
                >
                  <AddOutlined sx={{ fontSize: 16 }} />
                  Add Grading Scale
                </button>
              }
            >
              {scaleFormOpen ? (
                <form
                  className="mb-4 grid gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 sm:grid-cols-2"
                  onSubmit={(e) => void saveScale(e)}
                >
                  <label className="block sm:col-span-2">
                    <FieldLabel required>Scale Name</FieldLabel>
                    <input
                      className="nx-input w-full"
                      value={scaleName}
                      disabled={saving}
                      onChange={(e) => setScaleName(e.target.value)}
                      placeholder="e.g. CBSE Grading Scale (1-10)"
                    />
                  </label>
                  <div className="sm:col-span-2">
                    <FieldLabel>Applicable Classes</FieldLabel>
                    <div className="mt-1 flex max-h-32 flex-wrap gap-2 overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white p-2">
                      {classes.map((item) => (
                        <label
                          key={item.id}
                          className="inline-flex items-center gap-1.5 rounded-md bg-[#F3F4F6] px-2 py-1 text-xs text-[#374151]"
                        >
                          <input
                            type="checkbox"
                            className="size-3.5 accent-primary"
                            checked={scaleClassIds.includes(item.id)}
                            onChange={() => toggleScaleClass(item.id)}
                          />
                          {item.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-[#374151]">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={scaleIsDefault}
                      disabled={saving}
                      onChange={(e) => setScaleIsDefault(e.target.checked)}
                    />
                    Set as default
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-[#374151]">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={scaleIsActive}
                      disabled={saving}
                      onChange={(e) => setScaleIsActive(e.target.checked)}
                    />
                    Active
                  </label>
                  <div className="flex gap-2 sm:col-span-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      disabled={saving}
                    >
                      {editingScaleId ? "Update Scale" : "Save Scale"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#6B7280]"
                      onClick={resetScaleForm}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                      <th className="px-2 py-2.5">#</th>
                      <th className="px-2 py-2.5">Scale Name</th>
                      <th className="px-2 py-2.5">Applicable Classes</th>
                      <th className="px-2 py-2.5">Default</th>
                      <th className="px-2 py-2.5">Status</th>
                      <th className="px-2 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scales.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-2 py-8 text-center text-[#6B7280]">
                          {loading ? "Loading…" : "No grading scales yet."}
                        </td>
                      </tr>
                    ) : (
                      scales.map((item, index) => {
                        const selected = item.id === selectedScaleId;
                        return (
                          <tr
                            key={item.id}
                            onClick={() => setSelectedScaleId(item.id)}
                            className={[
                              "cursor-pointer border-b border-[#F3F4F6] last:border-b-0",
                              selected ? "bg-primary/[0.06]" : "hover:bg-[#F9FAFB]",
                            ].join(" ")}
                          >
                            <td className="px-2 py-3 text-[#6B7280]">{index + 1}</td>
                            <td className="px-2 py-3 font-semibold text-[#1A1A1A]">{item.name}</td>
                            <td className="px-2 py-3 text-[#6B7280]">
                              {item.applicableClassesLabel}
                            </td>
                            <td className="px-2 py-3">
                              <button
                                type="button"
                                className="inline-flex text-amber-500 disabled:opacity-40"
                                disabled={!canManage || saving}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void setDefaultScale(item);
                                }}
                                title={item.isDefault ? "Default scale" : "Set as default"}
                              >
                                {item.isDefault ? (
                                  <Star sx={{ fontSize: 20 }} />
                                ) : (
                                  <StarBorder sx={{ fontSize: 20 }} />
                                )}
                              </button>
                            </td>
                            <td className="px-2 py-3">
                              <span
                                className={[
                                  "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                                  item.isActive
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-600",
                                ].join(" ")}
                              >
                                {item.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  className="inline-flex size-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10 disabled:opacity-40"
                                  disabled={!canManage || saving}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditScale(item);
                                  }}
                                >
                                  <EditOutlined sx={{ fontSize: 18 }} />
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex size-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                                  disabled={!canManage || saving || item.isDefault}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void deleteScale(item);
                                  }}
                                >
                                  <DeleteOutline sx={{ fontSize: 18 }} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <InfoBox>Default grading scale will be used for new classes and evaluations.</InfoBox>
            </Card>

            <Card
              title="2. Scale Details"
              actions={
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-primary px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
                  disabled={!canManage || saving || !selectedScaleId}
                  onClick={startAddGrade}
                >
                  <AddOutlined sx={{ fontSize: 16 }} />
                  Add Grade
                </button>
              }
            >
              <label className="mb-4 block max-w-md">
                <FieldLabel required>Select Scale</FieldLabel>
                <select
                  className="nx-input w-full"
                  value={selectedScaleId}
                  onChange={(e) => {
                    setSelectedScaleId(e.target.value);
                    resetGradeForm();
                  }}
                >
                  {scales.length === 0 ? <option value="">No scales</option> : null}
                  {scales.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.isDefault ? " (Default)" : ""}
                    </option>
                  ))}
                </select>
              </label>

              {gradeFormOpen ? (
                <form
                  className="mb-4 grid gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-3 sm:grid-cols-3"
                  onSubmit={(e) => void saveGrade(e)}
                >
                  <label className="block">
                    <FieldLabel required>Grade</FieldLabel>
                    <input
                      className="nx-input w-full"
                      value={gradeCode}
                      disabled={saving}
                      onChange={(e) => setGradeCode(e.target.value)}
                      placeholder="A1"
                    />
                  </label>
                  <label className="block">
                    <FieldLabel required>Grade Point</FieldLabel>
                    <input
                      type="number"
                      step="0.1"
                      className="nx-input w-full"
                      value={gradePoint}
                      disabled={saving}
                      onChange={(e) => setGradePoint(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Grade Name</FieldLabel>
                    <input
                      className="nx-input w-full"
                      value={gradeName}
                      disabled={saving}
                      onChange={(e) => setGradeName(e.target.value)}
                      placeholder="Outstanding"
                    />
                  </label>
                  <label className="block">
                    <FieldLabel required>From (%)</FieldLabel>
                    <input
                      type="number"
                      className="nx-input w-full"
                      value={fromPercent}
                      disabled={saving}
                      onChange={(e) => setFromPercent(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel required>To (%)</FieldLabel>
                    <input
                      type="number"
                      className="nx-input w-full"
                      value={toPercent}
                      disabled={saving}
                      onChange={(e) => setToPercent(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <FieldLabel>Remarks</FieldLabel>
                    <input
                      className="nx-input w-full"
                      value={remarks}
                      disabled={saving}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Excellent"
                    />
                  </label>
                  <div className="flex gap-2 sm:col-span-3">
                    <button
                      type="submit"
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      disabled={saving}
                    >
                      {editingGradeId ? "Update Grade" : "Save Grade"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-semibold text-[#6B7280]"
                      onClick={resetGradeForm}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                      <th className="px-2 py-2.5">Grade</th>
                      <th className="px-2 py-2.5">Grade Point</th>
                      <th className="px-2 py-2.5">From (%)</th>
                      <th className="px-2 py-2.5">To (%)</th>
                      <th className="px-2 py-2.5">Grade Name</th>
                      <th className="px-2 py-2.5">Remarks</th>
                      <th className="px-2 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedScale || selectedScale.grades.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-2 py-8 text-center text-[#6B7280]">
                          {loading
                            ? "Loading…"
                            : selectedScale
                              ? "No grades in this scale yet."
                              : "Select a scale to view details."}
                        </td>
                      </tr>
                    ) : (
                      selectedScale.grades.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-[#F3F4F6] last:border-b-0 hover:bg-[#F9FAFB]"
                        >
                          <td className="px-2 py-3 font-semibold text-[#1A1A1A]">{item.grade}</td>
                          <td className="px-2 py-3 text-[#6B7280]">
                            {item.gradePoint.toFixed(1)}
                          </td>
                          <td className="px-2 py-3 text-[#6B7280]">{item.fromPercent}</td>
                          <td className="px-2 py-3 text-[#6B7280]">{item.toPercent}</td>
                          <td className="px-2 py-3 text-[#6B7280]">{item.gradeName || "—"}</td>
                          <td className="px-2 py-3 text-[#6B7280]">{item.remarks || "—"}</td>
                          <td className="px-2 py-3">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10 disabled:opacity-40"
                                disabled={!canManage || saving}
                                onClick={() => startEditGrade(item)}
                              >
                                <EditOutlined sx={{ fontSize: 18 }} />
                              </button>
                              <button
                                type="button"
                                className="inline-flex size-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-40"
                                disabled={!canManage || saving}
                                onClick={() => void deleteGrade(item)}
                              >
                                <DeleteOutline sx={{ fontSize: 18 }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <InfoBox>Percent ranges must not overlap and should cover 0 to 100.</InfoBox>
            </Card>

            <Card title="3. Assign Grading Scale to Classes">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                      <th className="px-2 py-2.5">Class / Group</th>
                      <th className="px-2 py-2.5">Assigned Grading Scale</th>
                      <th className="px-2 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classGroups.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-2 py-8 text-center text-[#6B7280]">
                          {loading ? "Loading…" : "No classes available."}
                        </td>
                      </tr>
                    ) : (
                      classGroups.map((group) => (
                        <tr
                          key={group.key}
                          className="border-b border-[#F3F4F6] last:border-b-0 hover:bg-[#F9FAFB]"
                        >
                          <td className="px-2 py-3 font-semibold text-[#1A1A1A]">{group.label}</td>
                          <td className="px-2 py-3 text-[#6B7280]">
                            {changingGroupKey === group.key ? (
                              <select
                                className="nx-input max-w-xs"
                                value={changeScaleId}
                                onChange={(e) => setChangeScaleId(e.target.value)}
                              >
                                <option value="">Select scale</option>
                                {scales
                                  .filter((s) => s.isActive)
                                  .map((scale) => (
                                    <option key={scale.id} value={scale.id}>
                                      {scale.name}
                                    </option>
                                  ))}
                              </select>
                            ) : (
                              group.scaleName || "Unassigned"
                            )}
                          </td>
                          <td className="px-2 py-3">
                            <div className="flex justify-end gap-2">
                              {changingGroupKey === group.key ? (
                                <>
                                  <button
                                    type="button"
                                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                                    disabled={!canManage || saving || !changeScaleId}
                                    onClick={() => void applyGroupScale(group)}
                                  >
                                    Apply
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs font-semibold text-[#6B7280]"
                                    onClick={() => {
                                      setChangingGroupKey(null);
                                      setChangeScaleId("");
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
                                  disabled={!canManage || saving}
                                  onClick={() => {
                                    setChangingGroupKey(group.key);
                                    setChangeScaleId(group.scaleId ?? "");
                                  }}
                                >
                                  Change
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <InfoOutlined sx={{ fontSize: 18 }} className="text-primary" />
                <h2 className="text-sm font-bold text-[#1A1A1A]">Quick Guide</h2>
              </div>
              <ul className="space-y-2.5 text-xs leading-relaxed text-[#6B7280]">
                <li>• Grades evaluate student performance in exams.</li>
                <li>• Grade Point is used for GPA / CGPA calculations.</li>
                <li>• Set a scale as Default for auto-assignment to new classes.</li>
                <li>• Multiple scales can be created for different boards or levels.</li>
              </ul>
            </section>

            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-5">
              <div className="mb-2 flex items-center gap-2 text-amber-800">
                <WarningAmberOutlined sx={{ fontSize: 18 }} />
                <h3 className="text-sm font-bold">Note</h3>
              </div>
              <p className="text-xs leading-relaxed text-amber-900/80">
                Changes in grading scale will not affect existing student results.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
