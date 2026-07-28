import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { isPortalUser } from "../../components/AppShell";
import { apiRequest, assetUrl } from "../../lib/api";
import { applyBrandingToDocument, parseBranding } from "../../lib/branding";
import { isProductBucketAllowed } from "../../lib/productMode";
import { PortalProvider } from "./PortalContext";
import { PortalPushPrompt } from "./PortalPushPrompt";
import { PORTAL_CHILD_STORAGE_KEY, type PortalOverview } from "./portalTypes";

function getNavItems(basePath: string, productMode: PortalOverview["productMode"]) {
  const items = [
    { to: basePath, label: "Home", icon: "HM", end: true },
    { to: `${basePath}/profile`, label: "Update Profile", icon: "PR", end: false },
    { to: `${basePath}/notices`, label: "Notices", icon: "NT", end: false },
    { to: `${basePath}/attendance`, label: "Attendance", icon: "AT", end: false },
    { to: `${basePath}/leave`, label: "Leave", icon: "LV", end: false },
    { to: `${basePath}/exams`, label: "Exams", icon: "EX", end: false },
  ];
  if (isProductBucketAllowed(productMode, "LMS")) {
    items.push({ to: `${basePath}/timetable`, label: "Timetable", icon: "TT", end: false });
    items.push({ to: `${basePath}/homework`, label: "Homework", icon: "HW", end: false });
  }
  if (isProductBucketAllowed(productMode, "CMS")) {
    items.push({ to: `${basePath}/fees`, label: "Fees", icon: "FE", end: false });
    items.push({ to: `${basePath}/documents`, label: "Documents", icon: "DC", end: false });
  }
  return items;
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
  if (isParentUser && !isParentPath) return <Navigate to="/portal/parent" replace />;
  if (!isParentUser && isParentPath) return <Navigate to="/portal/student" replace />;

  const child = overview?.children[activeChild] ?? null;
  const role = overview?.role ?? expectedRole;
  const panelTitle = role === "PARENT" ? "Parent Panel" : "Student Panel";

  const contextValue = {
    overview,
    activeChild,
    setActiveChild,
    child,
    reload,
    accessToken,
    role,
    productMode: overview?.productMode ?? user.tenant?.productMode ?? null,
    canSubmitHomework: overview?.canSubmitHomework ?? false,
    loading,
    error,
    basePath,
  };

  return (
    <PortalProvider value={contextValue}>
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
              <p className="text-[11px] text-slate-300">
                {branding.logoText || user.tenant?.name || "SaaS CMS LMS"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
            {(role === "STUDENT" ? child?.student.photoUrl : null) || user.avatarUrl ? (
              <img
                src={assetUrl((role === "STUDENT" ? child?.student.photoUrl : null) || user.avatarUrl)}
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
              <p className="truncate text-[11px] text-slate-300">{user.email}</p>
            </div>
          </div>

          <nav className="flex flex-1 gap-1 overflow-x-auto p-3 lg:block lg:space-y-1 lg:overflow-y-auto">
            {navItems.map(({ to, label, icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-teal-500 text-white shadow-md shadow-teal-500/25"
                      : "text-slate-200 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <span className="grid size-7 place-items-center rounded-md bg-white/10 text-[10px] font-bold">
                  {icon}
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
          <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 bg-[#f4f7fb] px-6 py-3">
            <div className="flex flex-wrap items-center gap-3">
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
              {role === "PARENT" && overview && overview.children.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {overview.children.map((item, index) => (
                    <button
                      key={item.student.id}
                      type="button"
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                        index === activeChild
                          ? "bg-teal-500 text-white shadow-sm"
                          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                      }`}
                      onClick={() => setActiveChild(index)}
                    >
                      {item.student.firstName} {item.student.lastName}
                      {item.relation ? ` · ${item.relation}` : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl bg-white px-3.5 py-2 text-right shadow-sm ring-1 ring-slate-200/80">
              <p className="text-sm font-semibold text-slate-900">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-6 py-8">
            {error && <p className="alert-error mb-4">{error}</p>}
            {!loading && overview ? (
              <PortalPushPrompt accessToken={accessToken} userId={user.id} />
            ) : null}
            {loading && !overview ? (
              <p className="text-sm text-slate-500">Loading your portal…</p>
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </div>
    </PortalProvider>
  );
}
