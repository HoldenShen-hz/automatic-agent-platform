import { createGzip } from "node:zlib";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

const distRoot = join(process.cwd(), "apps/web/dist/assets");
const budgets = {
  maxJsChunkBytes: 100 * 1024, // §7.3.1: main<200KB gz, lazy chunk<100KB gz – use stricter 100KB limit for all chunks
  maxCssChunkBytes: 150 * 1024,
  totalBytes: 1200 * 1024,
};

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
const largestJs = jsAssets.reduce((largest, asset) => (asset.gzipBytes ?? asset.bytes) > (largest.gzipBytes ?? largest.bytes) ? asset : largest, { file: "none", bytes: 0, gzipBytes: 0 });
const largestCss = cssAssets.reduce((largest, asset) => (asset.gzipBytes ?? asset.bytes) > (largest.gzipBytes ?? largest.bytes) ? asset : largest, { file: "none", bytes: 0, gzipBytes: 0 });
const totalGzipBytes = assets.reduce((total, asset) => total + (asset.gzipBytes ?? asset.bytes), 0);

if ((largestJs.gzipBytes ?? largestJs.bytes) > budgets.maxJsChunkBytes) {
  throw new Error(`perf_budget.js_chunk_exceeded:${largestJs.file}:${largestJs.gzipBytes ?? largestJs.bytes}`);
}
if ((largestCss.gzipBytes ?? largestCss.bytes) > budgets.maxCssChunkBytes) {
  throw new Error(`perf_budget.css_chunk_exceeded:${largestCss.file}:${largestCss.gzipBytes ?? largestCss.bytes}`);
}
if (totalGzipBytes > budgets.totalBytes) {
  throw new Error(`perf_budget.total_exceeded:${totalGzipBytes}`);
}

console.log(JSON.stringify({ budgets, largestJs, largestCss, totalGzipBytes }, null, 2));
