import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateCode,
  isValidCode,
  ackTopic,
  buildReceiverLink,
  parseHash,
  buildAlert,
  buildAck,
  buildTest,
  isTestMessage,
  pickAlertToShow,
  receiverSince,
  formatTime,
} from "../../js/channel.js";

const C = "att-abcdefghijk23456";

test("generateCode encodes 10 bytes as att- + 16 base32 chars", () => {
  assert.equal(generateCode(new Uint8Array(10)), "att-aaaaaaaaaaaaaaaa");
  assert.equal(generateCode(new Uint8Array(10).fill(255)), "att-7777777777777777");
});

test("generateCode without argument is random and valid", () => {
  const a = generateCode();
  const b = generateCode();
  assert.notEqual(a, b);
  assert.ok(isValidCode(a));
  assert.ok(isValidCode(b));
});

test("isValidCode accepts only att- + 16 lowercase base32 chars", () => {
  assert.equal(isValidCode(C), true);
  assert.equal(isValidCode("att-ABCDEFGHIJK23456"), false);
  assert.equal(isValidCode("att-short"), false);
  assert.equal(isValidCode(""), false);
  assert.equal(isValidCode("xyz-aaaaaaaaaaaaaaaa"), false);
  assert.equal(isValidCode("att-aaaaaaaaaaaaaaa1"), false);
});

test("ackTopic appends -ok", () => {
  assert.equal(ackTopic(C), C + "-ok");
});

test("buildReceiverLink drops old hash and keeps query", () => {
  assert.equal(
    buildReceiverLink("https://x.cz/app/?server=http://l:4174#old", C),
    "https://x.cz/app/?server=http://l:4174#k=" + C + "&r=b",
  );
});

test("buildReceiverLink adds the send time when given", () => {
  assert.equal(buildReceiverLink("https://x.cz/", C, 1234), "https://x.cz/#k=" + C + "&r=b&t=1234");
});

test("parseHash returns receiver code only for a valid r=b link", () => {
  assert.deepEqual(parseHash("#k=" + C + "&r=b"), { code: C, role: "receiver", sentAt: null });
  assert.deepEqual(parseHash("#k=" + C + "&r=b&t=1234"), { code: C, role: "receiver", sentAt: 1234 });
  assert.deepEqual(parseHash("#k=" + C + "&r=b&t=abc"), { code: C, role: "receiver", sentAt: null });
  assert.equal(parseHash("#k=bad&r=b"), null);
  assert.equal(parseHash(""), null);
  assert.equal(parseHash("#k=" + C), null);
});

test("buildAlert produces the ntfy JSON from the spec", () => {
  const link = "https://x.cz/#k=" + C + "&r=b&t=1000";
  assert.deepEqual(
    buildAlert({ code: C, text: "Pomoc", pageUrl: "https://x.cz/", server: "https://ntfy.sh", sentAt: 1000 }),
    {
      topic: C,
      title: "⚠️ ATTENTION",
      message: "Pomoc",
      priority: 5,
      tags: ["rotating_light"],
      click: link,
      actions: [
        { action: "view", label: "Otevřít", url: link },
        {
          action: "http",
          label: "Rozumím",
          url: "https://ntfy.sh/" + C + "-ok",
          method: "POST",
          body: "Rozumím",
          clear: true,
        },
      ],
    },
  );
});

test("buildAck and buildTest produce the spec payloads", () => {
  assert.deepEqual(buildAck(C), { topic: C + "-ok", message: "Rozumím" });
  assert.deepEqual(buildTest(C), {
    topic: C,
    title: "Test",
    message: "Zkušební zpráva – vše funguje",
    priority: 3,
    tags: ["test"],
  });
});

test("isTestMessage detects the test tag", () => {
  assert.equal(isTestMessage({ tags: ["test"] }), true);
  assert.equal(isTestMessage({ tags: ["rotating_light"] }), false);
  assert.equal(isTestMessage({}), false);
});

test("pickAlertToShow returns newest non-test message newer than ackedTime", () => {
  const msgs = [
    { id: "a", time: 100 },
    { id: "b", time: 200 },
    { id: "t", time: 300, tags: ["test"] },
  ];
  assert.equal(pickAlertToShow(msgs, 0).id, "b");
  assert.equal(pickAlertToShow(msgs, 200), null);
  assert.equal(pickAlertToShow([], 0), null);
});

test("receiverSince allows 60 s of clock skew", () => {
  assert.equal(receiverSince(0, 1000), 940);
  assert.equal(receiverSince(5000, 1000), 5000);
});

test("formatTime renders local HH:MM", () => {
  assert.equal(formatTime(new Date(2026, 0, 1, 7, 5).getTime() / 1000), "07:05");
  assert.equal(formatTime(new Date(2026, 0, 1, 23, 59).getTime() / 1000), "23:59");
});
