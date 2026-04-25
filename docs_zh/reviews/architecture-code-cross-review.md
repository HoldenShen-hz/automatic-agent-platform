# 架构设计文档 vs 代码实现交叉审查报告

> **版本**：v2.0（2026-04-25 回写版）
> **原始问题清单日期**：2026-04-24
> **本次复核日期**：2026-04-25
> **设计基线**：`docs_zh/architecture/00-platform-architecture.md` v3.2 + `docs_zh/architecture/05-cross-platform-ui-architecture.md` v3.2
> **复核范围**：`src/`、`tests/`、`ui/`、`docs_zh/`、`docs_en/`
> **口径**：先逐项复核 2026-04-24 版本列出的 24 项偏差，再按“修代码优先、文档回写其次、历史误报归档”的原则闭环。

---

## 1. 执行结论

2026 年 4 月 24 日版本记录的 **24 项偏差** 已在 2026 年 4 月 25 日重新验真并完成闭环：

- **8 项** 属于架构文档滞后，已回写到当前仓库真相：
  `00-platform-architecture.md` 的存储分组、推荐目录与领域目录说明；`05-cross-platform-ui-architecture.md` 的目录全景、PlatformAdapter、测试基线、依赖命令、React Flow 版本与 API 映射
- **16 项** 经复核确认已被现有代码提前关闭，本次仅将 review 状态回写，避免继续误报

**截至 2026-04-25，本文件原始 24 项任务已全部关闭，无剩余 open item。**

---

## 2. 本次实际改动

### 2.1 文档回写

- `00-platform-architecture.md`
  - `§25.7 / §26.3` 已与 `SchemaInventoryService` 对齐为 **86 表**、`4 category + 7 documented group` 双视图
  - `§35` 已补充 `src/apps`、`src/benchmarks`、`src/core`、`src/testing`、`src/types`，以及 `platform/shared / agent-delegation / cost-management / prompt-registry / stability`
  - `§35` 已澄清 `operations/` 与 `it-operations/` 的职责边界，并把额外领域目录标记为孵化域 / 元域 / 平台支撑目录
- `05-cross-platform-ui-architecture.md`
  - 目录全景改为当前 `npm workspaces` 基线，补充 `packages/shared/platform` 与 `governance-compliance`
  - `PlatformAdapter` 改为与 `@aa/shared-types` 一致的扁平接口，并说明 capability view 投影
  - `React Flow` 基线改回当前仓内 `11.x`
  - `typecheck / test / build` 改为脚本闭环表述，明确 `npm install` 前置条件
  - `§7.1 / §7.2` 明确：当前仓内 `npm run test:e2e` 是 Vitest smoke 基线，Playwright / Detox 仍为目标态
  - 附录 A 已回写 `incidents / knowledge / plugins / prompts / webhooks` 的当前实现状态

### 2.2 测试补充

- 新增文档对齐测试，锁定本 review 的 2026-04-25 闭环快照
- 扩展 `contracts/index.test.ts`，回归验证核心契约对象的直接导出

---

## 3. 24 项逐项状态

| 编号 | 原问题摘要 | 2026-04-25 状态 | 处置方式 |
| ---- | ---------- | ---------------- | -------- |
| 1.1 | `contracts/index.ts` 未直接导出五个核心契约对象 | 已关闭 | 复核归档：现有 `types/platform-contracts` 直出已满足 |
| 1.2 | StructuredLog 缺少 `service` / 字段命名不一致 | 已关闭 | 现有代码已满足 |
| 1.3 | Recovery Worker 仅实现 2/6 | 已关闭 | 现有代码已满足 |
| 1.4 | `HumanWaitExecutor` 缺失 | 已关闭 | 现有代码已满足 |
| 1.5 | 存储分组与表数与文档不一致 | 已关闭 | 文档回写到 `SchemaInventoryService` |
| 1.6 | `ModelGateway.chat()` 方法名不匹配 | 已关闭 | 现有代码已满足 |
| 1.7 | Runtime 模式连字符 vs 下划线 | 已关闭 | 现有代码已有 documented/internal 映射 |
| 1.8 | `§35` 未覆盖额外目录 | 已关闭 | 文档回写 |
| 1.9 | 实际领域目录超出文档声明 | 已关闭 | 文档回写 |
| 2.1 | 三个 WebSocket 事件未实现 | 已关闭 | 现有代码已满足 |
| 2.2 | UI 额外包与 Feature 未在文档中声明 | 已关闭 | 文档回写 |
| 2.3 | PlatformAdapter 接口与文档差异大 | 已关闭 | 文档回写 |
| 2.4 | shared 子包仅为空壳 scaffold | 已关闭 | 现有代码已满足 |
| 2.5 | 桌面端/移动端 App Shell 仅配置骨架 | 已关闭 | 现有代码 + 文档措辞已对齐 |
| 2.6 | UI Monorepo 未安装依赖、typecheck 无法验证 | 已关闭 | 文档改为脚本闭环表述 |
| 2.7 | React Flow 版本不匹配 | 已关闭 | 文档回写到 11.x |
| 4.1 | UI 层缺少 E2E 覆盖 | 已关闭 | 文档改为“当前 smoke 基线 + 目标态 E2E” |
| 5.1 | OAPEFLIR `Analyze` vs `Assess` 术语差异 | 已关闭 | 复核归档，当前平台架构文档以 `Assess` 为准 |
| 5.2 | UI Feature 路由与后端 API 资源映射不完整 | 已关闭 | 现有代码 + 文档回写 |
| 5.3 | 设计令牌默认暗色主题 | 已关闭 | 现有代码已改为亮色默认 |
| 5.4 | `operations/` 与 `it-operations/` 职责重叠 | 已关闭 | 文档回写职责边界 |

---

## 4. 复核依据摘要

本次关闭结论基于以下仓内事实：

- `src/platform/shared/observability/structured-logger.ts` 已包含 `service`、`timestamp`、`structuredPayload` 与 `fatal`
- `src/platform/execution/ha/` 已存在 `ExecutionRecoveryWorker`、`WorkflowRepairWorker`、`ProjectionRebuildWorker`、`ReplayWorker`
- `src/platform/execution/plugin-executor/human-wait-executor.ts` 与 `src/platform/execution/tool-executor/tool-executor.ts` 已落地
- `src/platform/model-gateway/provider-registry/unified-chat-provider.ts` 已提供 `chat()`、`complete()`、`embed()`
- `ui/packages/shared/api-client/src/ws-event-router.ts` 已映射 `progress / message_delta / artifact_ready`
- `ui/packages/shared/api-client/src/endpoints.ts` 已定义 `workflow-runs/:id/steps`、`knowledge`、`packs`、`plugins`、`prompts`
- `ui/packages/shared/i18n`、`telemetry`、`nl-client`、`domain` 不再是空壳
- `ui/apps/electron-win`、`ui/apps/tauri-*`、`ui/apps/mobile` 已具备 smoke shell 基线
- `ui/packages/ui-core/src/design-tokens/index.ts` 默认主题为亮色
- `src/platform/state-evidence/truth/schema-inventory-service.ts` 当前 authoritative summary 为 **86 表**

---

## 5. 权威性说明

本文件为 `architecture-code-cross-review` 的**权威版本**。后续若仓库继续演进，应在新增真实偏差后再增量记录；不得继续沿用 2026-04-24 的过期问题清单作为当前状态描述。
