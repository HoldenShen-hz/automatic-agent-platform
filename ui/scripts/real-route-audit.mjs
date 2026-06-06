import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(uiRoot, "..");
const featureRegistryPath = path.join(uiRoot, "apps/web/src/feature-registry.ts");
const outputDir = path.join(repoRoot, "data/ui-route-audit");
const outputPath = path.join(outputDir, "latest.json");
const baseUrl = process.env.AA_UI_BASE_URL?.trim() || "http://localhost:5173";

function normalizeRoutes(source) {
  const matches = [...source.matchAll(/path:\s*"([^"]+)"/g)].map((match) => match[1]);
  const normalized = matches.map((route) => {
    if (route.startsWith("/")) {
      return route;
    }
    return `/operations/release-console/${route}`;
  });
  return [...new Set(normalized)];
}

function sanitizeMessage(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function containsTransientLoadingMarker(text) {
  return (
    text.includes("Loading dashboard snapshot") ||
    text.includes("Loading stability summary") ||
    text.includes("Loading...") ||
    text.includes("WSconnecting") ||
    text.includes("需要启用 JavaScript") ||
    text.includes("正在加载 Automatic Agent Platform Web Shell")
  );
}

function isBenignConsoleError(message) {
  return message.includes("The Content Security Policy directive 'frame-ancestors' is ignored when delivered via a <meta> element.");
}

function isBenignRequestFailure(failure) {
  return failure.failureText === "net::ERR_ABORTED";
}

function isInterestingResponse(response) {
  const status = response.status();
  if (status < 400) {
    return false;
  }
  const resourceType = response.request().resourceType();
  return resourceType === "document" || resourceType === "fetch" || resourceType === "xhr" || resourceType === "script";
}

async function collectVisibleHeadings(page) {
  return page.locator("h1, h2, h3").evaluateAll((nodes) => nodes
    .map((node) => {
      const element = node;
      const text = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (text.length === 0) {
        return null;
      }
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") {
        return null;
      }
      return text;
    })
    .filter((text) => text != null));
}

async function readBodyText(page) {
  return sanitizeMessage(await page.locator("body").evaluate((node) => (node instanceof HTMLElement ? node.innerText : "")).catch(() => ""));
}

async function waitForRouteContentToSettle(page) {
  const startedAt = Date.now();
  let previousText = "";
  let stableIterations = 0;

  while (Date.now() - startedAt < 8_000) {
    const currentText = await readBodyText(page);
    const settled =
      currentText.length > 0 &&
      currentText === previousText &&
      !containsTransientLoadingMarker(currentText);

    if (settled) {
      stableIterations += 1;
      if (stableIterations >= 2) {
        return currentText;
      }
    } else {
      stableIterations = 0;
    }

    previousText = currentText;
    await page.waitForTimeout(350);
  }

  return readBodyText(page);
}

async function run() {
  const source = await fs.readFile(featureRegistryPath, "utf8");
  const routes = normalizeRoutes(source);
  await fs.mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const routeResults = [];

  try {
    for (const route of routes) {
      const consoleErrors = [];
      const pageErrors = [];
      const responseFailures = [];
      const requestFailures = [];

      const onConsole = (message) => {
        if (message.type() === "error") {
          const text = sanitizeMessage(message.text());
          if (!isBenignConsoleError(text)) {
            consoleErrors.push(text);
          }
        }
      };
      const onPageError = (error) => {
        pageErrors.push(sanitizeMessage(error.message));
      };
      const onResponse = (response) => {
        if (!isInterestingResponse(response)) {
          return;
        }
        responseFailures.push({
          status: response.status(),
          method: response.request().method(),
          resourceType: response.request().resourceType(),
          url: response.url(),
        });
      };
      const onRequestFailed = (request) => {
        const failure = {
          method: request.method(),
          resourceType: request.resourceType(),
          url: request.url(),
          failureText: request.failure()?.errorText ?? "unknown_failure",
        };
        if (!isBenignRequestFailure(failure)) {
          requestFailures.push(failure);
        }
      };

      page.on("console", onConsole);
      page.on("pageerror", onPageError);
      page.on("response", onResponse);
      page.on("requestfailed", onRequestFailed);

      let navigationError = null;
      try {
        await page.goto(new URL(route, baseUrl).toString(), {
          waitUntil: "domcontentloaded",
          timeout: 20_000,
        });
        await page.waitForFunction(
          () => {
            const root = document.querySelector("#root");
            if (root == null) {
              return false;
            }
            return !root.textContent?.includes("正在加载 Automatic Agent Platform Web Shell");
          },
          { timeout: 15_000 },
        );
      } catch (error) {
        navigationError = sanitizeMessage(error instanceof Error ? error.message : String(error));
      }

      const bodyText = await waitForRouteContentToSettle(page);
      const headings = await collectVisibleHeadings(page).catch(() => []);

      routeResults.push({
        route,
        ok: navigationError == null && consoleErrors.length === 0 && pageErrors.length === 0 && responseFailures.length === 0 && requestFailures.length === 0,
        navigationError,
        headings,
        bodyPreview: bodyText.slice(0, 500),
        consoleErrors,
        pageErrors,
        responseFailures,
        requestFailures,
      });

      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("response", onResponse);
      page.off("requestfailed", onRequestFailed);
    }
  } finally {
    await browser.close();
  }

  const failures = routeResults.filter((result) => !result.ok);
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    totalRoutes: routeResults.length,
    failedRoutes: failures.length,
    routes: routeResults,
  };

  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

await run();
