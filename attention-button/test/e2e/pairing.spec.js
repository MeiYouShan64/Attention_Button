import { test, expect } from "@playwright/test";
import { APP, newPhone } from "./helpers.js";
import { generateCode } from "../../js/channel.js";

const CODE_RE = /^att-[a-z2-7]{16}$/;

test("first launch shows role selection", async ({ browser }) => {
  const page = await newPhone(browser);
  await page.goto(APP);
  await expect(page.locator("#screen-role")).toBeVisible();
  await expect(page.locator("#choose-sender")).toHaveText("Tento telefon ODESÍLÁ (A)");
  await expect(page.locator("#choose-receiver")).toHaveText("Tento telefon PŘIJÍMÁ (B)");
});

test("pairing via the receiver link", async ({ browser }) => {
  const a = await newPhone(browser);
  const b = await newPhone(browser);
  await a.goto(APP);
  await a.click("#choose-sender");
  await expect(a.locator("#screen-sender")).toBeVisible();
  const code = await a.locator("#code-sender").textContent();
  expect(code).toMatch(CODE_RE);

  const link = await a.locator("#receiver-link").inputValue();
  await b.goto(link);
  await expect(b.locator("#screen-receiver")).toBeVisible();
  await expect(b.locator("#code-receiver")).toHaveText(code);
  expect(b.url()).not.toContain("#k=");
});

test("roles survive a reload", async ({ browser }) => {
  const a = await newPhone(browser);
  const b = await newPhone(browser);
  await a.goto(APP);
  await a.click("#choose-sender");
  const code = await a.locator("#code-sender").textContent();
  await b.goto(await a.locator("#receiver-link").inputValue());
  await expect(b.locator("#screen-receiver")).toBeVisible();

  await a.reload();
  await b.reload();
  await expect(a.locator("#screen-sender")).toBeVisible();
  await expect(a.locator("#code-sender")).toHaveText(code);
  await expect(b.locator("#screen-receiver")).toBeVisible();
  await expect(b.locator("#code-receiver")).toHaveText(code);
});

test("manual code entry validates the code", async ({ browser }) => {
  const b = await newPhone(browser);
  await b.goto(APP);
  await b.click("#choose-receiver");
  await b.fill("#manual-code", "att-bad");
  await b.click("#manual-code-save");
  await expect(b.locator("#role-error")).toHaveText("Neplatný kód");
  await expect(b.locator("#screen-receiver")).toBeHidden();

  const code = generateCode();
  await b.fill("#manual-code", code);
  await b.click("#manual-code-save");
  await expect(b.locator("#screen-receiver")).toBeVisible();
  await expect(b.locator("#code-receiver")).toHaveText(code);
});

test("new code after confirmation", async ({ browser }) => {
  const a = await newPhone(browser);
  await a.goto(APP);
  await a.click("#choose-sender");
  const before = await a.locator("#code-sender").textContent();
  a.once("dialog", (d) => d.accept());
  await a.click("#new-code");
  await expect(a.locator("#code-sender")).not.toHaveText(before);
  await expect(a.locator("#code-sender")).toHaveText(CODE_RE);
});

test("a sender opening its own pairing link stays a sender unless confirmed", async ({ browser }) => {
  const a = await newPhone(browser);
  await a.goto(APP);
  await a.click("#choose-sender");
  const link = await a.locator("#receiver-link").inputValue();

  await a.goto("about:blank");
  a.once("dialog", (d) => d.dismiss());
  await a.goto(link);
  await expect(a.locator("#screen-sender")).toBeVisible();

  await a.goto("about:blank");
  a.once("dialog", (d) => d.accept());
  await a.goto(link);
  await expect(a.locator("#screen-receiver")).toBeVisible();
});
