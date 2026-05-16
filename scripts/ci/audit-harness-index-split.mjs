import { existsSync, readFileSync } from "node:fs";

const checks = [];

function read(path) {
  return readFileSync(path, "utf8");
}

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

const indexPath = "src/platform/five-plane-orchestration/harness/index.ts";
const constraintPackPath = "src/platform/five-plane-orchestration/harness/constraint-pack.ts";
const runtimeTypesPath = "src/platform/five-plane-orchestration/harness/runtime-types.ts";
const runtimeComponentsPath = "src/platform/five-plane-orchestration/harness/runtime-components.ts";

const indexSource = read(indexPath);
const indexLineCount = indexSource.split("\n").length;
const exportStarCount = [...indexSource.matchAll(/^export \* from /gm)].length;

check("constraint-pack module exists", existsSync(constraintPackPath), "constraint-pack.ts 已拆出约束包定义和规范化逻辑");
check("runtime-types module exists", existsSync(runtimeTypesPath), "runtime-types.ts 已拆出 runtime 类型和默认策略");
check("runtime-components module exists", existsSync(runtimeComponentsPath), "runtime-components.ts 已拆出 harness 子模块 re-export");
check("harness index line count reduced", indexLineCount < 1800, `harness/index.ts 当前 ${indexLineCount} 行，小于 1800`);
check("harness index export-star count reduced", exportStarCount <= 3, `harness/index.ts 当前 export* 为 ${exportStarCount} 行`);
check(
  "harness index imports split modules",
  indexSource.includes('from "./constraint-pack.js"') && indexSource.includes('from "./runtime-types.js"'),
  "harness/index.ts 通过 split 模块消费约束包和 runtime 类型",
);
check(
  "harness index no longer defines constraint pack inline",
  !indexSource.includes("export interface ConstraintPack") &&
    !indexSource.includes("export interface ConstraintBudgetEnvelope") &&
    !indexSource.includes("export const DEFAULT_TAINT_POLICY"),
  "harness/index.ts 不再内联 constraint pack/runtime types 默认值",
);

for (const item of checks) {
  console.log(`${item.ok ? "ok" : "fail"} ${item.name} - ${item.detail}`);
}

const failures = checks.filter((item) => !item.ok);
if (failures.length > 0) {
  console.error(`harness index split audit failed: ${failures.length}/${checks.length}`);
  process.exit(1);
}

console.log(`harness index split audit passed: ${checks.length}/${checks.length}`);
