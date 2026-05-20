import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function countImplementationLines(paths: readonly string[]): number {
  let total = 0;
  for (const relativePath of paths) {
    const content = readFileSync(join(process.cwd(), relativePath), "utf8");
    const trimmed = content.trim();
    if (/^export \* from \"\.\.\/.+\";$/.test(trimmed) || /^export \* from \"\.\.\/\.\.\/.+\";$/.test(trimmed)) {
      continue;
    }
    total += content.split("\n").length;
  }
  return total;
}

test("[SYS-QUAL-7.3] marketplace implementation footprint stays below extracted threshold", async () => {
  const { execFileSync } = await import("node:child_process");
  const root = process.cwd();
  const marketplaceFiles = execFileSync(
    "find",
    ["src/scale-ecosystem/marketplace", "-type", "f", "-name", "*.ts"],
    { cwd: root, encoding: "utf8" },
  )
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const scaleFiles = execFileSync(
    "find",
    ["src/scale-ecosystem", "-type", "f", "-name", "*.ts"],
    { cwd: root, encoding: "utf8" },
  )
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const marketplaceImplLines = countImplementationLines(marketplaceFiles);
  const scaleImplLines = countImplementationLines(scaleFiles);

  assert.ok(
    marketplaceImplLines <= 3100,
    `expected marketplace implementation lines <= 3100, got ${marketplaceImplLines}`,
  );
  assert.ok(
    marketplaceImplLines / Math.max(scaleImplLines, 1) <= 0.12,
    `expected marketplace share <= 12%, got ${((marketplaceImplLines / Math.max(scaleImplLines, 1)) * 100).toFixed(2)}%`,
  );
});
