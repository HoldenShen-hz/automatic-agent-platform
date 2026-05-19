import { createGzip } from "node:zlib";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

const distRoot = join(process.cwd(), "apps/web/dist/assets");
const lighthouseReportPath = process.env.LIGHTHOUSE_REPORT_PATH ?? join(process.cwd(), ".lighthouseci", "manifest.json");
const budgets = {
  maxJsChunkBytes: 100 * 1024, // §7.3.1: main<200KB gz, lazy chunk<100KB gz – use stricter 100KB limit for all chunks
  maxCssChunkBytes: 150 * 1024,
  totalBytes: 1200 * 1024,
  maxEchartsGzBytes: 150 * 1024,
  maxMonacoGzBytes: 200 * 1024,
  maxFirstContentfulPaintMs: 2000,
  maxInteractionToNextPaintMs: 200,
  minPerformanceScore: 0.8,
};

if (!existsSync(distRoot)) {
  if (process.env.CI === "true") {
    throw new Error(`perf_budget.dist_root_missing:${distRoot}`);
  }
  console.warn(`perf_budget.dist_root_missing:${distRoot}`);
  process.exit(0);
}

async function gzipSize(filePath) {
  const { createReadStream } = await import("node:fs");
  const chunks = [];
  await pipeline(createReadStream(filePath), createGzip(), async function* (source) {
    for await (const chunk of source) {
      chunks.push(chunk);
    }
  });
  return Buffer.concat(chunks).length;
}

function loadLighthouseSummaries() {
  if (!existsSync(lighthouseReportPath)) {
    return [];
  }
  try {
    const manifest = JSON.parse(readFileSync(lighthouseReportPath, "utf8"));
    const entries = Array.isArray(manifest) ? manifest : manifest?.items;
    if (!Array.isArray(entries)) {
      return [];
    }
    return entries.flatMap((entry) => {
      const reportPath = typeof entry?.jsonPath === "string" ? join(process.cwd(), entry.jsonPath) : null;
      if (reportPath == null || !existsSync(reportPath)) {
        return [];
      }
      const report = JSON.parse(readFileSync(reportPath, "utf8"));
      return [{
        path: reportPath,
        performanceScore: report?.categories?.performance?.score ?? null,
        firstContentfulPaintMs: report?.audits?.["first-contentful-paint"]?.numericValue ?? null,
        interactionToNextPaintMs: report?.audits?.["interaction-to-next-paint"]?.numericValue ?? null,
      }];
    });
  } catch {
    return [];
  }
}

const assets = readdirSync(distRoot).map((file) => ({
  file,
  bytes: statSync(join(distRoot, file)).size,
  gzipBytes: null as number | null,
}));

for (const asset of assets) {
  try {
    asset.gzipBytes = await gzipSize(join(distRoot, asset.file));
  } catch {
    asset.gzipBytes = asset.bytes; // fallback to raw if gzip fails
  }
}

const jsAssets = assets.filter((asset) => asset.file.endsWith(".js"));
const cssAssets = assets.filter((asset) => asset.file.endsWith(".css"));
const echartsAssets = assets.filter((asset) => asset.file.toLowerCase().includes("echarts"));
const monacoAssets = assets.filter((asset) => asset.file.toLowerCase().includes("monaco"));
const largestJs = jsAssets.reduce((largest, asset) => (asset.gzipBytes ?? asset.bytes) > (largest.gzipBytes ?? largest.bytes) ? asset : largest, { file: "none", bytes: 0, gzipBytes: 0 });
const largestCss = cssAssets.reduce((largest, asset) => (asset.gzipBytes ?? asset.bytes) > (largest.gzipBytes ?? largest.bytes) ? asset : largest, { file: "none", bytes: 0, gzipBytes: 0 });
const totalEchartsGzipBytes = echartsAssets.reduce((total, asset) => total + (asset.gzipBytes ?? asset.bytes), 0);
const totalMonacoGzipBytes = monacoAssets.reduce((total, asset) => total + (asset.gzipBytes ?? asset.bytes), 0);
const totalGzipBytes = assets.reduce((total, asset) => total + (asset.gzipBytes ?? asset.bytes), 0);
const lighthouseSummaries = loadLighthouseSummaries();

if ((largestJs.gzipBytes ?? largestJs.bytes) > budgets.maxJsChunkBytes) {
  throw new Error(`perf_budget.js_chunk_exceeded:${largestJs.file}:${largestJs.gzipBytes ?? largestJs.bytes}`);
}
if ((largestCss.gzipBytes ?? largestCss.bytes) > budgets.maxCssChunkBytes) {
  throw new Error(`perf_budget.css_chunk_exceeded:${largestCss.file}:${largestCss.gzipBytes ?? largestCss.bytes}`);
}
if (totalEchartsGzipBytes > budgets.maxEchartsGzBytes) {
  throw new Error(`perf_budget.echarts_exceeded:${totalEchartsGzipBytes}`);
}
if (totalMonacoGzipBytes > budgets.maxMonacoGzBytes) {
  throw new Error(`perf_budget.monaco_exceeded:${totalMonacoGzipBytes}`);
}
if (totalGzipBytes > budgets.totalBytes) {
  throw new Error(`perf_budget.total_exceeded:${totalGzipBytes}`);
}
for (const summary of lighthouseSummaries) {
  if (typeof summary.performanceScore === "number" && summary.performanceScore < budgets.minPerformanceScore) {
    throw new Error(`perf_budget.lighthouse_performance_exceeded:${summary.path}:${summary.performanceScore}`);
  }
  if (typeof summary.firstContentfulPaintMs === "number" && summary.firstContentfulPaintMs > budgets.maxFirstContentfulPaintMs) {
    throw new Error(`perf_budget.lighthouse_fcp_exceeded:${summary.path}:${summary.firstContentfulPaintMs}`);
  }
  if (typeof summary.interactionToNextPaintMs === "number" && summary.interactionToNextPaintMs > budgets.maxInteractionToNextPaintMs) {
    throw new Error(`perf_budget.lighthouse_inp_exceeded:${summary.path}:${summary.interactionToNextPaintMs}`);
  }
}

console.log(JSON.stringify({
  budgets,
  largestJs,
  largestCss,
  totalEchartsGzipBytes,
  totalMonacoGzipBytes,
  totalGzipBytes,
  lighthouseSummaries,
}, null, 2));
