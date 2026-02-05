import * as fs from "fs/promises";
import * as path from "path";
import type { Page } from "puppeteer-core";

let cachedCss: string | null = null;

export const getPdfFontCss = async () => {
  if (cachedCss) return cachedCss;

  const regularPath = path.join(
    process.cwd(),
    "public",
    "fonts",
    "verdana.ttf",
  );
  const boldPath = path.join(process.cwd(), "public", "fonts", "verdanab.ttf");

  const [regular, bold] = await Promise.all([
    fs.readFile(regularPath),
    fs.readFile(boldPath),
  ]);

  const regularBase64 = regular.toString("base64");
  const boldBase64 = bold.toString("base64");

  cachedCss = `
  @font-face {
    font-family: 'PdfFont';
    src:
      local('Verdana'),
      local('Verdana Regular'),
      url(data:font/truetype;base64,${regularBase64}) format('truetype');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: 'PdfFont';
    src:
      local('Verdana Bold'),
      local('Verdana-Bold'),
      url(data:font/truetype;base64,${boldBase64}) format('truetype');
    font-weight: 700;
    font-style: normal;
    font-display: swap;
  }
`;

  return cachedCss;
};

export const waitForPdfFonts = async (page: Page) => {
  try {
    // Wait for DOM to be fully rendered
    await page.waitForFunction(
      () => {
        const tables = document.querySelectorAll("table");
        const content = document.body.textContent || "";
        return tables.length > 0 && content.length > 100;
      },
      { timeout: 10000 },
    );

    // Try to wait for fonts, but don't fail if it doesn't work
    try {
      await page.waitForFunction(
        () =>
          (document as unknown as { fonts?: FontFaceSet }).fonts?.check?.(
            "12px PdfFont",
          ),
        { timeout: 5000 },
      );
    } catch {
      // Font readiness check failed, continue anyway
    }

    // Give fonts extra time to render (especially important in serverless)
    await page.evaluate(() => {
      return new Promise((resolve) => setTimeout(resolve, 1000));
    });

    // Final DOM stability check
    await page.waitForFunction(
      () => {
        const body = document.body;
        return body && body.children.length > 0;
      },
      { timeout: 5000 },
    );
  } catch (error) {
    console.warn("Font/content readiness check had issues:", error);
    // Don't throw - continue with PDF generation anyway
  }
};
