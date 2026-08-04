import { test, expect } from "@playwright/test";
import { ScannerPage } from "../fixtures/ScannerPage";
import { DiscordClient } from "../fixtures/DiscordClient";

test("Targeted scan for high-res images using Network Interception", async ({ page }) => {
  const targetUrl = process.env.TARGET_URL;
  const webhookUrl = process.env.DISCORD_WEBHOOK;
  const targetSelector = process.env.TARGET_SELECTOR || "body";

  if (!targetUrl || !webhookUrl) {
    throw new Error("Missing environment variables.");
  }

  const scannerPage = new ScannerPage(page);
  const discordClient = new DiscordClient(webhookUrl);

  // 1. Start listening to the network
  await scannerPage.enableNetworkInterceptor();

  // 2. Navigate and trigger downloads
  await scannerPage.visit(targetUrl);

  // 3. Extract text from the DOM and retrieve captured network images
  const layoutData = await scannerPage.scanTargetedSection(targetSelector);

  expect(layoutData.texts.length).toBeGreaterThan(0);

  await discordClient.sendReport(targetUrl, layoutData.texts, layoutData.images);

  console.log(`Successfully intercepted ${layoutData.images.length} high-res images (>50KB) directly from the network.`);
});
