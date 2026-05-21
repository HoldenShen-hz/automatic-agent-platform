import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../../../../docs_zh/adr/018-rollout-eleven-state-machine.md", import.meta.url),
  "utf8",
);

test("ADR-018 is retained only as a historical record and points readers to ADR-075", () => {
  assert.match(source, /Superseded by ADR-075/);
  assert.match(source, /Historical record only\. Do not implement from this document\./);
  assert.match(source, /当前权威规范：ADR-075/);
});

test("ADR-018 no longer contains executable rollout tables, thresholds, or state-machine rules", () => {
  assert.doesNotMatch(source, /### 十一态 RolloutStatus 枚举/);
  assert.doesNotMatch(source, /\| 级别 \| 名称 \| 流量 \| 适用场景 \|/);
  assert.doesNotMatch(source, /failureRate > 5%/);
  assert.doesNotMatch(source, /p99Latency > 2x baseline/);
});
