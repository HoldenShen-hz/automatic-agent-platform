# Automatic Agent System — Agent Harness 改进方案 v1.9-Architecture-Release

| 字段 | 内容 |
|---|---|
| 文档版本 | v1.9-Architecture-Release |
| 日期 | 2026-05-26 |
| 基线版本 | `v1.8-RC`（逻辑基线；当前仓库未保留独立的 v1.8 文档文件） |
| 适用系统 | Automatic Agent System / Automatic Agent Platform |
| 顶层Architecture | Five Plane Architecture |
| 任务生命cycle | OAPEFLIR：Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release |
| 驱动方式 | Harness-driven：模型作为推理、生成、候选Decision组件，不作为系统控制器 |
| 能力地图 | Agent Harness Engineering / ETCLOVG 作为能力成熟度地图，不替代 Five Plane |
| Memory Architecture | Seven-layer Memory Governance，via逻辑上的 Memory Gateway 统一治理，不mandatory统一物理storage，也不mandatory新建同名目录 |
| 本版目标 | 在 v1.8-RC 基础上完成 release 前收敛：统一版本references用、明确 release class型、修正工程冻结条件、收敛 ADR Status、补充首批验证场景Recommendation，并保留真实code扫描 / owner / CI / P0a shadow 的工程阻断项 |
| 发布Conclusion | **可以 release 为 v1.9 Architecture Review Release**；不可作为 Engineering Freeze Baseline 或 Production Governance Baseline。进入工程冻结前仍必须完成真实仓库扫描、真实 owner 绑定、CI 命令落地和 P0a shadow 路径验证 |

---

## 0. 一页Conclusion

v1.8-RC 已via具备Architecture评审条件；v1.9 在此基础上完成 release 前收敛，修复版本一致性、ADR Status、工程冻结条件、首批验证场景Recommendation和 release 边界table述。

本版**可以正式 release 为 Architecture Review Release**，used for团队Architecture评审、工程排期、真实code扫描和 P0a 影子链路启动；但**不能**作为 Engineering Freeze Baseline 或 Production Governance Baseline。冻结工程基线前必须完成真实仓库扫描、真实 owner 绑定、CI 命令落地、P0a shadow 路径跑通。

本版主要改进：

1. **code映射不再伪装为事实**：Current Codebase Gap Matrix 明确区分 `已扫描确认 / 假设路径 / 待扫描确认 / 新增模块`，防止把目标设计误读为当前实现。
2. **TODO 增加真实执lines字段**：所有 Canonical TODO 增加 `OwnerName / Reviewer / TargetStart / TargetEnd / IssueLink / VerifyCommandStatus`，未确定项统一标记 `TBD`，不再伪装为已分配。
3. **CI 命令契约化**：所有 verify command 明确分为 `existing / to_add / TBD`，避免出现“文档里有验收命令但仓库里don't exist”的Issue。
4. **P0b 再拆分**：P0b 拆成 `P0b-1 high-risk tool enforce`、`P0b-2 L4-L7 memory enforce`、`P0b-3 production release gate`、`P0b-4 H3 untrusted output enforce`、`P0b-5 minimal approval UI/API`。
5. **H1-lite 前移**：外部文本、文件、检索结果、第三方资料的 untrusted 标记vs基础注入检测进入 P0b/P0c；H1-full 保持 P1。
6. **Release Gate threshold具体化**：按场景defines Golden / Security / Trajectory / Evidence / Cost threshold；high/critical 任务的 Policy Compliance vs Approval Compliance 必须满分。
7. **Cost/Latency relies on修正**：P0c 只做 advisory；P1 才允许作为 release blocking gate。
8. **Receipt / Outbox 原子性补强**：高风险副作用 commit 前必须writes `PrepareReceipt` 或 durable outbox record，避免“副作用已发生但证据层norecord”。
9. **Tool 可逆性进入风险Decision**：`not_reversible` / `forward_fix_only` 等可逆性等级参vs risk resolution，不再只is metadata。
10. **Memory Gateway 接口落地**：补充 `ManagedMemoryMinimal`、`MemoryProposal`、`MemoryProjection`、`MemoryCommitDecision`、`MemoryRevokeDecision`。
11. **Security & Privacy Baseline 补齐**：覆盖 secret、PII、cross-tenant isolation、retention、export/delete、restricted evidence access。
12. **增加三流图vs系统边界图**：补充控制流、证据流、Memory 流和 Five Plane × Gate 总图，便于评审理解。
13. **首批业务场景展开**：论文调研 Agent、code审查/测试failed分析 Agent 给出输入、工具、风险、Gate、Memory、Eval 和验收指标。
14. **TODO for deduplication**：Release Console、Memory Review Console 等拆成 backend/API vs frontend/UI，uses唯一 Canonical TODO ID。

最终Architecturetable达仍然不变：

```text
Automatic Agent System
= Five Plane Architecture
+ Harness-driven Runtime
+ OAPEFLIR Task Lifecycle
+ ETCLOVG Capability Maturity Map
+ Seven-layer Memory Governance
+ Trace-native Evaluation
+ Release / Evaluation / Governance Gate
```

### 0.1 v1.9 Release 声明

| 项 | Conclusion |
|---|---|
| Release 名称 | Automatic Agent System — Agent Harness 改进方案 v1.9-Architecture-Release |
| Release class型 | Architecture Review Release |
| 允许用途 | Architecture评审、工程排期、真实code扫描、P0a shadow 实施准备、首批业务场景基线评测准备 |
| 禁止用途 | 不得作为工程冻结基线、生产治理标准、生产发布门禁的唯一依据 |
| 仍阻断工程冻结的事项 | 真实code扫描、真实 Owner/Reviewer/Issue、CI 命令落地、P0a shadow E2E、Eval baseline 校准 |
| 下一目标版本 | v2.0 Engineering Baseline Candidate，前提is完成所有工程冻结条件 |

---

## 1. v1.9 相比 v1.8-RC 的 release 前收敛

| class别 | v1.8-RC 剩余Issue | v1.9 收敛方式 |
|---|---|---|
| code映射 | Gap Matrix 仍is“待扫描确认”的假设路径 | 增加 `MappingConfidence` vs `ScanAction`，明确哪些is事实、哪些is待扫描 |
| TODO 执lines | Owner is团队角色，不is真实负责人 | 增加 `OwnerName / Reviewer / TargetStart / TargetEnd / IssueLink`，未确定统一标记 TBD |
| 验收命令 | verify command 可能don't exist | 增加 `VerifyCommandStatus: existing / to_add / TBD` vs CI Command Contract |
| TODO repeats | Release Console、Memory Review Console 等repeats | 拆成 backend/API vs frontend/UI，建立relies on关系 |
| P0 阶段 | P0b 仍过重 | 拆成 P0b-1 到 P0b-5，分批 enforce |
| H1 风险 | H1 Input Gate 放到 P1 过晚 | H1-lite 前移到 P0b/P0c，H1-full 保持 P1 |
| Evaluation threshold | release threshold 偏抽象 | 增加按场景的 blocking threshold vs high-risk 满分项 |
| Cost/Latency | P0c Release Gate relies on P1 observability | P0c advisory，P1 blocking |
| Receipt 原子性 | receipt 写failed后的兜底不够底层 | 增加 durable outbox / commit journal 设计 |
| Tool rollback | 可逆性 metadata 未参vsDecision | 增加 reversibility risk rule |
| Memory schema | Memory Gateway 接口偏概念 | 增加 ManagedMemoryMinimal 等最小接口 |
| security隐私 | L5/L6/L7 memory vs trace privacy 不足 | 增加 Security & Privacy Baseline |
| 可读性 | 缺系统边界图和三流图 | 增加 Mermaid Architecture图、控制流、证据流、Memory 流 |
| 业务落地 | Business Scenario Matrix 偏粗 | 展开首批两个场景的落地设计 |

---

## 2. Architecture定位vs Non-goals

### 2.1 主Architecture仍is Five Plane

```text
1. Interface Plane
2. Control Plane
3. Orchestration Plane
4. Execution Plane
5. State & Evidence Plane

+ Reliability / Security / Governance / Observability Fabric
```

### 2.2 OAPEFLIR is任务生命cycle

```text
Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release
```

Release 必须区分两class：

| Release class型 | 含义 | 示例 | isno需要 Release Gate |
|---|---|---|---|
| Mission Release | 单iterations任务产物交付、验收、归档 | 报告、PR 草稿、实验Recommendation、预测辅助Conclusion | 需要任务级验收，不等同系统发布 |
| System Artifact Release | 系统能力版本发布 | prompt、tool schema、policy、workflow、model config、evaluator、sandbox config | 必须via过 EvalReport、Approval、Canary、RollbackPlan |

### 2.3 ETCLOVG is能力地图，不is顶层Architecture

| ETCLOVG | 对应 Five Plane | 用途 |
|---|---|---|
| E Execution Environment & Sandbox | Execution Plane | sandbox、worker、lease、side-effect commit |
| T Tool Interface & Protocol | Execution + Control | tool gateway、schema、routing、permission、tool version |
| C Context & Memory Management | Orchestration + State & Evidence | seven-layer memory、projection、context drift |
| L Lifecycle & Orchestration | Orchestration Plane | mission/session/task lifecycle、多 agent 协同 |
| O Observability & Operations | State & Evidence + Fabric | trace、metrics、cost、latency、failure diagnosis |
| V Verification & Evaluation | Control + State & Evidence | readiness、trajectory eval、regression、release gate |
| G Governance & Security | Control + Fabric | policy、approval、identity、audit、security guardrail |

### 2.4 Non-goals

本iterations改造明确不做：

1. 不把 Five Plane 改成 ETCLOVG 七层。
2. 不一iterations性重构目录结构。
3. 不让模型directly执lines副作用工具。
4. 不让模型directly commit L4-L7 Memory。
5. 不把 Memory 当 Policy。
6. 不把 Evidence 当 Memory。
7. 不把 Context 当事实源。
8. 不把最终答案评分当完整 Agent 评测。
9. 不把 Tool Registry 等同于 Tool Gateway。
10. 不允许没有 EvalReport / RollbackPlan 的 System Artifact Release 进入生产。
11. 不在 P0 阶段强lines完成full sandbox、full UI、full自优化。
12. 不把文档 release 等同于运lines时治理基线。
13. 不把本文件中的假设code路径当作当前code事实；必须via过仓库扫描确认。
14. 不把团队角色 owner 当作真实负责人；真实负责人必须在工程排期时补齐。
15. 不因为文档中的目标名词而平lines新建第二套子系统；defaults to先包装、扩展、收敛现有实现。

---

## 3. 系统边界图：Five Plane × Gate × Evidence

