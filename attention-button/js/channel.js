// Pure channel logic shared by the page and the tests (no DOM access).

const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";
const CODE_RE = /^att-[a-z2-7]{16}$/;

export function generateCode(bytes = crypto.getRandomValues(new Uint8Array(10))) {
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(buffer >> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return "att-" + out;
}

export function isValidCode(code) {
  return typeof code === "string" && CODE_RE.test(code);
}

export function ackTopic(code) {
  return `${code}-ok`;
}

// sentAt (A's send time) lets a browser without saved pairing still fetch the alert it was opened for.
export function buildReceiverLink(pageUrl, code, sentAt = null) {
  const link = `${pageUrl.split("#")[0]}#k=${code}&r=b`;
  return sentAt === null ? link : `${link}&t=${sentAt}`;
}

export function parseHash(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const code = params.get("k");
  if (params.get("r") !== "b" || !isValidCode(code)) return null;
  const t = params.get("t");
  return { code, role: "receiver", sentAt: /^\d+$/.test(t ?? "") ? Number(t) : null };
}

export function buildAlert({ code, text, pageUrl, server, sentAt = null }) {
  const link = buildReceiverLink(pageUrl, code, sentAt);
  return {
    topic: code,
    title: "⚠️ ATTENTION",
    message: text,
    priority: 5,
    tags: ["rotating_light"],
    click: link,
    actions: [
      { action: "view", label: "Otevřít", url: link },
      {
        action: "http",
        label: "Rozumím",
        url: `${server}/${ackTopic(code)}`,
        method: "POST",
        body: "Rozumím",
        clear: true,
      },
    ],
  };
}

export function buildAck(code) {
  return { topic: ackTopic(code), message: "Rozumím" };
}

export function buildTest(code) {
  return {
    topic: code,
    title: "Test",
    message: "Zkušební zpráva – vše funguje",
    priority: 3,
    tags: ["test"],
  };
}

export function isTestMessage(msg) {
  return Array.isArray(msg.tags) && msg.tags.includes("test");
}

export function pickAlertToShow(messages, ackedTime) {
  let newest = null;
  for (const msg of messages) {
    if (isTestMessage(msg) || msg.time <= ackedTime) continue;
    if (!newest || msg.time >= newest.time) newest = msg;
  }
  return newest;
}

// activatedAt comes from the phone clock, so allow it to run up to 60 s ahead of the server.
export function receiverSince(ackedTime, activatedAt) {
  return Math.max(ackedTime, activatedAt - 60);
}

export function formatTime(unixSeconds) {
  const d = new Date(unixSeconds * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
