import type { Page } from "puppeteer-core";

const sanitizeFilename = (value: string) => {
  const safe = value.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 80);
  return safe || "pdf-debug";
};

export const shouldTakePdfScreenshot = () =>
  process.env.PDF_DEBUG_SCREENSHOT === "1";

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
      const fonts = (document as unknown as { fonts?: FontFaceSet }).fonts;
      const pdfFontReady =
        fonts?.check?.("12px PdfFont") ?? null;
      const fontsStatus = fonts?.status ?? "unsupported";
      const inlineBodyFont = document.body?.style?.fontFamily || "";
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
        inlineBodyFont,
        pdfFontReady,
        fontsStatus,
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

    return debugInfo;
  } catch (error) {
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
    const safeName = sanitizeFilename(filename);
    const screenshotPath = `/tmp/${safeName}-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  } catch (error) {
    return null;
  }
};
