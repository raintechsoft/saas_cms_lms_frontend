import { useEffect, type ReactNode } from "react";
import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { applyBrandingToDocument, parseBranding } from "../lib/branding";
import { assetUrl } from "../lib/api";
import { getCampusNavForMode } from "../lib/productMode";

const PORTAL_ROLES = ["STUDENT", "PARENT"];
const STAFF_ROLES = ["INSTITUTION_ADMIN", "TEACHER", "ACCOUNTANT", "STAFF", "UNIVERSE_SUPER_ADMIN", "RESELLER_ADMIN"];

export function isPortalUser(roles: string[] = []) {
  return roles.some((role) => PORTAL_ROLES.includes(role)) && !roles.some((role) => STAFF_ROLES.includes(role));
}

export function isPlatformUser(permissions: string[] = []) {
  return permissions.includes("platform.manage");
}

function staffPanelTitle(roles: string[] = []) {
  if (roles.includes("TEACHER")) return "Teacher Panel";
  if (roles.includes("ACCOUNTANT")) return "Accountant Panel";
  if (roles.includes("INSTITUTION_ADMIN")) return "Admin Panel";
  return "Staff Panel";
}

const navIcons: Record<string, string> = {
  "/dashboard": "HM",
  "/profile": "PR",
  "/students": "ST",
  "/academics": "AC",
  "/attendance": "AT",
  "/notices": "NT",
  "/exams": "EX",
  "/timetable": "TT",
  "/homework": "HW",
  "/fees": "FE",
  "/hr": "HR",
  "/documents": "DC",
  "/erp": "ER",
  "/reports": "RP",
  "/users": "US",
  "/settings": "SE",
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

  return (
    <div className="min-h-screen bg-[#eef2f7] text-slate-900 lg:flex">
      <aside className="border-b border-[#0b1c33] bg-[#0f2744] text-white lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:border-b-0">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="" className="size-9 rounded-full object-cover ring-2 ring-teal-400/40" />
          ) : (
            <div className="grid size-9 place-items-center rounded-full bg-teal-500 font-bold text-white shadow-lg shadow-teal-500/30">
              {(branding.logoText || user.tenant?.name || "U").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold tracking-wide">{panelTitle}</p>
            <p className="text-[11px] text-slate-300">{branding.logoText || user.tenant?.name || "SaaS CMS LMS"}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          {user.avatarUrl ? (
            <img
              src={assetUrl(user.avatarUrl)}
              alt=""
              className="size-11 rounded-full object-cover ring-2 ring-teal-400/50"
            />
          ) : (
            <div className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-slate-200 to-slate-400 text-sm font-bold text-slate-700">
              {user.firstName[0]}
              {user.lastName?.[0] ?? ""}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {user.lastName}, {user.firstName}
            </p>
            <p className="truncate text-[11px] text-slate-300">
              {user.roles[0]?.replaceAll("_", " ") ?? "Staff"}
            </p>
          </div>
        </div>

        <nav className="flex flex-1 gap-1 overflow-x-auto p-3 lg:block lg:space-y-1 lg:overflow-y-auto">
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-teal-500 text-white shadow-md shadow-teal-500/25"
                    : "text-slate-200 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <span className="grid size-7 place-items-center rounded-md bg-white/10 text-[10px] font-bold">
                {navIcons[to] ?? label.slice(0, 1)}
              </span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
          >
            <span className="grid size-7 place-items-center rounded-md bg-white/10 text-[10px] font-bold">OUT</span>
            Logout
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:ml-64">
        <header className="flex h-16 items-center justify-between border-b border-slate-200/80 bg-[#f4f7fb] px-6">
          <div className="inline-flex items-center gap-2.5 rounded-xl bg-[#0f2744] px-3.5 py-2 text-white shadow-sm shadow-slate-900/10">
            <span className="grid size-7 place-items-center rounded-lg bg-teal-500 text-[10px] font-bold">
              {(user.tenant?.name ?? "U").slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-300">Campus</p>
              <p className="text-sm font-bold leading-tight">
                {user.tenant?.name ?? "Campus Management System"}
              </p>
            </div>
          </div>
          <div className="hidden rounded-xl bg-white px-3.5 py-2 text-right shadow-sm ring-1 ring-slate-200/80 sm:block">
            <p className="text-sm font-semibold text-slate-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}

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
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-sm font-semibold text-teal-600">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
      </div>
      {action}
    </div>
  );
}
