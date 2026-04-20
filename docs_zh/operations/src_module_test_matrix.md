# Src 模块测试矩阵

> 更新日期：2026-04-20
> 本文件收敛为当前仓库结构的维护矩阵，事实源以 `src/` 与 `tests/` 实际目录为准，不再维护旧 `src/core/` / `src/gateway/` 路径清单。

## 1. 统计口径

- 源文件统计：`find src/<area> -type f -name '*.ts'`
- 单元测试统计：`find tests/unit -type f -name '*.test.ts' | grep '/<area>/'`
- 集成测试统计：`find tests/integration -type f -name '*.test.ts' | grep '/<area>/'`
- `tests/golden/` 与 `tests/e2e/` 当前未作为各能力域的主覆盖来源，因此不单列到矩阵结论。

## 2. 当前矩阵

| 能力域 | 源文件数 | unit | integration | 结论 |
| --- | ---: | ---: | ---: | --- |
| `src/platform/` | 807 | 572 | 220 | 平台核心覆盖最完整，适合作为 contract/integration 事实源 |
| `src/domains/` | 35 | 27 | 6 | 以 orchestration / registry / governance unit 为主 |
| `src/interaction/` | 37 | 21 | 2 | 交互层已有主要服务单测，跨层流转继续靠 integration 补强 |
| `src/org-governance/` | 33 | 13 | 2 | 身份与治理服务已建立基础覆盖，SSO/SCIM 需维持拒绝路径回归 |
| `src/scale-ecosystem/` | 62 | 45 | 7 | 市场、跨区、调度、连接器已有可回归基线 |
| `src/ops-maturity/` | 81 | 32 | 12 | 可观测、调试、容量、漂移能力以 unit+integration 组合覆盖 |
| `src/sdk/` | 93 | 12 | 35 | SDK/CLI 以命令级集成为主，unit 只覆盖稳定类型与公共 helper |
| `src/core/` | 8 | 1 | 0 | 兼容层，仅保留最小回归；新能力不得继续沉积在此 |
| `src/plugins/` | 20 | 18 | 0 | 以 SPI / runtime host unit 为主 |
| `src/apps/` | 4 | 4 | 0 | 应用入口以轻量单测保障导出与装配 |
| `src/testing/` | 1 | 0 | 0 | 测试支撑模块，不单独要求镜像测试 |
| `src/benchmarks/` | 1 | 0 | 0 | 性能辅助入口，不纳入常规功能回归 |

## 3. 维护规则

- 新模块优先在同级目录下补 `tests/unit/<area>/...`，跨层流转补到 `tests/integration/`。
- `src/core/` 只允许兼容 shim；若新增实现落在 `src/core/`，视为结构回归。
- CLI、pack、plugin、client 等 SDK 变更必须至少补一个命令级或表面级测试。
- 当目录结构发生变化时，只更新本摘要矩阵，不再回写旧逐文件清单。

## 4. 推荐入口

- 看总体测试要求：[`../quality/00-full-coverage-test-manual.md`](../quality/00-full-coverage-test-manual.md)
- 看发布前门禁：[`operations-checklist.md`](./operations-checklist.md)
- 看架构与实现覆盖：[`../analysis/00-architecture-coverage-matrix.md`](../analysis/00-architecture-coverage-matrix.md)
