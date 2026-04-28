# ADR-009 部署与运维

---

## OAPEFLIR 关联

本文档定义 OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：信号采集与统一 DTO
- **Assess**：执行前/后评估与风险判断
- **Plan**：显式规划与 DAG 构建（ADR-060）
- **Execute**：步骤执行与 Dual-Channel 输出
- **Feedback**：信号收集、预处理与 7 类反馈源（ADR-079）
- **Learn**：模式检测与知识提取（ADR-080）
- **Improve**：改进候选评估与 Rollout 状态机（ADR-075）
- **Release**：六级受控发布与自动回滚

---

- 状态：Accepted
- 决策日期：2026-04-02

## 背景

平台既要支持本地 CLI / TUI，也要支持服务端 HTTP / Telegram / Web 模式，还要满足崩溃恢复、可观测性、配置热重载和后续多租户扩展。因此部署与运维不能只考虑单机 happy path。

## 决策

采用 TypeScript 全栈 + 分阶段基础设施演进路线：

- 核心服务层统一放在 `src/platform/`（v4.3 §35 canonical）。
- 接入层包括 CLI、TUI、HTTP Server、Gateway 和 Embedded Client。
- 早期持久化使用 SQLite + WAL。
- 通过结构化事件、工作流状态、产出物存储和恢复算法支持 crash recovery。
- 使用 Feature Flag 控制阶段性功能启用，避免未成熟能力提前耦合到主路径。

## 项目结构原则

代码结构应围绕职责边界展开：

- `platform/`：运行时、工具、provider、session、storage、安全、supervisor、memory（v4.3 §35 canonical）。
- `divisions/`：事业部定义与角色 prompt。
- `tools/`：内置工具、协作工具和专用工具。
- `gateway/`：多渠道接入。
- `server/`：HTTP API。
- `cli/`：CLI 与 TUI。
- `perception/`：主动感知模块。

## 存储与恢复

Phase 1-2 采用 SQLite，但必须承认其边界：

- 通过 WAL 提升读写并发。
- 避免让 heartbeat 等高频数据直接写库。
- 事件和 tool usage 采用批量或异步写入。
- 明确并发活跃 Agent 上限。

为了支撑恢复，至少需要：

- 任务表。
- harness_runs（v4.3 §35 canonical）。
- workflow_step_outputs。
- sessions / messages。
- events。
- artifacts 索引。

## 接入与 API

平台接入层至少包括：

- CLI 与 TUI。
- HTTP API。
- SSE 流式事件。
- Embedded Client。
- Gateway 桥接 Telegram，后续扩展 Slack / 飞书。

这些入口应共享同一服务层，而不是复制业务逻辑。

## 配置与功能开关

配置系统应支持：

- YAML 配置。
- 环境变量插值。
- 配置版本迁移。
- 配置热重载。
- Feature Flag 控制阶段性能力。

生产构建中，可进一步利用 Feature Flag 做编译期 DCE，减少未启用功能体积。

## 测试与可观测性

运维设计必须包含测试与观测：

- 测试金字塔与 LLM mock。
- VCR / record-replay 测试。
- 结构化日志。
- 核心 KPI 与调试日志基建。
- 边界测试，验证架构层和权限层没有被绕过。

## 演进路线

- Phase 1-2：SQLite 单机架构，明确并发上限。
- Phase 3：增强渠道、认证、Web 和商业化基础设施。
- Phase 4：迁移到 PostgreSQL、多租户、队列系统和更强企业能力。

## 结果

优点：

- 开发速度快，适合早期单人 + AI 团队推进。
- 通过统一服务层复用 CLI、HTTP、Embedded Client。
- 迁移路径明确，避免早期过度设计。

代价：

- SQLite 并发上限必须在文档和运行时中被硬性承认。
- Phase 迁移需要强测试与兼容约束，否则后续升级代价会很高。
- 若过早加入 Web、多租户和商业化能力，会显著拖慢基建成熟速度。

## 交叉引用

- [ADR-001 三层分权架构](./001-three-layer-architecture.md)
- [ADR-005 安全模型](./005-security-model.md)
- [ADR-008 成本模型](./008-cost-model.md)

## 来源章节

- `§3`
- `§3.2`
- `§3.3`
- `§3.4`
- `§3.5`
- `§3.6`
- `§3.7`
- `§3.8`
- `§9`
- `§12`

## v4.3 ADR Remediation

- R6-50: 修复目录结构引用。ADR-009 原先描述核心服务层放在 `src/core/`，与 v4.3 §35 canonical 目录结构 `src/platform/` 不符。修复：正文改为 `src/platform/`（v4.3 §35 canonical）。
