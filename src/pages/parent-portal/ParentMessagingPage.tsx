import { useMemo, useRef, useState } from "react";
import { AttachFileOutlined, SendRounded } from "@mui/icons-material";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_SUBTLE } from "./ParentPortalLayout";
import { useParentPortal } from "./ParentPortalContext";
import { PageHeader } from "./components/PageHeader";

interface ChatMessage {
  id: string;
  from: "parent" | "teacher";
  text: string;
  time: string;
}

interface Conversation {
  id: string;
  teacherName: string;
  subject: string;
  unread: number;
  messages: ChatMessage[];
}

const INITIAL: Conversation[] = [
  {
    id: "c1",
    teacherName: "Mrs. Priya Mehta",
    subject: "Mathematics",
    unread: 2,
    messages: [
      {
        id: "m1",
        from: "teacher",
        text: "Hello! Aarav did well on the last chapter test. A little more practice on fractions would help.",
        time: "10:12 AM",
      },
      {
        id: "m2",
        from: "parent",
        text: "Thank you for the update. We'll revise fractions over the weekend.",
        time: "10:28 AM",
      },
      {
        id: "m3",
        from: "teacher",
        text: "Great. I've also shared extra worksheets on the homework portal.",
        time: "10:35 AM",
      },
      {
        id: "m4",
        from: "teacher",
        text: "Please ensure the geometry notebook is submitted by Thursday.",
        time: "11:02 AM",
      },
    ],
  },
  {
    id: "c2",
    teacherName: "Mr. Anil Kapoor",
    subject: "Science",
    unread: 0,
    messages: [
      {
        id: "m5",
        from: "parent",
        text: "Sir, could you clarify the lab project deadline for Light?",
        time: "Yesterday",
      },
      {
        id: "m6",
        from: "teacher",
        text: "Sure — submissions are due next Friday. Groups of 3 are allowed.",
        time: "Yesterday",
      },
    ],
  },
  {
    id: "c3",
    teacherName: "Ms. Neha Joshi",
    subject: "English",
    unread: 1,
    messages: [
      {
        id: "m7",
        from: "teacher",
        text: "Aarav's essay on climate change was excellent. Please encourage him to join the debate club.",
        time: "Mon",
      },
    ],
  },
];

function lastPreview(conv: Conversation) {
  const last = conv.messages[conv.messages.length - 1];
  return last?.text ?? "";
}

export function ParentMessagingPage() {
  const { activeChild } = useParentPortal();
  // Teacher messaging API is not available yet — UI remains preview-only.
  const [conversations, setConversations] = useState(INITIAL);
  const [activeId, setActiveId] = useState(INITIAL[0].id);
  const [draft, setDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? conversations[0],
    [conversations, activeId],
  );

  function selectConversation(id: string) {
    setActiveId(id);
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text || !active) return;
    const msg: ChatMessage = {
      id: `local-${Date.now()}`,
      from: "parent",
      text,
      time: "Just now",
    };
    setConversations((prev) =>
      prev.map((c) => (c.id === active.id ? { ...c, messages: [...c.messages, msg], unread: 0 } : c)),
    );
    setDraft("");
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  return (
    <div>
      <PageHeader
        title="Messaging"
        subtitle={`Chat with ${activeChild.name.split(" ")[0]}'s teachers`}
      />
      <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
        Teacher messaging is not connected to the backend yet. This screen is a preview only.
      </p>

      <div
        className="grid min-h-[560px] grid-cols-1 overflow-hidden rounded-[20px] border bg-white shadow-[0_4px_18px_rgba(28,27,60,0.04)] lg:grid-cols-[320px_1fr]"
        style={{ borderColor: PARENT_BORDER }}
      >
        <aside className="border-b lg:border-b-0 lg:border-r" style={{ borderColor: PARENT_BORDER }}>
          <div className="border-b px-4 py-3" style={{ borderColor: PARENT_BORDER }}>
            <h2 className="text-[14px] font-bold text-[#1A1A2E]">Teachers</h2>
          </div>
          <ul className="flex max-h-[240px] flex-col overflow-y-auto lg:max-h-[520px]">
            {conversations.map((conv) => {
              const isActive = conv.id === active?.id;
              return (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => selectConversation(conv.id)}
                    className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#F9FAFB]"
                    style={{ background: isActive ? PARENT_PRIMARY_SUBTLE : undefined }}
                  >
                    <div
                      className="grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white"
                      style={{ background: PARENT_PRIMARY }}
                    >
                      {conv.teacherName
                        .split(" ")
                        .slice(-2)
                        .map((p) => p[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13.5px] font-bold text-[#1A1A2E]">{conv.teacherName}</span>
                        {conv.unread > 0 && (
                          <span
                            className="grid min-w-[20px] place-items-center rounded-full px-1.5 text-[10px] font-bold text-white"
                            style={{ background: PARENT_PRIMARY }}
                          >
                            {conv.unread}
                          </span>
                        )}
                      </div>
                      <p className="text-[11.5px] font-semibold" style={{ color: PARENT_PRIMARY }}>
                        {conv.subject}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-[#6B7280]">{lastPreview(conv)}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="flex min-h-[360px] flex-col">
          {active && (
            <>
              <div className="flex items-center gap-3 border-b px-4 py-3 sm:px-5" style={{ borderColor: PARENT_BORDER }}>
                <div
                  className="grid size-10 place-items-center rounded-full text-[13px] font-bold text-white"
                  style={{ background: PARENT_PRIMARY }}
                >
                  {active.teacherName
                    .split(" ")
                    .slice(-2)
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div>
                  <h3 className="text-[14.5px] font-bold text-[#1A1A2E]">{active.teacherName}</h3>
                  <p className="text-[12px] text-[#6B7280]">{active.subject}</p>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-[#F9FAFB] px-4 py-4 sm:px-5">
                {active.messages.map((msg) => {
                  const mine = msg.from === "parent";
                  return (
                    <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className="max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[70%]"
                        style={{
                          background: mine ? PARENT_PRIMARY : "#FFFFFF",
                          color: mine ? "#FFFFFF" : "#1A1A2E",
                          border: mine ? "none" : `1px solid ${PARENT_BORDER}`,
                        }}
                      >
                        <p className="text-[13.5px] leading-relaxed">{msg.text}</p>
                        <p
                          className="mt-1 text-right text-[10.5px]"
                          style={{ color: mine ? "rgba(255,255,255,0.75)" : "#9CA3AF" }}
                        >
                          {msg.time}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <div className="flex items-center gap-2 border-t px-3 py-3 sm:px-4" style={{ borderColor: PARENT_BORDER }}>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={() => {
                    /* mock attachment pick */
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="grid size-10 shrink-0 place-items-center rounded-xl text-[#6B7280] hover:bg-[#F3F4F6]"
                  aria-label="Attach file"
                >
                  <AttachFileOutlined sx={{ fontSize: 20 }} />
                </button>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type a message…"
                  className="h-11 flex-1 rounded-xl border bg-[#F9FAFB] px-3.5 text-[13.5px] outline-none focus:bg-white"
                  style={{ borderColor: PARENT_BORDER }}
                />
                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!draft.trim()}
                  className="grid size-11 shrink-0 place-items-center rounded-xl text-white disabled:opacity-40"
                  style={{ background: PARENT_PRIMARY }}
                  aria-label="Send"
                >
                  <SendRounded sx={{ fontSize: 20 }} />
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
