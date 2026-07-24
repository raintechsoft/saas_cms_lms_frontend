import type { ComponentType } from "react";
import { useEffect, type ReactNode } from "react";
import {
  AssignmentOutlined,
  BadgeOutlined,
  CalendarMonthOutlined,
  CampaignOutlined,
  DashboardOutlined,
  EventNoteOutlined,
  GroupsOutlined,
  LogoutOutlined,
  MenuBookOutlined,
  PaymentsOutlined,
  PersonOutlined,
  QuizOutlined,
  SchoolOutlined,
  SettingsOutlined,
  SummarizeOutlined,
  TuneOutlined,
  WorkOutlineOutlined,
} from "@mui/icons-material";
import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { applyBrandingToDocument, parseBranding } from "../lib/branding";
import { assetUrl } from "../lib/api";
import { getCampusNavForMode } from "../lib/productMode";

const PORTAL_ROLES = ["STUDENT", "PARENT"];
const STAFF_ROLES = ["INSTITUTION_ADMIN", "TEACHER", "ACCOUNTANT", "STAFF", "UNIVERSE_SUPER_ADMIN", "RESELLER_ADMIN"];

/** Thumb-friendly icon size (~44px hit area with padding). */
const NAV_ICON_SX = { fontSize: 28 };

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

export function AppShell() {
  const { user, isAuthenticated, logout } = useAuth();
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

  const panelTitle = staffPanelTitle(user.roles);
  const schoolName = branding.logoText || user.tenant?.name || "SaaS CMS LMS";

  return (
    <div className="min-h-screen bg-[#edf1f7] text-slate-900 lg:flex">
      {/* Desktop-style fixed sidebar */}
      <aside className="border-b border-[#0b1c33] bg-[#0b1f36] text-white lg:fixed lg:inset-y-0 lg:flex lg:w-60 lg:flex-col lg:border-b-0 lg:border-r lg:border-[#071526]">
        <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-3">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="" className="size-9 rounded object-cover" />
          ) : (
            <div className="grid size-9 place-items-center rounded bg-[#2563eb] text-sm font-bold text-white">
              {schoolName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-tight">{schoolName}</p>
            <p className="truncate text-[10px] text-slate-400">{panelTitle} panel</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 border-b border-white/10 px-3 py-3">
          {user.avatarUrl ? (
            <img src={assetUrl(user.avatarUrl)} alt="" className="size-10 rounded object-cover" />
          ) : (
            <div className="grid size-10 place-items-center rounded bg-slate-600 text-sm font-bold text-white">
              {user.firstName[0]}
              {user.lastName?.[0] ?? ""}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">
              {user.lastName}, {user.firstName}
            </p>
            <p className="truncate text-[11px] text-slate-400">
              {user.roles[0]?.replaceAll("_", " ") ?? "Staff"}
            </p>
          </div>
        </div>

        <nav className="flex flex-1 gap-1 overflow-x-auto p-2 lg:block lg:space-y-1 lg:overflow-y-auto">
          {links.map(({ to, label }) => {
            const Icon = navIcons[to] ?? DashboardOutlined;
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 whitespace-nowrap rounded-md px-2.5 py-2 text-[13px] font-medium transition ${
                    isActive
                      ? "bg-[#2563eb] text-white"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <Icon sx={NAV_ICON_SX} className="shrink-0 opacity-95" />
                {label}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-2">
          <button
            type="button"
            onClick={logout}
            className="flex min-h-11 w-full items-center gap-3 rounded-md px-2.5 py-2 text-[13px] font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <LogoutOutlined sx={NAV_ICON_SX} className="shrink-0" />
            Logout
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:ml-60">
        {/* Flat top toolbar */}
        <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-slate-200 bg-white px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:inline">
              Campus
            </span>
            <span className="hidden text-slate-300 sm:inline">|</span>
            <p className="truncate text-[13px] font-semibold text-slate-800">
              {user.tenant?.name ?? "Campus Management System"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[12px] font-semibold leading-tight text-slate-800">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[10px] text-slate-500">{user.email}</p>
            </div>
            <div className="grid size-9 place-items-center rounded bg-[#2563eb] text-xs font-bold text-white">
              {user.firstName[0]}
              {user.lastName?.[0] ?? ""}
            </div>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}

/** Compact desktop page title bar (Vyapar-style density). */
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
    <div className="flex flex-col justify-between gap-2 border-b border-slate-200 pb-3 sm:flex-row sm:items-center">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{eyebrow}</p>
        <h1 className="text-lg font-semibold leading-tight text-slate-900">{title}</h1>
        {description ? (
          <p className="mt-0.5 truncate text-[12px] text-slate-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
