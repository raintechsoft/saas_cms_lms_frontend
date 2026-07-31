import { useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  ApartmentOutlined,
  BadgeOutlined,
  CurrencyRupeeOutlined,
  DeleteOutline,
  EditOutlined,
  EventNoteOutlined,
} from "@mui/icons-material";
import { apiRequest } from "../../../lib/api";
import { confirmDelete } from "../../../lib/confirm";
import { notifySuccess } from "../../../lib/notify";
import type { HrSetup } from "./types";

const PREVIEW_ROWS = 5;

export function HrSetupPanel({
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
  async function request(path: string, method: string, body?: unknown) {
    try {
      await apiRequest(path, token, {
        method,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      await onSaved();
      return true;
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to save HR setup");
      return false;
    }
  }

  return (
    <section className="mt-4 grid gap-4 xl:grid-cols-2">
      <MasterCard
        icon={<ApartmentOutlined sx={{ fontSize: 20 }} />}
        tint="#6366f1"
        title="Departments"
        inputLabel="Department Name"
        placeholder="Enter department name"
        columnLabel="Department Name"
        viewAllLabel="departments"
        rows={setup.departments.map((item) => ({ id: item.id, name: item.name }))}
        onAdd={async (name) =>
          (await request("/hr/departments", "POST", { name })) &&
          void notifySuccess("Department added")
        }
        onUpdate={async (id, name) =>
          (await request(`/hr/departments/${id}`, "PUT", { name })) &&
          void notifySuccess("Department updated")
        }
        onDelete={async (id) =>
          (await request(`/hr/departments/${id}`, "DELETE")) &&
          void notifySuccess("Department deleted")
        }
      />

      <MasterCard
        icon={<BadgeOutlined sx={{ fontSize: 20 }} />}
        tint="#8b5cf6"
        title="Designations"
        inputLabel="Designation Name"
        placeholder="Enter designation name"
        columnLabel="Designation Name"
        viewAllLabel="designations"
        rows={setup.designations.map((item) => ({ id: item.id, name: item.name }))}
        onAdd={async (name) =>
          (await request("/hr/designations", "POST", { name })) &&
          void notifySuccess("Designation added")
        }
        onUpdate={async (id, name) =>
          (await request(`/hr/designations/${id}`, "PUT", { name })) &&
          void notifySuccess("Designation updated")
        }
        onDelete={async (id) =>
          (await request(`/hr/designations/${id}`, "DELETE")) &&
          void notifySuccess("Designation deleted")
        }
      />

      <MasterCard
        icon={<EventNoteOutlined sx={{ fontSize: 20 }} />}
        tint="#0ea5e9"
        title="Leave Types"
        inputLabel="Leave Type Name"
        placeholder="Enter leave type name"
        columnLabel="Leave Type Name"
        viewAllLabel="leave types"
        rows={setup.leaveTypes.map((item) => ({
          id: item.id,
          name: item.name,
          meta: item.annualLimit ? `${item.annualLimit} days/yr` : undefined,
          extraValue: item.annualLimit != null ? String(item.annualLimit) : "",
        }))}
        extraField={{ label: "Days / Year", placeholder: "e.g. 12" }}
        onAdd={async (name, extra) =>
          (await request("/hr/leave-types", "POST", {
            name,
            annualLimit: extra ? Number(extra) : null,
          })) && void notifySuccess("Leave type added")
        }
        onUpdate={async (id, name, extra) =>
          (await request(`/hr/leave-types/${id}`, "PUT", {
            name,
            annualLimit: extra ? Number(extra) : null,
          })) && void notifySuccess("Leave type updated")
        }
        onDelete={async (id) =>
          (await request(`/hr/leave-types/${id}`, "DELETE")) &&
          void notifySuccess("Leave type deleted")
        }
      />

      <PayParametersCard setup={setup} request={request} />
    </section>
  );
}

interface MasterRow {
  id: string;
  name: string;
  meta?: string;
  extraValue?: string;
}

function MasterCard({
  icon,
  tint,
  title,
  inputLabel,
  placeholder,
  columnLabel,
  viewAllLabel,
  rows,
  extraField,
  onAdd,
  onUpdate,
  onDelete,
}: {
  icon: ReactNode;
  tint: string;
  title: string;
  inputLabel: string;
  placeholder: string;
  columnLabel: string;
  viewAllLabel: string;
  rows: MasterRow[];
  extraField?: { label: string; placeholder: string };
  onAdd: (name: string, extra: string) => Promise<unknown>;
  onUpdate: (id: string, name: string, extra: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}) {
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const [editingId, setEditingId] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const visible = showAll ? rows : rows.slice(0, PREVIEW_ROWS);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    if (editingId) await onUpdate(editingId, name.trim(), extra.trim());
    else await onAdd(name.trim(), extra.trim());
    setBusy(false);
    setName("");
    setExtra("");
    setEditingId("");
  }

  async function remove(row: MasterRow) {
    const ok = await confirmDelete({
      text: `Delete "${row.name}"? Staff referencing it will be unlinked.`,
    });
    if (!ok) return;
    await onDelete(row.id);
    if (editingId === row.id) {
      setEditingId("");
      setName("");
      setExtra("");
    }
  }

  return (
    <div className="nx-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-4">
        <div
          className="grid size-10 shrink-0 place-items-center rounded-xl"
          style={{ background: `${tint}1a`, color: tint }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-slate-900">{title}</h3>
        </div>
        <form className="flex min-w-0 flex-1 items-end justify-end gap-2" onSubmit={submit}>
          <label className="block min-w-0 max-w-72 flex-1">
            <span className="nx-label">{inputLabel}</span>
            <input
              className="nx-input mt-1 w-full"
              placeholder={placeholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {extraField ? (
            <label className="block w-28 shrink-0">
              <span className="nx-label">{extraField.label}</span>
              <input
                className="nx-input mt-1 w-full"
                type="number"
                min="0"
                placeholder={extraField.placeholder}
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
              />
            </label>
          ) : null}
          <button type="submit" className="nx-btn-primary shrink-0" disabled={busy}>
            <AddOutlined sx={{ fontSize: 15 }} /> {editingId ? "Save" : "Add"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="nx-btn-secondary shrink-0"
              onClick={() => {
                setEditingId("");
                setName("");
                setExtra("");
              }}
            >
              Cancel
            </button>
          ) : null}
        </form>
      </div>

      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-y border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            <th className="w-12 px-4 py-2.5 text-left">#</th>
            <th className="px-3 py-2.5 text-left">{columnLabel}</th>
            <th className="w-24 px-4 py-2.5 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {visible.map((row, index) => (
            <tr key={row.id} className="transition hover:bg-indigo-50/30">
              <td className="px-4 py-2.5 text-slate-400">{index + 1}</td>
              <td className="px-3 py-2.5 font-medium text-slate-700">
                {row.name}
                {row.meta ? (
                  <span className="ml-2 text-[11.5px] text-slate-400">{row.meta}</span>
                ) : null}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    title="Edit"
                    className="grid size-7 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                    onClick={() => {
                      setEditingId(row.id);
                      setName(row.name);
                      setExtra(row.extraValue ?? "");
                    }}
                  >
                    <EditOutlined sx={{ fontSize: 14 }} />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    className="grid size-7 place-items-center rounded-lg border border-rose-200 text-rose-500 transition hover:bg-rose-50"
                    onClick={() => void remove(row)}
                  >
                    <DeleteOutline sx={{ fontSize: 14 }} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? (
        <p className="px-5 py-8 text-center text-[13px] text-slate-500">None added yet.</p>
      ) : null}
      {rows.length > PREVIEW_ROWS ? (
        <button
          type="button"
          className="w-full border-t border-slate-100 px-4 py-2.5 text-left text-[12.5px] font-semibold text-indigo-600 hover:bg-indigo-50/40"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? `Show fewer ${viewAllLabel}` : `View all ${viewAllLabel} (${rows.length})`}
        </button>
      ) : null}
    </div>
  );
}

