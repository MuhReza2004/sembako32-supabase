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
    await page.waitForFunction(
      () =>
        (document as unknown as { fonts?: FontFaceSet }).fonts?.check?.(
          "12px PdfFont",
        ),
      { timeout: 15000 },
    );
    await page.evaluate(async () => {
      const fonts = (document as unknown as { fonts?: FontFaceSet }).fonts;
      if (fonts?.ready) {
        await fonts.ready;
      }
    });
  } catch {
    // ignore font readiness failures
  }
};
