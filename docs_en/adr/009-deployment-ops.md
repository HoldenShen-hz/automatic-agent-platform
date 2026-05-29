# ADR-009 部署vs运维

---

## OAPEFLIR 关联

本文档defines OAPEFLIR 八阶段认知循环中的以下组件：

- **Observe**：信号采集vs统一 DTO
- **Assess**：执lines前/后评估vs风险判断
- **Plan**：显式规划vs DAG 构建（ADR-060）
- **Execute**：步骤执linesvs Dual-Channel 输出
- **Feedback**：信号收集、预handlevs 7 class反馈源（ADR-079）
- **Learn**：模式检测vs知识提取（ADR-080）
- **Improve**：改进候选评估vs Rollout Status机（ADR-075）
- **Release**：六级受控发布vs自动回滚

---

- Status：Historical Context（see v4.3 runtime / operations baseline）
- Decision日期：2026-04-02

## Background

平台既要supported本地 CLI / TUI，也要supported服务端 HTTP / Telegram / Web 模式，还要满足崩溃恢复、可观测性、configure热重载和后续多租户扩展。因此部署vs运维不能只考虑单机 happy path。

## Decision

采用 TypeScript 全栈 + 分阶段基础设施演进路线：

- 核心服务层统一放在 `src/core/`。
- 接入层includes CLI、TUI、HTTP Server、Gateway 和 Embedded Client。
- 早期持久化uses SQLite + WAL。
- via结构化事件、工作流Status、产出物storage和恢复算法supported crash recovery。
- uses Feature Flag 控制阶段性功能enabled，避免未成熟能力提前耦合到主路径。

## 项目结构principle

code结构应围绕职责边界展开：

- `core/`：运lines时、工具、provider、session、storage、security、supervisor、memory。
- `divisions/`：事业部definesvs角色 prompt。
- `tools/`：内置工具、协作工具和专用工具。
- `gateway/`：多渠道接入。
- `server/`：HTTP API。
- `cli/`：CLI vs TUI。
- `perception/`：主动感知模块。

## storagevs恢复

Phase 1-2 采用 SQLite，但必须承认其边界：

- via WAL 提升读写concurrent。
- 避免让 heartbeat 等高频datadirectly写库。
- 事件和 tool usage 采用批量或异步writes。
- 明确concurrent活跃 Agent upper limit。

为了支撑恢复，至少需要：

- 任务table。
- workflow_state。
- workflow_step_outputs。
- sessions / messages。
- events。
- artifacts 索references。

## 接入vs API

平台接入层至少includes：

- CLI vs TUI。
- HTTP API。
- SSE 流式事件。
- Embedded Client。
- Gateway 桥接 Telegram，后续扩展 Slack / 飞书。

这些入口应共享同一服务层，而不is复制业务逻辑。

## configurevs功能开关

configure系统应supported：

- YAML configure。
- 环境variable插值。
- configure版本迁移。
- configure热重载。
- Feature Flag 控制阶段性能力。

生产构建中，可进一步利用 Feature Flag 做编译期 DCE，减少未enabled功能体积。

## 测试vs可观测性

运维设计必须contains测试vs观测：

- 测试金字塔vs LLM mock。
- VCR / record-replay 测试。
- 结构化日志。
- 核心 KPI vs调试日志基建。
- 边界测试，验证Architecture层和permission层没有被bypassing。

## 演进路线

- Phase 1-2：SQLite 单机Architecture，明确concurrentupper limit。
- Phase 3：增强渠道、authentication、Web 和商业化基础设施。
- Phase 4：迁移到 PostgreSQL、多租户、队列系统和更强企业能力。

## 结果

优点：

- 开发速度快，适合早期单人 + AI 团队推进。
- via统一服务层复用 CLI、HTTP、Embedded Client。
- 迁移路径明确，避免早期过度设计。

代价：

- SQLite concurrentupper limit必须在文档和运lines时中被硬性承认。
- Phase 迁移需要强测试vs兼容约束，no则后续升级代价会很高。
- 若过早加入 Web、多租户和商业化能力，会显著拖慢基建成熟速度。

## 交叉references用

- [ADR-001 三层分权Architecture](./001-three-layer-architecture.md)
- [ADR-005 security模型](./005-security-model.md)
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
