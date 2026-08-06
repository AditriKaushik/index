"use client";

import type { ConversationSummary } from "@/types/chat";
import { useAuth } from "@/components/auth-provider";

function conversationLabel(conv: ConversationSummary, currentUserId: string | undefined) {
  if (conv.title) return conv.title;
  const others = conv.members.filter((m) => m.id !== currentUserId);
  return others.map((m) => m.displayName).join(", ") || "New conversation";
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onStartNew,
}: {
  conversations: ConversationSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStartNew: () => void;
}) {
  const { user } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-lg font-semibold">Chats</h2>
        <button
          onClick={onStartNew}
          className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground"
        >
          + New
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <li className="p-4 text-sm text-muted">No conversations yet. Start one!</li>
        )}
        {conversations.map((conv) => {
          const unread =
            conv.lastMessage &&
            (!conv.lastReadAt || new Date(conv.lastMessage.createdAt) > new Date(conv.lastReadAt)) &&
            conv.lastMessage.senderId !== user?.id;

          return (
            <li key={conv.id}>
              <button
                onClick={() => onSelect(conv.id)}
                className={`flex w-full flex-col items-start gap-0.5 border-b px-4 py-3 text-left ${
                  selectedId === conv.id ? "bg-accent/10" : "hover:bg-surface"
                }`}
              >
                <span className="flex w-full items-center justify-between font-medium">
                  {conversationLabel(conv, user?.id)}
                  {unread && <span className="h-2 w-2 rounded-full bg-accent" />}
                </span>
                <span className="truncate text-sm text-muted">
                  {conv.lastMessage?.body ??
                    (conv.lastMessage ? `[${conv.lastMessage.type.toLowerCase()}]` : "Say hello 👋")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
