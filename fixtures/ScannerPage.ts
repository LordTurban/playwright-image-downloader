import { Page, Locator } from "@playwright/test";

export interface ScannedStructure {
  texts: string[];
  images: { src: string; alt: string }[];
}

export class ScannerPage {
  readonly page: Page;
  private networkImages: Set<string> = new Set();

  constructor(page: Page) {
    this.page = page;
  }

  async enableNetworkInterceptor() {
    this.page.on("response", async (response) => {
      if (response.request().resourceType() === "image" && response.status() === 200) {
        const url = response.url();
        if (url.startsWith("data:") || url.includes(".svg")) return;

        const contentLength = response.headers()["content-length"];
        if (contentLength) {
          const sizeInBytes = parseInt(contentLength, 10);
          // Lowered the threshold slightly to catch highly-optimized webp images
          if (sizeInBytes > 30000) {
            this.networkImages.add(url);
          }
        }
      }
    });
  }

  async visit(url: string) {
    await this.page.goto(url, { waitUntil: "domcontentloaded" });

    await this.page.evaluate(async () => {
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      for (let i = 0; i < document.body.scrollHeight; i += 500) {
        window.scrollTo(0, i);
        await delay(100);
      }
    });

    await this.page.waitForTimeout(2000);
  }

  async scanTargetedSection(containerSelector: string): Promise<ScannedStructure> {
    const container = this.page.locator(containerSelector);
    await container.waitFor({ state: "visible" });

    // 1. Scrape the DOM for BOTH <img> tags and CSS background images
    const domImages = await container.evaluate((el: HTMLElement) => {
      const texts: string[] = [];
      const textNodes = el.querySelectorAll("h1, h2, h3, p");
      textNodes.forEach((node) => {
        const text = node.textContent?.trim();
        if (text && text.length > 0 && !texts.includes(text)) texts.push(text);
      });

      const containerImageBases: { originalUrl: string; baseUrl: string; alt: string }[] = [];

      const getBaseUrl = (urlStr: string) => {
        try {
          const urlObj = new URL(urlStr, window.location.origin);
          // Strip out size modifiers in filenames (e.g. -300x300.jpg -> .jpg)
          let cleanPath = urlObj.pathname.replace(/-\d+x\d+(?=\.[a-zA-Z]+$)/, "");
          return urlObj.origin + cleanPath;
        } catch (e) {
          return null;
        }
      };

      // Target 1: Standard Images
      const imgNodes = el.querySelectorAll("img");
      imgNodes.forEach((img) => {
        // currentSrc is the most accurate, but we fall back to data-src and src
        const srcToUse = img.currentSrc || img.getAttribute("data-src") || img.src;
        if (srcToUse && !srcToUse.startsWith("data:") && !srcToUse.includes(".svg")) {
          const base = getBaseUrl(srcToUse);
          if (base) {
            containerImageBases.push({
              originalUrl: srcToUse, // Keep the original as a fallback
              baseUrl: base,
              alt: img.alt || "Content Image",
            });
          }
        }
      });

      // Target 2: CSS Background Images (often used for banners/cards)
      const allElements = el.querySelectorAll("*");
      allElements.forEach((node) => {
        const style = window.getComputedStyle(node);
        if (style.backgroundImage && style.backgroundImage !== "none") {
          // Extract the URL from `url("...")`
          const match = style.backgroundImage.match(/^url\(["']?(.+?)["']?\)$/);
          if (match && match[1] && !match[1].startsWith("data:") && !match[1].includes(".svg")) {
            const base = getBaseUrl(match[1]);
            if (base) {
              containerImageBases.push({
                originalUrl: match[1],
                baseUrl: base,
                alt: "Background Image", // Backgrounds don't have alt attributes natively
              });
            }
          }
        }
      });

      return { texts, containerImageBases };
    });

    // 2. Correlate with Network Intercepts, with a Guaranteed Fallback
    const finalImages: { src: string; alt: string }[] = [];
    const interceptedUrls = Array.from(this.networkImages);

    for (const domImg of domImages.containerImageBases) {
      // Look for a network image that includes our base URL (Fuzzy Match)
      const highResMatch = interceptedUrls.find((netUrl) => {
        try {
          const netUrlObj = new URL(netUrl);
          const netCleanPath = netUrlObj.pathname.replace(/-\d+x\d+(?=\.[a-zA-Z]+$)/, "");
          const netBase = netUrlObj.origin + netCleanPath;
          return netBase === domImg.baseUrl;
        } catch {
          return false;
        }
      });

      // THE FIX: If we found a network match, use it. If NOT, use the DOM URL.
      if (highResMatch) {
        finalImages.push({ src: highResMatch, alt: domImg.alt });
      } else {
        // We now guarantee the image is not left behind!
        finalImages.push({ src: domImg.originalUrl, alt: domImg.alt });
      }
    }

    // 3. Remove duplicates
    const uniqueImages = Array.from(new Map(finalImages.map((item) => [item.src, item])).values());

    return {
      texts: domImages.texts,
      images: uniqueImages,
    };
  }
}
