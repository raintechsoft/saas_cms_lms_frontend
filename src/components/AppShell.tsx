import type { ComponentType } from "react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AssignmentOutlined,
  BadgeOutlined,
  CalendarMonthOutlined,
  CampaignOutlined,
  DashboardOutlined,
  ExpandMoreOutlined,
  EventNoteOutlined,
  GridViewRounded,
  GroupsOutlined,
  LogoutOutlined,
  MenuBookOutlined,
  NotificationsActiveOutlined,
  NotificationsOutlined,
  PaymentsOutlined,
  PersonOutlined,
  QuizOutlined,
  SchoolOutlined,
  SearchOutlined,
  SettingsOutlined,
  SummarizeOutlined,
  TuneOutlined,
  WorkOutlineOutlined,
} from "@mui/icons-material";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { applyBrandingToDocument, parseBranding } from "../lib/branding";
import { apiRequest, assetUrl } from "../lib/api";
import { CAMPUS_NAV, getCampusNavForMode, type NavSection } from "../lib/productMode";
import { InitialsAvatar } from "./InitialsAvatar";

type HeaderSearchStudent = {
  id: string;
  firstName: string;
  lastName?: string | null;
  admissionNumber: string;
};

type HeaderSearchPayment = {
  id: string;
  receiptNumber?: string;
  paymentId?: string;
  amount?: string;
  student?: { firstName: string; lastName?: string | null; admissionNumber?: string };
};

type HeaderSearchResults = {
  students: HeaderSearchStudent[];
  payments: HeaderSearchPayment[];
};

const PORTAL_ROLES = ["STUDENT", "PARENT"];
const STAFF_ROLES = ["INSTITUTION_ADMIN", "TEACHER", "ACCOUNTANT", "STAFF", "UNIVERSE_SUPER_ADMIN", "RESELLER_ADMIN"];

type NavIcon = ComponentType<{ sx?: { fontSize?: number }; className?: string }>;

export function isPortalUser(roles: string[] = []) {
  return roles.some((role) => PORTAL_ROLES.includes(role)) && !roles.some((role) => STAFF_ROLES.includes(role));
}

export function isPlatformUser(permissions: string[] = []) {
  return permissions.includes("platform.manage");
}

function staffPanelTitle(roles: string[] = []) {
  if (roles.includes("TEACHER")) return "Teacher";
  if (roles.includes("ACCOUNTANT")) return "Accounts";
  if (roles.includes("INSTITUTION_ADMIN")) return "Admin";
  return "Staff";
}

const navIcons: Record<string, NavIcon> = {
  "/dashboard": DashboardOutlined,
  "/profile": PersonOutlined,
  "/students": SchoolOutlined,
  "/academics": MenuBookOutlined,
  "/attendance": EventNoteOutlined,
  "/notices": CampaignOutlined,
  "/notifications": NotificationsOutlined,
  "/exams": QuizOutlined,
  "/timetable": CalendarMonthOutlined,
  "/homework": AssignmentOutlined,
  "/fees": PaymentsOutlined,
  "/hr": WorkOutlineOutlined,
  "/documents": BadgeOutlined,
  "/erp": TuneOutlined,
  "/reports": SummarizeOutlined,
  "/users": GroupsOutlined,
  "/settings": SettingsOutlined,
};

const SECTION_LABEL: Record<Extract<NavSection, "cms" | "lms" | "management">, string> = {
  cms: "CMS Modules",
  lms: "LMS Modules",
  management: "Management",
};

