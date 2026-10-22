import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/e2e",
  workers: 1,
  timeout: 20000,
  expect: { timeout: 5000 },
  use: { browserName: "chromium" },
  webServer: {
    command: "node test/serve.js",
    url: "http://localhost:4173/js/channel.js",
    reuseExistingServer: false,
  },
});
