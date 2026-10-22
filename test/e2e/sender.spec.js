import { test, expect } from "@playwright/test";
import { APP, NTFY, newPhone, pollTopic } from "./helpers.js";

async function setupSender(browser) {
  const a = await newPhone(browser);
  await a.goto(APP);
  await a.click("#choose-sender");
  const code = await a.locator("#code-sender").textContent();
  return { a, code };
}

async function hold(page, ms) {
  await page.locator("#attention").hover();
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

test("full flow A → B → acknowledgement, with diacritics, emoji and HTML kept as text", async ({
  browser,
}) => {
  const TEXT = "Příliš žluťoučký kůň 🚨 <b>x</b>";
  const { a } = await setupSender(browser);
  const b = await newPhone(browser);
  await b.goto(await a.locator("#receiver-link").inputValue());
  await expect(b.locator("#conn-status")).toContainText("Připojeno");

  await a.fill("#message", TEXT);
  await hold(a, 1200);
  await expect(a.locator("#send-status")).toHaveText(/^Odesláno \d{2}:\d{2}$/);

  await expect(b.locator("#alarm")).toBeVisible();
  await expect(b.locator("#alarm-text")).toHaveText(TEXT);
  await expect(b.locator("#alarm-text b")).toHaveCount(0);

  await b.click("#alarm-ack");
  await expect(a.locator("#send-status")).toHaveText(/^Příjemce potvrdil \d{2}:\d{2}$/);

  await a.reload();
  await expect(a.locator("#send-status")).toHaveText(/^Příjemce potvrdil \d{2}:\d{2}$/);
});

test("a short press sends nothing", async ({ browser, request }) => {
  const { a, code } = await setupSender(browser);
  await hold(a, 300);
  await expect(a.locator("#hold-hint")).toHaveText("Držte 1 sekundu");
  await a.waitForTimeout(1500);
  expect(await pollTopic(request, code)).toEqual([]);
});

test("holding for 2.5 s sends exactly one message", async ({ browser, request }) => {
  const { a, code } = await setupSender(browser);
  await hold(a, 2500);
  await expect(a.locator("#send-status")).toHaveText(/^Odesláno/);
  await a.waitForTimeout(1000);
  expect(await pollTopic(request, code)).toHaveLength(1);
});

test("the message text is remembered", async ({ browser }) => {
  const { a } = await setupSender(browser);
  await expect(a.locator("#message")).toHaveValue("Potřebuji pomoc, zavolej mi!");
  await a.fill("#message", "Nový text");
  await a.reload();
  await expect(a.locator("#message")).toHaveValue("Nový text");
});

test("empty text disables the button", async ({ browser }) => {
  const { a } = await setupSender(browser);
  await a.fill("#message", "   ");
  await expect(a.locator("#attention")).toBeDisabled();
  await expect(a.locator("#send-status")).toHaveText("Napište text zprávy");
  await a.fill("#message", "Pomoc");
  await expect(a.locator("#attention")).toBeEnabled();
  await expect(a.locator("#send-status")).toHaveText("");
});

test("send failure shows an error and retry works", async ({ browser }) => {
  const { a } = await setupSender(browser);
  await a.route(NTFY + "/", (route) =>
    route.request().method() === "POST" ? route.fulfill({ status: 500 }) : route.continue(),
  );
  await hold(a, 1200);
  await expect(a.locator("#send-status")).toHaveText("Nepodařilo se odeslat – zkontrolujte internet.");
  await expect(a.locator("#retry")).toBeVisible();
  await expect(a.locator("#retry")).toHaveText("Zkusit znovu");

  await a.unroute(NTFY + "/");
  await a.click("#retry");
  await expect(a.locator("#send-status")).toHaveText(/^Odesláno \d{2}:\d{2}$/);
  await expect(a.locator("#retry")).toBeHidden();
});

test("the alert carries the ntfy fields from the spec", async ({ browser, request }) => {
  const { a, code } = await setupSender(browser);
  await hold(a, 1200);
  await expect(a.locator("#send-status")).toHaveText(/^Odesláno/);
  const [msg] = await pollTopic(request, code);
  expect(msg.priority).toBe(5);
  expect(msg.title).toBe("⚠️ ATTENTION");
  expect(msg.message).toBe("Potřebuji pomoc, zavolej mi!");
  expect(msg.click).toMatch(new RegExp(`#k=${code}&r=b&t=\\d+$`));
});

test("a failed send never shows an older acknowledgement", async ({ browser }) => {
  const ERR = "Nepodařilo se odeslat – zkontrolujte internet.";
  const { a } = await setupSender(browser);
  const b = await newPhone(browser);
  await b.goto(await a.locator("#receiver-link").inputValue());
  await expect(b.locator("#conn-status")).toContainText("Připojeno");
  await hold(a, 1200);
  await b.click("#alarm-ack");
  await expect(a.locator("#send-status")).toHaveText(/^Příjemce potvrdil/);

  await a.route(NTFY + "/", (route) =>
    route.request().method() === "POST" ? route.fulfill({ status: 500 }) : route.continue(),
  );
  await hold(a, 1200);
  await expect(a.locator("#send-status")).toHaveText(ERR);

  // Coming back to the page (e.g. from the dialer) reconnects the ack subscription.
  await a.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await a.waitForTimeout(1500);
  await expect(a.locator("#send-status")).toHaveText(ERR);

  await a.reload();
  await a.waitForTimeout(1500);
  await expect(a.locator("#send-status")).toHaveText(ERR);
  await expect(a.locator("#retry")).toBeVisible();
});
