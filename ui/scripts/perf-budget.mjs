import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const distRoot = join(process.cwd(), "apps/web/dist/assets");
const budgets = {
  maxJsChunkBytes: 550 * 1024,
  maxCssChunkBytes: 150 * 1024,
  totalBytes: 1200 * 1024,
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
