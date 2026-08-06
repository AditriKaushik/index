"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";

interface UserResult {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
}

export function NewConversationDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [busy, setBusy] = useState(false);

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) return setResults([]);
    const res = await apiFetch<{ users: UserResult[] }>(
      `/api/users/search?q=${encodeURIComponent(q)}`
    );
    setResults(res.users);
  }

  async function startConversation(userId: string) {
    setBusy(true);
    try {
      const res = await apiFetch<{ conversation: { id: string } }>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ participantIds: [userId] }),
      });
      onCreated(res.conversation.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-background p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">New chat</h3>
          <button onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <input
          autoFocus
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Search by name, email, or phone"
          className="mb-3 w-full rounded-lg border bg-surface px-3 py-2 text-sm"
        />
        <ul className="max-h-64 overflow-y-auto">
          {results.map((u) => (
            <li key={u.id}>
              <button
                disabled={busy}
                onClick={() => startConversation(u.id)}
                className="flex w-full flex-col items-start rounded-lg px-2 py-2 text-left hover:bg-surface disabled:opacity-50"
              >
                <span className="font-medium">{u.displayName}</span>
                <span className="text-xs text-muted">{u.email ?? u.phone}</span>
              </button>
            </li>
          ))}
          {query.length >= 2 && results.length === 0 && (
            <li className="px-2 py-2 text-sm text-muted">No matches.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
