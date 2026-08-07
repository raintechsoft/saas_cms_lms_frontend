import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AddOutlined,
  AssignmentReturnOutlined,
  DeleteOutline,
  EditOutlined,
  MenuBookOutlined,
  ScheduleOutlined,
  CategoryOutlined,
  WarningAmberOutlined,
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

type Tab = "books" | "issue" | "due" | "categories";

interface LibraryCategory {
  id: string;
  name: string;
  isActive: boolean;
  notes: string | null;
  _count: { books: number };
}

interface LibraryBook {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  accessionNo: string | null;
  publisher: string | null;
  publishedYear: number | null;
  totalCopies: number;
  availableCopies: number;
  location: string | null;
  isActive: boolean;
  notes: string | null;
  category: { id: string; name: string } | null;
}

interface LibraryLoan {
  id: string;
  status: "ISSUED" | "RETURNED" | "LOST";
  issuedAt: string;
  dueAt: string;
  returnedAt: string | null;
  note: string | null;
  fineAmount: string | null;
  book: {
    id: string;
    title: string;
    author: string | null;
    accessionNo: string | null;
  };
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string | null;
  };
}

interface StudentOption {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string | null;
}

interface LibrarySummary {
  books: number;
  categories: number;
  totalCopies: number;
  availableCopies: number;
  issued: number;
  overdue: number;
}

const TABS: Array<CmsIconTabItem<Tab>> = [
  { key: "books", label: "Books", shortLabel: "Books", icon: MenuBookOutlined, tone: "cyan" },
  { key: "issue", label: "Issue / Return", shortLabel: "Issue", icon: AssignmentReturnOutlined, tone: "indigo" },
  { key: "due", label: "Overdue", shortLabel: "Due", icon: WarningAmberOutlined, tone: "amber" },
  { key: "categories", label: "Categories", shortLabel: "Categories", icon: CategoryOutlined, tone: "sky" },
];

const PAGE_SIZE = 8;

function studentLabel(student: { firstName: string; lastName: string | null }) {
  return `${student.firstName} ${student.lastName ?? ""}`.trim();
}

