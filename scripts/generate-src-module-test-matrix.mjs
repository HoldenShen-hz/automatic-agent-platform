import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const repoRoot = process.cwd();
const srcRoot = join(repoRoot, "src");
const testsRoot = join(repoRoot, "tests");
const outputPath = join(repoRoot, "docs_zh/operations/src_module_test_matrix.md");

function walk(dir, predicate, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, predicate, files);
      continue;
    }
    if (predicate(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function toPosix(path) {
  return path.split(sep).join("/");
}

function sourceModuleKey(sourcePath) {
  const relativePath = toPosix(relative(srcRoot, sourcePath));
  const parts = relativePath.split("/");
  if (parts[0] === "core" && parts.length >= 2) {
    return `core/${parts[1]}`;
  }
  if (parts[0] === "gateway") {
    return "gateway";
  }
  if (parts[0] === "cli") {
    return "cli";
  }
  return parts[0] ?? "root";
}

function normalizeBaseName(filePath) {
  return toPosix(filePath)
    .replace(/\.test\.[cm]?tsx?$/u, "")
    .replace(/\.[cm]?tsx?$/u, "")
    .split("/")
    .pop();
}

function hasPathToken(path, token) {
  return toPosix(path).includes(`/${token}/`);
}

function classifyTestKind(testPath) {
  const normalized = toPosix(relative(testsRoot, testPath));
  if (normalized.startsWith("unit/")) return "unit";
  if (normalized.startsWith("integration/")) return "integration";
  if (normalized.startsWith("e2e/")) return "integration";
  if (normalized.startsWith("golden/")) return "integration";
  return "other";
}

function findMatchingTests(sourcePath, tests) {
  const sourceBase = normalizeBaseName(sourcePath);
  const sourceRelative = toPosix(relative(srcRoot, sourcePath));
  const sourceDirParts = sourceRelative.split("/").slice(0, -1);
  const directDirToken = sourceDirParts[sourceDirParts.length - 1];

  return tests.filter((testPath) => {
    const testBase = normalizeBaseName(testPath);
    if (testBase === sourceBase) {
      return true;
    }
    if (directDirToken && hasPathToken(testPath, directDirToken) && testBase.includes(sourceBase)) {
      return true;
    }
    return false;
  });
}

function dedupe(values) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

const sourceFiles = walk(
  srcRoot,
  (filePath) => /\.(ts|tsx)$/u.test(filePath) && !filePath.endsWith(".d.ts"),
);
const testFiles = walk(
  testsRoot,
  (filePath) => /\.test\.(ts|tsx)$/u.test(filePath),
);

const modules = new Map();

for (const sourcePath of sourceFiles) {
  const moduleKey = sourceModuleKey(sourcePath);
  const testMatches = findMatchingTests(sourcePath, testFiles);
  const unitTests = testMatches.filter((testPath) => classifyTestKind(testPath) === "unit");
  const integrationTests = testMatches.filter((testPath) => classifyTestKind(testPath) === "integration");
  const relativeSource = toPosix(relative(repoRoot, sourcePath));

  if (!modules.has(moduleKey)) {
    modules.set(moduleKey, {
      sources: [],
      unitTests: [],
      integrationTests: [],
      uncoveredSources: [],
    });
  }

  const moduleRecord = modules.get(moduleKey);
  moduleRecord.sources.push(relativeSource);
  moduleRecord.unitTests.push(...unitTests.map((testPath) => toPosix(relative(repoRoot, testPath))));
  moduleRecord.integrationTests.push(...integrationTests.map((testPath) => toPosix(relative(repoRoot, testPath))));

  if (unitTests.length === 0 && integrationTests.length === 0) {
    moduleRecord.uncoveredSources.push(relativeSource);
  }
}

const orderedModules = Array.from(modules.entries()).sort(([left], [right]) => left.localeCompare(right));

const lines = [];
lines.push("# Src 模块测试矩阵");
lines.push("");
lines.push("> 本文档由 `npm run test:matrix` 自动生成，用于回答“`src` 每个模块当前有哪些单元测试、哪些集成测试、还有哪些文件缺少直接覆盖”。");
lines.push("");
lines.push("## 1. 统计规则");
lines.push("");
lines.push("- 模块按 `src` 顶层目录归类，`src/core/*` 细分到 `core/<子模块>`。");
lines.push("- `tests/unit/` 视为单元测试；`tests/integration/`、`tests/e2e/`、`tests/golden/` 视为集成测试。");
lines.push("- “直接覆盖”按同 basename 或同目录 token 的测试文件推断，用于维护视角，不替代覆盖率报告。");
lines.push("- `index.ts`、type-only 文件也会进入矩阵；若没有直接测试，会出现在“缺少直接覆盖”中。");
lines.push("");
lines.push("## 2. 概览");
lines.push("");
lines.push("| 模块 | 源文件数 | 单元测试数 | 集成测试数 | 缺少直接覆盖 | 状态 |");
lines.push("| --- | ---: | ---: | ---: | ---: | --- |");

for (const [moduleKey, record] of orderedModules) {
  const sourceCount = record.sources.length;
  const unitCount = dedupe(record.unitTests).length;
  const integrationCount = dedupe(record.integrationTests).length;
  const uncoveredCount = dedupe(record.uncoveredSources).length;
  const status = uncoveredCount === 0 ? "covered" : "needs_review";
  lines.push(`| \`${moduleKey}\` | ${sourceCount} | ${unitCount} | ${integrationCount} | ${uncoveredCount} | \`${status}\` |`);
}

lines.push("");
lines.push("## 3. 模块明细");
lines.push("");

for (const [moduleKey, record] of orderedModules) {
  const sources = dedupe(record.sources);
  const unitTests = dedupe(record.unitTests);
  const integrationTests = dedupe(record.integrationTests);
  const uncoveredSources = dedupe(record.uncoveredSources);

  lines.push(`### ${moduleKey}`);
  lines.push("");
  lines.push(`- 源文件数：${sources.length}`);
  lines.push(`- 单元测试：${unitTests.length}`);
  lines.push(`- 集成测试：${integrationTests.length}`);
  lines.push(`- 缺少直接覆盖：${uncoveredSources.length}`);
  lines.push("");

  if (unitTests.length > 0) {
    lines.push("单元测试：");
    for (const testPath of unitTests) {
      lines.push(`- \`${testPath}\``);
    }
    lines.push("");
  }

  if (integrationTests.length > 0) {
    lines.push("集成测试：");
    for (const testPath of integrationTests) {
      lines.push(`- \`${testPath}\``);
    }
    lines.push("");
  }

  if (uncoveredSources.length > 0) {
    lines.push("缺少直接覆盖的源文件：");
    for (const sourcePath of uncoveredSources) {
      lines.push(`- \`${sourcePath}\``);
    }
    lines.push("");
  }
}

lines.push("## 4. 维护方式");
lines.push("");
lines.push("- 当新增 `src` 模块或测试文件时，运行 `npm run test:matrix` 刷新本文档。");
lines.push("- 若某个模块故意只通过上层集成路径覆盖，请在代码评审或对应模块文档中说明原因。");
lines.push("");

writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Wrote ${relative(repoRoot, outputPath)}`);
