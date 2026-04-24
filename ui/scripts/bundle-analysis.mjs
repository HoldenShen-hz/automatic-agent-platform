import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const distRoot = join(process.cwd(), "apps/web/dist/assets");

function listAssets(directory) {
  return readdirSync(directory)
    .map((file) => {
      const absolutePath = join(directory, file);
      return {
        file,
        bytes: statSync(absolutePath).size,
      };
    })
    .sort((left, right) => right.bytes - left.bytes);
}

const assets = listAssets(distRoot);
const summary = {
  generatedAt: new Date().toISOString(),
  assetCount: assets.length,
  totalBytes: assets.reduce((total, asset) => total + asset.bytes, 0),
  largestAssets: assets.slice(0, 10),
};

writeFileSync(join(process.cwd(), "apps/web/dist/bundle-report.json"), JSON.stringify(summary, null, 2));
console.log(readFileSync(join(process.cwd(), "apps/web/dist/bundle-report.json"), "utf8"));
