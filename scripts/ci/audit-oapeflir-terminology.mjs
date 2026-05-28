#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const stageSequence = ["Observe", "Assess", "Plan", "Execute", "Feedback", "Learn", "Improve", "Release"];
const stageSequenceZh = ["观察", "评估", "计划", "执行", "反馈", "学习", "改进", "发布"];

const failures = [];

function indexOfStage(source, stage, localizedStage) {
  return Math.max(
    source.indexOf(`**${stage}**`),
    source.indexOf(`**${localizedStage}**`),
  );
}

for (const root of ["docs_zh/contracts", "docs_en/contracts"]) {
  for (const entry of readdirSync(root).sort()) {
    if (!entry.endsWith(".md")) {
      continue;
    }
    const path = join(root, entry);
    const source = readFileSync(path, "utf8");
    const hasCanonicalSection = source.includes("## OAPEFLIR 关联") || source.includes("## OAPEFLIR Association");
    if (!hasCanonicalSection) {
      continue;
    }
    const indexes = stageSequence.map((stage, index) => indexOfStage(source, stage, stageSequenceZh[index]));
    const inOrder = indexes.every((index) => index >= 0) && indexes.every((index, position) => position === 0 || index > indexes[position - 1]);
    if (!inOrder) {
      failures.push(`oapeflir-stage-sequence-mismatch: ${path}`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log("OAPEFLIR terminology audit passed");
