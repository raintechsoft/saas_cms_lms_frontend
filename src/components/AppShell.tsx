import type { ComponentType } from "react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  NotificationsNoneOutlined,
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
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { applyBrandingToDocument, parseBranding } from "../lib/branding";
import { assetUrl } from "../lib/api";
import { CAMPUS_NAV, getCampusNavForMode, type NavSection } from "../lib/productMode";
import { InitialsAvatar } from "./InitialsAvatar";

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
  const { user, isAuthenticated, logout } = useAuth();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const location = useLocation();
  const breadcrumb = useBreadcrumb();
  const branding = parseBranding(user?.tenant?.branding);

  useEffect(() => {
    applyBrandingToDocument(branding);
  }, [branding.primaryColor, branding.logoText]);

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
            <div className="relative hidden sm:block">
              <SearchOutlined sx={{ fontSize: 18 }} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="nx-input w-72 !rounded-lg !border-[#dfe1e4] !bg-white pl-9"
                placeholder="Search students, fees, logs..."
              />
            </div>
            <button type="button" className="relative grid size-9 place-items-center rounded-lg text-slate-500 transition hover:bg-white">
              <NotificationsNoneOutlined sx={{ fontSize: 21 }} />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-rose-500" />
            </button>
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
