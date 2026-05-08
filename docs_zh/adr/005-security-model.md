# ADR-005 安全模型

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

Automatic Agent 允许 Agent 访问工具、执行命令、调用外部系统，并最终面向多租户和商业化场景运行，因此必须在模型层之外建立强制执行的安全边界。

## 决策

采用多层安全模型：

- 角色权限层：每个角色只能访问被授权的工具和能力。
- 策略判断层：规则系统或策略提供者对命令和操作做 `allow`、`deny`、`ask` 判断。
- 审批层：高风险命令、外网访问、破坏性操作必须升级确认。
- 执行层：通过沙箱、路径映射、网络隔离和运行时审计做强制约束。
- 插件运行时层：高信任内建 plugin 可以进入独立 subprocess runtime，并在更强模式下启用专属 sandbox root、最小 env 白名单与 Node permission model。

## 四层防护思路

核心原则：

- `deny wins`，任何一层拒绝都终止执行。
- 默认最小权限。
- prompt injection 不能越过工具边界和沙箱边界。
- 成本超限、策略违规或 LLM 全面不可用时进入只读、暂停或终止状态。

安全链路：

1. 角色工具权限先筛一层。
2. 策略规则或 provider 再判断一层。
3. 需要时走审批。
4. 最后由沙箱和执行器强制落地。

## 运行模式

平台的运行模式会影响审批和自动化边界：

- `full_auto`：仅在更严格的预算、安全和回滚条件下开放。
- `supervised_auto`：允许自动执行，但高风险行为仍需受监督。
- `read_only`：禁止写入和副作用。
- `no-write`：允许读取与分析，但不允许任何写操作。
- `no-external-call`：禁止外部网络与第三方系统调用。
- `no-rollout`：禁止发布、推广和外部影响放大动作。
- `manual_only`：所有敏感动作都要求人工显式确认。
- `incident-mode`：事件处置模式，优先保护系统和证据链。

说明：

- `supervised / auto / full-auto` 只允许作为旧产品话术或 UI 投影，不再作为 canonical runtime mode 枚举。

## 沙箱与执行策略

执行侧至少要覆盖：

- 文件系统访问限制。
- 网络访问策略。
- 命令解析与风险分类。
- 超时、输出限制和异常捕获。
- 平台检测与不同宿主环境适配。
- plugin SPI 的 isolated runtime 至少区分 `shared_process`、`forked_process`、`sandboxed_process` 与 `containerized_process`；其中 `sandboxed_process` 必须是独立受限子进程，而 `containerized_process` 必须通过显式 launcher 接口进入外部独立沙箱，而不是仅靠逻辑约束。

增强能力包括：

- 虚拟路径映射。
- 沙箱预热池。
- 沙箱级文件锁。
- 远程 kill switch。
- 对 plugin runtime 应保留向 container / microVM 演进的空间；当前实现除 Node permission model + sandbox root 的 `sandboxed_process` 外，还提供了 `containerized_process` launcher host，可对接 `docker` / `podman` / `bwrap` 等外部隔离器，但这仍不等于已经完成 live orchestrator 编排。

## 可插拔策略提供者

策略层不应只支持一种实现：

- Phase 1a：规则驱动 provider。
- Phase 3：AI 分类器 provider。
- Phase 4：对接 OPA 等企业策略引擎。

统一约束：

- 所有 provider 结果进入同一决策链。
- 多 provider 并存时采用 `deny wins`。

## 认证与租户隔离

商业化后的安全能力还包括：

- PKCE OAuth。
- Web UI / CLI 的 token 管理。
- 多租户数据隔离。
- RBAC 角色权限。
- 费用和产出物按 `user_id` 或租户隔离。

## 结果

优点：

- 安全边界不依赖模型自觉。
- 未来企业级策略提供者可以无缝接入。
- 与权限、审计、恢复和商业化能力保持一致。

代价：

- 工具设计和角色设计必须显式表达边界。
- 沙箱、审计和审批会增加实现与测试成本。
- 必须用测试证明策略链能真正拦下危险路径。

## 交叉引用

- [ADR-006 LLM Provider 策略](./006-llm-provider-strategy.md)
- [ADR-008 成本模型](./008-cost-model.md)
- [ADR-009 部署与运维](./009-deployment-ops.md)

## 来源章节

- `§8.1`
- `§8.1.1`
- `§8.1.2`
- `§8.2`
- `§8.3`
- `§8.4`
- `§8.5`
- `§8.6`

## v4.3 ADR Remediation

- A-22: 本 ADR 原先只保留 `supervised / auto / full-auto` 三档运行模式，根因是早期安全模型把自动化程度当作唯一控制轴，没有把只读、禁写、禁外呼、禁 rollout、manual-only、incident-mode 这些运行时保护模式建成 canonical 枚举。修复：正文现将运行模式收敛到主架构规定的 8 种 runtime mode，并把旧三档降为 UI / 产品投影术语。
