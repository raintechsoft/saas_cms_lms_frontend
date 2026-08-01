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
    if (path === "/cms") return ["Dashboard", "CMS", "Overview"];
    if (path === "/lms") return ["Dashboard", "LMS", "Overview"];

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

/** Soft tinted chips so each module is easy to spot at a glance. */
const navIconTone: Record<string, string> = {
  "/dashboard": "bg-indigo-100 text-indigo-600",
  "/notifications": "bg-violet-100 text-violet-600",
  "/students": "bg-sky-100 text-sky-700",
  "/academics": "bg-blue-100 text-blue-700",
  "/attendance": "bg-amber-100 text-amber-700",
  "/notices": "bg-orange-100 text-orange-700",
  "/exams": "bg-fuchsia-100 text-fuchsia-700",
  "/timetable": "bg-cyan-100 text-cyan-700",
  "/homework": "bg-teal-100 text-teal-700",
  "/fees": "bg-emerald-100 text-emerald-700",
  "/hr": "bg-slate-200 text-slate-700",
  "/documents": "bg-rose-100 text-rose-700",
  "/erp": "bg-purple-100 text-purple-700",
  "/reports": "bg-indigo-100 text-indigo-700",
  "/users": "bg-blue-100 text-blue-700",
  "/settings": "bg-slate-200 text-slate-600",
  "/profile": "bg-slate-100 text-slate-600",
};

const sectionTone: Record<string, string> = {
  "CMS Modules": "bg-indigo-100 text-indigo-700",
  "LMS Modules": "bg-cyan-100 text-cyan-700",
};

function NavIconBadge({
  to,
  Icon,
  active = false,
  solidActive = false,
  size = "md",
}: {
  to: string;
  Icon: NavIcon;
  active?: boolean;
  /** Filled primary row (Overview) — white icon on solid bg */
  solidActive?: boolean;
  size?: "sm" | "md";
}) {
  const box = size === "md" ? "size-8" : "size-7";
  const font = size === "md" ? 20 : 18;
  if (solidActive && active) {
    return (
      <span className={`inline-grid ${box} shrink-0 place-items-center rounded-lg bg-white/20 text-white`}>
        <Icon sx={{ fontSize: font }} />
      </span>
    );
  }
  const tone = navIconTone[to] ?? "bg-slate-100 text-slate-600";
  return (
    <span
      className={`inline-grid ${box} shrink-0 place-items-center rounded-lg ${tone} ${
        active ? "ring-2 ring-indigo-200/80" : ""
      }`}
    >
      <Icon sx={{ fontSize: font }} />
    </span>
  );
}

