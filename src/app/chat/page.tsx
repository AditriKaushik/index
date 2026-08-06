"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useIsCompactViewport } from "@/lib/use-viewport";
import { AppShell } from "@/components/app-shell";
import { ConversationList } from "@/components/chat/conversation-list";
import { MessageThread } from "@/components/chat/message-thread";
import { NewConversationDialog } from "@/components/chat/new-conversation-dialog";
import { getSocket } from "@/lib/socket-client";
import type { ConversationSummary, MessageSummary } from "@/types/chat";

export default function ChatPage() {
  const { user, loading } = useRequireAuth();
  const isCompact = useIsCompactViewport();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const joinedRooms = useRef<Set<string>>(new Set());

  const loadConversations = useCallback(async () => {
    const res = await apiFetch<{ conversations: ConversationSummary[] }>("/api/conversations");
    setConversations(res.conversations);
  }, []);

  useEffect(() => {
    if (!user) return;
    loadConversations();
  }, [user, loadConversations]);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    function onNewMessage(message: MessageSummary) {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === message.conversationId);
        if (idx === -1) return prev;
        const updated = { ...prev[idx], lastMessage: message, updatedAt: message.createdAt };
        const rest = prev.filter((c) => c.id !== message.conversationId);
        return [updated, ...rest];
      });
    }

    function onTyping({ conversationId, userId, isTyping }: { conversationId: string; userId: string; isTyping: boolean }) {
      if (conversationId !== selectedId) return;
      setTypingUsers((prev) => {
        const next = new Set(prev);
        if (isTyping) next.add(userId);
        else next.delete(userId);
        return next;
      });
    }

    socket.on("message:new", onNewMessage);
    socket.on("typing", onTyping);
    return () => {
      socket.off("message:new", onNewMessage);
      socket.off("typing", onTyping);
    };
  }, [user, selectedId]);

  async function selectConversation(id: string) {
    setSelectedId(id);
    setTypingUsers(new Set());
    const socket = getSocket();
    if (!joinedRooms.current.has(id)) {
      socket.emit("conversation:join", id);
      joinedRooms.current.add(id);
    }
    const res = await apiFetch<{ messages: MessageSummary[] }>(`/api/conversations/${id}/messages`);
    setMessages([...res.messages].reverse());
    socket.emit("message:read", id);
  }

  function sendMessage(body: string) {
    if (!selectedId) return;
    getSocket().emit(
      "message:send",
      { conversationId: selectedId, body, type: "TEXT" },
      (result: { ok: boolean; error?: string }) => {
        if (!result.ok) console.error(result.error);
      }
    );
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  const showList = !isCompact || !selectedId;
  const showThread = !isCompact || Boolean(selectedId);

  const typingLabel =
    typingUsers.size > 0
      ? `${selected?.members.find((m) => typingUsers.has(m.id))?.displayName ?? "Someone"} is typing…`
      : null;

  return (
    <AppShell>
      <div className="flex h-full">
        {showList && (
          <div className={isCompact ? "w-full" : "w-80 shrink-0 border-r"}>
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              onSelect={selectConversation}
              onStartNew={() => setShowNewChat(true)}
            />
          </div>
        )}
        {showThread &&
          (selected ? (
            <div className="flex-1">
              <MessageThread
                conversation={selected}
                messages={messages}
                onSend={sendMessage}
                onBack={isCompact ? () => setSelectedId(null) : undefined}
                typingLabel={typingLabel}
              />
            </div>
          ) : (
            !isCompact && (
              <div className="flex flex-1 items-center justify-center text-sm text-muted">
                Select a conversation to start chatting.
              </div>
            )
          ))}
      </div>

      {showNewChat && (
        <NewConversationDialog
          onClose={() => setShowNewChat(false)}
          onCreated={async (id) => {
            setShowNewChat(false);
            await loadConversations();
            selectConversation(id);
          }}
        />
      )}
    </AppShell>
  );
}