```mermaid
flowchart TB
    U[User / API / SDK / CLI / Webhook] --> IP

    subgraph IP[Interface Plane]
      UI[Chat / Admin Console / Approval Queue / Trace Explorer]
    end

    IP --> H1[H1 Input Gate<br/>untrusted input screening]
    H1 --> C[Control Plane]

    subgraph C[Control Plane]
      POLICY[PolicyBundle / Permission / Budget / Risk]
      APPROVAL[Approval Gate]
      RELEASE[Release Gate]
      EVALG[Evaluation Gate]
    end

    C --> O[Orchestration Plane]

    subgraph O[Orchestration Plane]
      MISSION[Mission / Session / Task Lifecycle]
      PLAN[Planner / OAPEFLIR Loop]
      CTX[Context Builder / Memory Projection]
    end

    O --> H2[H2 Action Gate<br/>proposed action check]
    H2 --> E[Execution Plane]

    subgraph E[Execution Plane]
      TG[Tool Gateway]
      SB[SandboxProvider]
      WORKER[Worker Runtime]
      LEASE[Lease / Fencing / Idempotency]
      COMMIT[Prepare / Commit / Verify / Compensate]
    end

    E --> H3[H3 Observation Gate<br/>tool output filtering]
    H3 --> S[State & Evidence Plane]

    subgraph S[State & Evidence Plane]
      STORE[AuthoritativeTaskStore]
      BUS[DurableEventBus]
      RECEIPT[Receipt Store]
      EVID[Evidence Store]
      MEM[Seven-layer Memory Store Adapters]
      OUTBOX[Durable Outbox / Commit Journal]
    end

    C --> H4[H4 Approval Gate<br/>high-risk side-effect approval]
    H4 --> COMMIT

    FABRIC[Reliability / Security / Governance / Observability Fabric]
    FABRIC -.-> IP
    FABRIC -.-> C
    FABRIC -.-> O
    FABRIC -.-> E
    FABRIC -.-> S
```

---

## 4. 术语table

| 术语 | defines |
|---|---|
| Harness | 包裹模型的执lines控制系统，负责生命cycle、工具、Status、证据、评测、治理vs发布 |
| Plane | 顶层职责边界，used for划分系统控制、编排、执lines、Status和接口职责 |
| Capability | 生产级 Agent 所需能力域，例如 Tool Gateway、Memory Governance、Trace-native Evaluation |
| Mission | 面向业务目标的一iterations完整任务单元，可以跨 session、跨 task、跨工具运lines |
| Session | user或系统vs Agent 的一iterations交互上下文，隶belongs to Mission |
| Task | Mission 下可调度、可执lines、可评测的子任务 |
| Receipt | 结构化执lines凭证，record policy、approval、tool、memory、evaluation、release 等关键动作 |
| Evidence | 原始证据、工具结果、trace、日志、文件、评测结果等不可directly替代的事实材料 |
| Memory | 从 evidence、state、feedback 中提炼出的可复用知识、偏好、via验或摘要 |
| Context | 本iterations模型call看到的投影，不is事实源 |
| Projection | 按permission、任务、budget、风险从 memory/evidence/state 中选择并压缩后的上下文视图 |
| PolicyBundle | Control Plane 中可执lines策略的唯一权威版本对象 |
| Governance Memory | 治理via验、failed模式、policy proposal、eval case，不能替代 PolicyBundle |
| Release Artifact | 可版本发布的系统对象，如 prompt、tool schema、policy、workflow、model config、evaluator、sandbox config |
| Harness Lockfile | System Artifact Release 的不可变relies on锁定文件，used for可复现、灰度、回滚 |
| Durable Outbox | 在副作用动作前后record可恢复事件的可靠writes缓冲，used for修复 receipt 写failed |

---

## 5. 核心不variable Invariants

这些不variable必须进入code、测试和 review checklist：

1. 模型不能directly执lines副作用工具。
2. 模型不能directly commit L4-L7 Memory。
3. 工具输出不能bypassing H3 进入 Context 或 Memory。
4. 高风险动作不能bypassing H4 Approval。
5. System Artifact Release 不能bypassing EvalReport、Approval 和 RollbackPlan。
6. Receipt 不能缺少 `tenantId / traceId / missionId / schemaVersion / timestamp`。
7. PolicyBundle is可执lines策略的唯一权威来源。
8. L7 Governance / Experience / Evaluation Memory 只能存放 policy evidence、policy proposal、failure pattern、eval case 和 release via验；不能替代 PolicyBundle。
9. Evidence is原始证据；Memory is证据派生资产；Context is投影。
10. L1 Active Context Memory is projection output，不is authoritative source。
11. Mission Memory 不能替代 AuthoritativeTaskStore。Mission Status的权威来源is `StateCommand / AuthoritativeTaskStore`；Mission Memory 只is对目标、约束、Decision、摘要和via验的可复用table示。
12. 高风险副作用 commit 前必须至少writes `PrepareReceipt` 或 durable outbox record。
13. `production_mutation + not_reversible` defaults to critical 且defaults to block，除非 break-glass。
14. Revoked / expired / quarantined memory 不得进入 Context Projection。
15. 跨租户 memory、evidence、trace defaults to不可见，除非显式authorization。
16. P0c 阶段 cost / latency 只能作为 advisory；P1 以后才能作为 release blocking gate。

---

## 6. Current Codebase Gap Matrix / 当前code映射

> Description：本节不iscode事实审计结果，而is v1.9 的工程扫描清单。所有 `MappingConfidence = 待扫描确认` 的条目必须via仓库扫描、测试运lines和 owner 确认后，才能进入工程实施基线。

### 6.1 映射Statusdefines

| 字段 | 取值 | 含义 |
|---|---|---|
| MappingConfidence | 已扫描确认 / 部分确认 / 假设路径 / 待扫描确认 / 新增模块 | 当前映射可信度 |
| ImplementationStatus | 已实现 / 部分实现 / 缺失 / mock / unknown | 当前实现Status |
| MigrationMode | 包装 / 替换 / 新增 / 下沉 / 删除 / 保持 | 改造方式 |
| VerifyCommandStatus | existing / to_add / TBD | 验收命令isno已存在 |
| ReleaseBlocking | yes / no / conditional | isno阻断工程冻结基线 |

### 6.2 Gap Matrix

| 目标能力 | 当前已观察模块（仓库扫描） | MappingConfidence | 当前Status | 改造方式 | 目标收敛形态（非新建承诺） | Verify Command | VerifyCommandStatus | ReleaseBlocking |
|---|---|---:|---|---|---|---|---|---|
| Tool execution / registry boundary | `src/platform/five-plane-execution/tool-executor/`、`src/platform/five-plane-orchestration/harness/toolbelt/` | 部分确认 | 部分实现 | 包装/扩展 | 在现有 `tool-executor` 前增加统一 gateway facade，而不is先分叉新执lines栈 | `npm run test:integration` | existing | yes |
| Policy / Approval / Risk | `src/platform/five-plane-control-plane/risk-control/`、`src/platform/five-plane-control-plane/approval-center/`、`src/org-governance/approval-routing/` | 部分确认 | 部分实现 | 扩展 | 在现有风控/审批实现之上补齐统一 governance hook，而不is平lines新建Control Plane | `npm run test:integration` | existing | yes |
| Event Bus / Outbox / Receipt | `src/platform/five-plane-state-evidence/events/`、`src/platform/shared/outbox/`、`src/platform/five-plane-state-evidence/side-effect-ledger/` | 部分确认 | 部分实现 | 扩展 | 以现有 event/outbox/ledger 收敛为 receipt contract，而不is先拆新 receipt 子系统 | `npm run test:integration` | existing | yes |
| Task Store / Truth | `src/platform/five-plane-state-evidence/truth/` | 已扫描确认 | 部分实现 | 扩展 | 在 truth/repository 之内固化 authoritative task semantics，而不is复制第二套Status真源 | `npm run test:integration` | existing | yes |
| Memory governance | `src/platform/five-plane-state-evidence/memory/`、`src/platform/five-plane-orchestration/harness/memory-manager.ts` | 已扫描确认 | 部分实现 | facade 包装 | 以 adapter/facade 方式收敛 memory plane，而不is先新建独立 memory-gateway 包 | `npm run test:integration` | existing | yes |
| Release / Rollout gate | `src/platform/shared/stability/stable-release-gate.ts`、`src/platform/five-plane-control-plane/config-center/`、`src/sdk/cli/release-pipeline.ts` | 部分确认 | 部分实现 | 扩展 | 在现有稳定性/发布链路上补齐 release-gate contract，而不is复制第二套发布控制器 | `npm run gate:stable` | existing | yes |
| Evaluation / Harness grading | `src/platform/five-plane-orchestration/harness/evaluation/`、`src/platform/five-plane-orchestration/harness/eval-harness/` | 已扫描确认 | 部分实现 | 扩展 | 收敛现有 harness evaluation 路径，不再额外复制独立 eval stack | `AA_VALIDATION_ITERATIONS=2 npm run validate:stable:compiled` | existing | conditional |
| Observability | `src/platform/shared/observability/`、`src/platform/shared/stability/` | 已扫描确认 | 部分实现 | 扩展 | 在现有 observability 上补 agent trace 维度，不平lines新建第二套 metrics/logging 平面 | `npm run observability:smoke` | existing | conditional |
| Sandbox / execution guard | `src/platform/five-plane-execution/tool-executor/command-security.ts`、`src/platform/five-plane-execution/tool-executor/tool-path-scope.ts`、`src/platform/five-plane-orchestration/harness/sandbox/` | 部分确认 | 部分实现 | 新增抽象 | 提炼共享 sandbox contract；only当现有实现no法承载时才拆分新目录 | `npm run test:integration` | existing | no |
| Interface Console / Approval UI | `src/platform/five-plane-interface/console/`、`src/platform/five-plane-interface/api/http-server/approval-routes.ts`、`ui/packages/features/approval/` | 已扫描确认 | 部分实现 | 扩展 | 优先补齐现有 console/API/UI 链路，不再并lines新建另一套 admin console | `npm run test:e2e` | existing | conditional |
| CI boundary scan | `scripts/ci/`、`.github/workflows/` | 已扫描确认 | 部分实现 | 新增 | `scripts/architecture-boundary-scan.mjs` | `npm run lint:architecture-boundary` | existing | yes |

### 6.2.1 实施解释规则

1. `目标收敛形态` is职责收敛方向，不is必须新建的物理目录名。
2. 若现有模块via facade、adapter、contract tightening 可以达成目标，defaults to禁止新建平lines子系统。
3. 只有当扫描结果证明现有边界no法承载，且 ADR 明确Description复用failed原因时，才允许拆出新的物理模块。
4. 评审、排期、TODO、测试命令一律优先绑定到当前仓库已有实现，再逐步抽象出统一入口。

### 6.3 必须补充的真实扫描输出

工程冻结前必须生成：

```text
docs_zh/reviews/current-codebase-gap-review-v1.9.md
```

当前仓库已补入自动扫描产物：

```text
docs_zh/reviews/current-codebase-gap-review-v1.9.md
artifacts/current-codebase-gap-review-v1.9.json
```

`scan:current-codebase-gap` 已via落地；这two产物已可本地可复现生成。它们尚未进入 CI workflow，因此仍未成为工程冻结门禁的一部分。

该审查文档至少contains：

1. 真实目录树vs模块清单。
2. 当前 Tool / Policy / Memory / Event / Release / Evaluation / Observability 实现Status。
3. 所有 direct tool import、direct memory write、direct release publish 的code位置。
4. 当前 package.json 中已存在的 test/lint/build 命令。
5. 当前测试覆盖情况vs缺失的 P0 gate 测试。
6. 改造风险、owner、预计工作量。

