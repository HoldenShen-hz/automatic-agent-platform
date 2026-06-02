import { readdirSync } from "node:fs";
import { join } from "node:path";

const fixturesRoot = join(process.cwd(), "tests", "fixtures");
const allowedTopLevelEntries = new Set([
  "conversation",
  "migration",
  "packs",
  "prompt-engine",
]);

const topLevelEntries = readdirSync(fixturesRoot, { withFileTypes: true });
const unexpectedTopLevelEntries = topLevelEntries
  .map((entry) => entry.name)
  .filter((name) => !allowedTopLevelEntries.has(name))
  .sort((left, right) => left.localeCompare(right));

const fixtureTestFiles = walkFiles(fixturesRoot)
  .filter((path) => /\.test\.(ts|tsx|js|jsx|mjs|cjs)$/u.test(path))
  .sort((left, right) => left.localeCompare(right));

const summary = {
  fixturesRoot,
  allowedTopLevelEntries: [...allowedTopLevelEntries],
  actualTopLevelEntries: topLevelEntries.map((entry) => entry.name).sort((left, right) => left.localeCompare(right)),
  unexpectedTopLevelEntries,
  fixtureTestFiles,
};

console.log(JSON.stringify(summary, null, 2));

if (unexpectedTopLevelEntries.length > 0 || fixtureTestFiles.length > 0) {
  console.error("fixture boundary drift detected");
  process.exit(1);
}

function walkFiles(root) {
  const files = [];
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (entry.isFile()) {
        files.push(fullPath.slice(process.cwd().length + 1).replaceAll("\\", "/"));
      }
    }
  }
  return files;
}
