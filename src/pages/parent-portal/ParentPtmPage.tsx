import { useState } from "react";
import { AccessTimeOutlined, EventAvailableOutlined } from "@mui/icons-material";
import Swal from "sweetalert2";
import { notifySuccess } from "../../lib/notify";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_SUBTLE } from "./ParentPortalLayout";
import { useParentPortal } from "./ParentPortalContext";
import { PageHeader } from "./components/PageHeader";
import { StatusChip } from "./components/StatusChip";

interface Slot {
  id: string;
  time: string;
  available: boolean;
}

interface TeacherSlots {
  teacherName: string;
  subject: string;
  slots: Slot[];
}

interface Meeting {
  id: string;
  teacherName: string;
  subject: string;
  date: string;
  time: string;
}

const INITIAL_SLOTS: TeacherSlots[] = [
  {
    teacherName: "Mrs. Priya Mehta",
    subject: "Mathematics",
    slots: [
      { id: "s1", time: "10:00 AM", available: true },
      { id: "s2", time: "10:30 AM", available: true },
      { id: "s3", time: "11:00 AM", available: false },
      { id: "s4", time: "11:30 AM", available: true },
    ],
  },
  {
    teacherName: "Mr. Anil Kapoor",
    subject: "Science",
    slots: [
      { id: "s5", time: "12:00 PM", available: true },
      { id: "s6", time: "12:30 PM", available: true },
      { id: "s7", time: "01:00 PM", available: true },
    ],
  },
  {
    teacherName: "Ms. Neha Joshi",
    subject: "English",
    slots: [
      { id: "s8", time: "02:00 PM", available: true },
      { id: "s9", time: "02:30 PM", available: false },
      { id: "s10", time: "03:00 PM", available: true },
    ],
  },
];

const INITIAL_MEETINGS: Meeting[] = [
  {
    id: "mt1",
    teacherName: "Mrs. Priya Mehta",
    subject: "Mathematics",
    date: "31 May 2025",
    time: "10:30 AM",
  },
];

