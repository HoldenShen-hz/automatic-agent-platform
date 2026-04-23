# Current Todo List

> 当前整改清单以 [../reviews/architecture-design-vs-implementation-review.md](../reviews/architecture-design-vs-implementation-review.md) 为唯一真相。
> 本文件覆盖此前过早标记为 `done` 的 `W0-W6` 口径，只保留“仓内可落地、可测试、可文档回写”的整改任务。

## 1. 执行边界

- 只纳入仓内可开发、可验证、可在本轮文档回写中闭环的任务。
- `S4 K8s 集群级分片`、外部企业 IdP 真实联调、独立前端 WCAG 改造等外部基础设施/外部系统事项不计入本轮待办。
- 每个波次都必须同时完成：代码、测试、文档回写、review 状态同步。

## 2. 优先级映射

| 优先级 | review 缺口 | 本轮波次 |
| --- | --- | --- |
| `P0` | `II-1`、`III-1`、`IV-1`、`VI-1~VI-3` | `R1-R3` |
| `P1` | `I-2`、`II-2`、`III-2`、`IV-2~IV-4`、`VI-4~VI-9` | `R2-R5` |
| `P2` | `IV-5~IV-7`、`VI-10~VI-13` | `R4-R5` |
| `P3` | `II-3`、`VI-14/15`、`IX-1` | `R5-R6` |

## 3. 当前整改波次

### R0. Todo / Review 口径重置

状态：`in_progress`

- 重写 `current_todo_list` 为 `R0-R6` 结构。
- 去掉旧 `W1-W5 done` 口径，统一为“以 review 为准”。
- 清理 review 文档的重复缺口块，保留一份 authoritative 缺口台账。
- 在 todo 中建立 `review 编号 → 整改波次` 映射表。

完成定义：

- 中英文 `current_todo_list` 不再出现旧 `W*` 完成口径。
- `review / coverage-matrix / todo` 三者不再互相冲突。

### R1. Harness P0/P1 核心运行时补齐

状态：`in_progress`

- 扩展 `ConstraintPack`，补齐 `risk_policy / output_policy`。
- 将 `HarnessRun` 升级为多生命周期状态：`created / running / waiting_hitl / sleeping / recovering / completed / aborted`。
- 新增 `PlanBundle / WorkProduct / EvaluationReport / ContextSnapshot / WorkflowSleepLease / RecoveryCheckpoint` 契约。
- 为 Harness 补齐迭代、重入、resume、recovery 的正式运行时入口。
- 收口 review `VI-1 ~ VI-6`。

完成定义：

- Harness 不再只是单轮 `planner → generator → evaluator` 骨架。
- Harness 核心契约、状态机、恢复入口都可被定向测试验证。

### R2. ACP、OAPEFLIR↔Harness 语义映射、ModelGateway 补口

状态：`in_progress`

- 新增 `agent-delegation/collaboration-protocol`，落地 ACP message schema、8 种消息类型、强制字段与不变量校验。
- 将 ACP 接回现有委派主链：委派前校验、完成报告 evidence 约束、takeover notice 审计入口。
- 新增 OAPEFLIR↔Harness 显式语义映射，并写入 Harness step/report。
- 为 `UnifiedChatProvider` 补齐 `embed()` 和 `complete()`，复用现有 provider routing / degradation / cost attribution 主链。
- 收口 review `II-1`、`I-2`、`II-2`。

完成定义：

- 协作协议不再缺位。
- Harness 与 OAPEFLIR 的关系不再停留在文档描述。
- `ModelGateway` 对外能力补齐到 review 要求的 facade 级接口。

### R3. 领域元模型、Recipe 扩展、canonical domain_id 收敛

状态：`in_progress`

- 新增 `src/domains/canonical-meta-model/`，实现 Q1-Q12、validator、completeness 计算、24 域 seeder。
- 将 `DomainDescriptorOrchestrationService` 和 `bootstrapVerticalDomainBaselines()` 接到 meta-model validator。
- 将 `DomainRecipe` 原型扩展到 12 种。
- 修正 12 个不匹配的 `domain_id`，并提供 legacy alias → canonical 的兼容映射。
- 收口 review `III-1`、`III-2`、`IV-1`。

完成定义：

- 24 域全部使用 review 指定的 canonical `domain_id`。
- 领域元模型 completeness 可计算、可测试、可进入 descriptor review。

### R4. 24 域特化配置与域内运行面

状态：`in_progress`

- 为 24 域补齐正式配置入口和域特化 workflow/tool/risk/eval/latency/division wiring。
- 不再把通用 `intake → deliver` 双步工作流当作最终交付。
- 优先补齐 5 个关键域：`quant-trading`、`financial-services`、`finance-accounting`、`legal`、`healthcare`。
- 收口 review `IV-2 ~ IV-7`。

完成定义：

