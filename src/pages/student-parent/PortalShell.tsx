import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AccountBalanceWalletOutlined,
  AssignmentOutlined,
  AutoAwesomeOutlined,
  CalendarMonthOutlined,
  DarkModeOutlined,
  EmojiEventsOutlined,
  FolderOutlined,
  GridViewRounded,
  LightModeOutlined,
  LiveTvOutlined,
  LogoutOutlined,
  MenuBookOutlined,
  NotificationsOutlined,
  PersonOutlined,
  PieChartOutlineOutlined,
  SearchOutlined,
  SettingsOutlined,
  TrackChangesOutlined,
} from "@mui/icons-material";
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { isPortalUser } from "../../components/AppShell";
import { InitialsAvatar } from "../../components/InitialsAvatar";
import { apiRequest, assetUrl } from "../../lib/api";
import { applyBrandingToDocument, parseBranding } from "../../lib/branding";
import { PortalProvider } from "./PortalContext";
import { PortalPushPrompt } from "./PortalPushPrompt";
import { PORTAL_CHILD_STORAGE_KEY, type PortalOverview } from "./portalTypes";

const PRIMARY = "#534AB7";
const PRIMARY_SUBTLE = "#EEF0FD";
/** Narrow icon rail — icons only. */
const SIDEBAR_WIDTH = 76;

type NavBadgeKey = "notices" | "homework" | "fees" | "exams" | "live" | "documents";
type BadgeStyle = "dot" | "count" | "countPink" | "new";

interface NavItem {
  to: string;
  label: string;
  icon: typeof GridViewRounded;
  end: boolean;
  badgeKey?: NavBadgeKey;
  badgeStyle?: BadgeStyle;
  bucket?: "CMS" | "LMS" | "SHARED";
}

/** Exact Figma student-portal icon set (node 183). Always show full Figma set. */
function getNavItems(basePath: string, _productMode: PortalOverview["productMode"]) {
  void _productMode;
  return [
    { to: basePath, label: "Dashboard", icon: GridViewRounded, end: true },
    { to: `${basePath}/profile`, label: "My Profile", icon: PersonOutlined, end: false },
    { to: `${basePath}/attendance`, label: "Attendance", icon: PieChartOutlineOutlined, end: false, bucket: "CMS" as const },
    { to: `${basePath}/timetable`, label: "Timetable", icon: CalendarMonthOutlined, end: false, bucket: "LMS" as const },
    {
      to: `${basePath}/fees`,
      label: "Fees",
      icon: AccountBalanceWalletOutlined,
      end: false,
      badgeKey: "fees" as const,
      badgeStyle: "dot" as const,
      bucket: "CMS" as const,
    },
    {
      to: `${basePath}/homework`,
      label: "Homework",
      icon: AssignmentOutlined,
      end: false,
      badgeKey: "homework" as const,
      badgeStyle: "count" as const,
      bucket: "SHARED" as const,
    },
    {
      to: `${basePath}/exams`,
      label: "Exams & Results",
      icon: EmojiEventsOutlined,
      end: false,
      badgeKey: "exams" as const,
      badgeStyle: "new" as const,
      bucket: "CMS" as const,
    },
    {
      to: `${basePath}/live-classes`,
      label: "Live Classes",
      icon: LiveTvOutlined,
      end: false,
      badgeKey: "live" as const,
      badgeStyle: "dot" as const,
      bucket: "LMS" as const,
    },
    {
      to: `${basePath}/ncert`,
      label: "NCERT Content",
      icon: MenuBookOutlined,
      end: false,
      bucket: "LMS" as const,
    },
    { to: `${basePath}/ai-tutor`, label: "AI Tutor", icon: AutoAwesomeOutlined, end: false, bucket: "LMS" as const },
    {
      to: `${basePath}/test-series`,
      label: "Online Exams",
      icon: TrackChangesOutlined,
      end: false,
      bucket: "CMS" as const,
    },
    {
      to: `${basePath}/documents`,
      label: "Documents",
      icon: FolderOutlined,
      end: false,
      badgeKey: "documents" as const,
      badgeStyle: "dot" as const,
      bucket: "CMS" as const,
    },
    {
      to: `${basePath}/notices`,
      label: "Notices",
      icon: NotificationsOutlined,
      end: false,
      badgeKey: "notices" as const,
      badgeStyle: "countPink" as const,
    },
  ] satisfies NavItem[];
}

