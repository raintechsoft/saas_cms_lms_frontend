import { FamilyRestroomRounded, ShieldRounded } from "@mui/icons-material";
import { PARENT_PRIMARY, PARENT_PRIMARY_DARK } from "../ParentPortalLayout";

export function StayConnectedCard({ childName }: { childName: string }) {
  return (
    <div
      className="relative flex flex-col gap-2.5 overflow-hidden rounded-2xl p-3.5"
      style={{ background: `linear-gradient(135deg, #EEF2FF, #E0E7FF)` }}
    >
      <div
        className="absolute -right-5 -top-5 grid size-20 place-items-center rounded-full opacity-90"
        style={{ background: `linear-gradient(135deg, ${PARENT_PRIMARY}, ${PARENT_PRIMARY_DARK})` }}
      >
        <FamilyRestroomRounded sx={{ fontSize: 28, color: "#FFFFFF" }} />
      </div>
      <div
        className="grid size-9 place-items-center rounded-xl"
        style={{ background: `linear-gradient(135deg, ${PARENT_PRIMARY}, ${PARENT_PRIMARY_DARK})` }}
      >
        <ShieldRounded sx={{ fontSize: 18, color: "#FFFFFF" }} />
      </div>
      <div>
        <h2 className="text-[13.5px] font-bold leading-snug text-[#1A1A2E]">
          Stay connected with {childName}&apos;s learning journey
        </h2>
        <p className="mt-1 text-[12px] leading-snug text-[#4B5563]">
          Check updates regularly and help {childName.split(" ")[0]} stay ahead.
        </p>
      </div>
    </div>
  );
}