- 每个域至少拥有 domain-specific workflow、tool bundle、risk/eval profile、ownership 归属。
- 24 域 smoke / registry / rollout / governance wiring 测试补齐。

### R5. Harness P2/P3 子系统与产品级运行闭环

状态：`in_progress`

- 新增 `ToolbeltAssembler`、五层 Guardrails、正式 HITL Runtime、FeedbackEnvelope、Memory Namespace、Async Harness、Evaluation Harness。
- 将上述能力接入 `HarnessRun` 主链，而不是只做 helper。
- 补齐 Harness observability：iteration timeline、prompt lineage、failure-to-learning、replay entrypoint、audit link。
- 收口 review `VI-7 ~ VI-15`。

完成定义：

- Harness 具备产品级长时运行、HITL、反馈与学习闭环。
- 相关 integration / contract 测试可执行。

### R6. 路线图、ADR、ops-maturity 桩率与最终文档收口

状态：`in_progress`

- 修正 `RoadmapService`，补齐 Phase 8/9 注册。
- 补齐 review 点名缺失的 ADR 文件。
- 处理 `harness/` 目录结构、导出面和文档口径不一致的问题。
- 收口 `ops-maturity` 下被点名的高桩率叶子工具。
- 最终回写 `review / coverage-matrix / current_todo_list`，把已实现项全部改成 `✅`。

完成定义：

- 文档、目录、导出面、测试状态统一。
- review 里剩余项只保留外部基础设施类残留。

## 4. 测试要求

每个波次必须同时完成：

1. 代码实现
2. 定向测试
3. 文档回写
4. 修复该波次触发的失败测试

最低测试基线：

- Harness：`unit + integration`
- ACP / delegation：`unit + contract`
- domains：`unit + smoke + registry + rollout/gov wiring`
- ModelGateway：`unit + integration`
- 文档一致性：`docs + link + health`

## 5. 当前回写进度

- `R0` 已启动：todo 口径已切换到 review-driven remediation。
- `R0` 已完成关键去重：`architecture-design-vs-implementation-review.md` 的重复主块已裁剪为单一 authoritative 版本，文档健康测试继续通过。
- `R1` 已完成主干落地：ConstraintPack 扩展、Harness 多生命周期、PlanBundle/WorkProduct/EvaluationReport/ContextSnapshot/WorkflowSleepLease/RecoveryCheckpoint、resume/recovery/sleep 主链和定向测试已落地。
- `R3` 已完成主体实现：Q1-Q12 meta-model、12 种 recipe、12 个 canonical `domain_id`、legacy alias 兼容、descriptor/ bootstrap 接线和定向测试已落地。
- `R4` 已完成第一轮主干实现：24 域已具备专属 config 入口、domain-specific workflow/tool/eval/latency/ownership metadata，并已纳入 unit + integration 回归。
- `R5` 已完成第三轮子系统落地：`ToolbeltAssembler`、`GuardrailEngine`、`HitlRuntime`、`HarnessMemoryManager`、`AsyncHarnessService`、`EvalRunService`、`DurableHarnessService`、`ContextAssembler`、`RecoveryController`、timeline/invariant 检查已接回 Harness 主链，并有 unit/integration 回归保护。
- `R6` 已完成第二轮实现：`RoadmapService` 已补齐 Phase `8a/8b/8c/9a-9f` 的架构模板注册，`docs_zh/adr` 与 `docs_en/adr` 已补齐 `091-108` 的 Harness / Domain ADR，`harness/` 目录也已新增 canonical 子目录导出入口并通过结构对齐测试。
- `R6` 已完成第三轮实现：`platform-ops-agent`、`capacity-planner`、`compliance-reporter` 三组叶子工具已补成正式 service（capacity predictor / config optimizer / developer assistant / health monitor / incident diagnoser / forecaster / simulator / trend analyzer / evidence mapper / template registry / renderer），并通过 `build:test` 与定向 `ops-maturity` 回归保护。
- `R6` 已完成第四轮测试稳定化：`FluentdTransport` 已改为 lazy-connect，并把 reconnect timer / socket 句柄变成不阻塞进程退出；`DatadogTransport` 已补 requestFactory 注入点，observability transport 回归不再依赖真实外网超时。`build:test` 与定向 `shared/observability` 回归已重新通过。
- `R6` 已完成第五轮测试收口：`clean-dist.mjs` 现在会在保留 `dist` 时自动剪掉没有源码对应的陈旧测试产物，避免 `AA_PRESERVE_DIST=1` 把幽灵测试重新跑进全量；全量回归已重新产出 coverage report，并通过 baseline 更新后重新使 `coverage:gate` 绿灯。
- `R1-R6` 仍以 review 缺口为准推进，不再复用旧 `W* done` 结论。
- 所有后续“已完成”状态，必须以代码、测试、文档三者同时落地为准。
