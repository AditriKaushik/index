import type { Server as HttpServer } from "http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { parseCookie } from "cookie";
import { verifyAccessToken } from "@/server/auth/tokens";
import { createMessage, markRead, assertMembership, ChatError } from "./service";

interface AuthedSocket extends Socket {
  data: {
    userId: string;
    deviceId: string;
  };
}

const ACCESS_COOKIE = "sp_access";

export function initSocketServer(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    path: "/api/socket",
    cors: { origin: process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000", credentials: true },
  });

  io.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      if (!cookieHeader) throw new Error("Not authenticated");
      const parsed = parseCookie(cookieHeader);
      const token = parsed[ACCESS_COOKIE];
      if (!token) throw new Error("Not authenticated");

      const payload = verifyAccessToken(token);
      (socket as AuthedSocket).data = { userId: payload.sub, deviceId: payload.deviceId };
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (rawSocket) => {
    const socket = rawSocket as AuthedSocket;
    const { userId } = socket.data;

    socket.join(`user:${userId}`);

    socket.on("conversation:join", async (conversationId: string, ack?: (err?: string) => void) => {
      try {
        await assertMembership(conversationId, userId);
        socket.join(`conversation:${conversationId}`);
        ack?.();
      } catch (error) {
        ack?.(error instanceof Error ? error.message : "Failed to join conversation");
      }
    });

    socket.on(
      "message:send",
      async (
        payload: { conversationId: string; body?: string; type?: "TEXT" | "AUDIO" | "VIDEO" | "IMAGE" | "FILE"; mediaUrl?: string },
        ack?: (result: { ok: boolean; error?: string; messageId?: string }) => void
      ) => {
        try {
          const message = await createMessage({
            conversationId: payload.conversationId,
            senderId: userId,
            type: payload.type,
            body: payload.body,
            mediaUrl: payload.mediaUrl,
          });

          io.to(`conversation:${payload.conversationId}`).emit("message:new", message);
          ack?.({ ok: true, messageId: message.id });
        } catch (error) {
          const message = error instanceof ChatError ? error.message : "Could not send message.";
          ack?.({ ok: false, error: message });
        }
      }
    );

    socket.on("typing", (payload: { conversationId: string; isTyping: boolean }) => {
      socket.to(`conversation:${payload.conversationId}`).emit("typing", {
        conversationId: payload.conversationId,
        userId,
        isTyping: payload.isTyping,
      });
    });

    socket.on("message:read", async (conversationId: string) => {
      try {
        await markRead(conversationId, userId);
        socket.to(`conversation:${conversationId}`).emit("message:read", { conversationId, userId });
      } catch {
        // Non-fatal: read receipts are best-effort.
      }
    });
  });

  return io;
}
