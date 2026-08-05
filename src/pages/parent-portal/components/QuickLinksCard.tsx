import {
  DescriptionOutlined,
  ConfirmationNumberOutlined,
  ReceiptLongOutlined,
  EventBusyOutlined,
} from "@mui/icons-material";
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
    <div
      className="flex flex-col rounded-2xl border bg-white p-3.5 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
      style={{ borderColor: PARENT_BORDER }}
    >
      <h2 className="mb-2.5 text-[14px] font-bold text-[#1A1A2E]">Quick Links</h2>
      <div className="grid grid-cols-2 gap-2">
        {links.map((link) => {
          const Icon = ICON_MAP[link.icon];
          const colors = COLOR_MAP[link.icon];
          return (
            <button
              key={link.id}
              type="button"
              className="flex flex-col items-start gap-1.5 rounded-xl border p-2.5 text-left transition hover:bg-[#F5F6FA]"
              style={{ borderColor: PARENT_BORDER }}
            >
              <div className="grid size-8 place-items-center rounded-lg" style={{ background: colors.bg }}>
                <Icon sx={{ fontSize: 16, color: colors.text }} />
              </div>
              <span className="text-[11.5px] font-semibold leading-tight text-[#1A1A2E]">{link.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