### 6.4 Current Codebase Gap Review 输出模板

真实仓库扫描报告必须is可复现产物，而不is人工口头确认。Recommendation由 `npm run scan:current-codebase-gap` 生成 Markdown + JSON two结果：

```text
docs_zh/reviews/current-codebase-gap-review-v1.9.md
artifacts/current-codebase-gap-review-v1.9.json
```

JSON 最小结构：

```ts
export interface CodebaseGapReviewItem {
  capability: string;
  expectedPath: string;
  actualPaths: string[];
  implementationStatus: "implemented" | "partial" | "missing" | "mock" | "unknown";
  directBypassLocations: string[];
  testFiles: string[];
  packageScripts: string[];
  migrationMode: "wrap" | "replace" | "extend" | "new" | "remove" | "keep";
  migrationRisk: "low" | "medium" | "high" | "critical";
  estimatedEffort: "S" | "M" | "L" | "XL";
  ownerName?: string;
  reviewer?: string;
}
```

扫描至少覆盖：

1. `src/`、`tests/`、`ui/`、`scripts/`、`.github/`、`package.json`。
2. direct tool import / direct memory write / release bypass / policy bypass。
3. 当前已有 event bus、task store、memory、tool、policy、observability、release、evaluation 模块。
4. 当前测试命令、覆盖率命令、E2E 命令和 CI workflow。
5. vs P0 TODO 对应的code路径和测试路径isno存在。

**基线冻结规则：** 若 `MappingConfidence` 仍为 `待扫描确认`，该能力不得进入工程冻结基线，只能作为待办项进入排期。

---

## 7. CI Command Contract / 验收命令契约

### 7.1 命令Statusdefines

| Status | 含义 | handle方式 |
|---|---|---|
| existing | 当前仓库已存在（允许is aggregate 命令） | 可以directly作为评审版验收命令；工程冻结前应尽量收敛为 dedicated script |
| to_add | 当前未确认存在，v1.9 要求新增 | 对应 TODO 必须创建脚本和测试集合 |
| TBD | 需要扫描仓库后确认 | 阻断工程基线冻结 |

### 7.2 P0 required命令

当前仓库已via存在一批可directly复用的 aggregate 命令；v1.9 评审版先显式绑定这些现有命令，工程冻结前再按能力面补齐 dedicated script。

| 命令 | 目标 | 当前Status | 对应 TODO |
|---|---|---|---|
| `npm run test:integration` | 覆盖 receipt / outbox / truth / tool / policy / memory 等集成能力 | existing | REC-001,TOOL-001,GOV-001,MEM-001 |
| `npm run test:e2e` | 覆盖 approval / prompt injection / tenant boundary / side-effect 流程 | existing | GOV-002,GOV-003,UI-001,E2E-001,SEC-001 |
| `npm run gate:stable` | 覆盖 release gate / release package 稳定性门禁 | existing | REL-001 |
| `AA_VALIDATION_ITERATIONS=2 npm run validate:stable:compiled` | 覆盖稳定性验证vs eval-style compiled validation | existing | EVAL-001 |
| `npm run prompt-injection:stable` | 覆盖 H1-lite / prompt injection 红队基线 | existing | GOV-004,SEC-001 |
| `npm run security:tenant` | 覆盖跨租户vssecurity边界校验 | existing | SEC-001 |
| `npm run observability:smoke` | 覆盖 cost / latency / metrics / diagnostics 冒烟验证 | existing | OBS-001 |
| `npm run lint:architecture-boundary` | 禁止 direct tool import / direct memory write / release bypass | existing | CI-001 |
| `npm run scan:current-codebase-gap` | 生成真实code映射报告 | existing | DOC-014 |
| `npm run test:receipt-store` | 覆盖 BaseReceiptMinimal / outbox / ledger 的最小收敛契约 | existing | REC-001 |
| `npm run test:tool-gateway` | 覆盖 ToolGateway shadow / prepare / commit / verify / compensate facade | existing | TOOL-001,TOOL-002 |
| `npm run test:memory-gateway` | 覆盖 MemoryGateway facade、proposal-only、projection | existing | MEM-001 |
| `npm run test:release-gate` | 覆盖 ReleaseManifestDraft facade vs stable gate 最小契约 | existing | REL-001 |

### 7.3 CI Gate principle

1. `to_add` 命令在工程基线冻结前必须进入 `package.json` 或 CI workflow。
2. `TBD` 命令不允许作为 release checklist 的via项。
3. P0b enforce 之前，`lint:architecture-boundary` 必须至少能发现 bypass，但可以不 fail build。
4. P0c 之后，P0 blocking gate 的 bypass 必须 fail build。


### 7.4 package.json 脚本契约

当前仓库已具备 `test:integration`、`test:e2e`、`gate:stable`、`validate:stable:compiled`、`prompt-injection:stable`、`security:tenant`、`observability:smoke` 等 aggregate 命令，并已补齐 `test:receipt-store`、`test:tool-gateway`、`test:memory-gateway`、`test:release-gate` 四个 dedicated script。注意：这些脚本名is验收契约，允许先包装最小真实测试集合，但不允许空壳脚本。

```json
{
  "scripts": {
    "scan:current-codebase-gap": "node scripts/scan-current-codebase-gap.mjs",
    "lint:architecture-boundary": "node scripts/architecture-boundary-scan.mjs",
    "test:receipt-store": "node --import tsx --test tests/unit/platform/state-evidence/receipts/index.test.ts",
    "test:tool-gateway": "node --import tsx --test tests/unit/platform/execution/tool-gateway/index.test.ts",
    "test:policy-gate": "node --test tests/unit/platform/control-plane/governance-hooks tests/integration/platform/control-plane/governance-hooks",
    "test:memory-gateway": "node --import tsx --test tests/unit/platform/state-evidence/memory-gateway/index.test.ts",
    "test:release-gate": "node --import tsx --test tests/unit/platform/shared/stability/release-gate-facade.test.ts tests/unit/platform/shared/stability/stable-release-gate.test.ts tests/unit/platform/stability/stable-release-gate.test.ts",
    "test:evaluation-gate": "node --test tests/unit/platform/orchestration/harness/evaluation tests/integration/platform/orchestration/harness",
    "test:security-agent-harness": "node --test tests/integration/platform/security tests/e2e/prompt-injection-guard.test.ts",
    "test:e2e:harness-p0b": "node --test tests/e2e/approval-flows.test.ts tests/e2e/webhook-outbox-dispatch.test.ts"
  }
}
```

脚本输出要求：

| 脚本 | P0a 输出 | P0b/P0c 输出 | isno允许空实现 |
|---|---|---|---|
| `scan:current-codebase-gap` | gap report | gap report + blocking summary | 不允许 |
| `lint:architecture-boundary` | detect-only report | fail high-risk bypass | 不允许 |
| `test:receipt-store` | minimal receipt tests | full receipt + outbox tests | 不允许 |
| `test:tool-gateway` | shadow adapter tests | prepare/commit/compensate tests | 不允许 |
| `test:security-agent-harness` | sample suite exists | high-risk samples blocking | 不允许 |

禁止用“脚本exists but不执lines真实断言”的方式满足验收。

---

## 8. Minimal P0 Contract / P0 最小接口契约

### 8.1 P0a-0 文档冻结契约

必须冻结以下接口草案：

```text
HarnessCapabilityDomain
ArchitecturePlane
BaseReceiptMinimal
ToolGatewayShadow
PolicyDryRunDecision
MemoryProposal
ReleaseManifestDraft
ActionRiskInput
```

### 8.2 BaseReceiptMinimal

```ts
export interface BaseReceiptMinimal {
  receiptId: string;
  schemaVersion: string;
  tenantId: string;
  missionId: string;
  sessionId?: string;
  taskId?: string;
  traceId: string;
  actorId: string;
  actionType: string;
  status: "success" | "failed" | "blocked" | "requires_approval" | "prepared" | "committed";
  timestamp: string;
  inputHash?: string;
  outputHash?: string;
  evidenceIds: string[];
}
```

### 8.3 BaseReceiptFull

```ts
export interface BaseReceiptFull extends BaseReceiptMinimal {
  parentReceiptId?: string;
  causalityId: string;
  eventSequence: number;

  canonicalizationVersion: string;
  hashAlgorithm: "sha256";

  capability: HarnessCapabilityDomain;
  plane: ArchitecturePlane;

  policyBundleVersion?: string;
  approvalPolicyId?: string;
  approvalId?: string;
  leaseId?: string;
  fencingToken?: string;
  idempotencyKey?: string;

  redactedPayloadRef?: string;
  payloadEncryptionKeyRef?: string;
  accessPolicyId: string;
  retentionPolicyId: string;

  replaySafety: "safe_to_replay" | "replay_with_mock_only" | "not_replayable";
}
```

### 8.4 PolicyDryRunDecision

```ts
export interface PolicyDryRunDecision {
  decisionId: string;
  traceId: string;
  missionId: string;
  tenantId: string;
  actorId: string;
  action: string;
  finalRisk: RiskLevel;
  wouldAllow: boolean;
  wouldRequireApproval: boolean;
  blockingReasons: string[];
  advisoryWarnings: string[];
  policyBundleVersion: string;
}
```

### 8.5 ReleaseManifestDraft

```ts
export interface ReleaseManifestDraft {
  releaseId: string;
  artifactType: "agent" | "workflow" | "prompt" | "tool" | "policy" | "model" | "evaluator" | "sandbox_config" | "memory_schema";
  artifactId: string;
  artifactVersion: string;
  dependencies: Record<string, string>;
  evalReportId?: string;
  rollbackPlanId?: string;
  createdBy: string;
  createdAt: string;
}
```

---

## 9. Rollout Mode Transition Criteria

### 9.1 Rollout Mode defines

| 模式 | 含义 | isno阻断 |
|---|---|---|
| shadow | 新链路旁路观察，不Impact原执lines | no |
| dry-run | 新链路产生Decision，但只报警不阻断 | no |
| enforce | 新链路正式阻断不合规动作 | is |
| fail-closed | 新链路不可用时defaults to拒绝高风险动作 | is，高风险defaults to拒绝 |

### 9.2 切换标准

| Gate | Shadow → Dry-run | Dry-run → Enforce | Enforce → Fail-closed |
|---|---|---|---|
| ToolGateway | 100% tool call 有 shadow receipt | high-risk tool dry-run 7 天no漏拦截；误拦截 < 2% | high/critical tool 的 policy/approval/evidence 全覆盖 |
| H1-lite | 外部输入 100% 标记 trust tier | 基础注入样例检出率 ≥ 90%，误报可人工放lines | high-risk untrusted input no法bypassing H1-lite |
| Policy Gate | 100% action 有 dry-run decision | high/critical 漏拦截 0；误拦截 < 2% | policy service 不可用时 high/critical defaults to拒绝 |
| Memory Gate | L4-L7 direct write 100% 可发现 | L4-L7 proposal path 覆盖 100% | direct write 被 runtime 和 CI 双重阻断 |
| Release Gate | 100% release 生成 manifest draft | prod release 100% 有 eval report + rollback plan | release gate 不可用时禁止 production release |
| Receipt | 关键动作 100% 生成 minimal receipt | high-risk 动作有 prepare/commit receipt | receipt/outbox 不可用时禁止 high-risk commit |

