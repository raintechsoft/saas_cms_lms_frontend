import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AddOutlined,
  ArrowDownwardOutlined,
  ArrowUpwardOutlined,
  CloseOutlined,
  KeyboardArrowDownOutlined,
  KeyboardArrowUpOutlined,
  ReplayOutlined,
  SearchOutlined,
  Star,
  StarBorder,
  StarHalf,
} from "@mui/icons-material";
import { InitialsAvatar } from "../../../components/InitialsAvatar";
import { apiRequest } from "../../../lib/api";
import { notifySuccess } from "../../../lib/notify";
import { staffName, type HrSetup } from "./types";

const PAGE_SIZE = 5;
const today = new Date().toISOString().slice(0, 10);

const RATING_LABELS: Record<string, string> = {
  "5": "Excellent",
  "4": "Very good",
  "3": "Good",
  "2": "Needs improvement",
  "1": "Unsatisfactory",
};

const CHIP_STYLES = [
  "bg-indigo-50 text-indigo-600",
  "bg-sky-50 text-sky-600",
  "bg-emerald-50 text-emerald-600",
  "bg-rose-50 text-rose-600",
  "bg-amber-50 text-amber-700",
];

const ANON_TINTS = ["#64748b", "#6366f1", "#a855f7", "#10b981", "#7c3aed"];

interface RatingSummary {
  staffId: string;
  name: string;
  designation: string | null;
  photoUrl: string | null;
  subjects: string[];
  classes: string[];
  averageRating: number;
  totalReviews: number;
  trend: number | null;
  recent: Array<{
    id: string;
    rating: number;
    comment: string | null;
    ratingDate: string;
  }>;
}

