import type { Page } from "puppeteer-core";

/**
 * Debug PDF rendering issues in serverless environment
 * This helps identify why content is not appearing in generated PDFs
 */
export const debugPdfContent = async (page: Page, documentName: string) => {
  try {
    const debugInfo = await page.evaluate(() => {
      const bodyText = document.body.textContent || "";
      const tables = document.querySelectorAll("table");
      const paragraphs = document.querySelectorAll("p");
      const divs = document.querySelectorAll("div");
      
      // Check if fonts are loaded
      const styles = window.getComputedStyle(document.body);
      
      return {
        bodyTextLength: bodyText.length,
        tableCount: tables.length,
        paragraphCount: paragraphs.length,
        divCount: divs.length,
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        color: styles.color,
        hasContent: bodyText.trim().length > 50,
        firstTableHeaders: tables.length > 0 
          ? Array.from(tables[0].querySelectorAll("th")).map(th => th.textContent?.trim())
          : [],
        visibleElements: {
          header: !!document.querySelector(".header"),
          table: !!document.querySelector("table"),
          total: !!document.querySelector(".amount-highlight"),
          customerSection: !!document.querySelector(".customer-section"),
        }
      };
    });

    console.log(`[PDF DEBUG] ${documentName}:`, JSON.stringify(debugInfo, null, 2));
    return debugInfo;
  } catch (error) {
    console.error(`[PDF DEBUG ERROR] ${documentName}:`, error);
    return null;
  }
};

/**
 * Take screenshot for debugging PDF rendering
 */
export const takeDebugScreenshot = async (
  page: Page,
  filename: string,
) => {
  try {
    const screenshotPath = `/tmp/${filename}-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`[PDF SCREENSHOT] Saved to: ${screenshotPath}`);
    return screenshotPath;
  } catch (error) {
    console.error("[PDF SCREENSHOT ERROR]:", error);
    return null;
  }
};