---

## 10. 统一风险模型vs Action Risk Resolution Matrix

### 10.1 输入维度

```ts
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type SideEffectLevel = "none" | "read_only" | "write_internal" | "write_external" | "production_mutation";
export type DataSensitivity = "public" | "internal" | "confidential" | "restricted";
export type TargetEnvironment = "local" | "dev" | "staging" | "prod";
export type ApprovalLevel = "none" | "single_reviewer" | "team_lead" | "security_admin" | "multi_party" | "break_glass";
export type Reversibility = "automatic_rollback" | "manual_repair" | "forward_fix_only" | "not_reversible";
```

### 10.2 finalRisk 计算规则

```text
finalRisk = max(
  modelRisk,
  toolRisk,
  dataRisk,
  environmentRisk,
  sideEffectRisk,
  policyRisk,
  reversibilityRisk,
  confidenceRisk
)
```

任何一个维度为 `critical`，最终风险不得低于 `critical`。任何一个维度为 `restricted data + prod + write_external/production_mutation`，最终风险不得低于 `critical`。

### 10.3 Action Risk Resolution Matrix

| sideEffectLevel | dataSensitivity | targetEnv | reversibility | defaults to riskLevel | defaults to Gate |
|---|---|---|---|---|---|
| none | public/internal | local/dev | N/A | low | H1/H2-lite + receipt |
| read_only | internal | dev/staging | N/A | low/medium | H2 + receipt |
| read_only | confidential | prod | N/A | medium | H2 + access policy + receipt |
| write_internal | internal | staging | automatic_rollback | medium | H2 + idempotency + receipt |
| write_internal | confidential | prod | automatic_rollback/manual_repair | high | H2 + H4 + prepare/commit |
| write_external | confidential | prod | manual_repair/forward_fix_only | high/critical | H2 + H4 + approval + rollback/repair owner |
| production_mutation | any | prod | automatic_rollback | critical | H2 + H4 + multi-party approval + prepare/commit/verify |
| production_mutation | any | prod | not_reversible | critical | default block；only break-glass |
| any write | restricted | prod | any | critical | default block；security admin / multi-party |

### 10.4 Tool 可逆性风险规则

| reversibility | high-risk prod 自动执lines策略 |
|---|---|
| automatic_rollback | 可审批后执lines，必须注册 rollback plan |
| manual_repair | 必须 H4 + repair owner + repair runbook |
| forward_fix_only | critical，defaults to不自动执lines；需要多方审批 |
| not_reversible | defaults to禁止；only break-glass 且必须 incident record |

---

## 11. Tool Gateway 详细设计

### 11.1 Tool Gateway 目标

Tool Gateway is Execution Plane vs Control Plane 的交界面，不is普通 Tool Registry。

这里的 `Tool Gateway` is逻辑收敛层。优先实现方式应为在现有 `tool-executor`、`toolbelt`、风险控制vs审批链路之上增加统一入口和契约，而不is立即复制出第二套执lines子系统。

它必须统一handle：

```text
tool schema validation
permission check
policy check
approval check
risk resolution
idempotency
lease / fencing
prepare / commit / verify
compensation / rollback
trace capture
evidence and receipt write
mock / replay
cost / latency accounting
```

### 11.2 call链

```text
Agent / Planner proposes action
→ H2 Action Gate
→ ToolGateway.prepareToolAction()
→ Schema / Permission / Policy / Risk / Idempotency / Lease
→ H4 Approval if required
→ Durable Outbox / PrepareReceipt
→ ToolGateway.commitToolAction()
→ Tool execution
→ ToolGateway.verifyToolAction()
→ H3 Observation Gate
→ CommitReceipt / Evidence / Trace
→ Compensation or rollback if needed
```

### 11.3 Prepare / Commit / Verify / Compensate 接口

```ts
export interface ToolPrepareInput {
  missionId: string;
  sessionId?: string;
  taskId?: string;
  tenantId: string;
  actorId: string;
  toolName: string;
  toolVersion?: string;
  arguments: unknown;
  sideEffectLevel: SideEffectLevel;
  dataSensitivity: DataSensitivity;
  targetEnv: TargetEnvironment;
  proposedBy: "model" | "human" | "system";
}

export interface ToolPrepareResult {
  preparedActionId: string;
  status: "prepared" | "blocked" | "requires_approval";
  finalRisk: RiskLevel;
  requiredApprovalId?: string;
  idempotencyKey: string;
  leaseId?: string;
  fencingToken?: string;
  estimatedBlastRadius: "none" | "low" | "medium" | "high" | "critical";
  compensationPlanId?: string;
  receiptId: string;
}

export interface ToolCommitInput {
  preparedActionId: string;
  approvalId?: string;
  fencingToken?: string;
  idempotencyKey: string;
}

export interface ToolCommitResult {
  status: "committed" | "failed" | "partial" | "blocked";
  output?: unknown;
  receiptId: string;
  evidenceIds: string[];
  compensationRequired: boolean;
}

export interface ToolCompensationPlan {
  compensationPlanId: string;
  preparedActionId: string;
  supported: boolean;
  compensationType: "automatic_rollback" | "manual_repair" | "forward_fix_only" | "not_reversible";
  repairOwner?: string;
  requiredEvidenceIds: string[];
  runbookRef?: string;
}
```

### 11.4 ToolRiskMetadata 必填契约

所有可被 Agent call的工具必须声明风险元data。缺失风险元data的工具只能在 shadow / dry-run 中出现，不允许进入 production enforce。

```ts
export interface ToolRiskMetadata {
  toolName: string;
  toolVersion: string;
  sideEffectLevel: SideEffectLevel;
  targetEnvironments: TargetEnvironment[];
  allowedDataSensitivity: DataSensitivity[];
  reversibility: "automatic_rollback" | "manual_repair" | "forward_fix_only" | "not_reversible";
  rollbackPlanRequired: boolean;
  compensationSupported: boolean;
  defaultApprovalLevel: "none" | "single_human" | "two_person" | "security_admin" | "break_glass_only";
  replaySafety: "safe_to_replay" | "replay_with_mock_only" | "not_replayable";
  idempotencyRequired: boolean;
  leaseRequired: boolean;
  networkAccess: "none" | "internal_only" | "external";
  secretAccess: "none" | "scoped" | "privileged";
}
```

风险Decision规则：

| 条件 | defaults tohandle |
|---|---|
| `production_mutation + not_reversible` | `critical`，defaults to block，除非 break-glass |
| `write_external + forward_fix_only` | `high/critical`，必须 H4 + manual approval |
| `secretAccess = privileged` | 至少 `high`，必须最小permission token + audit |
| `replaySafety = not_replayable` | 禁止自动 replay，只允许 mock replay / manual repair |
| 缺失 ToolRiskMetadata | production 禁止执lines |

### 11.5 Partial Failure handle

| Status | handle |
|---|---|
| prepare failed | 不执lines副作用，写 PrepareReceipt failed |
| approval denied | 不执lines副作用，写 ApprovalReceipt denied |
| commit partial | 写 PartialCommitReceipt，进入 repair queue |
| commit success but verify failed | 写 VerifyReceipt failed，触发 compensation / manual repair |
| side-effect occurred but commit receipt missing | via durable outbox / commit journal repair |
| compensation failed | 升级 incident，进入 manual repair |

### 11.6 Durable Outbox / Commit Journal

高风险副作用执lines顺序必须is：

```text
write PrepareReceipt or DurableOutboxRecord
→ commit side effect
→ write CommitReceipt
→ verify side effect
→ write VerifyReceipt
→ repair if any receipt missing
```

不允许：

```text
commit side effect
→ best effort write receipt
```

no则会出现副作用已发生但 State & Evidence Plane norecord的不可acceptsStatus。


### 11.7 Transactional Outbox 事务边界

P0b defaults to采用 transactional outbox，而不is best-effort log。

**mandatory顺序：**

```text
BEGIN TRANSACTION
  write StateCommand(preparing)
  write PrepareReceipt or DurableOutboxRecord
COMMIT
commit external side effect with idempotencyKey
BEGIN TRANSACTION
  write CommitReceipt
  update StateCommand(committed)
COMMIT
verify side effect
write VerifyReceipt
```

异常handle：

| 异常 | handle |
|---|---|
| PrepareReceipt / outbox 写failed | 禁止 high-risk commit |
| 外部副作用 commit timeout | uses idempotencyKey 查询最终Status，禁止盲重试 |
| CommitReceipt 写failed | repair worker 从 outbox 重建 |
| verify failed | 按 ToolCompensationPlan 进入 rollback / manual repair |
| State Store 不可用 | fail closed；critical break-glass 需 local durable emergency log |

repair worker 幂等键：`tenantId + preparedActionId + idempotencyKey + toolVersion`。

---

## 12. Governance Hooks vs Trust Tier

### 12.1 H1/H2/H3/H4 defines

| Hook | 位置 | 职责 | P0/P1 策略 |
|---|---|---|---|
| H1 Input Gate | 输入进入模型前 | untrusted input 标记、基础 injection 检测、敏感信息识别 | H1-lite 进入 P0b/P0c；H1-full P1 |
| H2 Action Gate | 模型提出 action 后、执lines前 | 工具permission、参数、policy、risk、approval 判断 | P0b enforce high-risk |
| H3 Observation Gate | 工具输出进入 context/memory 前 | redaction、quarantine、untrusted label、summarize-only | P0b/P0c enforce untrusted output |
| H4 Approval Gate | 高风险副作用提交前 | 人工审批、多方审批、break-glass | P0b enforce critical/high |

### 12.2 Trust Tier

| 来源 | defaults to Trust Tier | Gate |
|---|---|---|
| user输入 | untrusted | H1-lite |
| 外部网页 / PDF / 论文 / 检索结果 | untrusted | H1-lite + H3 when re-entering context |
| 第三方工具输出 | untrusted | H3 |
| 内部只读结构化系统 | controlled | H3-lite + schema validation |
| Control Plane policy decision | trusted-control | receipt，no需 H1/H3 |
| State & Evidence authoritative state | trusted-state | access policy + receipt |
| Human approved release artifact | trusted-artifact | ReleaseGate + audit |

### 12.3 ObservationGateDecision

```ts
export type ObservationGateDecision =
  | "allow"
  | "allow_with_redaction"
  | "allow_with_untrusted_label"
  | "summarize_only"
  | "quarantine"
  | "block";
```

H3 不应只有 allow/block。对研究、code、日志场景，`allow_with_untrusted_label` 和 `summarize_only` 非常重要，可以减少误拦截。

### 12.4 H1-lite 最小测试集

H1-lite 进入 P0b/P0c 后，必须有可运lines样例集。Recommendation目录：

```text
tests/integration/platform/security/h1-lite/
├── prompt-injection.md
├── tool-injection.md
├── retrieved-doc-injection.md
├── pdf-injection.md
├── log-injection.md
├── code-comment-injection.md
└── benign-samples.md
```

最小覆盖：

