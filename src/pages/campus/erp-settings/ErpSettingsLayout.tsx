import { ArrowBackOutlined } from "@mui/icons-material";
import { Link, NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import { ERP_DEFAULT_SLUG, ERP_SETTINGS_NAV, findErpNavItem } from "./erpNav";

export function ErpSettingsLayout() {
  const params = useParams<{ slug?: string }>();
  const location = useLocation();
  const slugFromPath = location.pathname.replace(/^\/erp\/?/, "").split("/")[0] || ERP_DEFAULT_SLUG;
  const activeSlug = params.slug || slugFromPath || ERP_DEFAULT_SLUG;
  const active = findErpNavItem(activeSlug);

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-background">
      <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-border bg-white">
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3">
          <Link
            to="/dashboard"
            className="inline-flex size-8 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F6F7F9] hover:text-[#1A1A1A]"
            aria-label="Back to dashboard"
          >
            <ArrowBackOutlined sx={{ fontSize: 18 }} />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#1A1A1A]">ERP Settings</p>
            <p className="truncate text-[11px] text-[#6B7280]">Institution configuration</p>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {ERP_SETTINGS_NAV.map((group) => (
            <div key={group.key} className="mb-4">
              <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeSlug === item.slug;
                  return (
                    <li key={item.slug}>
                      <NavLink
                        to={`/erp/${item.slug}`}
                        className={[
                          "block rounded-lg px-2.5 py-2 text-[13px] font-medium transition",
                          isActive
                            ? "bg-primary text-white shadow-sm"
                            : "text-[#6B7280] hover:bg-[#F6F7F9] hover:text-[#1A1A1A]",
                        ].join(" ")}
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet context={{ activeSlug, activeLabel: active?.item.label ?? "Settings" }} />
      </div>
    </div>
  );
}