function Stars({ value, size = 17 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center text-amber-400">
      {Array.from({ length: 5 }, (_, i) => {
        if (value >= i + 0.75) return <Star key={i} sx={{ fontSize: size }} />;
        if (value >= i + 0.25) return <StarHalf key={i} sx={{ fontSize: size }} />;
        return <StarBorder key={i} sx={{ fontSize: size }} className="text-slate-300" />;
      })}
    </span>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function TeacherRatingsPanel({
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
  const [rows, setRows] = useState<RatingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ staffId: "", rating: "5", comment: "", ratingDate: today });
  const [busy, setBusy] = useState(false);

  async function loadSummary() {
    setLoading(true);
    try {
      setRows(await apiRequest<RatingSummary[]>("/hr/ratings/summary", token));
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to load teacher ratings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const subjects = useMemo(
    () => Array.from(new Set(rows.flatMap((row) => row.subjects))).sort(),
    [rows],
  );
  const classes = useMemo(
    () => Array.from(new Set(rows.flatMap((row) => row.classes))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => !subjectFilter || row.subjects.includes(subjectFilter))
      .filter((row) => !classFilter || row.classes.includes(classFilter))
      .filter((row) => !query || row.name.toLowerCase().includes(query));
  }, [rows, subjectFilter, classFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showFrom = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const showTo = Math.min(safePage * PAGE_SIZE, filtered.length);

  async function submitRating(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiRequest("/hr/ratings", token, {
        method: "POST",
        body: JSON.stringify({ ...form, rating: Number(form.rating) }),
      });
      notifySuccess("Teacher rating saved");
      setAddOpen(false);
      setForm({ staffId: "", rating: "5", comment: "", ratingDate: today });
      await Promise.all([loadSummary(), onSaved()]);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Unable to add teacher rating");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 space-y-4">
      <div className="nx-card flex flex-wrap items-end justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="nx-label">Subject</span>
            <select
              className="nx-input mt-1 w-44"
              value={subjectFilter}
              onChange={(e) => {
                setSubjectFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Subjects</option>
              {subjects.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="nx-label">Class</span>
            <select
              className="nx-input mt-1 w-44"
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Classes</option>
              {classes.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <div className="relative">
            <SearchOutlined
              sx={{ fontSize: 17 }}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="nx-input w-64 pl-9"
              placeholder="Search teacher by name…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="nx-btn-secondary"
            onClick={() => {
              setSubjectFilter("");
              setClassFilter("");
              setSearch("");
              setPage(1);
            }}
          >
            <ReplayOutlined sx={{ fontSize: 16 }} /> Clear Filters
          </button>
          <button type="button" className="nx-btn-primary" onClick={() => setAddOpen(true)}>
            <AddOutlined sx={{ fontSize: 16 }} /> Add Rating
          </button>
        </div>
      </div>

      <div className="nx-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="nx-table min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 text-left">Teacher Name</th>
                <th className="px-3 py-3 text-left">Subject(s)</th>
                <th className="px-3 py-3 text-center">Average Rating</th>
                <th className="px-3 py-3 text-center">Total Reviews</th>
                <th className="px-3 py-3 text-center">Trend</th>
                <th className="w-14 px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((row) => (
                <Fragment key={row.staffId}>
                  <tr className="transition hover:bg-indigo-50/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={row.name} photoUrl={row.photoUrl} size={36} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{row.name}</p>
                          <p className="truncate text-[12px] text-slate-400">
                            {row.designation ?? "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {row.subjects.length ? (
                          row.subjects.map((name, index) => (
                            <span
                              key={name}
                              className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${
                                CHIP_STYLES[index % CHIP_STYLES.length]
                              }`}
                            >
                              {name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[12px] text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {row.totalReviews ? (
                        <span className="inline-flex items-center gap-2">
                          <Stars value={row.averageRating} />
                          <span className="text-[13px] font-semibold text-slate-700">
                            {row.averageRating.toFixed(1)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[12px] text-slate-400">Not rated yet</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-slate-700">
                      {row.totalReviews}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {row.trend == null ? (
                        <span className="text-[12px] text-slate-400">—</span>
                      ) : row.trend >= 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-[12.5px] font-bold text-emerald-600">
                          <ArrowUpwardOutlined sx={{ fontSize: 14 }} /> {row.trend}%
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[12.5px] font-bold text-rose-500">
                          <ArrowDownwardOutlined sx={{ fontSize: 14 }} /> {Math.abs(row.trend)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                        onClick={() =>
                          setExpanded((current) => (current === row.staffId ? null : row.staffId))
                        }
                      >
                        {expanded === row.staffId ? (
                          <KeyboardArrowUpOutlined sx={{ fontSize: 18 }} />
                        ) : (
                          <KeyboardArrowDownOutlined sx={{ fontSize: 18 }} />
                        )}
                      </button>
                    </td>
                  </tr>
                  {expanded === row.staffId ? (
                    <tr>
                      <td colSpan={6} className="bg-slate-50/50 px-4 py-4">
                        <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
                          <p className="border-b border-slate-100 px-4 py-3 text-[13px] font-bold text-slate-900">
                            Recent Student Ratings &amp; Comments{" "}
                            <span className="font-medium text-slate-400">(Anonymized)</span>
                          </p>
                          <table className="w-full text-[13px]">
                            <thead>
                              <tr className="border-b border-slate-100 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
                                <th className="px-4 py-2.5 text-left">Student</th>
                                <th className="px-3 py-2.5 text-left">Rating</th>
                                <th className="px-3 py-2.5 text-left">Comment</th>
                                <th className="px-4 py-2.5 text-right">Reviewed On</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {row.recent.map((item, index) => {
                                const letter = String.fromCharCode(65 + index);
                                const tint = ANON_TINTS[index % ANON_TINTS.length];
                                return (
                                  <tr key={item.id}>
                                    <td className="px-4 py-2.5">
                                      <span className="flex items-center gap-2 font-medium text-slate-700">
                                        <span
                                          className="grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                                          style={{ background: tint }}
                                        >
                                          {letter}
                                        </span>
                                        Student {letter}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2.5">
                                      <Stars value={item.rating} size={15} />
                                    </td>
                                    <td className="px-3 py-2.5 text-slate-600">
                                      {item.comment ?? "—"}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-slate-500">
                                      {formatDate(item.ratingDate)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {!row.recent.length ? (
                            <p className="px-4 py-6 text-center text-[13px] text-slate-500">
                              No ratings recorded for this teacher yet.
                            </p>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
          {!pageRows.length ? (
            <p className="px-5 py-12 text-center text-sm text-slate-500">
              {loading ? "Loading teacher ratings…" : "No teachers match the current filters."}
            </p>
          ) : null}
        </div>
        {filtered.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-[12px] text-slate-500">
              Showing {showFrom} to {showTo} of {filtered.length} entries
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`grid size-8 place-items-center rounded-lg text-[12px] font-semibold transition ${
                    num === safePage
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                  onClick={() => setPage(num)}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                className="nx-btn-secondary !px-3 !py-1.5 text-[12px]"
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
              >
                ›
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-xl"
            onSubmit={submitRating}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h3 className="text-[16px] font-bold text-slate-900">Add teacher rating</h3>
              <button
                type="button"
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
                onClick={() => setAddOpen(false)}
              >
                <CloseOutlined sx={{ fontSize: 18 }} />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <label className="block">
                <span className="nx-label">Teacher</span>
                <select
                  className="nx-input mt-1 w-full"
                  required
                  value={form.staffId}
                  onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                >
                  <option value="">Select teacher</option>
                  {setup.staff
                    .filter((member) => member.status === "ACTIVE")
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {staffName(member)} · {member.designation?.name ?? "No role"}
                      </option>
                    ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="nx-label">Rating</span>
                  <select
                    className="nx-input mt-1 w-full"
                    value={form.rating}
                    onChange={(e) => setForm({ ...form, rating: e.target.value })}
                  >
                    {(["5", "4", "3", "2", "1"] as const).map((value) => (
                      <option key={value} value={value}>
                        {value} · {RATING_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="nx-label">Rating date</span>
                  <input
                    className="nx-input mt-1 w-full"
                    type="date"
                    value={form.ratingDate}
                    onChange={(e) => setForm({ ...form, ratingDate: e.target.value })}
                  />
                </label>
              </div>
              <label className="block">
                <span className="nx-label">Review comment</span>
                <textarea
                  className="nx-input mt-1 w-full"
                  rows={3}
                  placeholder="Optional feedback"
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button type="button" className="nx-btn-secondary" onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="nx-btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Save rating"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