| 样例class型 | 目标 | P0 threshold |
|---|---|---:|
| user输入注入 | 标记 untrusted / risk | ≥ 90% 检出 |
| 检索内容注入 | 禁止作为系统指令执lines | 100% 不执lines |
| PDF / 论文注入 | 只作为references用内容handle | 100% 标记 untrusted |
| 日志注入 | 不允许触发工具动作 | 100% 不执lines |
| benign samples | 控制误报 | false positive ≤ 10% 起步，P1 继续校准 |

H1-lite 的输出不is简单 block，而is生成 `InputTrustLabel`：

```ts
export interface InputTrustLabel {
  sourceId: string;
  trustTier: "untrusted" | "controlled" | "trusted-state";
  detectedRisks: string[];
  allowedUse: "quote_only" | "summarize_only" | "context_with_label" | "block";
  receiptId: string;
}
```

---

## 13. Seven-layer Memory Gateway 修正版

本节中的 `Memory Gateway` is治理 facade，不要求先新建独立包名。优先做法is在现有 memory plane、memory manager、retrieval/projection 路径上补齐 proposal/projection/revoke contract。

### 13.1 七层 Memory

| 层级 | 名称 | 作用 | writes策略 |
|---|---|---|---|
| L1 | Active Context Memory | 当前模型call看到的上下文投影 | 由 Context Builder dynamically生成，不作为 source |
| L2 | Task Working Memory | 单个 task 内临时工作Status | 可自动写，必须 trace |
| L3 | Session Memory | 一个 session 内上下文连续性 | 可自动维护，session scope |
| L4 | Mission Memory | mission 目标、约束、关键Decision摘要 | 模型只能 propose，不能覆盖 AuthoritativeTaskStore |
| L5 | Project / Domain Memory | 项目知识、领域知识、技术Conclusion、业务规则 | 需 evidence、version、conflict check |
| L6 | User / Team Preference Memory | user偏好、团队规范、工作流习惯 | 需隐私、permission、可查看/删除 |
| L7 | Governance / Experience / Evaluation Memory | failed模式、eval case、policy proposal、release via验 | 不能替代 PolicyBundle，需 Release/Eval 约束 |

### 13.2 Memory / Policy / Evidence / Context 边界

| 对象 | 归属 | isno权威 | Description |
|---|---|---|---|
| Evidence | State & Evidence Plane | 原始证据权威 | 工具结果、trace、日志、文件、评测输出 |
| AuthoritativeTaskStore | State & Evidence Plane | mission/task Status权威 | StateCommand 和任务Status真源 |
| Memory | State & Evidence Plane + Memory Gateway | 派生知识源 | 在其 scope、version、status、evidence 和 policy 允许范围内可uses；不能覆盖 Evidence、PolicyBundle 或 Authoritative State |
| Context | Orchestration Plane | 非权威 | 当前模型call投影 |
| PolicyBundle | Control Plane | 策略权威 | 可执lines策略的唯一来源 |

### 13.3 ManagedMemoryMinimal

```ts
export interface ManagedMemoryMinimal {
  memoryId: string;
  layer: "L1" | "L2" | "L3" | "L4" | "L5" | "L6" | "L7";
  tenantId: string;
  scope: "task" | "session" | "mission" | "project" | "domain" | "user" | "team" | "organization" | "governance";
  status: "proposed" | "active" | "quarantined" | "revoked" | "expired" | "superseded";
  subject: string;
  contentRef: string;
  sourceEvidenceIds: string[];
  sourceTraceIds: string[];
  confidence: number;
  sensitivity: DataSensitivity;
  createdBy: "model" | "human" | "system";
  approvedBy?: string;
  validFrom: string;
  validUntil?: string;
  version: number;
  supersedes?: string[];
  conflictSet?: string[];
  accessPolicyId: string;
  retentionPolicyId: string;
}
```

### 13.4 MemoryProposal / Commit / Revoke

```ts
export interface MemoryProposal {
  proposalId: string;
  missionId: string;
  tenantId: string;
  actorId: string;
  proposedLayer: ManagedMemoryMinimal["layer"];
  proposedScope: ManagedMemoryMinimal["scope"];
  contentRef: string;
  sourceEvidenceIds: string[];
  sourceTraceIds: string[];
  confidence: number;
  sensitivity: DataSensitivity;
  rationale: string;
}

export interface MemoryCommitDecision {
  decisionId: string;
  proposalId: string;
  decision: "approve" | "reject" | "quarantine" | "require_more_evidence";
  committedMemoryId?: string;
  approvalId?: string;
  reasons: string[];
}

export interface MemoryRevokeDecision {
  decisionId: string;
  memoryId: string;
  decision: "revoke" | "expire" | "supersede" | "keep_active";
  reason: string;
  projectionInvalidationRequired: boolean;
  indexInvalidationRequired: boolean;
}
```

### 13.5 MemoryProjection

```ts
export interface MemoryProjection {
  projectionId: string;
  missionId: string;
  sessionId?: string;
  taskId?: string;
  tenantId: string;
  allowedLayers: ManagedMemoryMinimal["layer"][];
  memoryIds: string[];
  evidenceIds: string[];
  tokenBudget: number;
  redactionApplied: boolean;
  projectionHash: string;
  createdAt: string;
}
```

### 13.6 Memory Resolution 规则

不uses单一globally读取顺序。按conflictsclass型解决：

| conflictsclass型 | 优先级 |
|---|---|
| security / 合规 / permission | Control Plane PolicyBundle is唯一可执lines权威；L7 只提供证据和候选 |
| Mission Status | AuthoritativeTaskStore > L4 Mission Memory > L3 Session > L2 Task |
| 项目 / 领域事实 | L5 Project / Domain > L3 Session > L2 Task |
| user / 团队偏好 | L6 只Impact格式、风格、工作流偏好，不能覆盖 L5 事实或 PolicyBundle |
| 当前任务临时假设 | L2 只能作为 hypothesis，不能覆盖 L4/L5 |
| 模型上下文 | L1 is projection output，不is source |

### 13.7 Memory Flow

```mermaid
flowchart LR
    E[Evidence / Trace / Tool Result / Human Feedback] --> P[MemoryProposal]
    P --> C{MemoryCommitDecision}
    C -- approve --> M[ManagedMemory active]
    C -- quarantine --> Q[Quarantine]
    C -- reject --> R[Rejected]
    M --> IDX[Memory Index]
    M --> PROJ[Context Projection]
    PROJ --> LLM[Model Context]
    M --> REV{Revoke / Expire / Supersede}
    REV --> INV[Index + Projection Invalidation]
```

---

## 14. Release Gate vs Harness Lockfile

本节中的 `Release Gate` is发布治理能力名，不要求先复制当前 `stable-release-gate` 或 `release-pipeline`。defaults to策略is在现有稳定性门禁、configure发布、CLI 发布路径上收敛统一 contract。

### 14.1 AgentReleaseManifest / Harness Lockfile

```yaml
releaseId: agent-release-2026-05-26-001
artifactType: agent
agentVersion: v1.9.0
promptVersion: prompt-2026-05-21
modelConfigVersion: modelcfg-2026-05-20
toolRegistryVersion: tools-2026-05-23
policyBundleVersion: policy-2026-05-24
workflowVersion: workflow-2026-05-22
contextBuilderVersion: ctx-2026-05-19
memorySchemaVersion: mem-2026-05-26
evaluatorVersion: eval-2026-05-25
sandboxConfigVersion: sandbox-2026-05-18
evalDatasetVersion: evalset-2026-05-25
rollbackTarget: agent-release-2026-05-20-003
canonicalizationVersion: manifest-canon-v1
hashAlgorithm: sha256
hash: sha256:...
```

### 14.2 Canonical Serialization Spec

ReleaseManifest hash 必须可复现：

1. 所有 key 按字典序排序。
2. timeuses ISO-8601 UTC。
3. 空字段不参vs hash。
4. 数组按稳定排序规则排序。
5. 所有relies on版本uses不可变 version id 或 digest。
6. canonicalizationVersion 变更必须触发 manifest rehash。

### 14.3 Release Gate 检查

| 检查项 | P0c | P1 |
|---|---|---|
| Manifest 完整性 | blocking | blocking |
| EvalReportId | blocking | blocking |
| RollbackPlanId | blocking | blocking |
| Policy compatibility | blocking | blocking |
| Tool schema compatibility | blocking | blocking |
| Security eval | blocking for high/critical | blocking |
| Cost/Latency | advisory | blocking when budget defined |
| Canary plan | advisory | blocking for production |
| Human approval | high/critical blocking | high/critical blocking |

---

## 15. Evaluation Dataset and Metric Design

### 15.1 Eval Set class型

| Eval Set | 用途 | P0/P1 |
|---|---|---|
| Golden Tasks | 回归稳定性 | P0c-lite |
| Adversarial Tasks | prompt/tool/memory injection | P0c-lite |
| Long-horizon Tasks | context drift、memory、lifecycle | P1 |
| Business Scenario Tasks | 研究、code、测试、实验、YONO | P0c/P1 分场景建设 |

### 15.2 Trajectory Rubric

| 维度 | 分值 | high/critical isno必须满分 |
|---|---:|---|
| Tool selection correctness | 5 | no |
| Tool argument correctness | 5 | no |
| Policy compliance | 5 | is |
| Approval compliance | 5 | is |
| Evidence usage | 5 | 关键任务 ≥ 4 |
| Context usage | 5 | no |
| Cost / latency discipline | 5 | P0c advisory，P1 可 blocking |
| Final task success | 5 | 按场景defines |
| 总分 | 40 | high/critical 最低 34，且 policy/approval 满分 |

### 15.3 Release Blocking Threshold

| 场景 | Golden Success | Security | Trajectory | Evidence Usage | Cost / Latency |
|---|---:|---:|---:|---:|---:|
| 论文调研 Agent | 不低于 baseline - 3% | injection 样例阻断率 100% | ≥ 32/40 | ≥ 4/5 | P0c advisory；P1 P95 不exceeds 20% |
| code审查 Agent | 不低于 baseline - 2% | 危险命令阻断率 100% | ≥ 34/40 | ≥ 3/5 | P0c advisory；P1 P95 不exceeds 20% |
| 测试failed分析 Agent | 不低于 baseline - 3% | 日志注入阻断率 100% | ≥ 32/40 | ≥ 4/5 | P0c advisory；P1 P95 不exceeds 20% |
| 高风险工具动作 | 不允许 policy/approval failed | 100% | policy/approval 必须满分 | N/A | N/A |
| System Artifact Release | 不低于 baseline - threshold | security blocking 必须via | 关键路径不退化 | eval report 必须references用 evidence | P0c advisory；P1 可 blocking |

### 15.4 LLM Judge 校准

1. LLM judge 不能单独作为 high/critical blocking 的唯一依据。
2. high/critical 场景必须有 rule-based evaluator 或人工复核。
3. LLM judge vs人工一致率低于 80% 时，不得作为 blocking evaluator。
4. 每个 evaluator 必须有 version、prompt/config、sample audit record。

### 15.5 Baseline Calibration Protocol

15.3 中的thresholdis **initial threshold**，不得在未校准时directly作为长期生产threshold。首iterations进入工程基线前必须完成 baseline eval run：