function NavGroup({
  label,
  items,
  active,
  navIcons: icons,
  to,
}: {
  label: string;
  items: Array<{ to: string; label: string }>;
  active: boolean;
  navIcons: Record<string, NavIcon>;
  /** Optional dashboard route opened when the group header is clicked. */
  to?: string;
}) {
  const [open, setOpen] = useState(active);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
  if (!items.length) return null;
  const GroupIcon = icons[items[0].to] ?? GridViewRounded;
  const groupTone = sectionTone[label] ?? "bg-slate-100 text-slate-600";

  const handleHeaderClick = () => {
    if (to && location.pathname !== to) {
      setOpen(true);
      navigate(to);
      return;
    }
    setOpen((current) => !current);
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleHeaderClick}
        className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-[13px] font-semibold transition ${
          active ? "bg-white/80 text-indigo-800 shadow-sm" : "text-slate-600 hover:bg-white/60 hover:text-slate-800"
        }`}
      >
        <span className={`inline-grid size-8 shrink-0 place-items-center rounded-lg ${groupTone}`}>
          <GroupIcon sx={{ fontSize: 20 }} />
        </span>
        <span className="flex-1 text-left">{label}</span>
        <ExpandMoreOutlined
          sx={{ fontSize: 18 }}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="ml-3 mt-1 space-y-1 border-l-2 border-indigo-100 pl-2.5">
          {items.map(({ to, label: itemLabel }) => {
            const Icon = icons[to] ?? GridViewRounded;
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `relative flex items-center gap-2.5 rounded-xl px-2 py-2 text-[13px] font-medium transition ${
                    isActive
                      ? "bg-white text-[#4b41e1] shadow-sm before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-[#4b41e1]"
                      : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <NavIconBadge to={to} Icon={Icon} active={isActive} size="md" />
                    <span className="truncate">{itemLabel}</span>
                  </>
                )}
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
  const isCmsActive =
    location.pathname === "/cms" || cmsLinks.some((item) => location.pathname.startsWith(item.to));
  const isLmsActive =
    location.pathname === "/lms" || lmsLinks.some((item) => location.pathname.startsWith(item.to));

  const panelTitle = staffPanelTitle(user.roles);
  const schoolName = branding.logoText || user.tenant?.name || "SaaS CMS LMS";
  const fullName = `${user.firstName} ${user.lastName ?? ""}`.trim();

  return (
    <div className="flex h-screen min-h-0 bg-[#f6f7f9] text-[#1d1f23] lg:flex">
      <aside className="border-b border-indigo-100/80 bg-gradient-to-b from-[#eef1fb] via-[#f3f5fb] to-[#f7f8fc] lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-b-0 lg:border-r lg:border-indigo-100/80">
        <div className="flex h-16 items-center gap-2.5 border-b border-indigo-100/70 px-4">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="" className="size-9 rounded-lg object-cover" />
          ) : (
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#6366f1] text-white shadow-sm shadow-indigo-200">
              <GridViewRounded sx={{ fontSize: 20 }} />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold leading-tight text-[#1d1f23]">{schoolName}</p>
            <p className="truncate text-[10px] font-medium text-indigo-400/90">{panelTitle} panel</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
          <div className="space-y-0.5">
            <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400/80">Dashboard</p>
            {topLinks.map(({ to, label }) => {
              const Icon = navIcons[to] ?? DashboardOutlined;
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `relative flex items-center gap-2.5 rounded-xl px-2 py-2 text-[13px] font-semibold transition ${
                      isActive
                        ? "bg-[#6366f1] text-white shadow-sm shadow-indigo-200"
                        : "text-slate-700 hover:bg-white/70"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <NavIconBadge to={to} Icon={Icon} active={isActive} solidActive size="md" />
                      {label}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>

          {cmsLinks.length > 0 && <NavGroup label="CMS Modules" items={cmsLinks} active={isCmsActive} navIcons={navIcons} to="/cms" />}
          {lmsLinks.length > 0 && <NavGroup label="LMS Modules" items={lmsLinks} active={isLmsActive} navIcons={navIcons} to="/lms" />}

          {managementLinks.length > 0 && (
            <div className="space-y-0.5">
              <p className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400/80">Management</p>
              {managementLinks.map(({ to, label }) => {
                const Icon = navIcons[to] ?? SettingsOutlined;
                return (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `relative flex items-center gap-2.5 rounded-xl px-2 py-2 text-[13px] font-medium transition ${
                        isActive
                          ? "bg-white text-[#4b41e1] shadow-sm before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-[#4b41e1]"
                          : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <NavIconBadge to={to} Icon={Icon} active={isActive} size="md" />
                        {label}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          )}
        </nav>

        <div className="relative border-t border-indigo-100/70 bg-white/40 p-2.5 backdrop-blur-[2px]">
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:ml-64">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-indigo-100/80 bg-gradient-to-r from-[#eef1fb] via-[#f3f5fb] to-[#f7f8fc] px-5 backdrop-blur-sm lg:px-6">
          <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
            {breadcrumb.map((crumb, index) => (
              <span key={`${crumb}-${index}`} className="flex items-center gap-1.5">
                {index > 0 && <span className="text-indigo-300">&gt;</span>}
                <span
                  className={
                    index === breadcrumb.length - 1
                      ? "font-semibold text-[#1d1f23]"
                      : "font-medium text-indigo-400/90"
                  }
                >
                  {crumb}
                </span>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative hidden sm:block" ref={searchRef}>
              <SearchOutlined
                sx={{ fontSize: 18 }}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400"
              />
              <input
                className="nx-input w-72 !rounded-xl !border-indigo-100 !bg-white/80 pl-9 shadow-sm shadow-indigo-100/40 placeholder:text-slate-400"
                placeholder="Search students, fees, logs..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => {
                  if (searchQuery.trim().length >= 2) setSearchOpen(true);
                }}
              />
              {searchOpen && (
                <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-lg shadow-indigo-100/50">
                  {searchLoading ? (
                    <p className="px-3 py-3 text-center text-[12px] text-slate-500">Searching...</p>
                  ) : searchResults.students.length === 0 && searchResults.payments.length === 0 ? (
                    <p className="px-3 py-3 text-center text-[12px] text-slate-500">No matches found.</p>
                  ) : (
                    <div className="max-h-96 overflow-y-auto py-1">
                      {searchResults.students.length > 0 ? (
                        <div>
                          <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-sky-500">
                            Students
                          </p>
                          {searchResults.students.map((student) => (
                            <button
                              key={student.id}
                              type="button"
                              onClick={() => goToStudent(student.id)}
                              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-sky-50"
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
                          <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-500">
                            Payments
                          </p>
                          {searchResults.payments.map((payment) => (
                            <button
                              key={payment.id}
                              type="button"
                              onClick={goToFees}
                              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-emerald-50"
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
                className="relative inline-grid size-9 place-items-center rounded-xl bg-violet-100 text-violet-600 shadow-sm shadow-violet-100 transition hover:bg-violet-200/80"
              >
                <BellIcon sx={{ fontSize: 20 }} />
                {unreadCount > 0 ? (
                  <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-[#eef1fb]" />
                ) : null}
              </button>
              {bellOpen && (
                <div className="absolute right-0 mt-3 w-[380px] overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-lg shadow-indigo-100/50">
                  <div className="flex items-center justify-between gap-3 border-b border-indigo-50 bg-gradient-to-r from-violet-50 to-white px-3 py-2">
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
                              className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-violet-50/70"
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
            <div className="hidden items-center gap-2 rounded-xl border border-indigo-100/80 bg-white/70 px-2 py-1 shadow-sm shadow-indigo-100/40 sm:flex">
              <InitialsAvatar name={fullName || "Admin User"} photoUrl={user.avatarUrl ? assetUrl(user.avatarUrl) : undefined} size={32} />
              <span className="text-[12.5px] font-semibold text-slate-700">{fullName || "Admin User"}</span>
              <ExpandMoreOutlined sx={{ fontSize: 16 }} className="text-indigo-300" />
            </div>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
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
    <div className="flex shrink-0 flex-col justify-between gap-3 pb-1 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">{eyebrow}</p>
        <h1 className="mt-0.5 text-[22px] font-bold leading-tight text-slate-900">{title}</h1>
        {description ? <p className="mt-1 text-[13px] text-slate-500">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
