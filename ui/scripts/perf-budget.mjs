import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createGzip } from "node:zlib";
import { Readable } from "node:stream";

const distRoot = join(process.cwd(), "apps/web/dist/assets");
// §7.3.1 perf budget: main<200KB gz/lazy chunk<100KB gz
const budgets = {
  maxJsChunkGzBytes: 100 * 1024,   // 100KB gz per lazy chunk
  maxCssChunkGzBytes: 40 * 1024,   // 40KB gz per css chunk
  totalGzBytes: 200 * 1024,         // 200KB gz total
};

/**
 * Compresses a buffer using gzip and returns the compressed size.
 */
async function gzipSize(buffer: Buffer): Promise<number> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const gzip = createGzip();
    gzip.on("data", (chunk) => chunks.push(chunk));
    gzip.on("end", () => resolve(Buffer.concat(chunks).length));
    gzip.on("error", reject);
    Readable.from(buffer).pipe(gzip);
  });
}

/**
 * Gets the gzip-compressed size of a file.
 */
async function getGzippedSize(filePath: string): Promise<number> {
  const content = await import("node:fs").then((fs) =>
    fs.promises.readFile(filePath),
  );
  return gzipSize(content);
}

const assets = readdirSync(distRoot).map((file) => ({
  file,
  rawBytes: statSync(join(distRoot, file)).size,
}));

const jsAssets = assets.filter((asset) => asset.file.endsWith(".js"));
const cssAssets = assets.filter((asset) => asset.file.endsWith(".css"));

let largestJsGzBytes = 0;
let largestJsFile = "none";
let largestCssGzBytes = 0;
let largestCssFile = "none";
let totalGzBytes = 0;

for (const asset of jsAssets) {
  const fullPath = join(distRoot, asset.file);
  const gzBytes = await getGzippedSize(fullPath);
  if (gzBytes > largestJsGzBytes) {
    largestJsGzBytes = gzBytes;
    largestJsFile = asset.file;
  }
  totalGzBytes += gzBytes;
}

for (const asset of cssAssets) {
  const fullPath = join(distRoot, asset.file);
  const gzBytes = await getGzippedSize(fullPath);
  if (gzBytes > largestCssGzBytes) {
    largestCssGzBytes = gzBytes;
    largestCssFile = asset.file;
  }
}

if (largestJsGzBytes > budgets.maxJsChunkGzBytes) {
  throw new Error(`perf_budget.js_chunk_exceeded:${largestJsFile}:${largestJsGzBytes}`);
}
if (largestCssGzBytes > budgets.maxCssChunkGzBytes) {
  throw new Error(`perf_budget.css_chunk_exceeded:${largestCssFile}:${largestCssGzBytes}`);
}
if (totalGzBytes > budgets.totalGzBytes) {
  throw new Error(`perf_budget.total_exceeded:${totalGzBytes}`);
}

console.log(
  JSON.stringify(
    {
      budgets,
      largestJs: { file: largestJsFile, gzBytes: largestJsGzBytes },
      largestCss: { file: largestCssFile, gzBytes: largestCssGzBytes },
      totalGzBytes,
    },
    null,
    2,
  ),
);
