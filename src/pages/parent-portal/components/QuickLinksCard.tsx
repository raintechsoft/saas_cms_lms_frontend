import {
  DescriptionOutlined,
  ConfirmationNumberOutlined,
  ReceiptLongOutlined,
  EventBusyOutlined,
} from "@mui/icons-material";
import { Link } from "react-router-dom";
import type { QuickLink } from "../types";
import { PARENT_BORDER } from "../ParentPortalLayout";

const ICON_MAP: Record<QuickLink["icon"], typeof DescriptionOutlined> = {
  reportCard: DescriptionOutlined,
  hallTicket: ConfirmationNumberOutlined,
  feeReceipt: ReceiptLongOutlined,
  applyLeave: EventBusyOutlined,
};

const COLOR_MAP: Record<QuickLink["icon"], { bg: string; text: string }> = {
  reportCard: { bg: "#EEF2FF", text: "#4F46E5" },
  hallTicket: { bg: "#DCFCE7", text: "#16A34A" },
  feeReceipt: { bg: "#FFEDD5", text: "#EA580C" },
  applyLeave: { bg: "#FEE2E2", text: "#DC2626" },
};

export function QuickLinksCard({ links }: { links: QuickLink[] }) {
  return (
    <section
      className="rounded-2xl border bg-white shadow-[0_2px_12px_rgba(28,27,60,0.04)]"
      style={{ borderColor: PARENT_BORDER }}
    >
      <div className="border-b px-4 py-3" style={{ borderColor: PARENT_BORDER }}>
        <h2 className="text-[14px] font-bold text-[#111827]">Quick Links</h2>
      </div>
      <div className="grid grid-cols-2 gap-2.5 p-3.5">
        {links.map((link) => {
          const Icon = ICON_MAP[link.icon];
          const colors = COLOR_MAP[link.icon];
          return (
            <Link
              key={link.id}
              to={link.to}
              className="flex flex-col items-start gap-2 rounded-xl border bg-[#FAFBFC] p-3 transition hover:border-[#C7D2FE] hover:bg-[#EEF2FF]"
              style={{ borderColor: PARENT_BORDER }}
            >
              <div
                className="grid size-8 place-items-center rounded-lg"
                style={{ background: colors.bg }}
              >
                <Icon sx={{ fontSize: 16, color: colors.text }} />
              </div>
              <span className="text-[12px] font-semibold leading-snug text-[#111827]">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
