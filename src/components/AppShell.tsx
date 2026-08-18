import type { ComponentType } from "react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AccessTimeOutlined,
  AssignmentOutlined,
  AutoAwesomeOutlined,
  BadgeOutlined,
  BarChartOutlined,
  CalendarMonthOutlined,
  CampaignOutlined,
  DashboardOutlined,
  DescriptionOutlined,
  FactCheckOutlined,
  DirectionsBusOutlined,
  ExpandMoreOutlined,
  EventAvailableOutlined,
  GridViewRounded,
  GroupsOutlined,
  HelpOutlineOutlined,
  HomeWorkOutlined,
  Inventory2Outlined,
  LibraryBooksOutlined,
  LogoutOutlined,
  MenuBookOutlined,
  MicOutlined,
  NotificationsActiveOutlined,
  NotificationsOutlined,
  PaymentsOutlined,
  PersonOutlined,
  PlayCircleOutlined,
  PresentToAllOutlined,
  QuizOutlined,
  SchoolOutlined,
  SearchOutlined,
  SettingsOutlined,
  TrackChangesOutlined,
  TrendingUpOutlined,
  TuneOutlined,
  VideocamOutlined,
  WorkOutlineOutlined,
} from "@mui/icons-material";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { applyBrandingToDocument, parseBranding } from "../lib/branding";
import { apiRequest, assetUrl } from "../lib/api";
import {
  CAMPUS_NAV,
  NAV_SECTION_LABEL,
  isCampusNavItemVisible,
  isProductBucketAllowed,
} from "../lib/productMode";
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

function useBreadcrumb() {
  const location = useLocation();
  const { user } = useAuth();
  return useMemo(() => {
    const path = location.pathname;
    if (path === "/cms") return ["Dashboard", "CMS"];
    if (path === "/lms") return ["Dashboard", "LMS"];

    const match = [...CAMPUS_NAV]
      .filter((item) => path === item.to || path.startsWith(`${item.to}/`))
      .sort((a, b) => b.to.length - a.to.length)[0];

    if (!match) return ["Dashboard"];

    if (match.section === "top") {
      return match.to === "/dashboard" ? ["Dashboard"] : ["Dashboard", match.label];
    }

    const trail = ["Dashboard", NAV_SECTION_LABEL[match.section], match.label];

    if (match.to === "/students") {
      if (path === "/students/new") trail.push("Add Student");
      else if (path !== "/students" && /^\/students\/[^/]+$/.test(path)) trail.push("Student Profile");
    }
    return trail;
  }, [location.pathname, user?.tenant?.productMode]);
}

const navIcons: Record<string, NavIcon> = {
  "/dashboard": GridViewRounded,
  "/results-performance": TrendingUpOutlined,
  "/students": SchoolOutlined,
  "/academics": MenuBookOutlined,
  "/timetable": AccessTimeOutlined,
  "/attendance": EventAvailableOutlined,
  "/fees": PaymentsOutlined,
  "/documents": BadgeOutlined,
  "/academic-calendar": CalendarMonthOutlined,
  "/lesson-planning": AssignmentOutlined,
  "/homework": DescriptionOutlined,
  "/live-classes": VideocamOutlined,
  "/classroom-management": PresentToAllOutlined,
  "/video-gallery": PlayCircleOutlined,
  "/ai-tutor": AutoAwesomeOutlined,
  "/voice-ai-agent": MicOutlined,
  "/ncert-content": LibraryBooksOutlined,
  "/question-bank": HelpOutlineOutlined,
  "/test-series": BarChartOutlined,
  "/exams": QuizOutlined,
  "/online-exams": FactCheckOutlined,
  "/preparation-practice": TrackChangesOutlined,
  "/transport": DirectionsBusOutlined,
  "/hostel": HomeWorkOutlined,
  "/library": MenuBookOutlined,
  "/inventory": Inventory2Outlined,
  "/users": GroupsOutlined,
  "/hr": WorkOutlineOutlined,
  "/notices": CampaignOutlined,
  "/erp": TuneOutlined,
  "/lms-settings": TuneOutlined,
  "/profile": PersonOutlined,
  "/notifications": NotificationsOutlined,
  "/settings": SettingsOutlined,
};

