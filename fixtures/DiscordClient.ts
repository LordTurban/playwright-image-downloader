import { request } from "@playwright/test";

export class DiscordClient {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async sendReport(targetUrl: string, texts: string[], images: any[]) {
    const apiContext = await request.newContext();

    // 1. Send the Header Message
    await apiContext.post(this.webhookUrl, {
      data: { content: `**Page Layout Scan Started**\n**URL:** ${targetUrl}\nTotal Images Found: ${images.length}` },
    });

    // 2. Send Images in Batches of 10 to avoid the 2000 character limit
    const chunkSize = 10;
    for (let i = 0; i < images.length; i += chunkSize) {
      const chunk = images.slice(i, i + chunkSize);

      // Formatting the chunk into markdown
      const imageList = chunk
        .map((img) => {
          // Fallback text if alt is missing to ensure valid markdown formatting
          const altText = img.alt ? img.alt.substring(0, 50) : "Image";
          return `- [${altText}](${img.src})`;
        })
        .join("\n");

      await apiContext.post(this.webhookUrl, {
        data: { content: `**Images ${i + 1} to ${Math.min(i + chunkSize, images.length)}:**\n${imageList}` },
      });
    }

    await apiContext.dispose();
  }
}
