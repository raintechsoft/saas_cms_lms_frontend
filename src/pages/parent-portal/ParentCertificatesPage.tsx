import { useState } from "react";
import {
  DownloadOutlined,
  EmojiEventsOutlined,
  DescriptionOutlined,
  SwapHorizOutlined,
} from "@mui/icons-material";
import Swal from "sweetalert2";
import { notifySuccess } from "../../lib/notify";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_SUBTLE } from "./ParentPortalLayout";
import { useParentPortal } from "./ParentPortalContext";
import { PageHeader } from "./components/PageHeader";
import { StatusChip } from "./components/StatusChip";

type CertType = "Bonafide" | "Transfer Certificate" | "Achievement Certificate";
type RequestStatus = "Requested" | "Approved" | "Ready";

interface CertRequest {
  id: string;
  type: CertType;
  requestedOn: string;
  status: RequestStatus;
}

const CERT_CARDS: {
  type: CertType;
  description: string;
  icon: typeof DescriptionOutlined;
}[] = [
  {
    type: "Bonafide",
    description: "Official school enrolment certificate for bank, visa, or other formal use.",
    icon: DescriptionOutlined,
  },
  {
    type: "Transfer Certificate",
    description: "Required when changing schools. Issued after clearance of dues.",
    icon: SwapHorizOutlined,
  },
  {
    type: "Achievement Certificate",
    description: "Recognition for academic, sports, or co-curricular excellence.",
    icon: EmojiEventsOutlined,
  },
];

const INITIAL_REQUESTS: CertRequest[] = [
  { id: "cr1", type: "Bonafide", requestedOn: "12 May 2025", status: "Ready" },
  { id: "cr2", type: "Achievement Certificate", requestedOn: "20 May 2025", status: "Approved" },
  { id: "cr3", type: "Transfer Certificate", requestedOn: "28 May 2025", status: "Requested" },
];

const STATUS_TONE: Record<RequestStatus, "orange" | "blue" | "green"> = {
  Requested: "orange",
  Approved: "blue",
  Ready: "green",
};

export function ParentCertificatesPage() {
  const { activeChild } = useParentPortal();
  const [requests, setRequests] = useState(INITIAL_REQUESTS);

  async function requestCertificate(type: CertType) {
    const result = await Swal.fire({
      title: `Request ${type}?`,
      text: `Submit a request for ${type} for ${activeChild.name}?`,
      showCancelButton: true,
      confirmButtonText: "Submit request",
      confirmButtonColor: PARENT_PRIMARY,
      cancelButtonColor: "#9CA3AF",
    });
    if (!result.isConfirmed) return;

    setRequests((prev) => [
      {
        id: `cr-${Date.now()}`,
        type,
        requestedOn: new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        status: "Requested",
      },
      ...prev,
    ]);
    notifySuccess(`${type} request submitted`);
  }

  function downloadCert(req: CertRequest) {
    notifySuccess(`Downloading ${req.type}…`);
  }

  return (
    <div>
      <PageHeader
        title="Certificates"
        subtitle={`Request and download certificates for ${activeChild.name.split(" ")[0]}`}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {CERT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.type}
              className="flex flex-col rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
              style={{ borderColor: PARENT_BORDER }}
            >
              <div
                className="mb-3 grid size-12 place-items-center rounded-2xl"
                style={{ background: PARENT_PRIMARY_SUBTLE, color: PARENT_PRIMARY }}
              >
                <Icon sx={{ fontSize: 24 }} />
              </div>
              <h2 className="text-[15px] font-bold text-[#1A1A2E]">{card.type}</h2>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-[#6B7280]">{card.description}</p>
              <button
                type="button"
                onClick={() => requestCertificate(card.type)}
                className="mt-4 h-10 rounded-xl text-[13px] font-bold text-white"
                style={{ background: PARENT_PRIMARY }}
              >
                Request
              </button>
            </div>
          );
        })}
      </div>

      <div
        className="overflow-hidden rounded-[20px] border bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
        style={{ borderColor: PARENT_BORDER }}
      >
        <div className="border-b px-5 py-4" style={{ borderColor: PARENT_BORDER }}>
          <h2 className="text-[15px] font-bold text-[#1A1A2E]">Past Requests</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b bg-[#F9FAFB] text-[12px] font-bold uppercase tracking-wide text-[#6B7280]" style={{ borderColor: PARENT_BORDER }}>
                <th className="px-5 py-3">Certificate</th>
                <th className="px-5 py-3">Requested On</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="border-b last:border-b-0" style={{ borderColor: PARENT_BORDER }}>
                  <td className="px-5 py-3.5 text-[13.5px] font-semibold text-[#1A1A2E]">{req.type}</td>
                  <td className="px-5 py-3.5 text-[13px] text-[#6B7280]">{req.requestedOn}</td>
                  <td className="px-5 py-3.5">
                    <StatusChip label={req.status} tone={STATUS_TONE[req.status]} />
                  </td>
                  <td className="px-5 py-3.5">
                    {req.status === "Ready" ? (
                      <button
                        type="button"
                        onClick={() => downloadCert(req)}
                        className="inline-flex items-center gap-1 text-[12.5px] font-semibold hover:underline"
                        style={{ color: PARENT_PRIMARY }}
                      >
                        <DownloadOutlined sx={{ fontSize: 16 }} />
                        Download
                      </button>
                    ) : (
                      <span className="text-[12.5px] text-[#9CA3AF]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