export function ParentPtmPage() {
  const { activeChild } = useParentPortal();
  const [slotGroups, setSlotGroups] = useState(INITIAL_SLOTS);
  const [meetings, setMeetings] = useState(INITIAL_MEETINGS);

  async function bookSlot(group: TeacherSlots, slot: Slot) {
    const result = await Swal.fire({
      title: "Book PTM slot?",
      html: `<p style="color:#6B7280;font-size:14px">Book <b>${slot.time}</b> with <b>${group.teacherName}</b> (${group.subject}) for ${activeChild.name}?</p>`,
      showCancelButton: true,
      confirmButtonText: "Confirm booking",
      confirmButtonColor: PARENT_PRIMARY,
      cancelButtonColor: "#9CA3AF",
    });
    if (!result.isConfirmed) return;

    setSlotGroups((prev) =>
      prev.map((g) =>
        g.teacherName === group.teacherName
          ? { ...g, slots: g.slots.map((s) => (s.id === slot.id ? { ...s, available: false } : s)) }
          : g,
      ),
    );
    setMeetings((prev) => [
      ...prev,
      {
        id: `mt-${Date.now()}`,
        teacherName: group.teacherName,
        subject: group.subject,
        date: "31 May 2025",
        time: slot.time,
      },
    ]);
    notifySuccess("PTM slot booked successfully");
  }

  async function cancelMeeting(meeting: Meeting) {
    const result = await Swal.fire({
      title: "Cancel meeting?",
      text: `Cancel PTM with ${meeting.teacherName} on ${meeting.date} at ${meeting.time}?`,
      showCancelButton: true,
      confirmButtonText: "Yes, cancel",
      confirmButtonColor: "#DC2626",
      cancelButtonColor: "#9CA3AF",
    });
    if (!result.isConfirmed) return;
    setMeetings((prev) => prev.filter((m) => m.id !== meeting.id));
    notifySuccess("Meeting cancelled");
  }

  async function rescheduleMeeting(meeting: Meeting) {
    const result = await Swal.fire({
      title: "Reschedule meeting?",
      text: `We'll release the current slot with ${meeting.teacherName}. Pick a new time from Available Slots.`,
      showCancelButton: true,
      confirmButtonText: "Release & reschedule",
      confirmButtonColor: PARENT_PRIMARY,
      cancelButtonColor: "#9CA3AF",
    });
    if (!result.isConfirmed) return;
    setMeetings((prev) => prev.filter((m) => m.id !== meeting.id));
    setSlotGroups((prev) =>
      prev.map((g) =>
        g.teacherName === meeting.teacherName
          ? {
              ...g,
              slots: g.slots.map((s) => (s.time === meeting.time ? { ...s, available: true } : s)),
            }
          : g,
      ),
    );
    notifySuccess("Slot released — please book a new time");
  }

  return (
    <div>
      <PageHeader
        title="PTM Scheduling"
        subtitle={`Book parent-teacher meetings for ${activeChild.name.split(" ")[0]}`}
      />
      <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
        PTM booking is not connected to the backend yet. This screen is a preview only.
      </p>

      <div className="mb-6">
        <h2 className="mb-3 text-[15px] font-bold text-[#1A1A2E]">Available Slots</h2>
        <div className="flex flex-col gap-4">
          {slotGroups.map((group) => (
            <div
              key={group.teacherName}
              className="rounded-[20px] border bg-white p-5 shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
              style={{ borderColor: PARENT_BORDER }}
            >
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div
                  className="grid size-10 place-items-center rounded-full text-[12px] font-bold text-white"
                  style={{ background: PARENT_PRIMARY }}
                >
                  {group.teacherName
                    .split(" ")
                    .slice(-2)
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div>
                  <h3 className="text-[14.5px] font-bold text-[#1A1A2E]">{group.teacherName}</h3>
                  <p className="text-[12.5px] text-[#6B7280]">{group.subject}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.slots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => bookSlot(group, slot)}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                      borderColor: slot.available ? PARENT_PRIMARY : PARENT_BORDER,
                      color: slot.available ? PARENT_PRIMARY : "#9CA3AF",
                      background: slot.available ? PARENT_PRIMARY_SUBTLE : "#F9FAFB",
                    }}
                  >
                    <AccessTimeOutlined sx={{ fontSize: 16 }} />
                    {slot.time}
                    {slot.available ? " · Book Slot" : " · Booked"}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-bold text-[#1A1A2E]">My Upcoming Meetings</h2>
        {meetings.length === 0 ? (
          <div
            className="rounded-[20px] border bg-white p-8 text-center text-[13.5px] text-[#6B7280] shadow-[0_4px_18px_rgba(28,27,60,0.04)]"
            style={{ borderColor: PARENT_BORDER }}
          >
            No upcoming meetings. Book a slot above.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {meetings.map((meeting) => (
              <div
                key={meeting.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border bg-white p-4 shadow-[0_4px_18px_rgba(28,27,60,0.04)] sm:p-5"
                style={{ borderColor: PARENT_BORDER }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="grid size-11 place-items-center rounded-2xl"
                    style={{ background: PARENT_PRIMARY_SUBTLE, color: PARENT_PRIMARY }}
                  >
                    <EventAvailableOutlined sx={{ fontSize: 22 }} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14.5px] font-bold text-[#1A1A2E]">{meeting.teacherName}</h3>
                      <StatusChip label="Confirmed" tone="green" />
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-[#6B7280]">
                      {meeting.subject} · {meeting.date} · {meeting.time}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => rescheduleMeeting(meeting)}
                    className="rounded-xl border px-3.5 py-2 text-[12.5px] font-semibold"
                    style={{ borderColor: PARENT_BORDER, color: PARENT_PRIMARY }}
                  >
                    Reschedule
                  </button>
                  <button
                    type="button"
                    onClick={() => cancelMeeting(meeting)}
                    className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2 text-[12.5px] font-semibold text-[#DC2626]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