function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100">
        {icon}
      </div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function LibraryPage() {
  const { accessToken, user } = useAuth();
  const [tab, setTab] = useState<Tab>("books");
  const [summary, setSummary] = useState<LibrarySummary | null>(null);
  const [categories, setCategories] = useState<LibraryCategory[]>([]);
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loans, setLoans] = useState<LibraryLoan[]>([]);
  const [dueLoans, setDueLoans] = useState<LibraryLoan[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showBookForm, setShowBookForm] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [accessionNo, setAccessionNo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [totalCopies, setTotalCopies] = useState("1");
  const [availableCopies, setAvailableCopies] = useState("1");
  const [location, setLocation] = useState("");
  const [bookActive, setBookActive] = useState(true);
  const [categoryName, setCategoryName] = useState("");
  const [issueBookId, setIssueBookId] = useState("");
  const [issueStudentId, setIssueStudentId] = useState("");
  const [loanDays, setLoanDays] = useState("14");
  const [issueNote, setIssueNote] = useState("");

  const canManage = user?.permissions.includes("library.manage") ?? false;
  const pageRows = useMemo(() => paginateItems(books, page, PAGE_SIZE), [books, page]);
  const availableBooks = useMemo(
    () => books.filter((book) => book.isActive && book.availableCopies > 0),
    [books],
  );

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(books.length / PAGE_SIZE));
    if (page > maxPage) setPage(maxPage);
  }, [books.length, page]);

  function resetBookForm() {
    setEditingBookId(null);
    setTitle("");
    setAuthor("");
    setIsbn("");
    setAccessionNo("");
    setCategoryId("");
    setTotalCopies("1");
    setAvailableCopies("1");
    setLocation("");
    setBookActive(true);
    setShowBookForm(false);
  }

  async function load(q = search) {
    try {
      const query = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const [summaryRow, categoryRows, bookRows, loanRows, dueRows, studentList] = await Promise.all([
        apiRequest<LibrarySummary>("/library/summary", accessToken),
        apiRequest<LibraryCategory[]>("/library/categories", accessToken),
        apiRequest<LibraryBook[]>(`/library/books${query}`, accessToken),
        apiRequest<LibraryLoan[]>("/library/loans?status=ISSUED&take=100", accessToken),
        apiRequest<LibraryLoan[]>("/library/loans?overdueOnly=true&take=100", accessToken),
        apiRequest<{ items: StudentOption[] }>("/students?limit=100&status=ACTIVE", accessToken),
      ]);
      setSummary(summaryRow);
      setCategories(categoryRows);
      setBooks(bookRows);
      setLoans(loanRows);
      setDueLoans(dueRows);
      setStudents(studentList.items);
      setPage(1);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load library data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [accessToken]);

  function startEditBook(book: LibraryBook) {
    setEditingBookId(book.id);
    setTitle(book.title);
    setAuthor(book.author ?? "");
    setIsbn(book.isbn ?? "");
    setAccessionNo(book.accessionNo ?? "");
    setCategoryId(book.category?.id ?? "");
    setTotalCopies(String(book.totalCopies));
    setAvailableCopies(String(book.availableCopies));
    setLocation(book.location ?? "");
    setBookActive(book.isActive);
    setShowBookForm(true);
  }

  async function saveBook(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setSubmitting(true);
    const payload = {
      title,
      author: author || null,
      isbn: isbn || null,
      accessionNo: accessionNo || null,
      categoryId: categoryId || null,
      totalCopies: Number(totalCopies) || 1,
      availableCopies: Number(availableCopies) || 0,
      location: location || null,
      isActive: bookActive,
    };
    try {
      if (editingBookId) {
        await apiRequest(`/library/books/${editingBookId}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        notifySuccess("Book updated");
      } else {
        await apiRequest("/library/books", accessToken, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        notifySuccess("Book added");
      }
      resetBookForm();
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save book");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeBook(id: string) {
    if (!canManage) return;
    const ok = await confirmDelete({
      title: "Delete book?",
      text: "Active issues must be returned first.",
    });
    if (!ok) return;
    try {
      await apiRequest(`/library/books/${id}`, accessToken, { method: "DELETE" });
      if (editingBookId === id) resetBookForm();
      notifySuccess("Book deleted");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete book");
    }
  }

  async function saveCategory(event: FormEvent) {
    event.preventDefault();
    if (!canManage || !categoryName.trim()) return;
    setSubmitting(true);
    try {
      await apiRequest("/library/categories", accessToken, {
        method: "POST",
        body: JSON.stringify({ name: categoryName.trim() }),
      });
      notifySuccess("Category created");
      setCategoryName("");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to create category");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeCategory(id: string) {
    if (!canManage) return;
    const ok = await confirmDelete({
      title: "Delete category?",
      text: "Books in this category will keep their records without a category.",
    });
    if (!ok) return;
    try {
      await apiRequest(`/library/categories/${id}`, accessToken, { method: "DELETE" });
      notifySuccess("Category deleted");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to delete category");
    }
  }

  async function issueBook(event: FormEvent) {
    event.preventDefault();
    if (!canManage || !issueBookId || !issueStudentId) return;
    setSubmitting(true);
    try {
      await apiRequest("/library/issue", accessToken, {
        method: "POST",
        body: JSON.stringify({
          bookId: issueBookId,
          studentId: issueStudentId,
          loanDays: Number(loanDays) || 14,
          note: issueNote || null,
        }),
      });
      notifySuccess("Book issued");
      setIssueBookId("");
      setIssueStudentId("");
      setIssueNote("");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to issue book");
    } finally {
      setSubmitting(false);
    }
  }

  async function returnLoan(id: string, markLost = false) {
    if (!canManage) return;
    setSubmitting(true);
    try {
      await apiRequest(`/library/loans/${id}/return`, accessToken, {
        method: "POST",
        body: JSON.stringify({ markLost }),
      });
      notifySuccess(markLost ? "Marked as lost" : "Book returned");
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to return book");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <CmsPage>
      <CmsPageHeader
        title="Library"
        description="Catalogue books, issue to students, and track overdue returns."
        actions={
          canManage && tab === "books" ? (
            <button
              type="button"
              className="nx-btn-primary"
              onClick={() => {
                if (showBookForm && !editingBookId) resetBookForm();
                else {
                  setEditingBookId(null);
                  setShowBookForm(true);
                }
              }}
            >
              <AddOutlined sx={{ fontSize: 16 }} />
              {showBookForm && !editingBookId ? "Close form" : "Add book"}
            </button>
          ) : null
        }
      />

      <CmsKpiGrid>
        <CmsKpiCard icon={<MenuBookOutlined sx={{ fontSize: 20 }} />} label="Books" value={summary?.books ?? 0} tint="#0891b2" />
        <CmsKpiCard icon={<ScheduleOutlined sx={{ fontSize: 20 }} />} label="Copies available" value={summary?.availableCopies ?? 0} tint="#4f46e5" />
        <CmsKpiCard icon={<AssignmentReturnOutlined sx={{ fontSize: 20 }} />} label="Issued" value={summary?.issued ?? 0} tint="#059669" />
        <CmsKpiCard icon={<WarningAmberOutlined sx={{ fontSize: 20 }} />} label="Overdue" value={summary?.overdue ?? 0} tint="#d97706" />
      </CmsKpiGrid>

      <CmsIconTabs
        ariaLabel="Library sections"
        value={tab}
        onChange={setTab}
        columnsClass="grid-cols-2 sm:grid-cols-4"
        items={TABS}
      />

      <CmsScrollBody className="space-y-4 pt-4">
        {tab === "books" ? (
          <>
            {canManage && showBookForm ? (
              <CmsSectionCard className="overflow-hidden !p-0">
                <div className="border-b border-cyan-100 bg-gradient-to-r from-cyan-50 via-white to-sky-50/40 px-5 py-4">
                  <h2 className="text-sm font-bold text-slate-900">{editingBookId ? "Edit book" : "Add book"}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Title, copies, accession number, and shelf location.</p>
                </div>
                <form className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3" onSubmit={saveBook}>
                  <label>
                    <span className="nx-label">Title *</span>
                    <input className="nx-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} required />
                  </label>
                  <label>
                    <span className="nx-label">Author</span>
                    <input className="nx-input w-full" value={author} onChange={(e) => setAuthor(e.target.value)} />
                  </label>
                  <label>
                    <span className="nx-label">Category</span>
                    <select className="nx-input w-full" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                      <option value="">None</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="nx-label">Accession no.</span>
                    <input className="nx-input w-full" value={accessionNo} onChange={(e) => setAccessionNo(e.target.value)} />
                  </label>
                  <label>
                    <span className="nx-label">ISBN</span>
                    <input className="nx-input w-full" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
                  </label>
                  <label>
                    <span className="nx-label">Location / shelf</span>
                    <input className="nx-input w-full" value={location} onChange={(e) => setLocation(e.target.value)} />
                  </label>
                  <label>
                    <span className="nx-label">Total copies</span>
                    <input className="nx-input w-full" type="number" min="1" value={totalCopies} onChange={(e) => setTotalCopies(e.target.value)} />
                  </label>
                  <label>
                    <span className="nx-label">Available copies</span>
                    <input className="nx-input w-full" type="number" min="0" value={availableCopies} onChange={(e) => setAvailableCopies(e.target.value)} />
                  </label>
                  <label className="flex items-center gap-2 pt-6 text-sm">
                    <input type="checkbox" checked={bookActive} onChange={(e) => setBookActive(e.target.checked)} />
                    <span className="font-medium text-slate-700">Active</span>
                  </label>
                  <div className="flex flex-wrap gap-2 sm:col-span-3">
                    <button type="submit" className="nx-btn-primary" disabled={submitting}>
                      {editingBookId ? "Update book" : "Create book"}
                    </button>
                    <button type="button" className="nx-btn-secondary" onClick={resetBookForm}>Cancel</button>
                  </div>
                </form>
              </CmsSectionCard>
            ) : null}

            <CmsSectionCard className="overflow-hidden !p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Catalogue</h2>
                  <p className="text-xs text-slate-500">{books.length} book{books.length === 1 ? "" : "s"}</p>
                </div>
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void load(search);
                  }}
                >
                  <input
                    className="nx-input w-56 text-sm"
                    placeholder="Search title, author, ISBN…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button type="submit" className="nx-btn-secondary text-xs">Search</button>
                </form>
              </div>
              {loading ? (
                <EmptyState icon={<MenuBookOutlined />} title="Loading books…" />
              ) : !books.length ? (
                <EmptyState icon={<MenuBookOutlined />} title="No books yet" hint="Add books to start issuing to students." />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="nx-table min-w-full text-left">
                      <thead>
                        <tr>
                          <th>Book</th>
                          <th>Category</th>
                          <th>Copies</th>
                          <th>Location</th>
                          <th>Status</th>
                          {canManage ? <th>Actions</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((book) => (
                          <tr key={book.id}>
                            <td>
                              <p className="font-semibold text-slate-900">{book.title}</p>
                              <p className="text-xs text-slate-500">
                                {[book.author, book.accessionNo, book.isbn].filter(Boolean).join(" · ") || "—"}
                              </p>
                            </td>
                            <td className="text-slate-700">{book.category?.name ?? "—"}</td>
                            <td>
                              <span className="inline-flex rounded-lg bg-cyan-50 px-2 py-1 text-xs font-bold text-cyan-800">
                                {book.availableCopies}/{book.totalCopies}
                              </span>
                            </td>
                            <td className="text-slate-700">{book.location ?? "—"}</td>
                            <td>
                              <span className={book.isActive ? "nx-pill nx-pill-success" : "nx-pill nx-pill-neutral"}>
                                {book.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            {canManage ? (
                              <td>
                                <div className="flex gap-1.5">
                                  <button type="button" className="nx-btn-secondary !px-2 !py-1 text-xs" onClick={() => startEditBook(book)}>
                                    <EditOutlined sx={{ fontSize: 14 }} />
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-rose-600"
                                    onClick={() => void removeBook(book.id)}
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
                  <ListPagination page={page} pageSize={PAGE_SIZE} total={books.length} onPageChange={setPage} />
                </>
              )}
            </CmsSectionCard>
          </>
        ) : null}

        {tab === "issue" ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            <CmsSectionCard className="p-5">
              <h2 className="text-sm font-bold text-slate-900">Issue book</h2>
              <p className="mt-0.5 text-xs text-slate-500">Default loan period is 14 days.</p>
              {canManage ? (
                <form className="mt-4 grid gap-3" onSubmit={issueBook}>
                  <label>
                    <span className="nx-label">Book *</span>
                    <select className="nx-input w-full" value={issueBookId} onChange={(e) => setIssueBookId(e.target.value)} required>
                      <option value="">Select book</option>
                      {availableBooks.map((book) => (
                        <option key={book.id} value={book.id}>
                          {book.title} ({book.availableCopies} available)
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="nx-label">Student *</span>
                    <select className="nx-input w-full" value={issueStudentId} onChange={(e) => setIssueStudentId(e.target.value)} required>
                      <option value="">Select student</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.admissionNumber} · {studentLabel(student)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="nx-label">Loan days</span>
                    <input className="nx-input w-full" type="number" min="1" max="365" value={loanDays} onChange={(e) => setLoanDays(e.target.value)} />
                  </label>
                  <label>
                    <span className="nx-label">Note</span>
                    <input className="nx-input w-full" value={issueNote} onChange={(e) => setIssueNote(e.target.value)} placeholder="Optional" />
                  </label>
                  <button type="submit" className="nx-btn-primary w-fit" disabled={submitting}>Issue book</button>
                </form>
              ) : (
                <p className="mt-4 text-sm text-slate-500">You need library.manage to issue books.</p>
              )}
            </CmsSectionCard>

            <CmsSectionCard className="overflow-hidden !p-0">
              <div className="border-b border-slate-100 px-5 py-3.5">
                <h2 className="text-sm font-bold text-slate-900">Currently issued</h2>
              </div>
              {!loans.length ? (
                <EmptyState icon={<AssignmentReturnOutlined />} title="No active issues" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="nx-table min-w-full text-left">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Book</th>
                        <th>Due</th>
                        {canManage ? <th>Actions</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {loans.map((loan) => {
                        const overdue = new Date(loan.dueAt) < new Date();
                        return (
                          <tr key={loan.id}>
                            <td>
                              <p className="font-semibold text-slate-900">{studentLabel(loan.student)}</p>
                              <p className="font-mono text-[11px] text-slate-500">{loan.student.admissionNumber}</p>
                            </td>
                            <td className="text-slate-800">{loan.book.title}</td>
                            <td>
                              <span className={overdue ? "nx-pill nx-pill-warning" : "text-xs text-slate-600"}>
                                {new Date(loan.dueAt).toLocaleDateString()}
                              </span>
                            </td>
                            {canManage ? (
                              <td>
                                <div className="flex gap-1.5">
                                  <button type="button" className="nx-btn-primary !px-2 !py-1 text-xs" onClick={() => void returnLoan(loan.id)}>
                                    Return
                                  </button>
                                  <button type="button" className="nx-btn-secondary !px-2 !py-1 text-xs" onClick={() => void returnLoan(loan.id, true)}>
                                    Lost
                                  </button>
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CmsSectionCard>
          </div>
        ) : null}

        {tab === "due" ? (
          <CmsSectionCard className="overflow-hidden !p-0">
            <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50/80 via-white to-white px-5 py-3.5">
              <h2 className="text-sm font-bold text-slate-900">Overdue loans</h2>
              <p className="text-xs text-slate-500">{dueLoans.length} book{dueLoans.length === 1 ? "" : "s"} past due date</p>
            </div>
            {!dueLoans.length ? (
              <EmptyState icon={<WarningAmberOutlined />} title="No overdue books" hint="Great — nothing is past due." />
            ) : (
              <div className="overflow-x-auto">
                <table className="nx-table min-w-full text-left">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Book</th>
                      <th>Due</th>
                      <th>Days late</th>
                      {canManage ? <th>Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {dueLoans.map((loan) => {
                      const daysLate = Math.max(
                        0,
                        Math.floor((Date.now() - new Date(loan.dueAt).getTime()) / (1000 * 60 * 60 * 24)),
                      );
                      return (
                        <tr key={loan.id}>
                          <td>
                            <p className="font-semibold text-slate-900">{studentLabel(loan.student)}</p>
                            <p className="font-mono text-[11px] text-slate-500">{loan.student.admissionNumber}</p>
                          </td>
                          <td>{loan.book.title}</td>
                          <td>{new Date(loan.dueAt).toLocaleDateString()}</td>
                          <td>
                            <span className="nx-pill nx-pill-warning">{daysLate}d</span>
                          </td>
                          {canManage ? (
                            <td>
                              <button type="button" className="nx-btn-primary !px-2 !py-1 text-xs" onClick={() => void returnLoan(loan.id)}>
                                Return
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CmsSectionCard>
        ) : null}

        {tab === "categories" ? (
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            {canManage ? (
              <CmsSectionCard className="p-5">
                <h2 className="text-sm font-bold text-slate-900">Add category</h2>
                <form className="mt-4 grid gap-3" onSubmit={saveCategory}>
                  <label>
                    <span className="nx-label">Name *</span>
                    <input className="nx-input w-full" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} required />
                  </label>
                  <button type="submit" className="nx-btn-primary w-fit" disabled={submitting}>Create category</button>
                </form>
              </CmsSectionCard>
            ) : null}
            <CmsSectionCard className="overflow-hidden !p-0">
              <div className="border-b border-slate-100 px-5 py-3.5">
                <h2 className="text-sm font-bold text-slate-900">Categories</h2>
              </div>
              {!categories.length ? (
                <EmptyState icon={<CategoryOutlined />} title="No categories yet" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="nx-table min-w-full text-left">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Books</th>
                        <th>Status</th>
                        {canManage ? <th>Actions</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((category) => (
                        <tr key={category.id}>
                          <td className="font-semibold text-slate-900">{category.name}</td>
                          <td>{category._count.books}</td>
                          <td>
                            <span className={category.isActive ? "nx-pill nx-pill-success" : "nx-pill nx-pill-neutral"}>
                              {category.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          {canManage ? (
                            <td>
                              <button
                                type="button"
                                className="inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-rose-600"
                                onClick={() => void removeCategory(category.id)}
                              >
                                <DeleteOutline sx={{ fontSize: 14 }} />
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CmsSectionCard>
          </div>
        ) : null}
      </CmsScrollBody>
      <CmsFooter />
    </CmsPage>
  );
}
