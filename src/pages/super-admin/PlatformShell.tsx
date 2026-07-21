import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { isPlatformUser } from "../../components/AppShell";
import { assetUrl } from "../../lib/api";

const nav = [
  { to: "/admin/dashboard", label: "Command Center", icon: "01" },
  { to: "/admin/tenants", label: "Tenants", icon: "02" },
  { to: "/admin/resellers", label: "Resellers", icon: "03" },
  { to: "/admin/users", label: "Users", icon: "04" },
  { to: "/admin/audit", label: "Audit Log", icon: "05" },
  { to: "/admin/settings", label: "Settings", icon: "06" },
  { to: "/admin/profile", label: "Profile", icon: "07" },
] as const;

export function PlatformShell() {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !user) return <Navigate to="/admin/login" replace />;
  if (!isPlatformUser(user.permissions)) return <Navigate to="/dashboard" replace />;

  const crumb = nav.find((item) => location.pathname.startsWith(item.to))?.label ?? "Platform";

  return (
    <div className="min-h-screen bg-[#f7f5f0] text-zinc-900 lg:flex">
      <aside className="border-b border-zinc-800 bg-zinc-950 text-white lg:fixed lg:inset-y-0 lg:flex lg:w-[17rem] lg:flex-col lg:border-b-0 lg:border-r lg:border-zinc-800">
        <div className="flex h-[4.25rem] items-center gap-3 border-b border-zinc-800 px-5">
          <div className="grid size-9 place-items-center rounded-md bg-amber-500 font-black text-zinc-950">
            SC
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-400">SaaS CMS LMS</p>
            <p className="text-sm font-semibold text-zinc-100">Ops Console</p>
          </div>
        </div>

        <div className="border-b border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/80 p-3">
            {user.avatarUrl ? (
              <img
                src={assetUrl(user.avatarUrl)}
                alt=""
                className="size-10 rounded-md object-cover ring-1 ring-amber-500/40"
              />
            ) : (
              <div className="grid size-10 place-items-center rounded-md bg-zinc-700 text-xs font-bold text-amber-300">
                {user.firstName[0]}
                {user.lastName?.[0] ?? ""}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-100">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-[11px] text-zinc-500">Super administrator</p>
            </div>
          </div>
        </div>

        <nav className="flex flex-1 gap-1 overflow-x-auto p-3 lg:block lg:space-y-0.5 lg:overflow-y-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "border border-amber-500/30 bg-amber-500/15 text-amber-300"
                    : "border border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                }`
              }
            >
              <span
                className={`font-mono text-[10px] font-bold tracking-wider ${
                  location.pathname.startsWith(item.to) ? "text-amber-400" : "text-zinc-600"
                }`}
              >
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-zinc-800 p-3">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-sm font-medium text-zinc-400 transition hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100"
          >
            <span className="font-mono text-[10px] font-bold text-zinc-600">OUT</span>
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:ml-[17rem]">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-zinc-200 bg-[#f7f5f0]/95 px-6 py-3 backdrop-blur">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700">
              Platform ops
            </p>
            <p className="text-lg font-semibold tracking-tight text-zinc-900">{crumb}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 sm:inline-flex">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Systems nominal
            </span>
            <div className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-right">
              <p className="text-sm font-semibold text-zinc-900">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[11px] text-zinc-500">{user.email}</p>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
