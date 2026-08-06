import "dotenv/config";
import { createServer } from "http";
import next from "next";
import { initSocketServer } from "@/server/chat/socket-server";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  initSocketServer(httpServer);

  httpServer.listen(port, () => {
    console.log(`Ready on http://localhost:${port} (socket.io on /api/socket)`);
  });
});