const navIconTone: Record<string, string> = {
  "/dashboard": "bg-[#EEF2FF] text-[#6366F1]",
  "/results-performance": "bg-[#FFEDD5] text-[#F97316]",
  "/students": "bg-[#DBEAFE] text-[#3B82F6]",
  "/academics": "bg-[#DBEAFE] text-[#3B82F6]",
  "/timetable": "bg-[#DBEAFE] text-[#3B82F6]",
  "/attendance": "bg-[#FEF3C7] text-[#F59E0B]",
  "/fees": "bg-[#CCFBF1] text-[#14B8A6]",
  "/documents": "bg-[#FEE2E2] text-[#EF4444]",
  "/academic-calendar": "bg-[#EEF2FF] text-[#6366F1]",
  "/lesson-planning": "bg-[#DBEAFE] text-[#3B82F6]",
  "/homework": "bg-[#D1FAE5] text-[#10B981]",
  "/live-classes": "bg-[#FEE2E2] text-[#EF4444]",
  "/classroom-management": "bg-[#FEE2E2] text-[#EF4444]",
  "/video-gallery": "bg-[#FEE2E2] text-[#EF4444]",
  "/ai-tutor": "bg-[#F3E8FF] text-[#8B5CF6]",
  "/voice-ai-agent": "bg-[#F3E8FF] text-[#8B5CF6]",
  "/ncert-content": "bg-[#D1FAE5] text-[#10B981]",
  "/question-bank": "bg-[#CCFBF1] text-[#14B8A6]",
  "/test-series": "bg-[#FFEDD5] text-[#F97316]",
  "/exams": "bg-[#FCE7F3] text-[#EC4899]",
  "/online-exams": "bg-[#F3E8FF] text-[#8B5CF6]",
  "/preparation-practice": "bg-[#FFEDD5] text-[#F97316]",
  "/transport": "bg-[#ECFCCB] text-[#84CC16]",
  "/hostel": "bg-[#FFEDD5] text-[#F97316]",
  "/library": "bg-[#CCFBF1] text-[#14B8A6]",
  "/inventory": "bg-[#F3F4F6] text-[#6B7280]",
  "/users": "bg-[#F3F4F6] text-[#6B7280]",
  "/hr": "bg-[#F3F4F6] text-[#6B7280]",
  "/notices": "bg-[#FFEDD5] text-[#F97316]",
  "/erp": "bg-[#EDE9FE] text-[#534AB7]",
  "/lms-settings": "bg-[#EDE9FE] text-[#534AB7]",
  "/profile": "bg-[#F3F4F6] text-[#6B7280]",
  "/notifications": "bg-[#F3E8FF] text-[#8B5CF6]",
  "/settings": "bg-[#F3F4F6] text-[#6B7280]",
};

function ModuleIconChip({ to, Icon }: { to: string; Icon: NavIcon }) {
  const tone = navIconTone[to] ?? "bg-[#F3F4F6] text-[#6B7280]";
  return (
    <span className={`inline-grid size-5 shrink-0 place-items-center rounded-md ${tone}`}>
      <Icon sx={{ fontSize: 13 }} />
    </span>
  );
}

