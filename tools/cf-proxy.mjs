import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import http from "node:http";
import WebSocket from "ws";

const WORKER_WS_URL = "wss://cfp.surtr1385.workers.dev?token=b076d22c79dd673aad688fd3b14b8ef16720cc5647b079e422f42cad74f217ff";
const LOCAL_PORT = process.env.PORT || 1080;

const server = http.createServer((req, res) => {
  res.writeHead(400, { "Content-Type": "text/plain" });
  res.end("Use HTTP CONNECT proxy.");
});

server.on("connect", (req, clientSocket, head) => {
  const [host, port] = req.url.split(":");
  const targetPort = port || 443;
  console.log(`[CF Proxy] CONNECT request for ${host}:${targetPort}`);

  const ws = new WebSocket(WORKER_WS_URL);

  let connected = false;

  ws.on("open", () => {
    ws.send(JSON.stringify({ action: "connect", host, port: Number(targetPort) }));
  });

  ws.on("message", (data) => {
    try {
      const text = data.toString("utf8");
      const msg = JSON.parse(text);
      if (msg.status === "connected") {
        connected = true;
        console.log(`[CF Proxy] Tunnel established to ${host}:${targetPort}`);
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head && head.length > 0) {
          ws.send(JSON.stringify({ action: "data", data: head.toString("base64") }));
        }
      } else if (msg.action === "data" && msg.data) {
        const chunk = Buffer.from(msg.data, "base64");
        clientSocket.write(chunk);
      } else if (msg.error) {
        console.error(`[CF Proxy] Worker Error (${host}:${targetPort}):`, msg.error);
        clientSocket.destroy();
      }
    } catch (e) {
      console.error("[CF Proxy] Parse error:", e);
    }
  });

  clientSocket.on("data", (chunk) => {
    if (connected && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "data", data: chunk.toString("base64") }));
    }
  });

  clientSocket.on("end", () => ws.close());
  clientSocket.on("error", () => ws.close());
  ws.on("error", (err) => {
    console.error(`[CF Proxy] WS Error (${host}:${targetPort}):`, err.message);
    clientSocket.destroy();
  });
  ws.on("close", () => clientSocket.destroy());
});

server.listen(LOCAL_PORT, "127.0.0.1", () => {
  console.log(`🚀 CF Proxy Daemon listening on http://127.0.0.1:${LOCAL_PORT}`);
});
