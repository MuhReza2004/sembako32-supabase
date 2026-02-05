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
      const invoiceNum = document.querySelector(".no-invoice");
      const customerInfo = document.querySelector(".customer-section");
      const totalAmount = document.querySelector(".amount-highlight");
      
      // Get all text content for verification
      const firstParagraph = document.querySelector("p")?.textContent?.trim() || "";
      const firstTable = tables[0];
      const tableHeads = firstTable ? Array.from(firstTable.querySelectorAll("th")).map(th => th.textContent?.trim()) : [];
      const tableRows = firstTable ? firstTable.querySelectorAll("tbody tr").length : 0;
      
      // Check if fonts are loaded
      const styles = window.getComputedStyle(document.body);
      const bodyHtml = document.body.innerHTML.substring(0, 500);
      
      return {
        bodyTextLength: bodyText.length,
        bodyTextPreview: bodyText.substring(0, 200),
        tableCount: tables.length,
        tableHeadersCount: tableHeads.length,
        tableRowsCount: tableRows,
        paragraphCount: paragraphs.length,
        divCount: divs.length,
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        color: styles.color,
        hasContent: bodyText.trim().length > 50,
        firstParagraph: firstParagraph.substring(0, 100),
        tableHeaders: tableHeads,
        visibleElements: {
          header: !!document.querySelector(".header"),
          table: !!document.querySelector("table"),
          total: !!totalAmount,
          customerSection: !!customerInfo,
          invoiceNumber: !!invoiceNum,
        },
        htmlPreview: bodyHtml,
      };
    });

    console.log(`[PDF DEBUG] ${documentName}:`, JSON.stringify(debugInfo, null, 2));
    
    // Validate critical content
    if (debugInfo.bodyTextLength < 100) {
      console.error(`[PDF DEBUG ERROR] ${documentName}: Content too short (${debugInfo.bodyTextLength} chars)`);
    }
    if (debugInfo.tableCount === 0) {
      console.error(`[PDF DEBUG ERROR] ${documentName}: No tables found in HTML`);
    }
    if (!debugInfo.visibleElements.table) {
      console.error(`[PDF DEBUG ERROR] ${documentName}: Table element not found`);
    }
    
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
