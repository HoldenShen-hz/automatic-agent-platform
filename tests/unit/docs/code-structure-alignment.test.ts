import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function resolveWorkspaceRoot(startDirectory: string): string {
  let current = startDirectory;
  while (!existsSync(join(current, "package.json"))) {
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`workspace_root_not_found:${startDirectory}`);
    }
    current = parent;
  }
  return current;
}

const WORKSPACE_ROOT = resolveWorkspaceRoot(dirname(fileURLToPath(import.meta.url)));
const STRUCTURE_DOC = join(WORKSPACE_ROOT, "docs_zh/architecture/01-code-structure.md");

function extractDocumentedSourceDirectories(documentPath: string): string[] {
  const lines = readFileSync(documentPath, "utf8").split(/\r?\n/);
  const directories = new Set<string>();

  let inCodeBlock = false;
  let skipCurrentCodeBlock = false;
  let baseDirectory = "";
  let stack: string[] = [];

  for (const [index, line] of lines.entries()) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) {
        const previousContext = lines.slice(Math.max(0, index - 3), index).join("\n");
        skipCurrentCodeBlock = previousContext.includes("ui/packages/features/<feature>/src/");
      }
      if (!inCodeBlock) {
        skipCurrentCodeBlock = false;
        baseDirectory = "";
        stack = [];
      }
      continue;
    }

    if (!inCodeBlock || skipCurrentCodeBlock) {
      continue;
    }

    const baseMatch = line.trim().match(/^(src\/[A-Za-z0-9-]+\/?|src\/)$/);
    if (baseMatch) {
      const matchedBase = baseMatch[1];
      if (matchedBase == null) {
        continue;
      }
      baseDirectory = matchedBase.replace(/\/$/, "");
      stack = [];
      directories.add(baseDirectory);
      continue;
    }

    if (!baseDirectory) {
      continue;
    }

    const branchIndex = line.search(/[├└]──/);
    if (branchIndex === -1) {
      continue;
    }

    const prefix = line.slice(0, branchIndex);
    const remainder = line.slice(branchIndex + 3).trim();
    const entryName = remainder.split(/\s+/)[0];
    if (entryName == null) {
      continue;
    }
    if (!entryName.endsWith("/")) {
      continue;
    }

    const level =
      (prefix.match(/│   /g) ?? []).length + (prefix.match(/    /g) ?? []).length;
    stack = stack.slice(0, level);
    stack[level] = entryName.replace(/\/$/, "");
    directories.add([baseDirectory, ...stack].join("/"));
  }

  return Array.from(directories).sort();
}

test("code structure: documented src directories exist and expose index entrypoints", () => {
  const documentedDirectories = extractDocumentedSourceDirectories(STRUCTURE_DOC);
  assert.ok(documentedDirectories.length > 0, "expected documented src directories");

  for (const directory of documentedDirectories) {
    const absoluteDirectory = join(WORKSPACE_ROOT, directory);
    assert.ok(existsSync(absoluteDirectory), `missing documented directory: ${directory}`);

    if (directory === "src") {
      continue;
    }

    const indexFile = join(absoluteDirectory, "index.ts");
    assert.ok(existsSync(indexFile), `missing documented module entrypoint: ${directory}/index.ts`);
  }
});

test("code structure: canonical second-level modules expose index entrypoints", () => {
  const secondLevelRoots = [
    "src/platform",
    "src/domains",
    "src/interaction",
    "src/org-governance",
    "src/scale-ecosystem",
    "src/ops-maturity",
    "src/plugins",
    "src/sdk",
  ];

  for (const root of secondLevelRoots) {
    const absoluteRoot = join(WORKSPACE_ROOT, root);
    for (const entry of readdirSync(absoluteRoot)) {
      if (entry == null) {
        continue;
      }
      const absoluteEntry = join(absoluteRoot, entry);
      if (!statSync(absoluteEntry).isDirectory()) {
        continue;
      }
      const indexFile = join(absoluteEntry, "index.ts");
      assert.ok(existsSync(indexFile), `missing canonical module entrypoint: ${root}/${entry}/index.ts`);
    }
  }
});