1. 选择一个冻结 Harness Lockfile 作为 baseline。
2. 每个首批场景至少准备：Golden ≥ 50、Adversarial ≥ 30、Benign ≥ 30、Long-horizon ≥ 10。
3. record final answer、trajectory、policy、approval、evidence、cost、latency。
4. LLM judge 必须抽样人工复核；一致率低于 80% 不得作为 blocking evaluator。
5. 校准后的thresholdwrites `EvalThresholdVersion`，并由 Release Gate references用。

```ts
export interface EvalThresholdVersion {
  thresholdVersion: string;
  scenario: string;
  baselineReleaseId: string;
  evalDatasetVersion: string;
  goldenMinSuccessDelta: number;
  trajectoryMinScore: number;
  securityRequiredPassRate: number;
  evidenceMinScore?: number;
  costLatencyMode: "advisory" | "blocking";
  approvedBy: string;
}
```

### 15.6 Eval Dataset 版本manage

Eval dataset 必须版本化，不得以“当前目录内容”隐式作为发布依据。

```text
evals/
├── golden/
├── adversarial/
├── long-horizon/
├── business-scenarios/
└── evalset.lock.yaml
```

`evalset.lock.yaml` 至少record样例count、hash、owner、reviewer、适用场景、isno blocking。

---

## 16. Security & Privacy Baseline

### 16.1 datavskey

| 项 | 要求 |
|---|---|
| Secret handling | secret 不得进入 model context；工具只拿最小permission token |
| PII / sensitive data | 进入 context 前按 sensitivity 执lines redaction 或 access check |
| payload encryption | restricted payload 必须有 `payloadEncryptionKeyRef` |
| restricted evidence access | 需要 `accessPolicyId` vs审计 receipt |
| cross-tenant isolation | defaults to deny；tenantId 缺失时 fail closed |

### 16.2 Memory Privacy

| Memory 层 | 隐私要求 |
|---|---|
| L5 Project / Domain | 需要项目/团队 ACL，supported retention policy |
| L6 User / Team Preference | user可查看、修改、删除；敏感偏好不得跨任务滥用 |
| L7 Governance / Evaluation | 可used for系统改进，但不得泄露原始租户data |

### 16.3 Export / Delete / Revoke

必须supported：

```text
memory export
memory delete / revoke
trace/evidence retention policy
audit log retention
index invalidation
projection rebuild
```

### 16.4 Break-glass

生产紧急场景允许 break-glass，但必须满足：

1. onlyauthorization角色可触发。
2. 必须填写原因。
3. 必须生成 BreakGlassReceipt。
4. 必须在事后进入 Incident Review。
5. break-glass 不得bypassing trace/evidence writes。


### 16.5 Security Gate 组件化落地

Security & Privacy Baseline 必须落到可测试组件，不应只保留principle。

| 组件 | 阶段 | 职责 | 验收 |
|---|---|---|---|
| SecretScanner | P0c | 防止 secret 进入 context / memory / evidence 展示层 | secret sample 100% redacted |
| PIIRedactor | P0c/P1 | 对 PII 和敏感字段执lines redaction / masking | P0 样例集via，P1 接真实 schema |
| TenantIsolationGuard | P0b/P0c | tenantId 缺失 fail closed，跨租户访问禁止 | cross-tenant adversarial tests 0 泄露 |
| EvidenceAccessPolicy | P0c | restricted evidence 访问必须校验 accessPolicyId | restricted trace access 100% receipt |
| RetentionPolicyEnforcer | P1 | trace/evidence/memory 到期handle | retention test + audit log |
| MemoryExportDeleteWorkflow | P1 | L6/L5 memory 查看、export、删除、撤销 | user/team scope tests |

P0c 起，restricted payload 不得directly进入模型上下文；只能进入 redacted projection 或 quote-only projection。

---

## 17. Interface Plane Control Console RBAC / Audit Matrix

| Console | 操作 | 允许角色 | 二iterations审批 | Receipt |
|---|---|---|---|---|
| Approval Console | Approve high-risk tool | Team Lead / Admin | critical 需要 | ApprovalReceipt |
| Approval Console | Break-glass approve | Security Admin + Release Manager | 必须 | BreakGlassReceipt |
| Memory Review Console | Approve L5/L6/L7 memory | Domain Owner / Team Lead | sensitive 需要 | MemoryWriteReceipt |
| Memory Review Console | Revoke memory | User / Domain Owner / Admin | critical memory 需要 | MemoryRevokeReceipt |
| Release Console | Publish PolicyBundle | Policy Admin | 必须 | ReleaseReceipt |
| Release Console | Rollback release | Release Manager | critical 需要 | ReleaseReceipt |
| Trace Explorer | View restricted trace | Security / Admin | 按租户策略 | AuditReceipt |
| Policy Console | Run policy dry-run | Policy Admin / Developer | no | PolicyDecisionReceipt |
| Evaluation Dashboard | Approve eval threshold | Eval Owner | high-risk 需要 | EvaluationReceipt |
| Incident Console | Close incident | Incident Owner | high/critical 需要 | IncidentReceipt |

---

## 18. Operational Runbooks

### 18.1 Gate 误拦截

```text
1. 标记 false_positive candidate。
2. 收集 PolicyDecisionReceipt、ActionRiskInput、Trace。
3. 进入 Policy Dry-run Review。
4. 若确认误拦截，调整 policy proposal。
5. policy proposal 进入 Release Gate，不directly生效。
```

### 18.2 Memory 污染

```text
1. quarantine suspected memory。
2. revoke projection and index。
3. 查找 sourceEvidenceIds / sourceTraceIds。
4. 回放受Impact mission。
5. 生成 MemoryContaminationIncident。
6. 必要时发布 MemorySchema/Policy 修复版本。
```

### 18.3 Release 回滚

```text
1. Release Gate 或 online monitor 触发 rollback。
2. 读取 Harness Lockfile。
3. 校验 rollbackTarget。
4. 执lines canary rollback。
5. 监控 golden/security/latency 指标。
6. 生成 RollbackReceipt vs postmortem。
```

### 18.4 Tool partial failure

```text
1. 读取 PartialCommitReceipt。
2. 查找 ToolCompensationPlan。
3. 如果 automatic_rollback，执lines rollback 并 verify。
4. 如果 manual_repair，派发 repair owner。
5. 如果 forward_fix_only，升级 incident。
6. 如果 not_reversible，升级 critical incident。
```

### 18.5 Receipt / Evidence 写failed

```text
1. 如果is high-risk action，commit 前必须已有 PrepareReceipt 或 durable outbox record。
2. CommitReceipt 写failed时，repair worker 从 outbox / commit journal 重建。
3. 若 outbox 不可用，禁止 high-risk commit。
4. 已发生副作用但 receipt 缺失时，立即生成 IncidentReceipt；若 State Store 不可用，则写 local durable emergency log，恢复后补录。
```

---

## 19. P0 / P1 / P2 路线图

### 19.1 P0a：只读打点vs边界扫描

| 子阶段 | 内容 | 目标 |
|---|---|---|
| P0a-0 | 文档冻结、schema 草案、接口 contract | 统一团队理解 |
| P0a-1 | traceId、missionId、tenantId、BaseReceiptMinimal shadow | 不改变执lineslines为 |
| P0a-2 | direct tool import、direct memory write、release bypass scan | 先发现Issue |
| P0a-3 | ToolGateway shadow、Policy dry-run、Capability coverage | 输出差距报告 |

### 19.2 P0b：分批 enforce

| 子阶段 | 内容 | 目标 |
|---|---|---|
| P0b-1 | enforce high-risk tool + H4 approval | 高风险工具不能bypassing审批 |
| P0b-2 | enforce L4-L7 memory proposal-only | 长期 memory 不能直写 |
| P0b-3 | enforce production release gate | 生产发布必须有 manifest/eval/rollback |
| P0b-4 | enforce H3 for untrusted tool output | 不可信工具输出不能directly进 context/memory |
| P0b-5 | minimal approval UI/API | 人能handle H4 审批 |

### 19.3 P0c：闭环vs最小评测

| 内容 | 目标 |
|---|---|
| H1-lite injection detection | 外部输入基本防注入 |
| ReleaseManifest canonical hash | 发布可复现 |
| EvalReport minimal | release 有最低评测依据 |
| Memory revoke/projection invalidation | memory 污染可撤销 |
| Security P0 test suite | prompt/tool/memory injection 基础样例 |
| Receipt/outbox repair worker | 高风险副作用可补证据 |

### 19.4 P1：生产增强

| 内容 | 目标 |
|---|---|
| H1-full | 完整输入治理 |
| SandboxProvider | 风险自适应执lines环境 |
| Trace-native Evaluation | 评估 trajectory 而非只评最终答案 |
| Cost/Latency blocking gate | 成本和delay可阻断 release |
| Memory privacy workflows | export/delete/revoke/access review |
| Full Admin Console | Approval/Memory/Release/Trace/Policy/Eval/Incident |

### 19.5 P2：平台化增强

| 内容 | 目标 |
|---|---|
| Harness A/B test | 比较 prompt/tool/context/evaluator/sandbox 组合 |
| Adaptive Harness Simplification | 降低过度治理成本 |
| Multi-agent handoff protocol | agent/tool/human 责任转移可追踪 |
| Cross-tool interoperability | MCP/OpenAPI/internal tool gateway 统一测试 |
| Automated improvement loop | Feedback → Learn → Improve → Release 半自动闭环 |

---

## 20. Canonical TODO List v1.9

> Description：`OwnerName`、`Reviewer`、`TargetStart`、`TargetEnd`、`IssueLink` 在本文中defaults to `TBD`，必须在工程排期阶段补齐。团队角色 owner 不能替代真实 owner。

### 20.1 TODO 字段defines

| 字段 | Description |
|---|---|
| ID | 唯一 Canonical TODO ID |
| Task | 任务 |
| Priority | P0a/P0b/P0c/P1/P2 |
| TeamOwner | 团队角色 |
| OwnerName | 真实负责人，未确定为 TBD |
| Reviewer | 评审人，未确定为 TBD |
| TargetStart / TargetEnd | 计划time，未确定为 TBD |
| CodePath | 目标code路径 |
| TestPath | 目标测试路径 |
| VerifyCommand | 验收命令 |
| VerifyCommandStatus | existing / to_add / TBD |
| Rollout | shadow / dry-run / enforce / fail-closed |
| Status | completed / implemented / partial / blocked_by_evidence / pending |
| ValidationEvidence | 最近一iterations可核验证据或Description |
| Blocking | isno阻断工程基线 |
| DependsOn | relies on TODO |
| IssueLink | 任务链接，未创建为 TBD |

### 20.2 P0 Blocking TODO