function PayParametersCard({
  setup,
  request,
}: {
  setup: HrSetup;
  request: (path: string, method: string, body?: unknown) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"EARNING" | "DEDUCTION">("EARNING");
  const [amount, setAmount] = useState("");
  const [editingId, setEditingId] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const rows = setup.payParameters;
  const visible = showAll ? rows : rows.slice(0, PREVIEW_ROWS);

  function reset() {
    setName("");
    setType("EARNING");
    setAmount("");
    setEditingId("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const body = { name: name.trim(), type, defaultAmount: Number(amount) || 0 };
    const ok = editingId
      ? await request(`/hr/pay-parameters/${editingId}`, "PUT", body)
      : await request("/hr/pay-parameters", "POST", body);
    setBusy(false);
    if (ok) {
      notifySuccess(editingId ? "Parameter updated" : "Parameter added");
      reset();
    }
  }

  async function remove(id: string, parameterName: string) {
    const ok = await confirmDelete({
      text: `Delete "${parameterName}"? New staff will no longer be pre-filled with it.`,
    });
    if (!ok) return;
    if (await request(`/hr/pay-parameters/${id}`, "DELETE")) {
      notifySuccess("Parameter deleted");
      if (editingId === id) reset();
    }
  }

  return (
    <div className="nx-card overflow-hidden">
      <div className="flex flex-wrap items-start gap-3 px-4 py-4">
        <div
          className="grid size-10 shrink-0 place-items-center rounded-xl"
          style={{ background: "#f59e0b1a", color: "#d97706" }}
        >
          <CurrencyRupeeOutlined sx={{ fontSize: 20 }} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-bold text-slate-900">
            Earning / Deduction Parameters
          </h3>
          <form className="mt-2 flex flex-wrap items-end gap-3" onSubmit={submit}>
            <label className="block min-w-0 flex-1 basis-44">
              <span className="nx-label">Parameter Name</span>
              <input
                className="nx-input mt-1 w-full"
                placeholder="Enter parameter name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div>
              <span className="nx-label">Type</span>
              <div className="mt-1.5 flex items-center gap-3 py-1.5 text-[13px] text-slate-600">
                {(["EARNING", "DEDUCTION"] as const).map((value) => (
                  <label key={value} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="pay-parameter-type"
                      checked={type === value}
                      onChange={() => setType(value)}
                    />
                    {value === "EARNING" ? "Earning" : "Deduction"}
                  </label>
                ))}
              </div>
            </div>
            <label className="block w-32">
              <span className="nx-label">Default Amount</span>
              <input
                className="nx-input mt-1 w-full"
                type="number"
                min="0"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <button type="submit" className="nx-btn-primary shrink-0" disabled={busy}>
              <AddOutlined sx={{ fontSize: 15 }} /> {editingId ? "Save" : "Add"}
            </button>
            {editingId ? (
              <button type="button" className="nx-btn-secondary shrink-0" onClick={reset}>
                Cancel
              </button>
            ) : null}
          </form>
        </div>
      </div>

      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-y border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            <th className="w-12 px-4 py-2.5 text-left">#</th>
            <th className="px-3 py-2.5 text-left">Parameter Name</th>
            <th className="px-3 py-2.5 text-left">Type</th>
            <th className="px-3 py-2.5 text-right">Default Amount</th>
            <th className="w-24 px-4 py-2.5 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {visible.map((row, index) => (
            <tr key={row.id} className="transition hover:bg-indigo-50/30">
              <td className="px-4 py-2.5 text-slate-400">{index + 1}</td>
              <td className="px-3 py-2.5 font-medium text-slate-700">{row.name}</td>
              <td className="px-3 py-2.5">
                <span
                  className={`nx-pill ${
                    row.type === "EARNING" ? "nx-pill-success" : "nx-pill-danger"
                  }`}
                >
                  {row.type === "EARNING" ? "Earning" : "Deduction"}
                </span>
              </td>
              <td className="px-3 py-2.5 text-right text-slate-600">
                ₹{" "}
                {Number(row.defaultAmount).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    title="Edit"
                    className="grid size-7 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                    onClick={() => {
                      setEditingId(row.id);
                      setName(row.name);
                      setType(row.type);
                      setAmount(String(Number(row.defaultAmount)));
                    }}
                  >
                    <EditOutlined sx={{ fontSize: 14 }} />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    className="grid size-7 place-items-center rounded-lg border border-rose-200 text-rose-500 transition hover:bg-rose-50"
                    onClick={() => void remove(row.id, row.name)}
                  >
                    <DeleteOutline sx={{ fontSize: 14 }} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? (
        <p className="px-5 py-8 text-center text-[13px] text-slate-500">
          No parameters yet — add earnings like HRA or deductions like Provident Fund. New
          staff forms will be pre-filled with them.
        </p>
      ) : null}
      {rows.length > PREVIEW_ROWS ? (
        <button
          type="button"
          className="w-full border-t border-slate-100 px-4 py-2.5 text-left text-[12.5px] font-semibold text-indigo-600 hover:bg-indigo-50/40"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? "Show fewer parameters" : `View all parameters (${rows.length})`}
        </button>
      ) : null}
    </div>
  );
}
