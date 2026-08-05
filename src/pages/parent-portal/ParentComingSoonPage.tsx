import { ConstructionRounded } from "@mui/icons-material";
import { useLocation } from "react-router-dom";
import { PARENT_NAV } from "./parentPortalNav";
import { PARENT_BORDER, PARENT_PRIMARY_SUBTLE } from "./ParentPortalLayout";

function labelForPath(pathname: string) {
  for (const item of PARENT_NAV) {
    if (item.to === pathname) return item.label;
    const leaf = item.children?.find((child) => child.to === pathname);
    if (leaf) return leaf.label;
  }
  return "This page";
}

export function ParentComingSoonPage() {
  const location = useLocation();
  const label = labelForPath(location.pathname);

  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 rounded-[20px] border bg-white p-10 text-center shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
      style={{ borderColor: PARENT_BORDER }}
    >
      <div className="grid size-14 place-items-center rounded-2xl" style={{ background: PARENT_PRIMARY_SUBTLE }}>
        <ConstructionRounded sx={{ fontSize: 28 }} className="text-[#4F46E5]" />
      </div>
      <h1 className="text-lg font-bold text-[#1A1A2E]">{label}</h1>
      <p className="max-w-sm text-sm text-[#6B7280]">This section is coming soon. Check back after it's wired up.</p>
    </div>
  );
}