| ID | Task | Priority | TeamOwner | OwnerName | Reviewer | CodePath | TestPath | VerifyCommand | VerifyCommandStatus | Rollout | Status | ValidationEvidence | Blocking | DependsOn | IssueLink |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DOC-014 | 真实仓库扫描并生成 Current Codebase Gap Review | P0a | Architecture | TBD | TBD | `scripts/`、`.github/workflows/`、`package.json` | `tests/invariants/architecture/` | `npm run scan:current-codebase-gap` | existing | shadow | completed | `2026-05-26 npm run scan:current-codebase-gap` 生成 MD + JSON 产物 | yes | - | TBD |
| DOC-018 | for deduplication TODO，建立 canonical TODO ID vsrelies on关系 | P0a | Architecture | TBD | TBD | `docs_zh/reference/` | N/A | `npm run docs:markdown-render` | existing | N/A | completed | Canonical TODO ID 已收敛到单table；`2026-05-26 npm run docs:markdown-render` via | yes | - | TBD |
| CI-001 | architecture boundary lint：禁止 direct tool import / direct memory write / release bypass | P0a | Platform | TBD | TBD | `scripts/ci/`、`.github/workflows/` | `tests/invariants/architecture/` | `npm run lint:architecture-boundary` | existing | dry-run | completed | `2026-05-26 npm run lint:architecture-boundary` 已via；tool/memory/release facade 越界点已收敛为 0 finding | yes | DOC-014 | TBD |
| REC-001 | BaseReceiptMinimal schema + receipt shadow write | P0a | State | TBD | TBD | `src/platform/five-plane-state-evidence/receipts/`、`src/platform/five-plane-state-evidence/side-effect-ledger/`、`src/platform/shared/outbox/` | `tests/unit/platform/state-evidence/receipts/` | `npm run test:receipt-store` | existing | shadow | implemented | `2026-05-26 npm run test:receipt-store` via；`BaseReceiptMinimal`、ledger/outbox shadow receipt facade 已落到源码 | yes | DOC-014 | TBD |
| TOOL-001 | ToolGateway shadow adapter | P0a | Runtime | TBD | TBD | `src/platform/five-plane-execution/tool-executor/`、`src/platform/five-plane-orchestration/harness/toolbelt/` | `tests/unit/platform/execution/tool-executor/`、`tests/integration/platform/execution/tool-executor/` | `npm run test:integration` | existing | shadow | implemented | 现有 tool-executor/toolbelt 已形成可复用主干；待继续收敛统一 facade 命名 | yes | REC-001 | TBD |
| GOV-001 | H2 Action Gate dry-run | P0a | Control | TBD | TBD | `src/platform/five-plane-control-plane/risk-control/`、`src/platform/five-plane-control-plane/approval-center/` | `tests/integration/platform/control-plane/` | `npm run test:integration` | existing | dry-run | implemented | 风控/审批主干已存在；需vs文档术语进一步对齐 | yes | REC-001 | TBD |
| GOV-002 | H4 Approval enforce for high-risk tool | P0b-1 | Control | TBD | TBD | `src/platform/five-plane-control-plane/approval-center/`、`src/org-governance/approval-routing/` | `tests/e2e/approval-*.test.ts`、`tests/integration/platform/control-plane/approval-center/` | `npm run test:e2e` | existing | enforce | implemented | 现有 approval-center + routing + approval e2e 主链已存在 | yes | TOOL-001,GOV-001 | TBD |
| TOOL-002 | prepare/commit/verify/compensate with durable outbox | P0b-1 | Runtime | TBD | TBD | `src/platform/five-plane-execution/tool-gateway/`、`src/platform/shared/outbox/`、`src/platform/five-plane-state-evidence/receipts/` | `tests/unit/platform/execution/tool-gateway/` | `npm run test:tool-gateway` | existing | enforce | implemented | `2026-05-26 npm run test:tool-gateway` via；prepare/commit/verify/compensate 已以 facade 形式vs durable outbox 收敛 | yes | REC-001,TOOL-001 | TBD |
| MEM-001 | MemoryGateway facade + L4-L7 proposal-only | P0b-2 | State | TBD | TBD | `src/platform/five-plane-state-evidence/memory-gateway/`、`src/platform/five-plane-orchestration/harness/memory-manager.ts` | `tests/unit/platform/state-evidence/memory-gateway/` | `npm run test:memory-gateway` | existing | enforce | implemented | `2026-05-26 npm run test:memory-gateway` via；`ManagedMemoryMinimal` / `MemoryProposal` / projection / higher-layer proposal-only 已落到源码接口 | yes | REC-001 | TBD |
| REL-001 | ReleaseManifestDraft + ReleaseGate enforce for prod | P0b-3 | Release | TBD | TBD | `src/platform/shared/stability/release-gate.ts`、`src/sdk/cli/release-pipeline.ts`、`src/platform/five-plane-control-plane/config-center/` | `tests/unit/platform/shared/stability/`、`tests/integration/platform/execution/stable-release-gate.test.ts` | `npm run gate:stable` | existing | enforce | implemented | `2026-05-26 npm run test:release-gate` via；`2026-05-26 npm run gate:stable` 已输出阻断报告，当前is证据不足导致业务 blocked，不iscode链路缺失 | yes | REC-001 | TBD |
| GOV-003 | H3 Observation Gate for untrusted tool output | P0b-4 | Control | TBD | TBD | `src/platform/five-plane-execution/tool-executor/tool-output-sanitizer.ts`、`src/platform/five-plane-execution/tool-executor/mcp-tool-guard.ts` | `tests/unit/platform/execution/tool-executor/`、`tests/e2e/prompt-injection-guard*.test.ts` | `npm run prompt-injection:stable` | existing | enforce | completed | `2026-05-26 npm run prompt-injection:stable` 5/5 scenarios passed | yes | TOOL-002 | TBD |
| UI-001 | Minimal Approval UI/API | P0b-5 | UI | TBD | TBD | `ui/packages/features/approval/`、`src/platform/five-plane-interface/api/http-server/approval-routes.ts` | `ui/tests/unit/ui/packages/features/approval/`、`tests/e2e/approval-*.test.ts` | `npm run test:e2e` | existing | enforce | implemented | 现有 approval UI/API 已存在；仍需vs文档中的“minimal approval UI/API”口径完全对齐 | conditional | GOV-002 | TBD |
| GOV-004 | H1-lite untrusted input marking | P0c | Control | TBD | TBD | `src/platform/prompt-engine/prompt-injection-guard.ts`、`src/platform/shared/stability/stable-prompt-injection-red-team.ts` | `tests/e2e/prompt-injection-guard*.test.ts`、`tests/integration/platform/prompt-engine/prompt-injection-guard.integration.test.ts` | `npm run prompt-injection:stable` | existing | dry-run/enforce for external | completed | `2026-05-26 npm run prompt-injection:stable` 5/5 scenarios passed | yes | DOC-014 | TBD |
| SEC-001 | P0 security suite：prompt/tool/memory injection | P0c | Security | TBD | TBD | `src/platform/prompt-engine/prompt-injection-guard.ts`、`src/platform/five-plane-control-plane/incident-control/tenant-execution-isolation-service.ts` | `tests/e2e/prompt-injection-guard*.test.ts`、`tests/integration/platform/security/` | `npm run test:e2e` | existing | enforce for high-risk | completed | `2026-05-26 npm run security:tenant` via；`2026-05-26 npm run prompt-injection:stable` via | yes | GOV-003,GOV-004,MEM-001 | TBD |
| EVAL-001 | Minimal eval report and release blocking threshold | P0c | Eval | TBD | TBD | `src/platform/five-plane-orchestration/harness/evaluation/`、`src/platform/five-plane-orchestration/harness/eval-harness/` | `tests/unit/platform/orchestration/harness/evaluation/`、`tests/integration/platform/orchestration/harness/` | `AA_VALIDATION_ITERATIONS=2 npm run validate:stable:compiled` | existing | enforce for release | completed | `2026-05-26 AA_VALIDATION_ITERATIONS=2 npm run validate:stable:compiled` 14/14 runs passed | yes | REL-001 | TBD |
| OBS-001 | Basic cost/latency tracing advisory | P0c | Observability | TBD | TBD | `src/platform/shared/observability/` | `tests/integration/platform/shared/observability/` | `npm run observability:smoke` | existing | advisory | completed | `2026-05-26 npm run observability:smoke` via | conditional | REC-001 | TBD |

### 20.3 P1/P2 TODO 摘要

| ID | Task | Priority | TeamOwner | Status | Notes |
|---|---|---|---|---|---|
| SAN-001 | SandboxProvider abstraction | P1 | Runtime | implemented | `src/platform/five-plane-execution/sandbox-provider/` 已提供 local/container/browser/microVM/remote provider 抽象；`2026-05-26 npm run test:sandbox-provider` via |
| EVAL-002 | Full trajectory evaluator | P1 | Eval | implemented | `src/platform/five-plane-orchestration/evaluator/full-trajectory-evaluator.ts` 已把 LLM judge 校准vs rule evaluator 收敛；`2026-05-26 npm run test:full-trajectory-evaluator` via |
| OBS-002 | Cost/latency release blocking gate | P1 | Observability | implemented | `src/platform/shared/observability/cost-latency-release-gate.ts` 已supported blocking report；`2026-05-26 npm run test:cost-latency-release-gate` via |
| MEM-002 | Memory export/delete/revoke privacy workflow | P1 | State/Security | implemented | `src/platform/five-plane-state-evidence/memory-gateway/privacy-workflow.ts` 已覆盖 export/delete/revoke；`2026-05-26 npm run test:memory-privacy-workflow` via |
| UI-002 | Memory Review Console frontend | P1 | UI | implemented | `ui/packages/features/memory-review/` 已接入 feature registry vs前端测试；`2026-05-26 npm run test:ui-p1-features` via |
| UI-003 | Release Console frontend | P1 | UI | implemented | `ui/packages/features/release-console/` 已接入 feature registry vs前端测试；`2026-05-26 npm run test:ui-p1-features` via |
| UI-004 | Trace Explorer frontend | P1 | UI | implemented | `ui/packages/features/trace-explorer/` 已接入 feature registry vs前端测试；`2026-05-26 npm run test:ui-p1-features` via |
| OPS-001 | Operational runbook automation | P1 | Ops | implemented | `src/ops-maturity/platform-ops-agent/runbook-automation-service.ts` vs incident runbook executor 测试链已存在；`2026-05-26 npm run test:runbook-automation` via |
| AB-001 | Harness A/B test | P2 | Eval/Platform | implemented | `src/platform/prompt-engine/eval/llm-eval-service.ts` 已supported A/B、显著性和独立 judge 约束；`2026-05-26 npm run test:ab-eval` via |
| MAG-001 | Multi-agent handoff protocol | P2 | Orchestration | implemented | `src/platform/five-plane-orchestration/oapeflir/handoff-model.ts` + `handoff-builder.ts` 已形成责任交接协议；`2026-05-26 npm run test:handoff-protocol` via |

---

## 21. CI / Runtime Gate

| Gate | P0a | P0b | P0c | P1 |
|---|---|---|---|---|
| Direct tool import scan | detect only | fail high-risk bypass | fail all production bypass | fail all bypass |
| Direct memory write scan | detect only | fail L4-L7 bypass | fail L3-L7 bypass in prod | fail all unauthorized writes |
| Release bypass scan | detect only | fail prod bypass | fail prod/staging bypass | fail all artifact release bypass |
| Receipt completeness | advisory | high-risk blocking | production blocking | all critical path blocking |
| Security injection suite | N/A | high-risk samples | P0 baseline | full regression |
| Cost/latency | trace only | advisory | advisory | blocking when budget defined |

---

## 22. 业务场景落地矩阵

### 22.1 总览

