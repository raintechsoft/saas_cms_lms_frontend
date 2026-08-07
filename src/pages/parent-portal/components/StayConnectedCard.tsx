import { ShieldRounded } from "@mui/icons-material";
import { Link } from "react-router-dom";
import { PARENT_PRIMARY } from "../ParentPortalLayout";

export function StayConnectedCard({ childName }: { childName: string }) {
  const first = childName.split(" ")[0] || childName;
  return (
    <section
      className="rounded-2xl px-4 py-4"
      style={{ background: "linear-gradient(145deg, #EEF2FF 0%, #E0E7FF 100%)" }}
    >
      <div
        className="grid size-9 place-items-center rounded-xl"
        style={{ background: PARENT_PRIMARY }}
      >
        <ShieldRounded sx={{ fontSize: 18, color: "#FFFFFF" }} />
      </div>
      <h2 className="mt-3 text-[14px] font-bold leading-snug text-[#111827]">
        Stay on top of {first}&apos;s progress
      </h2>
      <p className="mt-1.5 text-[12.5px] leading-snug text-[#4B5563]">
        Check attendance, homework, and fees regularly so nothing slips through.
      </p>
      <Link
        to="/parent/academics/homework"
        className="mt-3 inline-flex text-[12.5px] font-bold text-[#4F46E5] hover:underline"
      >
        Review homework →
      </Link>
    </section>
  );
}
