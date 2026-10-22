// Thin client for the ntfy HTTP API: JSON publishing and SSE subscriptions.

const RECONNECT_MS = 5000;
const TIMEOUT_MS = 10000;

// A connection that never answers (weak mobile signal) must end in an error the UI can retry.
async function request(url, init, timeoutMs) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.text();
  } catch (e) {
    if (e.name === "TimeoutError" || e.name === "AbortError") throw new Error("timeout");
    throw e;
  }
}

export async function publish(server, payload, { timeoutMs = TIMEOUT_MS } = {}) {
  // No Content-Type header: keeps this a "simple" CORS request without a preflight.
  const body = await request(`${server}/`, { method: "POST", body: JSON.stringify(payload) }, timeoutMs);
  return JSON.parse(body);
}

export async function poll(server, topic, since, { timeoutMs = TIMEOUT_MS } = {}) {
  const url = `${server}/${topic}/json?poll=1&since=${encodeURIComponent(since)}`;
  const body = await request(url, {}, timeoutMs);
  return body
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((msg) => msg.event === "message");
}

export function subscribe(server, topic, { since, onMessage, onStatus = () => {} }) {
  const seen = new Set();
  let lastId = null;
  let source = null;
  let timer = null;
  let closed = false;

  function connect() {
    const from = lastId ?? since;
    source = new EventSource(`${server}/${topic}/sse?since=${encodeURIComponent(from)}`);
    source.onopen = () => onStatus("open");
    source.onerror = () => {
      onStatus("reconnecting");
      // EventSource retries by itself unless the server answered with an error status.
      if (source.readyState === EventSource.CLOSED && !closed) {
        timer = setTimeout(connect, RECONNECT_MS);
      }
    };
    source.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.event !== "message" || seen.has(msg.id)) return;
      seen.add(msg.id);
      lastId = msg.id;
      onMessage(msg);
    };
  }

  connect();
  return {
    close() {
      closed = true;
      clearTimeout(timer);
      source?.close();
    },
  };
}
