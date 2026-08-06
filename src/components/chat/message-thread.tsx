"use client";

import { useEffect, useRef, useState } from "react";
import type { ConversationSummary, MessageSummary } from "@/types/chat";
import { useAuth } from "@/components/auth-provider";
import { getSocket } from "@/lib/socket-client";

function conversationLabel(conv: ConversationSummary, currentUserId: string | undefined) {
  if (conv.title) return conv.title;
  const others = conv.members.filter((m) => m.id !== currentUserId);
  return others.map((m) => m.displayName).join(", ") || "Conversation";
}

export function MessageThread({
  conversation,
  messages,
  onSend,
  onBack,
  typingLabel,
}: {
  conversation: ConversationSummary;
  messages: MessageSummary[];
  onSend: (body: string) => void;
  onBack?: () => void;
  typingLabel: string | null;
}) {
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleTyping(isTyping: boolean) {
    getSocket().emit("typing", { conversationId: conversation.id, isTyping });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    onSend(draft.trim());
    setDraft("");
    handleTyping(false);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b p-4">
        {onBack && (
          <button onClick={onBack} className="text-lg" aria-label="Back to chats">
            ←
          </button>
        )}
        <h2 className="flex-1 truncate font-semibold">{conversationLabel(conversation, user?.id)}</h2>
        <button
          disabled
          title="Audio calling is planned for a later phase — see ARCHITECTURE.md"
          className="rounded-full border px-2 py-1 text-sm opacity-40"
        >
          🎙️
        </button>
        <button
          disabled
          title="Video calling is planned for a later phase — see ARCHITECTURE.md"
          className="rounded-full border px-2 py-1 text-sm opacity-40"
        >
          🎥
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.map((m) => {
          const mine = m.senderId === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  mine ? "bg-accent text-accent-foreground" : "bg-surface"
                }`}
              >
                {!mine && conversation.isGroup && (
                  <p className="mb-0.5 text-xs font-medium opacity-70">{m.sender?.displayName}</p>
                )}
                <p className="whitespace-pre-wrap break-words">
                  {m.deletedAt ? <em className="opacity-60">Message deleted</em> : m.body}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {typingLabel && <p className="px-4 pb-1 text-xs text-muted">{typingLabel}</p>}

      <form onSubmit={submit} className="flex gap-2 border-t p-3">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            handleTyping(e.target.value.length > 0);
          }}
          onBlur={() => handleTyping(false)}
          placeholder="Type a message"
          className="flex-1 rounded-full border bg-background px-4 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
