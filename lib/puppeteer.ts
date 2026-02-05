import chromium from "@sparticuz/chromium";
import * as fs from "fs/promises";
import * as path from "path";

type LaunchOptions = {
  args: string[];
  executablePath: string;
  headless: boolean | "shell";
  defaultViewport?: { width: number; height: number };
};

const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
);

const WINDOWS_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `C:\\Users\\${process.env.USERNAME || "Default"}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

const MAC_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

const LINUX_CANDIDATES = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

const getLocalCandidates = () => {
  switch (process.platform) {
    case "win32":
      return WINDOWS_CANDIDATES;
    case "darwin":
      return MAC_CANDIDATES;
    default:
      return LINUX_CANDIDATES;
  }
};

const firstExistingPath = async (candidates: string[]) => {
  for (const p of candidates) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // try next
    }
  }
  return undefined;
};

const ensureChromiumLibs = () => {
  const libCandidates = ["/tmp/al2/lib", "/tmp/al2023/lib"];
  const current = process.env.LD_LIBRARY_PATH || "";
  const currentParts = current ? current.split(":") : [];
  const merged = [...new Set([...libCandidates, ...currentParts])];
  process.env.LD_LIBRARY_PATH = merged.join(":");
};

export const getPuppeteerLaunchOptions = async (): Promise<LaunchOptions> => {
  let executablePath = process.env.PUPPETEER_EXEC_PATH;
  let args: string[] = [];
  let headless: boolean | "shell" = true;
  let defaultViewport: LaunchOptions["defaultViewport"];

  if (isServerless) {
    if (!process.env.AWS_EXECUTION_ENV && !process.env.AWS_LAMBDA_JS_RUNTIME) {
      process.env.AWS_EXECUTION_ENV = "AWS_Lambda_nodejs20.x";
    }
    if (!executablePath) {
      const binPath = path.join(
        process.cwd(),
        "node_modules",
        "@sparticuz",
        "chromium",
        "bin",
      );
      executablePath = await chromium.executablePath(binPath);
    }
    ensureChromiumLibs();
    args = chromium.args;
    const chromiumHeadless = chromium.headless as boolean | "new" | "shell";
    headless = chromiumHeadless === "new" ? true : chromiumHeadless;
    defaultViewport = chromium.defaultViewport;
  } else {
    if (!executablePath) {
      executablePath = await firstExistingPath(getLocalCandidates());
    }
    if (!executablePath) {
      try {
        executablePath = await chromium.executablePath();
      } catch {
        // ignore
      }
    }
    args = ["--no-sandbox", "--disable-setuid-sandbox"];
  }

  if (!executablePath) {
    throw new Error("Chrome/Chromium executable not found.");
  }

  return { args, executablePath, headless, defaultViewport };
};