| 场景 | 首批适合度 | required P0 能力 | 主要风险 |
|---|---:|---|---|
| 论文调研 Agent | 高 | H1-lite、MemoryGateway、Trace/Eval、Evidence | 外部文档注入、错误Conclusion沉淀 |
| code审查 / 测试failed分析 Agent | 高 | ToolGateway、Sandbox-lite、Receipt、H3、Eval | 危险命令、错误 patch、日志注入 |
| 训练实验分析 Agent | 中 | ToolGateway、Release/Eval、Cost、Memory | GPU 资源浪费、错误归因 |
| YONO 预测辅助 Agent | 中低 | Governance、Evaluation、Audit、H4 | Decision责任、外部输出风险 |
| 生产data库操作 Agent | 低 | H4、Rollback、Policy、Sandbox、Audit | 高风险副作用，不适合首批全自动 |

### 22.3 论文调研 Agent 落地设计

| 项 | 设计 |
|---|---|
| 输入 | 论文 PDF、arXiv/OpenReview 页面、user研究Issue、内部实验record |
| 工具 | 搜索、PDF parser、文档摘要、知识库writes、eval case 生成 |
| 风险 | 外部文档 prompt injection、错误论文Conclusion进入 L5/L7、references用错误 |
| required Gate | H1-lite、H3、MemoryProposal、Evidence binding、EvalReport |
| Memory 层 | L2 task notes、L3 session summary、L5 domain conclusion、L7 eval/failure pattern |
| Evaluation | 论文召回率、references用准确率、Conclusion正确率、实验Recommendation可执lines性 |
| Release | Mission Release 交付调研报告；L5/L7 memory 需 review 后 commit |
| 验收指标 | references用准确率 ≥ 95%；L5 memory 100% 有 evidence；外部注入样例 100% 标记 untrusted |

### 22.4 code审查 / 测试failed分析 Agent 首批落地设计

| 项 | 设计 |
|---|---|
| 输入 | repo、diff、测试日志、CI 结果、Architecture文档 |
| 工具 | repo read、test runner、static analyzer、patch generator、PR draft |
| 风险 | 危险命令执lines、错误 patch、日志注入、误删文件 |
| required Gate | H1-lite for logs/docs、H2 for commands、H3 for tool output、ToolGateway、Receipt、Sandbox-lite |
| Memory 层 | L2 task debug notes、L3 session state、L5 project conventions、L7 recurring failure patterns |
| Evaluation | bug finding precision、false positive、test pass rate、dangerous command block rate |
| Release | Mission Release 交付审查报告或 PR 草稿；code合并仍需人工 review |
| 验收指标 | dangerous command block rate 100%；tool call receipt 100%；patch 只能以 draft 形式输出，不能自动 merge |

---

## 23. ADR Decisionrecord

| ADR | Decision | Status |
|---|---|---|
| ADR-001 | 保留 Five Plane，不替换为 ETCLOVG | accepted |
| ADR-002 | Harness-driven，不采用 model-driven | accepted |
| ADR-003 | Tool Registry 升级为 Tool Gateway | accepted for architecture release; engineering validation pending |
| ADR-004 | Memory 统一治理，不统一物理storage | accepted |
| ADR-005 | L7 memory 不等于 PolicyBundle | accepted |
| ADR-006 | Release Artifact Graph 必须 lockfile 化 | accepted for architecture release; engineering validation pending |
| ADR-007 | H1-lite 前移到 P0b/P0c | accepted for architecture release; engineering validation pending |
| ADR-008 | high-risk side-effect 必须 durable outbox / PrepareReceipt first | accepted for architecture release; engineering validation pending |
| ADR-009 | cost/latency P0c advisory，P1 blocking | accepted for architecture release; engineering validation pending |
| ADR-010 | Tool reversibility 必须参vs risk decision | accepted for architecture release; engineering validation pending |

---

## 24. Release Checklist

### 24.1 文档 release checklist

| 项 | Status |
|---|---|
| Five Plane / ETCLOVG / OAPEFLIR 关系清晰 | completed |
| Memory / Policy / Evidence / Context 边界清晰 | completed |
| P0a/P0b/P0c 路线图清晰 | completed |
| Current Codebase Gap Matrix 已defines | completed |
| 真实仓库扫描结果已填入 | completed（自动扫描版）；CI 门禁未接入，仍阻断工程基线 |
| TODO owner 真实姓名已填入 | 未完成，阻断工程基线 |
| Verify command isno存在已标记 | completed，并已区分 existing aggregate vs to_add dedicated |
| CI command 已进入 package.json / workflow | 未完成，阻断工程基线 |
| Release blocking threshold 已defines | completed |
| Security & Privacy Baseline 已defines | completed |

### 24.2 工程基线冻结条件

v1.9 文档已via可以作为 Architecture Review Release；冻结为工程实施基线前必须满足：

```text
1. current-codebase-gap-review-v1.9.md 已生成。
2. 所有 P0 Blocking TODO 已绑定真实 OwnerName / Reviewer。
3. 所有 P0 verify command 已进入 package.json 或 CI workflow。
4. P0a boundary scan 能运lines并输出报告。
5. ToolGateway shadow / Policy dry-run / Receipt shadow 至少有一条 E2E 路径。
6. Release Gate 的 prod bypass 能被 lint 或 runtime guard 发现。
```


---

## 25. v1.9 Release Decision Matrix

### 25.1 本版本可以 release 的范围

| Release class型 | isno允许 | Description |
|---|---:|---|
| Architecture Review Release | is | 本版本允许正式 release 为Architecture评审版本，可used forArchitecture评审、工程排期、真实code扫描 |
| Engineering Planning Input | is | TODO、风险、Gate、接口足够supported排期讨论 |
| P0a Implementation Draft | 有条件 | 需要先补 dedicated package scripts 和扫描脚本 |
| Engineering Freeze Baseline | no | 真实仓库扫描、真实 owner、CI 命令尚未完成 |
| Production Governance Baseline | no | 未via过 E2E、security、eval baseline 和 P0b enforce 验证 |

### 25.2 从 v1.9 Architecture Review Release 升级到工程冻结基线的必要条件

1. `current-codebase-gap-review-v1.9.md` vs JSON 扫描报告已生成。
2. 所有 P0 Blocking TODO 已绑定真实 `OwnerName / Reviewer / TargetStart / TargetEnd / IssueLink`。
3. 所有 P0 verify command 已进入 `package.json` 或 CI workflow，且不允许空实现。
4. P0a 至少跑通一条 E2E shadow 路径：`Receipt shadow + ToolGateway shadow + Policy dry-run + boundary scan`。
5. H1-lite 样例集、ToolRiskMetadata、Transactional Outbox、ReleaseManifest hash、ManagedMemoryMinimal 均有最小测试。
6. 首批场景至少选择一个进入 baseline eval run，并生成 `EvalThresholdVersion`。

### 25.3 仍需外部输入的事项

| 事项 | 为什么不能在文档内directly完成 |
|---|---|
| 真实code路径基线 | 需要生成可复现扫描产物并固化到 review artifact |
| 真实 owner | 需要团队排期vsmanageDecision |
| 专用 P0 命令落地 | 现有 aggregate 命令已识别，但 dedicated script 仍需补齐 |
| 评测 baseline | 需要真实 eval set vs baseline run |
| 生产security策略 | 需要公司security/合规要求 |

---

## 26. 最终Recommendation

v1.9-Architecture-Release 的定位is：

```text
可以作为：
- Architecture评审稿
- 工程排期输入
- P0 改造任务书草案
- 真实code扫描 checklist

不应directly作为：
- 已冻结工程实施基线
- 生产治理标准
- release baseline
- completed owner 分配的项目计划
```

下一步重点不is继续增加新模块，而is完成四件事：

```text
1. 扫描真实code，把 Gap Matrix 从“假设路径”变成“code事实”。
2. 给 P0 TODO 绑定真实 owner、reviewer、issue、target date。
3. 把 verify command 加入 package.json/CI，并至少跑通 P0a。 
4. 优先选择code审查 / 测试failed分析 Agent 作为首批验证场景，论文调研 Agent 作为第二验证场景，打通一条最小 Harness E2E。
```

一句话Conclusion：

> **v1.9 已via把 v1.8-RC 剩余的 release table述、版本一致性、ADR Status、工程冻结条件和首批验证路径收敛到“可正式发布为Architecture评审版本”的程度；但它仍然不is工程冻结基线，也不is生产基线。真正进入实施前，必须用真实仓库扫描和真实 owner 信息替换文档中的 TBD vs假设路径。**

---

## 参考资料

1. 《Agent Harness Engineering: A Survey》及其 ETCLOVG taxonomy。
2. Automatic Agent System 既有 Five Plane / OAPEFLIR / Harness-driven Architecture讨论。
3. `automatic_agent_system_harness_improvement_plan_v1_6_reviewed.md`。
4. v1.6/v1.7/v1.8 review 中提出的code映射、owner、CI 命令、H1-lite、security隐私、receipt/outbox、evaluation threshold、release 边界等Issue清单。

---

## 附录 A：v1.9 Release 修订摘要

| 修订项 | Status |
|---|---|
| 增加系统边界图 | completed |
| 增加 Current Codebase Gap Matrix 可信度标记 | completed |
| 增加 CI Command Contract | completed |
| 增加 P0b-1 到 P0b-5 | completed |
| H1-lite 前移 | completed |
| Release threshold 具体化 | completed |
| Cost/Latency advisory/blocking 阶段修正 | completed |
| Receipt / durable outbox 原子性 | completed |
| Tool reversibility risk rule | completed |
| ManagedMemoryMinimal schema | completed |
| Security & Privacy Baseline | completed |
| 首批业务场景展开 | completed |
| TODO for deduplication | completed |
| 真实code扫描 | 未完成，需工程执lines |
| 真实 owner 填写 | 未完成，需项目排期 |
| CI 命令落地 | 未完成，需工程执lines |
| H1-lite 最小测试集defines | completed |
| ToolRiskMetadata 必填契约 | completed |
| Transactional Outbox 事务边界 | completed |
| Eval baseline 校准协议 | completed |
| Security Gate 组件化 | completed |
| Release Decision Matrix | completed |

---

## 附录 B：版本修订record

| 版本 | Description |
|---|---|
| v1.1 | 初版 Harness 改进计划 |
| v1.2 | 增加 Seven-layer Memory 修正 |
| v1.3 | Memory Gate 独立增强补丁 |
| v1.4 | 合并 Memory Gate 到主文档 |
| v1.5 | 增加 TODO List、Release / Memory / Policy 边界修复 |
| v1.6 | 增加 Current Gap Matrix、Minimal P0、Rollout、Risk Matrix、Runbook、RBAC |
| v1.7 | 修复 v1.6 的可落地性Issue：真实扫描标记、CI 命令Status、P0b 细分、H1-lite、security隐私、receipt/outbox、threshold和业务场景 |
| v1.8 | 修复 v1.7 的 release 边界Issue：H1-lite 测试集、ToolRiskMetadata、Transactional Outbox、Eval baseline 校准、Security Gate 组件化、package.json 脚本契约和 Release Decision Matrix |
| v1.9 | Architecture Review Release：修复版本references用、工程冻结条件、ADR release Status、首批验证场景Recommendation，并明确 release class型vs禁止用途 |