function useBreadcrumb() {
  const location = useLocation();
  const { user } = useAuth();
  return useMemo(() => {
    const path = location.pathname;
    if (path === "/dashboard") {
      const mode = user?.tenant?.productMode;
      if (mode === "LMS") return ["Dashboard", "LMS", "Overview"];
      return ["Dashboard", "Overview"];
    }

    const match = [...CAMPUS_NAV]
      .filter((item) => item.to !== "/dashboard" && (path === item.to || path.startsWith(`${item.to}/`)))
      .sort((a, b) => b.to.length - a.to.length)[0];

    if (!match) return ["Dashboard"];

    const trail = ["Dashboard"];
    if (match.section === "cms" || match.section === "lms" || match.section === "management") {
      trail.push(SECTION_LABEL[match.section]);
    }
    trail.push(match.label);

    if (match.to === "/students") {
      if (path === "/students/new") trail.push("Add Student");
      else if (path !== "/students" && /^\/students\/[^/]+$/.test(path)) trail.push("Student Profile");
    }
    return trail;
  }, [location.pathname, user?.tenant?.productMode]);
}

function NavGroup({
  label,
  items,
  active,
  navIcons: icons,
}: {
  label: string;
  items: Array<{ to: string; label: string }>;
  active: boolean;
  navIcons: Record<string, NavIcon>;
}) {
  const [open, setOpen] = useState(active);
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
  if (!items.length) return null;
  const GroupIcon = icons[items[0].to] ?? GridViewRounded;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition ${
          active ? "text-indigo-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
        }`}
      >
        <GroupIcon sx={{ fontSize: 19 }} className="shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        <ExpandMoreOutlined
          sx={{ fontSize: 18 }}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-200 pl-3">
          {items.map(({ to, label: itemLabel }) => {
            const Icon = icons[to] ?? GridViewRounded;
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition ${
                    isActive
                      ? "bg-indigo-50 text-[#4b41e1] before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-[#4b41e1]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`
                }
              >
                <Icon sx={{ fontSize: 17 }} className="shrink-0" />
                <span className="truncate">{itemLabel}</span>
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const { user, isAuthenticated, logout, accessToken } = useAuth();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const breadcrumb = useBreadcrumb();
  const branding = parseBranding(user?.tenant?.branding);

  type NotificationAudience = "ALL" | "STUDENTS" | "PARENTS";
  type NotificationTypeKey = "ANNOUNCEMENT" | "FEE_OVERDUE" | "FEE_RECEIPT" | "HOMEWORK" | "EXAM";
  type CampusNotification = {
    id: string;
    title: string;
    body: string;
    createdAt: string;
    isRead: boolean;
    type: NotificationTypeKey;
    audience: NotificationAudience;
  };

  const bellRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [bellLoading, setBellLoading] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState<CampusNotification[]>([]);
  const [markAllLoading, setMarkAllLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HeaderSearchResults>({ students: [], payments: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const BellIcon = bellOpen || unreadCount > 0 ? NotificationsActiveOutlined : NotificationsOutlined;

  function timeAgo(value: string) {
    const then = new Date(value).getTime();
    const deltaMs = Date.now() - then;
    const deltaSec = Math.floor(deltaMs / 1000);
    if (deltaSec < 60) return "Just now";
    const deltaMin = Math.floor(deltaSec / 60);
    if (deltaMin < 60) return `${deltaMin}m ago`;
    const deltaHr = Math.floor(deltaMin / 60);
    if (deltaHr < 24) return `${deltaHr}h ago`;
    const deltaDays = Math.floor(deltaHr / 24);
    return `${deltaDays}d ago`;
  }

  useEffect(() => {
    applyBrandingToDocument(branding);
  }, [branding.primaryColor, branding.logoText]);

  async function refreshUnreadCount() {
    if (!accessToken) return;
    try {
      const data = await apiRequest<{ count: number }>("/notifications/unread-count", accessToken);
      setUnreadCount(Number(data?.count ?? 0));
    } catch {
      // Best-effort: unread badge is non-critical UI.
    }
  }

  async function refreshRecentNotifications() {
    if (!accessToken) return;
    setBellLoading(true);
    try {
      const data = await apiRequest<CampusNotification[]>("/notifications", accessToken);
      setRecentNotifications((data ?? []).slice(0, 10));
    } catch {
      // Best-effort: dropdown list is non-critical UI.
    } finally {
      setBellLoading(false);
    }
  }

  useEffect(() => {
    if (!accessToken) return;
    void refreshUnreadCount();
    const intervalId = window.setInterval(() => {
      void refreshUnreadCount();
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, [accessToken]);

  useEffect(() => {
    if (!bellOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!bellRef.current) return;
      if (bellRef.current.contains(target)) return;
      setBellOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [bellOpen]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults({ students: [], payments: [] });
      setSearchLoading(false);
      setSearchOpen(false);
      return;
    }
    if (!accessToken) return;

    let cancelled = false;
    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const [studentsRes, paymentsRes] = await Promise.all([
            apiRequest<{ items: HeaderSearchStudent[] }>(
              `/students?search=${encodeURIComponent(q)}&limit=5`,
              accessToken,
            ),
            apiRequest<HeaderSearchPayment[] | { items: HeaderSearchPayment[] }>(
              `/fees/payments?query=${encodeURIComponent(q)}`,
              accessToken,
            ),
          ]);
          if (cancelled) return;
          const students = Array.isArray(studentsRes?.items) ? studentsRes.items.slice(0, 5) : [];
          const paymentsRaw = Array.isArray(paymentsRes)
            ? paymentsRes
            : Array.isArray(paymentsRes?.items)
              ? paymentsRes.items
              : [];
          setSearchResults({ students, payments: paymentsRaw.slice(0, 5) });
          setSearchOpen(true);
        } catch {
          if (cancelled) return;
          setSearchResults({ students: [], payments: [] });
          setSearchOpen(true);
        } finally {
          if (!cancelled) setSearchLoading(false);
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery, accessToken]);

  useEffect(() => {
    if (!searchOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!searchRef.current) return;
      if (searchRef.current.contains(target)) return;
      setSearchOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [searchOpen]);

  function studentDisplayName(person: { firstName: string; lastName?: string | null }) {
    return `${person.firstName} ${person.lastName ?? ""}`.trim();
  }

  function goToStudent(id: string) {
    setSearchOpen(false);
    setSearchQuery("");
    navigate(`/students/${id}`);
  }

  function goToFees() {
    setSearchOpen(false);
    setSearchQuery("");
    navigate("/fees");
  }

  async function onBellClick() {
    const next = !bellOpen;
    setBellOpen(next);
    if (next) await refreshRecentNotifications();
  }

  async function markAllRead() {
    if (!accessToken) return;
    setMarkAllLoading(true);
    try {
      await apiRequest<unknown>("/notifications/read-all", accessToken, { method: "PUT" });
      await refreshUnreadCount();
      if (bellOpen) await refreshRecentNotifications();
    } catch {
      // Best-effort UI.
    } finally {
      setMarkAllLoading(false);
    }
  }

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (isPlatformUser(user.permissions)) return <Navigate to="/admin/dashboard" replace />;
  if (isPortalUser(user.roles)) return <Navigate to="/portal" replace />;

  const panelField = user.roles.includes("STUDENT")
    ? "studentEnabled"
    : user.roles.includes("PARENT")
      ? "parentEnabled"
      : "adminEnabled";
  const links = getCampusNavForMode(user.tenant?.productMode).filter(
    ({ permission, moduleKey }) =>
      (!permission || user.permissions?.includes(permission))
      && (!moduleKey || user.moduleSettings.find((item) => item.moduleKey === moduleKey)?.[panelField] !== false),
  );

  const topLinks = links.filter((item) => item.section === "top" && item.to !== "/profile");
  const cmsLinks = links.filter((item) => item.section === "cms");
  const lmsLinks = links.filter((item) => item.section === "lms");
  const managementLinks = links.filter((item) => item.section === "management");
  const isCmsActive = cmsLinks.some((item) => location.pathname.startsWith(item.to));
  const isLmsActive = lmsLinks.some((item) => location.pathname.startsWith(item.to));

  const panelTitle = staffPanelTitle(user.roles);
  const schoolName = branding.logoText || user.tenant?.name || "SaaS CMS LMS";
  const fullName = `${user.firstName} ${user.lastName ?? ""}`.trim();

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#1d1f23] lg:flex">
      <aside className="border-b border-[#dfe1e4] bg-white lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-b-0 lg:border-r lg:border-[#dfe1e4]">
        <div className="flex h-16 items-center gap-2.5 border-b border-[#eaecee] px-4">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="" className="size-9 rounded-lg object-cover" />
          ) : (
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#6366f1] text-white">
              <GridViewRounded sx={{ fontSize: 20 }} />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold leading-tight text-[#1d1f23]">{schoolName}</p>
            <p className="truncate text-[10px] font-medium text-[#9ca3af]">{panelTitle} panel</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
          <div className="space-y-0.5">
            <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Dashboard</p>
            {topLinks.map(({ to, label }) => {
              const Icon = navIcons[to] ?? DashboardOutlined;
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition ${
                      isActive
                        ? "bg-[#6366f1] text-white shadow-sm shadow-indigo-200"
                        : "text-slate-600 hover:bg-slate-50"
                    }`
                  }
                >
                  <Icon sx={{ fontSize: 19 }} className="shrink-0" />
                  {label}
                </NavLink>
              );
            })}
          </div>

          {cmsLinks.length > 0 && <NavGroup label="CMS Modules" items={cmsLinks} active={isCmsActive} navIcons={navIcons} />}
          {lmsLinks.length > 0 && <NavGroup label="LMS Modules" items={lmsLinks} active={isLmsActive} navIcons={navIcons} />}

          {managementLinks.length > 0 && (
            <div className="space-y-0.5">
              <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Management</p>
              {managementLinks.map(({ to, label }) => {
                const Icon = navIcons[to] ?? SettingsOutlined;
                return (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition ${
                        isActive
                          ? "bg-indigo-50 text-[#4b41e1] before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-[#4b41e1]"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                      }`
                    }
                  >
                    <Icon sx={{ fontSize: 18 }} className="shrink-0" />
                    {label}
                  </NavLink>
                );
              })}
            </div>
          )}
        </nav>

        <div className="relative border-t border-slate-100 p-2.5">
          {accountMenuOpen && (
            <div className="absolute inset-x-2.5 bottom-[calc(100%+4px)] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
              <Link
                to="/profile"
                onClick={() => setAccountMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
              >
                <PersonOutlined sx={{ fontSize: 17 }} /> My profile
              </Link>
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-rose-600 hover:bg-rose-50"
              >
                <LogoutOutlined sx={{ fontSize: 17 }} /> Logout
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setAccountMenuOpen((current) => !current)}
            className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-slate-50"
          >
            <InitialsAvatar name={fullName || "Admin User"} photoUrl={user.avatarUrl ? assetUrl(user.avatarUrl) : undefined} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-slate-800">{fullName || "Admin User"}</p>
              <p className="truncate text-[10.5px] text-slate-400">{user.email}</p>
            </div>
            <ExpandMoreOutlined sx={{ fontSize: 16 }} className="shrink-0 text-slate-400" />
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:ml-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-[#dfe1e4] bg-[#f6f7f9] px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
            {breadcrumb.map((crumb, index) => (
              <span key={`${crumb}-${index}`} className="flex items-center gap-1.5">
                {index > 0 && <span className="text-slate-300">&gt;</span>}
                <span className={index === breadcrumb.length - 1 ? "font-semibold text-[#1d1f23]" : "text-[#696d72]"}>
                  {crumb}
                </span>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block" ref={searchRef}>
              <SearchOutlined sx={{ fontSize: 18 }} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="nx-input w-72 !rounded-lg !border-[#dfe1e4] !bg-white pl-9"
                placeholder="Search students, fees, logs..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => {
                  if (searchQuery.trim().length >= 2) setSearchOpen(true);
                }}
              />
              {searchOpen && (
                <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  {searchLoading ? (
                    <p className="px-3 py-3 text-center text-[12px] text-slate-500">Searching...</p>
                  ) : searchResults.students.length === 0 && searchResults.payments.length === 0 ? (
                    <p className="px-3 py-3 text-center text-[12px] text-slate-500">No matches found.</p>
                  ) : (
                    <div className="max-h-96 overflow-y-auto py-1">
                      {searchResults.students.length > 0 ? (
                        <div>
                          <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Students
                          </p>
                          {searchResults.students.map((student) => (
                            <button
                              key={student.id}
                              type="button"
                              onClick={() => goToStudent(student.id)}
                              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-indigo-50"
                            >
                              <span className="truncate text-[13px] font-semibold text-slate-800">
                                {studentDisplayName(student)}
                              </span>
                              <span className="truncate text-[11px] text-slate-500">
                                {student.admissionNumber}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {searchResults.payments.length > 0 ? (
                        <div>
                          <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Payments
                          </p>
                          {searchResults.payments.map((payment) => (
                            <button
                              key={payment.id}
                              type="button"
                              onClick={goToFees}
                              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-indigo-50"
                            >
                              <span className="truncate text-[13px] font-semibold text-slate-800">
                                {payment.receiptNumber || payment.paymentId || payment.id}
                              </span>
                              <span className="truncate text-[11px] text-slate-500">
                                {payment.student
                                  ? studentDisplayName(payment.student)
                                  : "Fee payment"}
                                {payment.amount != null ? ` · ${payment.amount}` : ""}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="relative" ref={bellRef}>
              <button
                type="button"
                aria-label="Notifications"
                onClick={onBellClick}
                className="relative grid size-9 place-items-center rounded-lg text-slate-500 transition hover:bg-white"
              >
                <BellIcon sx={{ fontSize: 21 }} />
                {unreadCount > 0 ? <span className="absolute right-2 top-2 size-1.5 rounded-full bg-rose-500" /> : null}
              </button>
              {bellOpen && (
                <div className="absolute right-0 mt-3 w-[380px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2">
                    <p className="text-[12px] font-semibold text-slate-800">Notifications</p>
                    <button
                      type="button"
                      onClick={() => void markAllRead()}
                      disabled={markAllLoading}
                      className="nx-btn-secondary !h-7 !px-2 !py-0 text-[12px] disabled:opacity-60"
                    >
                      {markAllLoading ? "Marking..." : "Mark all read"}
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto px-2 py-2">
                    {bellLoading ? (
                      <p className="px-2 py-3 text-center text-[12px] text-slate-500">Loading...</p>
                    ) : recentNotifications.length ? (
                      <div className="space-y-1">
                        {recentNotifications.map((n) => {
                          const preview = n.body.length > 120 ? `${n.body.slice(0, 120)}...` : n.body;
                          return (
                            <div
                              key={n.id}
                              className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-indigo-50/70"
                            >
                              <span className={`mt-1 size-2 rounded-full ${n.isRead ? "bg-slate-300" : "bg-rose-500"}`} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-semibold text-slate-900">{n.title}</p>
                                <p className="mt-1 truncate text-[12px] text-slate-600">{preview}</p>
                                <p className="mt-1 text-[11px] text-slate-400">{timeAgo(n.createdAt)}</p>
                              </div>
                              <div className="shrink-0 pr-1 text-[11px] font-medium text-slate-400">
                                {n.isRead ? "Read" : "New"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="px-2 py-3 text-center text-[12px] text-slate-500">No notifications.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <InitialsAvatar name={fullName || "Admin User"} photoUrl={user.avatarUrl ? assetUrl(user.avatarUrl) : undefined} size={34} />
              <span className="text-[12.5px] font-semibold text-slate-700">{fullName || "Admin User"}</span>
              <ExpandMoreOutlined sx={{ fontSize: 16 }} className="text-slate-400" />
            </div>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}

/** Compact page title used on campus screens. */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 pb-1 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">{eyebrow}</p>
        <h1 className="mt-0.5 text-[22px] font-bold leading-tight text-slate-900">{title}</h1>
        {description ? <p className="mt-1 text-[13px] text-slate-500">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
