#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";

const planPath = "docs_zh/operations/dependency-upgrade-plan.md";
const packageJsonPath = "package.json";
const checks = [];

function read(path) {
  return readFileSync(path, "utf8");
}

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

const planExists = existsSync(planPath);
const plan = planExists ? read(planPath) : "";
const packageJson = read(packageJsonPath);

check("dependency upgrade plan exists", planExists, "依赖升级计划文档存在");
check("plan defines Wave 0", plan.includes("Wave 0"), "计划包含安全与门禁基线");
check("plan defines Wave 1", plan.includes("Wave 1"), "计划包含同 major 升级波次");
check("plan defines Wave 2", plan.includes("Wave 2"), "计划包含 major 评估波次");
check("plan defines Wave 3", plan.includes("Wave 3"), "计划包含工具链大版本波次");
check("plan defines monthly cadence", plan.includes("每月一次依赖复核"), "计划包含月度复核节奏");
check("plan defines quarterly cadence", plan.includes("每季度至少完成一轮升级波次"), "计划包含季度升级节奏");
check("plan requires build validation", plan.includes("npm run build:test"), "计划要求编译验证");
check("plan covers xml-crypto", plan.includes("`xml-crypto`"), "计划覆盖 xml-crypto");
check("plan covers zod", plan.includes("`zod`"), "计划覆盖 zod");
check("plan covers typescript", plan.includes("`typescript`"), "计划覆盖 typescript");
check("plan covers @types/node", plan.includes("`@types/node`"), "计划覆盖 @types/node");
check("plan covers eslint", plan.includes("`eslint`"), "计划覆盖 eslint");

check("package tracks xml-crypto baseline", packageJson.includes('"xml-crypto": "^6.1.2"'), "package.json 记录 xml-crypto 基线");
check("package tracks zod baseline", packageJson.includes('"zod": "^3.25.76"'), "package.json 记录 zod 基线");
check("package tracks typescript baseline", packageJson.includes('"typescript": "^5.8.3"'), "package.json 记录 typescript 基线");
check("package tracks @types/node baseline", packageJson.includes('"@types/node": "^22.19.15"'), "package.json 记录 @types/node 基线");
check("package tracks eslint baseline", packageJson.includes('"eslint": "^9.25.1"'), "package.json 记录 eslint 基线");

const failures = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? "ok" : "fail"} ${item.name} - ${item.detail}`);
}

if (failures.length > 0) {
  console.error(`dependency upgrade plan audit failed: ${failures.length}/${checks.length}`);
  process.exit(1);
}

console.log(`dependency upgrade plan audit passed: ${checks.length}/${checks.length}`);
