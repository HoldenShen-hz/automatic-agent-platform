import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const distPath = resolve(process.cwd(), "dist");
const TEST_ANCESTOR_PATTERN = /\b(?:c8|node(?:\s+[^\n]*?)?\s+--test|npm\s+test|npm\s+run\s+test(?::[\w-]+)?|tap)\b/;

function hasTestAncestor() {
  try {
    const output = execFileSync("ps", ["-axo", "pid=,ppid=,command="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const processes = new Map();
    for (const line of output.split("\n")) {
      const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
      if (!match) {
        continue;
      }
      processes.set(Number(match[1]), {
        ppid: Number(match[2]),
        command: match[3],
      });
    }

    let currentPid = process.ppid;
    const visited = new Set();
    while (currentPid > 1 && !visited.has(currentPid)) {
      visited.add(currentPid);
      const entry = processes.get(currentPid);
      if (!entry) {
        break;
      }
      if (TEST_ANCESTOR_PATTERN.test(entry.command)) {
        return true;
      }
      currentPid = entry.ppid;
    }
  } catch {
    return false;
  }
  return false;
}

const preserveDist =
  process.env.AA_PRESERVE_DIST === "1"
  || process.env.AA_RUNNING_TESTS === "1"
  || process.env.C8_PROCESS_INFO != null
  || process.env.NODE_V8_COVERAGE != null
  || hasTestAncestor();

function listFilesRecursively(rootPath) {
  const results = [];
  for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
    const fullPath = join(rootPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursively(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function pruneStaleDistTests() {
  const distTestsPath = join(distPath, "tests");
  if (!existsSync(distTestsPath)) {
    return;
  }

  for (const filePath of listFilesRecursively(distTestsPath)) {
    if (!filePath.endsWith(".test.js.map")) {
      continue;
    }

    let sourceMap;
    try {
      sourceMap = JSON.parse(readFileSync(filePath, "utf8"));
    } catch {
      continue;
    }

    const sources = Array.isArray(sourceMap.sources) ? sourceMap.sources : [];
    const sourcePaths = sources.map((sourcePath) => resolve(dirname(filePath), sourcePath));
    const hasExistingSource = sourcePaths.some((sourcePath) => existsSync(sourcePath));
    if (hasExistingSource) {
      continue;
    }

    const jsPath = filePath.slice(0, -".map".length);
    const dtsPath = jsPath.replace(/\.js$/, ".d.ts");
    rmSync(filePath, { force: true });
    rmSync(jsPath, { force: true });
    rmSync(dtsPath, { force: true });
  }
}

if (!preserveDist && existsSync(distPath)) {
  try {
    rmSync(distPath, { recursive: true, force: true });
  } catch (err) {
    if (err.code !== "ENOENT" && err.code !== "ENOTEMPTY") {
      throw err;
    }
  }
} else if (preserveDist) {
  pruneStaleDistTests();
}