function SidebarNavLink({
  to,
  label,
  size,
  unreadCount = 0,
}: {
  to: string;
  label: string;
  size: "dashboard" | "child";
  unreadCount?: number;
}) {
  const Icon = navIcons[to] ?? DashboardOutlined;
  const isNotifications = to === "/notifications";
  return (
    <NavLink
      to={to}
      end={to !== "/students" && to !== "/hostel"}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-lg px-4 transition ${
          size === "dashboard" ? "h-10 text-[14px]" : "h-9 text-[13px]"
        } ${
          isActive
            ? "bg-[#EEF2FF] font-semibold text-[#4F46E5]"
            : "font-medium text-[#374151] hover:bg-[#F6F7F9]"
        }`
      }
    >
      <span className="relative inline-flex">
        <ModuleIconChip to={to} Icon={Icon} />
        {isNotifications && unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 size-2 rounded-full bg-rose-500 ring-2 ring-white" />
        ) : null}
      </span>
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

function ModuleAccordion({
  label,
  to,
  items,
  childActive,
  headerIcon: HeaderIcon,
  headerTone,
}: {
  label: string;
  to: string;
  items: Array<{ to: string; label: string }>;
  childActive: boolean;
  headerIcon: NavIcon;
  headerTone: string;
}) {
  const location = useLocation();
  const headerActive = location.pathname === to;
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (childActive || headerActive) setOpen(true);
  }, [childActive, headerActive]);

  const restBg = headerActive
    ? "bg-[#EEF2FF]"
    : open
      ? "bg-[#F6F7F9]"
      : "hover:bg-[#F6F7F9]";

  return (
    <div>
      <div className={`flex h-10 items-center rounded-lg ${headerActive ? "bg-[#EEF2FF]" : open ? "bg-[#F6F7F9]" : ""}`}>
        <NavLink
          to={to}
          end
          className={`flex h-10 min-w-0 flex-1 items-center gap-2 rounded-l-lg pl-4 pr-2 text-[14px] font-semibold transition ${
            headerActive ? "text-[#4F46E5]" : `text-[#1A1A1A] ${open ? "" : "hover:bg-[#F6F7F9]"}`
          }`}
        >
          <span className={`inline-grid size-5 shrink-0 place-items-center rounded-md ${headerTone}`}>
            <HeaderIcon sx={{ fontSize: 13 }} />
          </span>
          <span className="min-w-0 flex-1 truncate">{label}</span>
        </NavLink>
        <button
          type="button"
          aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
          onClick={() => setOpen((current) => !current)}
          className={`flex h-10 w-9 shrink-0 items-center justify-center rounded-r-lg ${restBg}`}
        >
          <ExpandMoreOutlined
            sx={{ fontSize: 18 }}
            className={`text-[#9CA3AF] transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {open && items.length > 0 ? (
        <div className="mt-0.5 space-y-0.5 pl-4">
          {items.map((item) => (
            <SidebarNavLink key={item.to} to={item.to} label={item.label} size="child" />
          ))}
        </div>
      ) : null}
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
  const links = CAMPUS_NAV.filter((item) =>
    isCampusNavItemVisible(item, {
      productMode: user.tenant?.productMode,
      permissions: user.permissions ?? [],
      moduleSettings: user.moduleSettings ?? [],
      panelField,
    }),
  );

  const topLinks = links.filter((item) => item.section === "top");
  const cmsLinks = links.filter((item) => item.section === "cms");
  const lmsLinks = links.filter((item) => item.section === "lms");
  const showCms = isProductBucketAllowed(user.tenant?.productMode, "CMS");
  const showLms = isProductBucketAllowed(user.tenant?.productMode, "LMS");
  const isCmsChildActive = cmsLinks.some(
    (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  );
  const isLmsChildActive = lmsLinks.some(
    (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  );

  const panelTitle = staffPanelTitle(user.roles);
  const schoolName = branding.logoText || user.tenant?.name || "vsop";
  const fullName = `${user.firstName} ${user.lastName ?? ""}`.trim();
  const initials = (fullName || "AU")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-screen min-h-0 bg-[#F6F7F9] text-[#1A1A1A] lg:flex">
      <aside className="flex w-full flex-col border-b border-[#E5E7EB] bg-white lg:fixed lg:inset-y-0 lg:h-screen lg:w-[260px] lg:border-b-0 lg:border-r lg:border-[#E5E7EB]">
        {/* Header — 72px */}
        <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-[#E5E7EB] px-4">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="" className="size-8 rounded-lg object-cover" />
          ) : (
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#534AB7] text-white">
              <GridViewRounded sx={{ fontSize: 18 }} />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold leading-tight text-[#1A1A1A]">{schoolName}</p>
            <p className="truncate text-[12px] leading-tight text-[#9CA3AF]">{panelTitle} panel</p>
          </div>
        </div>

        {/* Scrollable nav body */}
        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto py-2">
          <p className="mt-3 px-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF]">
            Dashboard
          </p>
          <div className="mt-1 space-y-0.5">
            {topLinks.map((item) => (
              <SidebarNavLink
                key={item.to}
                to={item.to}
                label={item.label}
                size="dashboard"
                unreadCount={unreadCount}
              />
            ))}
          </div>

          {showCms ? (
            <div className="mt-2">
              <ModuleAccordion
                label="CMS Modules"
                to="/cms"
                items={cmsLinks}
                childActive={isCmsChildActive}
                headerIcon={SchoolOutlined}
                headerTone="bg-[#EEF2FF] text-[#6366F1]"
              />
            </div>
          ) : null}

          {showLms ? (
            <div className="mt-2">
              <ModuleAccordion
                label="LMS Modules"
                to="/lms"
                items={lmsLinks}
                childActive={isLmsChildActive}
                headerIcon={CalendarMonthOutlined}
                headerTone="bg-[#CCFBF1] text-[#14B8A6]"
              />
            </div>
          ) : null}
        </nav>

        {/* Footer — fixed */}
        <div className="relative shrink-0 border-t border-[#E5E7EB] p-3">
          {accountMenuOpen && (
            <div className="absolute inset-x-3 bottom-[calc(100%+4px)] rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-lg">
              <Link
                to="/profile"
                onClick={() => setAccountMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-[#374151] hover:bg-[#F6F7F9]"
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
            className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left transition hover:bg-[#F6F7F9]"
          >
            {user.avatarUrl ? (
              <InitialsAvatar
                name={fullName || "Admin User"}
                photoUrl={assetUrl(user.avatarUrl)}
                size={32}
              />
            ) : (
              <span className="inline-grid size-8 shrink-0 place-items-center rounded-full bg-[#534AB7] text-[11px] font-bold text-white">
                {initials || "AU"}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-[#374151]">{user.email}</p>
              <p className="truncate text-[11px] text-[#9CA3AF]">{schoolName}</p>
            </div>
            <ExpandMoreOutlined sx={{ fontSize: 16 }} className="shrink-0 text-[#9CA3AF]" />
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:ml-[260px]">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
            {breadcrumb.map((crumb, index) => (
              <span key={`${crumb}-${index}`} className="flex items-center gap-1.5">
                {index > 0 && <span className="text-[#D1D5DB]">/</span>}
                <span
                  className={
                    index === breadcrumb.length - 1
                      ? "font-semibold text-[#1A1A1A]"
                      : "font-medium text-[#9CA3AF]"
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
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
              />
              <input
                className="nx-input w-72 !rounded-xl !border-[#E5E7EB] !bg-[#F6F7F9] pl-9 placeholder:text-[#9CA3AF]"
                placeholder="Search students, classes, subjects..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onFocus={() => {
                  if (searchQuery.trim().length >= 2) setSearchOpen(true);
                }}
              />
              {searchOpen && (
                <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-lg">
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
