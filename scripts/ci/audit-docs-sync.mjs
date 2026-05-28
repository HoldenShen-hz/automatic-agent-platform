#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const checks = [];

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function walkMarkdown(root) {
  const output = [];
  const visit = (current) => {
    for (const entry of readdirSync(current).sort()) {
      const path = join(current, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) {
        visit(path);
      } else if (stat.isFile() && path.endsWith(".md")) {
        output.push(relative(root, path));
      }
    }
  };
  visit(root);
  return output.sort();
}

function compareTrees(leftRoot, rightRoot, label) {
  const left = walkMarkdown(leftRoot);
  const right = walkMarkdown(rightRoot);
  const missingInRight = left.filter((entry) => !right.includes(entry));
  const missingInLeft = right.filter((entry) => !left.includes(entry));
  check(`${label} trees stay in sync`, missingInRight.length === 0 && missingInLeft.length === 0, [
    missingInRight.length > 0 ? `missing in ${rightRoot}: ${missingInRight.join(", ")}` : null,
    missingInLeft.length > 0 ? `missing in ${leftRoot}: ${missingInLeft.join(", ")}` : null,
  ].filter(Boolean).join(" | ") || `${left.length} files` );

  for (const entry of left) {
    if (!right.includes(entry)) {
      continue;
    }
    compareDocumentShape(join(leftRoot, entry), join(rightRoot, entry), `${label}:${entry}`);
  }
}

function summarizeMarkdown(source) {
  const lines = source.split(/\r?\n/);
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0).length;
  const headingCount = lines.filter((line) => /^#{1,6}\s/.test(line)).length;
  const fenceCount = lines.filter((line) => line.trimStart().startsWith("```")).length;
  return { nonEmptyLines, headingCount, fenceCount };
}

function compareDocumentShape(leftPath, rightPath, label) {
  const left = summarizeMarkdown(readFileSync(leftPath, "utf8"));
  const right = summarizeMarkdown(readFileSync(rightPath, "utf8"));
  const lineDelta = Math.abs(left.nonEmptyLines - right.nonEmptyLines);
  const larger = Math.max(left.nonEmptyLines, right.nonEmptyLines, 1);
  const lineDrift = lineDelta > 40 && lineDelta / larger > 0.4;
  const headingDrift = left.headingCount !== right.headingCount;
  const fenceDrift = left.fenceCount !== right.fenceCount;

  check(
    `${label} markdown shape stays aligned`,
    !(lineDrift || headingDrift || fenceDrift),
    `zh=${left.nonEmptyLines}/${left.headingCount}/${left.fenceCount} en=${right.nonEmptyLines}/${right.headingCount}/${right.fenceCount}`,
  );
}

function parseAdrIndex(path) {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  return lines
    .filter((line) => /^\|\s*\[?[0-9]{3}[A-Z]?\]?/.test(line))
    .map((line) => line.split("|").map((part) => part.trim()).filter(Boolean))
    .map((parts) => ({
      number: parts[0].replace(/[\[\]]/g, "").replace(/\(.+\)/, ""),
      status: parts[2] ?? "",
      date: parts[3] ?? "",
    }));
}

function compareAdrIndexes() {
  const zh = new Map(parseAdrIndex("docs_zh/adr/README.md").map((entry) => [entry.number, entry]));
  const en = new Map(parseAdrIndex("docs_en/adr/README.md").map((entry) => [entry.number, entry]));
  check("ADR index row count matches across zh/en", zh.size === en.size, `zh=${zh.size} en=${en.size}`);
  const drift = [];
  for (const [number, left] of zh.entries()) {
    const right = en.get(number);
    if (right == null || left.status !== right.status || left.date !== right.date) {
      drift.push(number);
    }
  }
  check("ADR index status/date stay aligned", drift.length === 0, drift.join(", ") || "aligned");
}

compareTrees("docs_zh/contracts", "docs_en/contracts", "contract docs");
compareTrees("docs_zh/adr", "docs_en/adr", "ADR docs");
compareAdrIndexes();

for (const item of checks) {
  console.log(`${item.ok ? "ok" : "fail"} ${item.name} - ${item.detail}`);
}

if (checks.some((item) => !item.ok)) {
  process.exit(1);
}
