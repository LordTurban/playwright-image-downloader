import { Page, Locator } from "@playwright/test";

export class MainPage {
  readonly page: Page;
  readonly mainHeading: Locator;
  readonly getStartedButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    //Define locators using user-facing attributes where possible
    this.mainHeading = page.locator("h1");
    this.getStartedButton = page.locator("a", { hasText: "Get started" });
    this.searchInput = page.getByPlaceholder("Search");
  }

  /**
   * Navigates to the main page.
   */
  async goto() {
    await this.page.goto("https://playwright.dev/");
  }

  /**
   * Clicks the 'Get started' button.
   */
  async clickGetStarted() {
    await this.getStartedButton.click();
  }

  /**
   * Performs a search using the top search bar
   * @param term The text to search for
   */
  async searchFor(term: string) {
    // Playwright's site uses a keyboard shortcut or click to open search first.
    await this.page.locator(".DocSearch-Button").click();
    await this.searchInput.fill(term);
    await this.page.getByRole("link", { name: term, exact: true }).click();
  }
}
