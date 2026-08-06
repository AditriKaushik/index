export interface ConversationMemberSummary {
  id: string;
  displayName: string;
}

export interface MessageSummary {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: ConversationMemberSummary;
  type: "TEXT" | "AUDIO" | "VIDEO" | "IMAGE" | "FILE" | "SYSTEM";
  body: string | null;
  mediaUrl: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface ConversationSummary {
  id: string;
  isGroup: boolean;
  title: string | null;
  members: ConversationMemberSummary[];
  lastMessage: MessageSummary | null;
  lastReadAt: string | null;
  updatedAt: string;
}
