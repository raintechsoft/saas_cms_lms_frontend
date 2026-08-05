import { useState } from "react";
import {
  DirectionsBusFilledOutlined,
  PersonOutlined,
  PhoneOutlined,
  ScheduleOutlined,
} from "@mui/icons-material";
import { Switch } from "@mui/material";
import { notifySuccess } from "../../lib/notify";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_SUBTLE } from "./ParentPortalLayout";
import { useParentPortal } from "./ParentPortalContext";
import { PageHeader } from "./components/PageHeader";
import { StatusChip } from "./components/StatusChip";

const TRANSPORT = {
  busNumber: "MH-12-AB-4521",
  routeName: "Route B — Koregaon Park",
  driverName: "Suresh Patil",
  driverPhone: "+91 98765 43210",
  etaPickup: "7 mins",
  etaDrop: "18 mins",
  status: "On route",
};

export function ParentTransportPage() {
  const { activeChild } = useParentPortal();
  const [notifyNear, setNotifyNear] = useState(true);

  return (
    <div>
      <PageHeader
        title="Transport Tracking"
        subtitle={`Live bus status for ${activeChild.name.split(" ")[0]}`}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
        <div
          className="relative min-h-[420px] overflow-hidden rounded-[20px] border bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
          style={{ borderColor: PARENT_BORDER }}
        >
          {/* Map placeholder — ready for map library integration */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(160deg, #EEF2FF 0%, #F0FDF4 40%, #F8FAFC 70%, #DBEAFE 100%)",
            }}
          >
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(#CBD5E1 1px, transparent 1px), linear-gradient(90deg, #CBD5E1 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
          </div>

          <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-xl border bg-white/95 px-3 py-2 shadow-sm" style={{ borderColor: PARENT_BORDER }}>
            <DirectionsBusFilledOutlined sx={{ fontSize: 18, color: PARENT_PRIMARY }} />
            <span className="text-[12.5px] font-bold text-[#1A1A2E]">{TRANSPORT.busNumber}</span>
            <StatusChip label={TRANSPORT.status} tone="green" />
          </div>

          <svg className="absolute inset-0 z-[1] h-full w-full" viewBox="0 0 800 420" preserveAspectRatio="none" aria-hidden>
            <path
              d="M80 320 C 180 280, 220 180, 320 160 S 480 200, 560 140 S 700 80, 740 120"
              fill="none"
              stroke={PARENT_PRIMARY}
              strokeWidth="4"
              strokeDasharray="10 8"
              opacity="0.55"
            />
            <circle cx="80" cy="320" r="8" fill="#16A34A" />
            <circle cx="740" cy="120" r="8" fill="#DC2626" />
          </svg>

          <div
            className="absolute z-[2] grid size-12 place-items-center rounded-full text-white shadow-lg"
            style={{
              left: "42%",
              top: "38%",
              background: PARENT_PRIMARY,
              transform: "translate(-50%, -50%)",
            }}
            title="Bus location"
          >
            <DirectionsBusFilledOutlined sx={{ fontSize: 26 }} />
          </div>

          <div className="absolute bottom-4 left-4 z-10 rounded-xl border bg-white/95 px-3 py-2 text-[11.5px] text-[#6B7280]" style={{ borderColor: PARENT_BORDER }}>
            Map placeholder — connect Google Maps / Mapbox later
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div
            className="rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
            style={{ borderColor: PARENT_BORDER }}
          >
            <h2 className="text-[15px] font-bold text-[#1A1A2E]">Bus Details</h2>
            <p className="mt-1 text-[12.5px] text-[#6B7280]">{TRANSPORT.routeName}</p>

            <dl className="mt-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="grid size-9 place-items-center rounded-xl"
                  style={{ background: PARENT_PRIMARY_SUBTLE, color: PARENT_PRIMARY }}
                >
                  <DirectionsBusFilledOutlined sx={{ fontSize: 18 }} />
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Bus number</dt>
                  <dd className="text-[13.5px] font-bold text-[#1A1A2E]">{TRANSPORT.busNumber}</dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="grid size-9 place-items-center rounded-xl"
                  style={{ background: PARENT_PRIMARY_SUBTLE, color: PARENT_PRIMARY }}
                >
                  <PersonOutlined sx={{ fontSize: 18 }} />
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Driver</dt>
                  <dd className="text-[13.5px] font-bold text-[#1A1A2E]">{TRANSPORT.driverName}</dd>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="grid size-9 place-items-center rounded-xl"
                  style={{ background: PARENT_PRIMARY_SUBTLE, color: PARENT_PRIMARY }}
                >
                  <PhoneOutlined sx={{ fontSize: 18 }} />
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Contact</dt>
                  <dd className="text-[13.5px] font-bold text-[#1A1A2E]">{TRANSPORT.driverPhone}</dd>
                </div>
              </div>
            </dl>
          </div>

          <div
            className="rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
            style={{ borderColor: PARENT_BORDER }}
          >
            <div className="mb-3 flex items-center gap-2">
              <ScheduleOutlined sx={{ fontSize: 20, color: PARENT_PRIMARY }} />
              <h2 className="text-[15px] font-bold text-[#1A1A2E]">ETA</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border p-3" style={{ borderColor: PARENT_BORDER }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Pickup</p>
                <p className="mt-1 text-[20px] font-extrabold" style={{ color: PARENT_PRIMARY }}>
                  {TRANSPORT.etaPickup}
                </p>
              </div>
              <div className="rounded-xl border p-3" style={{ borderColor: PARENT_BORDER }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Drop</p>
                <p className="mt-1 text-[20px] font-extrabold text-[#1A1A2E]">{TRANSPORT.etaDrop}</p>
              </div>
            </div>
          </div>

          <div
            className="flex items-center justify-between gap-3 rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
            style={{ borderColor: PARENT_BORDER }}
          >
            <div>
              <p className="text-[13.5px] font-bold text-[#1A1A2E]">Notify me when bus is 10 mins away</p>
              <p className="mt-0.5 text-[12px] text-[#6B7280]">Push + SMS alert before pickup</p>
            </div>
            <Switch
              checked={notifyNear}
              onChange={(_, checked) => {
                setNotifyNear(checked);
                notifySuccess(checked ? "Proximity alerts enabled" : "Proximity alerts disabled");
              }}
              sx={{
                "& .MuiSwitch-switchBase.Mui-checked": { color: PARENT_PRIMARY },
                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: PARENT_PRIMARY },
              }}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
