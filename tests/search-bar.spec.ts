import { test, expect } from "@playwright/test";
import { MainPage } from "../pages/MainPage";

test.describe("Main Page Test Suite", () => {
  let mainPage: MainPage;

  test.beforeEach(async ({ page }) => {
    // Instantiate the POM and navigate before each test
    mainPage = new MainPage(page);
    await mainPage.goto();
  });

  test("should verify the main heading is visible", async () => {
    await expect(mainPage.mainHeading).toBeVisible();
    await expect(mainPage.mainHeading).toContainText("Playwright");
  });

  test("should navigate to the installation docs when clicking Get Started", async ({ page }) => {
    await mainPage.clickGetStarted();
    // Asserting the URL changed to the docs page.
    await expect(page).toHaveURL(/.*docs\/intro/);
  });

  test("should search for Locator content", async ({ page }) => {
    await mainPage.searchFor("Locators");
    // Asserting the URL changed to the Locators page.
    await expect(page).toHaveURL(/.*docs\/locators/);
  });
});