function readStoredChildIndex(max: number) {
  if (max <= 0) return 0;
  try {
    const raw = localStorage.getItem(PORTAL_CHILD_STORAGE_KEY);
    const index = raw ? Number.parseInt(raw, 10) : 0;
    if (Number.isFinite(index) && index >= 0 && index < max) return index;
  } catch {
    /* ignore */
  }
  return 0;
}

function NavBadge({ count, style }: { count: number; style?: BadgeStyle }) {
  if (style === "dot") {
    if (count <= 0) return null;
    return (
      <span className="absolute right-1 top-1 size-1.5 rounded-full bg-[#EF4444] ring-[1.5px] ring-[#534AB7]" />
    );
  }
  if (style === "new") {
    if (count <= 0) return null;
    return (
      <span className="absolute -right-0.5 -top-0.5 rounded-[4px] bg-[#22C55E] px-1 py-px text-[7px] font-extrabold leading-none tracking-wide text-white">
        NEW
      </span>
    );
  }
  if (count <= 0) return null;
  const bg = style === "countPink" ? "#F472B6" : "#F59E0B";
  return (
    <span
      className="absolute -right-0.5 -top-0.5 grid min-w-[14px] place-items-center rounded-full px-0.5 text-[8px] font-bold leading-[14px] text-white"
      style={{ background: bg }}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function PortalShell() {
  const { user, isAuthenticated, accessToken, logout } = useAuth();
  const location = useLocation();
  const isParentPath = location.pathname.startsWith("/portal/parent");
  const basePath = isParentPath ? "/portal/parent" : "/portal/student";
  const expectedRole = isParentPath ? "PARENT" : "STUDENT";

  const branding = parseBranding(user?.tenant?.branding);
  const [overview, setOverview] = useState<PortalOverview | null>(null);
  const [activeChild, setActiveChildState] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDark, setIsDark] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const reload = useCallback(async () => {
    try {
      setError("");
      const data = await apiRequest<PortalOverview>("/portal/overview", accessToken);
      setOverview(data);
      setActiveChildState((current) => {
        const stored = readStoredChildIndex(data.children.length);
        return current >= 0 && current < data.children.length ? current : stored;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load portal");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    applyBrandingToDocument(branding);
  }, [branding.primaryColor, branding.logoText]);

  useEffect(() => {
    if (accessToken) void reload();
  }, [accessToken, reload]);

  const setActiveChild = useCallback((index: number) => {
    setActiveChildState(index);
    try {
      localStorage.setItem(PORTAL_CHILD_STORAGE_KEY, String(index));
    } catch {
      /* ignore */
    }
  }, []);

  const navItems = useMemo(
    () => getNavItems(basePath, overview?.productMode ?? user?.tenant?.productMode ?? null),
    [basePath, overview?.productMode, user?.tenant?.productMode],
  );

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  if (!isPortalUser(user.roles)) return <Navigate to="/dashboard" replace />;

  const isParentUser = user.roles.includes("PARENT");
  if (isParentUser && !isParentPath) return <Navigate to="/parent/dashboard" replace />;
  if (!isParentUser && isParentPath) return <Navigate to="/portal/student" replace />;

  const child = overview?.children[activeChild] ?? null;
  const role = overview?.role ?? expectedRole;

  const contextValue = {
    overview,
    activeChild,
    setActiveChild,
    child,
    reload,
    accessToken,
    role,
    productMode: overview?.productMode ?? user?.tenant?.productMode ?? null,
    canSubmitHomework: overview?.canSubmitHomework ?? false,
    loading,
    error,
    basePath,
  };

  const badgeCounts = {
    notices: overview?.notices.length ?? 0,
    homework:
      child?.homework.filter((item) => !item.submission || item.submission.status === "RESUBMIT_REQUESTED").length ?? 0,
    fees: child?.fees && child.fees.totals.balance > 0 ? 1 : 0,
    exams: child?.exams.length ? 1 : 0,
    live: 0,
    documents: 0,
  };

  const currentNav = navItems.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
  );
  const pageTitle = currentNav?.label === "Dashboard" || !currentNav ? "Dashboard" : currentNav.label;

  const fullName = `${user.firstName} ${user.lastName ?? ""}`.trim();
  const classLabel = child?.enrollment
    ? `Class ${child.enrollment.className} - ${child.enrollment.section}`
    : role;

  return (
    <PortalProvider value={contextValue}>
      <div className="flex min-h-screen bg-[#F6F7F9] text-[#1A1A1A]">
        {/* Icon rail — even spacing, clean active state */}
        <aside className="relative z-20 hidden shrink-0 lg:block" style={{ width: SIDEBAR_WIDTH }}>
          <div
            className="fixed left-0 top-0 flex h-screen flex-col items-center"
            style={{
              width: SIDEBAR_WIDTH,
              background: PRIMARY,
              borderTopRightRadius: 28,
              borderBottomRightRadius: 28,
              paddingTop: 20,
              paddingBottom: 20,
            }}
          >
            <nav className="flex min-h-0 w-full flex-1 flex-col items-center justify-evenly px-2">
              {navItems.map(({ to, label, icon: Icon, end, badgeKey, badgeStyle }) => {
                const count = badgeKey ? badgeCounts[badgeKey] : 0;
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    aria-label={label}
                    className={({ isActive }) =>
                      `group relative grid size-10 shrink-0 place-items-center rounded-xl transition-colors duration-150 ${
                        isActive
                          ? "bg-white text-[#534AB7]"
                          : "text-white/85 hover:bg-white/10 hover:text-white"
                      }`
                    }
                  >
                    <Icon sx={{ fontSize: 20 }} />
                    <NavBadge count={count} style={badgeStyle} />
                    <span
                      className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#1A1A1A] px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
                      role="tooltip"
                    >
                      {label}
                      <span className="absolute left-0 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[#1A1A1A]" />
                    </span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-1 flex w-full flex-col items-center gap-2 px-2 pt-2">
              <span className="h-px w-8 rounded-full bg-white/20" />
              <button
                type="button"
                aria-label="Logout"
                onClick={logout}
                className="group relative grid size-10 shrink-0 place-items-center rounded-xl text-white/85 transition-colors duration-150 hover:bg-white/10 hover:text-white"
              >
                <LogoutOutlined sx={{ fontSize: 20 }} />
                <span
                  className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#1A1A1A] px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
                  role="tooltip"
                >
                  Logout
                  <span className="absolute left-0 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[#1A1A1A]" />
                </span>
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-20 px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6 lg:pt-5">
            <header className="flex min-h-[64px] items-center gap-3 rounded-[20px] border border-[#E5E7EB] bg-white px-3 py-2.5 shadow-[0_4px_18px_rgba(28,27,60,0.04)] sm:gap-4 sm:px-4 lg:px-5">
              <div className="shrink-0 rounded-2xl px-2 py-1.5 sm:px-3">
                <p className="text-[16px] font-bold leading-tight text-[#1A1A1A] sm:text-[18px]">{pageTitle}</p>
                <div className="mt-1 h-[3px] w-10 rounded-full" style={{ background: PRIMARY }} />
              </div>

              <div className="mx-auto hidden min-w-0 max-w-[440px] flex-1 items-center gap-2 rounded-2xl border border-[#E8EAF0] bg-[#F6F7F9] px-3.5 py-2.5 sm:flex">
                <SearchOutlined sx={{ fontSize: 18 }} className="shrink-0 text-[#9CA3AF]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search anything..."
                  className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-[#1A1A1A] outline-none placeholder:text-[#9CA3AF]"
                />
                <span className="shrink-0 rounded-lg border border-[#E8EAF0] bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#9CA3AF]">
                  ⌘K
                </span>
              </div>

              {isParentUser && overview && overview.children.length > 1 ? (
                <div className="hidden items-center gap-1.5 rounded-2xl border border-[#E8EAF0] bg-[#F6F7F9] p-1 md:flex">
                  {overview.children.map((item, index) => (
                    <button
                      key={item.student.id}
                      type="button"
                      onClick={() => setActiveChild(index)}
                      className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${
                        index === activeChild ? "text-white shadow-sm" : "text-[#6B7280] hover:bg-white"
                      }`}
                      style={index === activeChild ? { background: PRIMARY } : undefined}
                    >
                      {item.student.firstName}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsDark((v) => !v)}
                  className="hidden items-center gap-0.5 rounded-2xl border border-[#E8EAF0] p-1 text-[12px] font-semibold sm:flex"
                  style={{ background: PRIMARY_SUBTLE }}
                  title="Theme (visual toggle)"
                >
                  <span
                    className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 transition ${!isDark ? "text-white" : "text-[#6B7280]"}`}
                    style={!isDark ? { background: PRIMARY } : undefined}
                  >
                    <LightModeOutlined sx={{ fontSize: 14 }} /> Light
                  </span>
                  <span
                    className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 transition ${isDark ? "text-white" : "text-[#6B7280]"}`}
                    style={isDark ? { background: PRIMARY } : undefined}
                  >
                    <DarkModeOutlined sx={{ fontSize: 14 }} /> Dark
                  </span>
                </button>

                <NavLink
                  to={`${basePath}/notifications`}
                  className="relative grid size-10 place-items-center rounded-2xl border border-[#E8EAF0] bg-[#F6F7F9] text-[#6B7280] transition hover:bg-white hover:text-[#534AB7]"
                  title="Notifications"
                >
                  <NotificationsOutlined sx={{ fontSize: 19 }} />
                  {badgeCounts.notices > 0 ? (
                    <span
                      className="absolute right-1 top-1 grid min-w-[15px] place-items-center rounded-full px-1 text-[9px] font-bold leading-[15px] text-white"
                      style={{ background: PRIMARY }}
                    >
                      {badgeCounts.notices > 9 ? "9+" : badgeCounts.notices}
                    </span>
                  ) : null}
                </NavLink>
                <NavLink
                  to={`${basePath}/settings`}
                  className="grid size-10 place-items-center rounded-2xl border border-[#E8EAF0] bg-[#F6F7F9] text-[#6B7280] transition hover:bg-white hover:text-[#534AB7]"
                  title="Settings"
                >
                  <SettingsOutlined sx={{ fontSize: 19 }} />
                </NavLink>

                <div className="flex items-center gap-2 rounded-2xl border border-[#E8EAF0] bg-[#F6F7F9] py-1 pl-1 pr-2.5 sm:pr-3">
                  <InitialsAvatar
                    name={fullName || "User"}
                    photoUrl={user.avatarUrl ? assetUrl(user.avatarUrl) : undefined}
                    size={34}
                  />
                  <div className="hidden text-left sm:block">
                    <p className="text-[12.5px] font-semibold leading-tight text-[#1A1A1A]">{fullName || "User"}</p>
                    <p className="text-[10.5px] leading-tight text-[#6B7280]">{classLabel}</p>
                  </div>
                </div>
              </div>
            </header>
          </div>

          {/* Mobile nav strip — same Figma items */}
          <div className="mx-3 mt-3 flex gap-2 overflow-x-auto rounded-[20px] border border-[#E5E7EB] bg-white px-3 py-2 shadow-[0_4px_18px_rgba(28,27,60,0.04)] sm:mx-4 lg:hidden lg:mx-6">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold ${
                    isActive ? "bg-[#534AB7] text-white" : "bg-[#F6F7F9] text-[#6B7280]"
                  }`
                }
              >
                <Icon sx={{ fontSize: 14 }} />
                {label}
              </NavLink>
            ))}
          </div>

          <main className="min-w-0 flex-1 px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
            {error && <p className="alert-error mb-4">{error}</p>}
            {!loading && overview ? (
              <PortalPushPrompt accessToken={accessToken} userId={user.id} />
            ) : null}
            {loading && !overview ? (
              <p className="text-sm text-[#6B7280]">Loading your portal…</p>
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </div>
    </PortalProvider>
  );
}
