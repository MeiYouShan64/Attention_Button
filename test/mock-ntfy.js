// Minimal in-memory stand-in for the ntfy HTTP API used by the app (tests only).
import http from "node:http";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

const FIELDS = ["title", "tags", "priority", "click", "actions"];

export function startMockNtfy({ port = 0 } = {}) {
  const messages = [];
  const clients = new Set(); // { topics, res }

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };

  function store(topic, body) {
    const msg = {
      id: randomBytes(8).toString("base64url").slice(0, 10),
      time: Math.floor(Date.now() / 1000),
      event: "message",
      topic,
      message: body.message || "triggered",
    };
    for (const f of FIELDS) if (body[f] !== undefined) msg[f] = body[f];
    messages.push(msg);
    for (const c of clients) {
      if (c.topics.includes(topic)) c.res.write(`data: ${JSON.stringify(msg)}\n\n`);
    }
    return msg;
  }

  function cached(topics, since) {
    const forTopic = messages.filter((m) => topics.includes(m.topic));
    if (since === null || since === undefined) return [];
    if (since === "all") return forTopic;
    if (/^\d+$/.test(since)) return forTopic.filter((m) => m.time >= Number(since));
    const idx = forTopic.findIndex((m) => m.id === since);
    return idx === -1 ? forTopic : forTopic.slice(idx + 1);
  }

  function readBody(req) {
    return new Promise((resolve) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);

    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }

    if (req.method === "POST") {
      const raw = await readBody(req);
      let topic;
      let body;
      if (parts.length === 0) {
        try {
          body = JSON.parse(raw);
        } catch {
          body = {};
        }
        topic = body.topic;
      } else {
        topic = parts[0];
        body = { message: raw };
      }
      if (!topic) {
        res.writeHead(400, { ...cors, "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "topic missing" }));
      }
      const msg = store(topic, body);
      res.writeHead(200, { ...cors, "Content-Type": "application/json" });
      return res.end(JSON.stringify(msg));
    }

    if (req.method === "GET" && parts.length === 2 && parts[1] === "sse") {
      const topics = parts[0].split(",");
      const topic = parts[0];
      res.writeHead(200, {
        ...cors,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const open = { id: "open", time: Math.floor(Date.now() / 1000), event: "open", topic };
      res.write(`event: open\ndata: ${JSON.stringify(open)}\n\n`);
      for (const m of cached(topics, url.searchParams.get("since"))) {
        res.write(`data: ${JSON.stringify(m)}\n\n`);
      }
      const client = { topics, res };
      clients.add(client);
      req.on("close", () => clients.delete(client));
      return;
    }

    if (req.method === "GET" && parts.length === 2 && parts[1] === "json") {
      const list = cached(parts[0].split(","), url.searchParams.get("since") || "all");
      res.writeHead(200, { ...cors, "Content-Type": "application/x-ndjson" });
      return res.end(list.map((m) => JSON.stringify(m) + "\n").join(""));
    }

    res.writeHead(404, cors);
    res.end();
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const { port: actual } = server.address();
      resolve({
        url: `http://localhost:${actual}`,
        dropConnections() {
          for (const c of clients) c.res.destroy();
          clients.clear();
        },
        close() {
          for (const c of clients) c.res.destroy();
          clients.clear();
          return new Promise((r) => server.close(() => r()));
        },
      });
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.argv[2] || 4174);
  startMockNtfy({ port }).then((m) => console.log(`mock ntfy on ${m.url}`));
}
