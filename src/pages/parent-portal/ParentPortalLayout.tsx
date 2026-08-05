import { Fragment, useEffect, useState } from "react";
import {
  KeyboardArrowDownRounded,
  ChevronLeftRounded,
  ExpandMoreRounded,
  LogoutOutlined,
  NotificationsOutlined,
  PersonOutlined,
  SchoolRounded,
  SearchOutlined,
  SettingsOutlined,
} from "@mui/icons-material";
import { Menu, MenuItem, Divider } from "@mui/material";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { InitialsAvatar } from "../../components/InitialsAvatar";
import { PARENT_NAV } from "./parentPortalNav";
import { ParentPortalProvider, useParentPortal } from "./ParentPortalContext";

export const PARENT_PRIMARY = "#4F46E5";
export const PARENT_PRIMARY_DARK = "#4338CA";
export const PARENT_PRIMARY_SUBTLE = "#EEF2FF";
export const PARENT_BORDER = "#E5E7EB";
export const PARENT_MUTED = "#6B7280";
export const PARENT_TEXT = "#111827";
export const PARENT_BG = "#F5F6FA";
export const PARENT_SIDEBAR = "#4F46E5";
export const PARENT_SIDEBAR_DARK = "#4338CA";

const SIDEBAR_WIDTH = 272;
const SIDEBAR_WIDTH_COLLAPSED = 80;
/** Fixed columns so every row lines up: icon | label | chevron */
const ICON_COL = 22;
const CHEVRON_COL = 18;
const ROW_H = 40;
const CHILD_ROW_H = 32;
const NOTIFICATION_COUNT = 5;

function activeGroupForPath(pathname: string) {
  const group = PARENT_NAV.find((item) => item.children?.some((leaf) => pathname.startsWith(leaf.to)));
  return group?.key ?? null;
}

