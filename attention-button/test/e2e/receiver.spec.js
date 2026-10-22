import { test, expect } from "@playwright/test";
import { APP, NTFY, newPhone, pollTopic, publishToMock } from "./helpers.js";
import { generateCode, buildAlert, buildTest } from "../../js/channel.js";

const alertFor = (code, text) => buildAlert({ code, text, pageUrl: APP, server: NTFY });
const linkFor = (code) => `${APP}#k=${code}&r=b`;

async function pairedReceiver(browser) {
  const code = generateCode();
  const b = await newPhone(browser);
  await b.goto(linkFor(code));
  await expect(b.locator("#conn-status")).toContainText("Připojeno");
  return { b, code };
}

test("connection status shows connected", async ({ browser }) => {
  const { b } = await pairedReceiver(browser);
  await expect(b.locator("#conn-status")).toHaveText("● Připojeno – čekám na zprávy");
});

test("alert is shown over the whole screen", async ({ browser, request }) => {
  const { b, code } = await pairedReceiver(browser);
  await publishToMock(request, alertFor(code, "Pomoc, volej!"));
  const alarm = b.locator("#alarm");
  await expect(alarm).toBeVisible();
  expect(await alarm.boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 });
  await expect(b.locator("#alarm-text")).toHaveText("Pomoc, volej!");
  await expect(b.locator("#alarm-time")).toHaveText(/^Přijato \d{2}:\d{2}$/);
});

test("a newer alert replaces the one on screen", async ({ browser, request }) => {
  const { b, code } = await pairedReceiver(browser);
  await publishToMock(request, alertFor(code, "první"));
  await expect(b.locator("#alarm-text")).toHaveText("první");
  await publishToMock(request, alertFor(code, "druhá"));
  await expect(b.locator("#alarm-text")).toHaveText("druhá");
});

test("ROZUMÍM closes the alarm and sends an acknowledgement", async ({ browser, request }) => {
  const { b, code } = await pairedReceiver(browser);
  await publishToMock(request, alertFor(code, "Pomoc"));
  await b.click("#alarm-ack");
  await expect(b.locator("#alarm")).toBeHidden();
  await expect
    .poll(async () => (await pollTopic(request, code + "-ok")).map((m) => m.message))
    .toEqual(["Rozumím"]);
});

test("missed alert shows after reopening the same link, and not again once acknowledged", async ({
  browser,
  request,
}) => {
  const { b, code } = await pairedReceiver(browser);
  const context = b.context();
  await b.close();
  await publishToMock(request, alertFor(code, "Zmeškaná zpráva"));

  // Phone clock 5 minutes ahead: re-opening the link must not move activatedAt forward
  // (that would skip this alert even with the 60 s skew allowance).
  const b2 = await context.newPage();
  await b2.clock.setSystemTime(Date.now() + 5 * 60_000);
  await b2.goto(linkFor(code));
  await expect(b2.locator("#alarm")).toBeVisible();
  await expect(b2.locator("#alarm-text")).toHaveText("Zmeškaná zpráva");

  await b2.click("#alarm-ack");
  await expect(b2.locator("#alarm")).toBeHidden();
  await b2.reload();
  await expect(b2.locator("#conn-status")).toContainText("Připojeno");
  await b2.waitForTimeout(1500);
  await expect(b2.locator("#alarm")).toBeHidden();
});

test("test message is not shown as an alarm", async ({ browser, request }) => {
  const { b, code } = await pairedReceiver(browser);
  await publishToMock(request, buildTest(code));
  await b.waitForTimeout(1500);
  await expect(b.locator("#alarm")).toBeHidden();
  // The subscription is alive: a real alert right after does show.
  await publishToMock(request, alertFor(code, "skutečný poplach"));
  await expect(b.locator("#alarm")).toBeVisible();
});

test("send-test button publishes a test message", async ({ browser, request }) => {
  const { b, code } = await pairedReceiver(browser);
  await b.click("#send-test");
  await expect(b.locator("#test-status")).toHaveText(
    "Zkušební zpráva odeslána – měla by přijít notifikace ntfy.",
  );
  const msgs = await pollTopic(request, code);
  expect(msgs.map((m) => m.tags)).toEqual([["test"]]);
});

test("500-character alert keeps ROZUMÍM on a small screen", async ({ browser, request }) => {
  const { b, code } = await pairedReceiver(browser);
  await b.setViewportSize({ width: 360, height: 640 });
  await publishToMock(request, alertFor(code, "A".repeat(500)));
  await expect(b.locator("#alarm")).toBeVisible();
  await expect(b.locator("#alarm-ack")).toBeInViewport({ ratio: 1 });
});

test("a browser without saved pairing still shows the alert from the notification link", async ({
  browser,
  request,
}) => {
  const code = generateCode();
  const sentAt = Math.floor(Date.now() / 1000);
  const msg = await publishToMock(
    request,
    buildAlert({ code, text: "Pomoc z notifikace", pageUrl: APP, server: NTFY, sentAt }),
  );
  const b = await newPhone(browser);
  // Tapped two minutes later, in a browser that has never seen this code.
  await b.clock.setSystemTime(Date.now() + 2 * 60_000);
  await b.goto(msg.click);
  await expect(b.locator("#alarm-text")).toHaveText("Pomoc z notifikace");
});

test("an acknowledgement from the ntfy notification closes the alarm and keeps it closed", async ({
  browser,
  request,
}) => {
  const { b, code } = await pairedReceiver(browser);
  await publishToMock(request, alertFor(code, "Pomoc"));
  await expect(b.locator("#alarm")).toBeVisible();
  // The notification's "Rozumím" action posts plain text to <code>-ok.
  await request.post(`${NTFY}/${code}-ok`, { data: "Rozumím" });
  await expect(b.locator("#alarm")).toBeHidden();

  await b.reload();
  await expect(b.locator("#conn-status")).toContainText("Připojeno");
  await b.waitForTimeout(1500);
  await expect(b.locator("#alarm")).toBeHidden();
});
