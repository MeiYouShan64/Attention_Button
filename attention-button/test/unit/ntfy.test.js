import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { publish, subscribe, poll } from "../../js/ntfy.js";
import { startMockNtfy } from "../mock-ntfy.js";

let mock;
before(async () => {
  mock = await startMockNtfy();
});
after(async () => {
  await mock.close();
});

const now = () => Math.floor(Date.now() / 1000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitFor(fn, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (fn()) return resolve();
      if (Date.now() - started > timeout) return reject(new Error("timeout"));
      setTimeout(tick, 20);
    };
    tick();
  });
}

test("publish returns id and time", async () => {
  const res = await publish(mock.url, { topic: "t1", message: "ahoj" });
  assert.equal(typeof res.id, "string");
  assert.equal(typeof res.time, "number");
  assert.equal(res.message, "ahoj");
});

test("publish throws on HTTP 400", async () => {
  await assert.rejects(publish(mock.url, { message: "bez topicu" }), /HTTP 400/);
});

test("subscribe receives a live message with UTF-8 intact", async () => {
  const got = [];
  let opened = false;
  const sub = subscribe(mock.url, "t2", {
    since: now(),
    onMessage: (m) => got.push(m),
    onStatus: (s) => {
      if (s === "open") opened = true;
    },
  });
  try {
    await waitFor(() => opened);
    await publish(mock.url, { topic: "t2", message: "živě" });
    await waitFor(() => got.length === 1);
    assert.equal(got[0].message, "živě");
  } finally {
    sub.close();
  }
});

test("subscribe receives cached messages with since=all and ignores other topics", async () => {
  await publish(mock.url, { topic: "t3", message: "uložená" });
  await publish(mock.url, { topic: "jiny", message: "cizí" });
  const got = [];
  const sub = subscribe(mock.url, "t3", { since: "all", onMessage: (m) => got.push(m) });
  try {
    await waitFor(() => got.length === 1);
    await sleep(300);
    assert.deepEqual(got.map((m) => m.message), ["uložená"]);
  } finally {
    sub.close();
  }
});

test("subscribe does not deliver the same id twice after a reconnect", async () => {
  const sent = await publish(mock.url, { topic: "t4", message: "jednou" });
  const got = [];
  let opens = 0;
  const sub = subscribe(mock.url, "t4", {
    since: "all",
    onMessage: (m) => got.push(m),
    onStatus: (s) => {
      if (s === "open") opens++;
    },
  });
  try {
    await waitFor(() => got.length === 1);
    // ntfy's own "event: open" also fires onopen, so count opens relative to the drop.
    const opensBeforeDrop = opens;
    mock.dropConnections();
    await waitFor(() => opens > opensBeforeDrop);
    await sleep(500);
    assert.deepEqual(got.map((m) => m.id), [sent.id]);
  } finally {
    sub.close();
  }
});

test("publish rejects when the server never answers", { timeout: 5000 }, async () => {
  // Never answers; drops the socket after 1.5 s so a missing client timeout fails instead of hanging.
  const hang = http.createServer((req) => setTimeout(() => req.socket.destroy(), 1500));
  await new Promise((resolve) => hang.listen(0, "127.0.0.1", resolve));
  const url = `http://localhost:${hang.address().port}`;
  try {
    await assert.rejects(publish(url, { topic: "x" }, { timeoutMs: 200 }), /timeout/i);
  } finally {
    hang.closeAllConnections();
    hang.close();
  }
});

test("poll returns cached messages of a topic", async () => {
  await publish(mock.url, { topic: "t5", message: "1" });
  await publish(mock.url, { topic: "t5", message: "2" });
  const msgs = await poll(mock.url, "t5", "all");
  assert.deepEqual(msgs.map((m) => m.message), ["1", "2"]);
});

test("subscribe to two comma-separated topics receives both", async () => {
  await publish(mock.url, { topic: "t6", message: "a" });
  await publish(mock.url, { topic: "t6-ok", message: "b" });
  const got = [];
  const sub = subscribe(mock.url, "t6,t6-ok", { since: "all", onMessage: (m) => got.push(m) });
  try {
    await waitFor(() => got.length === 2);
    assert.deepEqual(got.map((m) => m.topic).sort(), ["t6", "t6-ok"]);
  } finally {
    sub.close();
  }
});