function Sidebar({ collapsed, onToggleCollapsed }: { collapsed: boolean; onToggleCollapsed: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  /** Only one parent group open at a time */
  const [expandedGroup, setExpandedGroup] = useState<string | null>(() =>
    collapsed ? null : activeGroupForPath(location.pathname),
  );

  useEffect(() => {
    if (collapsed) {
      setExpandedGroup(null);
      return;
    }
    const group = activeGroupForPath(location.pathname);
    // Keep the active section open; never open a second group
    if (group) setExpandedGroup(group);
  }, [location.pathname, collapsed]);

  const toggleGroup = (key: string, firstChildTo?: string) => {
    if (collapsed && firstChildTo) {
      navigate(firstChildTo);
      return;
    }
    setExpandedGroup((current) => (current === key ? null : key));
  };

  const width = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH;

  return (
    <aside className="relative z-20 hidden shrink-0 transition-[width] duration-200 lg:block" style={{ width }}>
      <div
        className="fixed left-0 top-0 flex h-screen flex-col overflow-hidden text-white transition-[width] duration-200"
        style={{ width, background: PARENT_SIDEBAR }}
      >
        {/* Brand */}
        <div
          className={`flex h-[68px] shrink-0 items-center border-b border-white/10 ${
            collapsed ? "justify-center" : "gap-3 px-4"
          }`}
        >
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#4F46E5]">
            <SchoolRounded sx={{ fontSize: 22 }} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold leading-snug text-white">Bright Future School</p>
              <p className="mt-0.5 text-[11px] font-medium text-white/60">Parent Portal</p>
            </div>
          )}
        </div>

        {/*
          Equal gaps: flex spacers between the 9 parents (always).
          Children sit inline under the open parent — spacers shrink evenly so icons/labels stay aligned.
          Only one parent's children render at a time.
        */}
        <nav className={`flex min-h-0 flex-1 flex-col ${collapsed ? "px-2" : "px-3"}`}>
          <ul className="flex h-full min-h-0 flex-col py-2">
            {PARENT_NAV.map((item, index) => {
              const Icon = item.icon;
              const isGroup = Boolean(item.children);
              const isExpanded = !collapsed && isGroup && expandedGroup === item.key;
              const isGroupActive =
                isGroup && item.children!.some((leaf) => location.pathname.startsWith(leaf.to));

              return (
                <Fragment key={item.key}>
                  {index > 0 && (
                    <li aria-hidden className="pointer-events-none min-h-[2px] flex-1" />
                  )}
                  <li className="shrink-0">
                    {isGroup ? (
                      <button
                        type="button"
                        onClick={() => toggleGroup(item.key, item.children?.[0]?.to)}
                        title={item.label}
                        aria-expanded={isExpanded}
                        className={[
                          "flex w-full items-center rounded-xl text-[13px] font-semibold transition-colors",
                          collapsed ? "mx-auto justify-center" : "gap-3 px-3",
                          isGroupActive || isExpanded
                            ? "bg-white/15 text-white"
                            : "text-white/90 hover:bg-white/10",
                        ].join(" ")}
                        style={{ height: ROW_H, width: collapsed ? ROW_H : "100%" }}
                      >
                        <span
                          className="grid shrink-0 place-items-center"
                          style={{ width: ICON_COL, height: ICON_COL }}
                        >
                          <Icon sx={{ fontSize: 20 }} />
                        </span>
                        {!collapsed && (
                          <>
                            <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                            <span
                              className="grid shrink-0 place-items-center"
                              style={{ width: CHEVRON_COL }}
                            >
                              <ExpandMoreRounded
                                sx={{
                                  fontSize: 18,
                                  opacity: 0.85,
                                  transition: "transform 180ms ease",
                                  transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                }}
                              />
                            </span>
                          </>
                        )}
                      </button>
                    ) : (
                      <NavLink
                        to={item.to!}
                        end={item.to === "/parent/dashboard"}
                        title={item.label}
                        onClick={() => setExpandedGroup(null)}
                        className={({ isActive }) =>
                          [
                            "flex items-center rounded-xl text-[13px] font-semibold transition-colors",
                            collapsed ? "mx-auto justify-center" : "w-full gap-3 px-3",
                            isActive ? "bg-white text-[#4F46E5] shadow-sm" : "text-white/90 hover:bg-white/10",
                          ].join(" ")
                        }
                        style={{ height: ROW_H, width: collapsed ? ROW_H : "100%" }}
                      >
                        {({ isActive }) => (
                          <>
                            <span
                              className="grid shrink-0 place-items-center"
                              style={{ width: ICON_COL, height: ICON_COL }}
                            >
                              <Icon sx={{ fontSize: 20, color: isActive ? PARENT_PRIMARY : "currentColor" }} />
                            </span>
                            {!collapsed && (
                              <>
                                <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                                <span className="shrink-0" style={{ width: CHEVRON_COL }} aria-hidden />
                              </>
                            )}
                          </>
                        )}
                      </NavLink>
                    )}

                    {isExpanded && item.children && (
                      <ul
                        className="mt-1 flex flex-col gap-0.5 border-l border-white/25 pl-2.5"
                        style={{ marginLeft: ICON_COL + 12 }}
                      >
                        {item.children.map((leaf) => (
                          <li key={leaf.to}>
                            <NavLink
                              to={leaf.to}
                              className={({ isActive }) =>
                                [
                                  "relative flex items-center rounded-lg px-2.5 text-[12px] font-semibold transition-colors",
                                  "before:absolute before:-left-[11px] before:top-1/2 before:size-1.5 before:-translate-y-1/2 before:rounded-full",
                                  isActive
                                    ? "bg-white text-[#4F46E5] shadow-sm before:bg-white"
                                    : "text-white/75 before:bg-white/40 hover:bg-white/10 hover:text-white",
                                ].join(" ")
                              }
                              style={{ height: CHILD_ROW_H }}
                            >
                              <span className="truncate leading-snug">{leaf.label}</span>
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ul>
        </nav>

        {/* Collapse */}
        <div className={`shrink-0 border-t border-white/10 py-3 ${collapsed ? "px-2" : "px-3"}`}>
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={[
              "flex items-center rounded-xl text-[13px] font-semibold text-white/85 transition-colors hover:bg-white/10",
              collapsed ? "mx-auto justify-center" : "w-full gap-3 px-3",
            ].join(" ")}
            style={{ height: ROW_H, width: collapsed ? ROW_H : "100%" }}
          >
            <span className="grid shrink-0 place-items-center" style={{ width: ICON_COL, height: ICON_COL }}>
              <ChevronLeftRounded
                sx={{
                  fontSize: 22,
                  transition: "transform 180ms ease",
                  transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 truncate text-left">Collapse</span>
                <span className="shrink-0" style={{ width: CHEVRON_COL }} aria-hidden />
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

function ChildSwitcher() {
  const { children, activeChild, activeChildIndex, setActiveChildIndex } = useParentPortal();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={(event) => setAnchorEl(event.currentTarget)}
        className="flex shrink-0 items-center gap-2.5 rounded-2xl border bg-white px-2 py-1.5 pr-3 transition hover:bg-[#F5F6FA]"
        style={{ borderColor: PARENT_BORDER }}
      >
        <InitialsAvatar name={activeChild.name} photoUrl={activeChild.photoUrl} size={36} />
        <div className="hidden text-left sm:block">
          <p className="text-[13px] font-bold leading-tight text-[#1A1A2E]">{activeChild.name}</p>
          <p className="text-[11px] leading-tight text-[#6B7280]">
            {activeChild.className} - {activeChild.section}
          </p>
        </div>
        <KeyboardArrowDownRounded sx={{ fontSize: 18 }} className="text-[#9CA3AF]" />
      </button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {children.map((child, index) => (
          <MenuItem
            key={child.id}
            selected={index === activeChildIndex}
            onClick={() => {
              setActiveChildIndex(index);
              setAnchorEl(null);
            }}
            className="gap-2.5"
          >
            <InitialsAvatar name={child.name} photoUrl={child.photoUrl} size={28} />
            <div>
              <p className="text-[13px] font-semibold leading-tight text-[#1A1A2E]">{child.name}</p>
              <p className="text-[11px] leading-tight text-[#6B7280]">
                {child.className} - {child.section}
              </p>
            </div>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function ProfileMenu() {
  const { parent } = useParentPortal();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleLogout = () => {
    setAnchorEl(null);
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <>
      <button
        type="button"
        onClick={(event) => setAnchorEl(event.currentTarget)}
        className="flex shrink-0 items-center gap-2 rounded-2xl py-1 pl-1 pr-2.5 transition hover:bg-[#F5F6FA] sm:pr-3"
      >
        <InitialsAvatar name={parent.name} photoUrl={parent.photoUrl} size={36} />
        <div className="hidden text-left sm:block">
          <p className="text-[13px] font-semibold leading-tight text-[#1A1A2E]">{parent.name}</p>
          <p className="text-[11px] leading-tight text-[#6B7280]">{parent.role}</p>
        </div>
        <KeyboardArrowDownRounded sx={{ fontSize: 18 }} className="hidden text-[#9CA3AF] sm:block" />
      </button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            navigate("/parent/settings");
          }}
          className="gap-2"
        >
          <PersonOutlined sx={{ fontSize: 18 }} /> My Profile
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout} className="gap-2 text-red-600">
          <LogoutOutlined sx={{ fontSize: 18 }} /> Logout
        </MenuItem>
      </Menu>
    </>
  );
}

function TopBar() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header
      className="flex h-16 items-center gap-3 border-b bg-white px-5"
      style={{ borderColor: PARENT_BORDER }}
    >
      <ChildSwitcher />

      <div
        className="mx-auto hidden min-w-0 max-w-[440px] flex-1 items-center gap-2 rounded-xl border px-3.5 py-2 sm:flex"
        style={{ borderColor: "#E8EAF0", background: PARENT_BG }}
      >
        <SearchOutlined sx={{ fontSize: 18 }} className="shrink-0 text-[#9CA3AF]" />
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search anything..."
          className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-[#1A1A2E] outline-none placeholder:text-[#9CA3AF]"
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <NavLink
          to="/parent/notifications"
          className="relative grid size-9 place-items-center rounded-xl transition hover:bg-[#F5F6FA]"
          title="Notifications"
        >
          <NotificationsOutlined sx={{ fontSize: 20 }} style={{ color: PARENT_PRIMARY }} />
          {NOTIFICATION_COUNT > 0 && (
            <span className="absolute right-0.5 top-0.5 grid min-w-[16px] place-items-center rounded-full bg-[#3B82F6] px-1 text-[10px] font-bold leading-[16px] text-white">
              {NOTIFICATION_COUNT}
            </span>
          )}
        </NavLink>
        <NavLink
          to="/parent/settings"
          className="grid size-9 place-items-center rounded-xl transition hover:bg-[#F5F6FA]"
          title="Settings"
        >
          <SettingsOutlined sx={{ fontSize: 20 }} className="text-[#6B7280]" />
        </NavLink>
        <ProfileMenu />
      </div>
    </header>
  );
}

function ParentPortalShellInner() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen" style={{ background: PARENT_BG }}>
      <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((v) => !v)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20">
          <TopBar />
        </div>
        <main className="min-w-0 flex-1 px-5 py-4">
          <div className="mx-auto w-full max-w-[1168px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export function ParentPortalLayout() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.roles.includes("PARENT")) {
    return <Navigate to={user.roles.includes("STUDENT") ? "/portal/student" : "/dashboard"} replace />;
  }

  return (
    <ParentPortalProvider>
      <ParentPortalShellInner />
    </ParentPortalProvider>
  );
}
