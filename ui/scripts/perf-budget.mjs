import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const distRoot = join(process.cwd(), "apps/web/dist/assets");
// §7.3.1 perf budget: main<200KB gz/lazy chunk<100KB gz
// With ~2.5-3x gzip ratio, raw limits are ~500KB/250KB
const budgets = {
  maxJsChunkBytes: 250 * 1024,   // ~100KB gz per lazy chunk
  maxCssChunkBytes: 100 * 1024,  // ~40KB gz
  totalBytes: 600 * 1024,        // ~200-240KB gz total
};

const assets = readdirSync(distRoot).map((file) => ({
  file,
  bytes: statSync(join(distRoot, file)).size,
}));

const jsAssets = assets.filter((asset) => asset.file.endsWith(".js"));
const cssAssets = assets.filter((asset) => asset.file.endsWith(".css"));
const largestJs = jsAssets.reduce((largest, asset) => asset.bytes > largest.bytes ? asset : largest, { file: "none", bytes: 0 });
const largestCss = cssAssets.reduce((largest, asset) => asset.bytes > largest.bytes ? asset : largest, { file: "none", bytes: 0 });
const totalBytes = assets.reduce((total, asset) => total + asset.bytes, 0);

if (largestJs.bytes > budgets.maxJsChunkBytes) {
  throw new Error(`perf_budget.js_chunk_exceeded:${largestJs.file}:${largestJs.bytes}`);
}
if (largestCss.bytes > budgets.maxCssChunkBytes) {
  throw new Error(`perf_budget.css_chunk_exceeded:${largestCss.file}:${largestCss.bytes}`);
}
if (totalBytes > budgets.totalBytes) {
  throw new Error(`perf_budget.total_exceeded:${totalBytes}`);
}

console.log(JSON.stringify({ budgets, largestJs, largestCss, totalBytes }, null, 2));
