import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  outputDir: "work/playwright-results",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8765", viewport: { width: 412, height: 915 },
    launchOptions: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE } : {}
  },
  projects: [{ name: "firefox", use: { browserName: "firefox" } }],
  webServer: { command: "node scripts/fixture-server.mjs", url: "http://127.0.0.1:8765", reuseExistingServer: false }
});
