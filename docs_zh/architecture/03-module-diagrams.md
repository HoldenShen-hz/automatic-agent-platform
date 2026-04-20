# Automatic Agent Platform — 模块框架图集

> **版本**: v1.1  
> **日期**: 2026-04-19  
> **配套文档**: `agent_platform_design_architecture.md` v2.7 · `code_file_structure.md` v1.0 · `migration_assessment.md` v1.1  
> **说明**: 本文档以 ASCII 框架图形式呈现系统全景及各层/各模块的内部结构与交互关系。

### 图类型约定

本文档中每张图均标注其类型，读者应据此判断图的表达范围：

| 图类型 | 含义 | 表达 | 不表达 |
|--------|------|------|--------|
| **结构图** | 模块归属与逻辑边界 | 模块属于哪个平面/层 | 运行时调用顺序 |
| **数据流图** | 运行时数据/控制信号流向 | 信号传递方向与协议 | 模块内部实现 |
| **依赖图** | 代码级 import 方向 | 谁可以依赖谁 | 运行时时序 |
| **时序图** | 运行时执行顺序 | 步骤先后 | 模块归属 |
| **约束图** | 架构规则与禁止项 | 允许/禁止的依赖方向 | 具体调用关系 |

### 命名口径统一

以下名称在本文档、`code_file_structure.md`、`migration_assessment.md` 三份文档中统一使用：

| 统一名称 | 不使用的别名 |
|----------|-------------|
| `emergency/` | emergency-brake/ |
| `workflow-debugger/` | debug-ui/ |
| `platform-ops-agent/` | self-ops-agent/ |
| `resource-manager/` | resource-scheduler/ |
| `goal-decomposer/` | goal-decomposition/ |

### 统计口径声明

> 本文档所有统计数字为 **规划口径**，非最终落地文件数；含迁移映射与新建占位模块估算。

---

## 目录

| 章节 | 图类型 | 内容 |
|------|--------|------|
| §一 | 结构图 | 系统全景框架图（七层 + 五平面 + 跨层） |
| §二 | 数据流图 | Layer 1-2 `platform/` 五平面主干协议流 |
| §三 | 结构图 | P1 Interface Plane 模块归属图 |
| §四 | 结构图 | P2 Control Plane 模块归属图 |
| §五 | 结构图 | P3 Orchestration Plane 模块归属图 |
| §六 | 结构图 + 时序图 | P4 Execution Plane（BC 框架 + 执行时序 + 工具安全） |
| §七 | 结构图 | P5 State & Evidence Plane（按 Bounded Context 分组） |
| §八 | 结构图 | AI Runtime Support Stack（Model Gateway · Prompt Engine · Compliance） |
| §九 | 数据流图 | 平台协议图（Contracts 跨平面协议链 + Shared 基础设施） |
| §十 | 结构图 | Layer 3 `domains/` 业务域接入层 |
| §十一 | 结构图 | Layer 4 `interaction/` 智能交互层 |
| §十二 | 结构图 | Layer 5 `org-governance/` 组织治理层 |
| §十三 | 结构图 | Layer 6 `scale-ecosystem/` 规模化运行 + 生态层 |
| §十四 | 结构图 | Layer 7 `ops-maturity/` 运营成熟度层 |
| §十五 | 结构图 | 跨层模块（plugins · sdk · apps） |
| §十六 | 数据流图 | 端到端数据流全景图 |
| §十七 | 约束图 | 依赖方向与分层约束 |
| §十八 | 结构图 | 稳定性七层模型 |
| §十九 | 结构图 | P4 Runtime Bounded Context 专项图 |
| §二十 | 结构图 | P5 Storage Bounded Context 专项图 |
| §二一 | 结构图 | 横切能力控制面图 |
| §二二 | 结构图 | 老系统模块 → 新平台落点图 |
| §二三 | 时序图 | 迁移波次路线图 |
| §二四 | 数据流图 | 交互 · 治理 · 平台 三轴协作图 |

---

## §一 系统全景框架图

> **图类型: 结构图** — 表达七层 + 五平面 + 跨层的逻辑归属关系。不表达运行时调用顺序。
>
> **关键认知**: `platform/` 是基础内核，`interaction/` · `org-governance/` · `scale-ecosystem/` · `ops-maturity/` 是 **独立上层系统**（不是 platform 的子组件），它们通过契约和事件与内核交互。

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Automatic Agent Platform v2.7                          │
│                                                                                 │
│  ╔═══════════════════════════════════════════════════════════════════════════╗  │
│  ║  Layer 7: 运营成熟度层  ops-maturity/         ← 独立上层系统             ║  │
│  ║  可解释性 · 紧急制动 · Agent 生命周期 · 边缘 · 漂移 · 成本 · 调试 · 合规 ║  │
│  ╠═══════════════════════════════════════════════════════════════════════════╣  │
│  ║  Layer 6: 规模化运行 + 生态层  scale-ecosystem/ ← 独立上层系统           ║  │
│  ║  多 Region · 资源竞争 · SLA · Agent 市场 · 反馈改进 · 外部集成           ║  │
│  ╠═══════════════════════════════════════════════════════════════════════════╣  │
│  ║  Layer 5: 组织治理层  org-governance/           ← 独立上层系统           ║  │
│  ║  组织层次 · 审批路由 · SSO/SCIM · 合规引擎 · 知识隔离 · 治理委托         ║  │
│  ╠═══════════════════════════════════════════════════════════════════════════╣  │
│  ║  Layer 4: 智能交互层  interaction/              ← 独立上层系统           ║  │
│  ║  NL 入口 · 目标分解 · 主动 Agent · 渐进自主权 · 运维看板 · UX            ║  │
│  ╠═══════════════════════════════════════════════════════════════════════════╣  │
│  ║  Layer 3: 业务域接入层  domains/                ← 独立上层系统           ║  │
│  ║  域注册中心 · 风险画像 · 知识结构 · 评测框架 · Prompt 库 · Recipe · 治理  ║  │
│  ╚═══════════════════════════════════════════════════════════════════════════╝  │
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │  Layer 1-2: 基础设施 + AI 运营层  platform/    ← 平台内核                │  │
│  │                                                                           │  │
│  │  ┌────── 五平面主核 ──────────────────────────────────────────────────┐  │  │
│  │  │  P1 Interface │ P2 Control │ P3 Orchestrate │ P4 Execution │ P5 State │ │  │
│  │  └───────────────────────────────────────────────────────────────────┘  │  │
│  │  ┌────── AI 运营侧车 ────────────────────────────────────────────────┐  │  │
│  │  │  model-gateway/ · prompt-engine/ · compliance/                     │  │  │
│  │  └───────────────────────────────────────────────────────────────────┘  │  │
│  │  ┌────── 横切基础 ──────────────────────────────────────────────────┐  │  │
│  │  │  contracts/ · shared/ (utils · lifecycle · cache · obs · stability) │  │  │
│  │  └───────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                          │
│  │   plugins/   │  │     sdk/     │  │    apps/     │   ← 跨层模块              │
│  │ 插件生态系统  │  │ SDK & DevEx  │  │ 应用入口     │                           │
│  └──────────────┘  └──────────────┘  └──────────────┘                          │
│                                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   tests/     │  │   config/    │  │  divisions/  │  │    doc/      │        │
│  │ 测试镜像 src │  │ 版本化配置   │  │ 业务分区定义  │  │ 设计与契约   │        │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### X1 Reliability & Security Fabric 定义

X1 不是单独目录，而是由以下模块共同构成的 **横切能力带**，贯穿全部五平面和七层：

| 能力 | 实现位置 |
|------|---------|
| AuthN/Z · Sandbox | `platform/control-plane/iam/` |
| Circuit Breaker | `platform/model-gateway/provider-registry/` · `platform/shared/stability/` |
| Rate Limit · Backpressure | `platform/interface/ingress/` · `platform/execution/dispatcher/` |
| DLQ | `platform/state-evidence/dlq/` |
| Secrets · Egress | `platform/control-plane/iam/` |
| Observability | `platform/shared/observability/` |
| Recovery · Stability Rehearsal | `platform/execution/recovery/` · `platform/shared/stability/` |
| Policy · Compliance | `platform/control-plane/policy-center/` · `platform/compliance/` |

---

## §二 Layer 1-2 `platform/` 五平面主干协议流

> **图类型: 数据流图** — 表达五平面之间的主干协议传递方向，以及 AI 运营模块的侧向支撑关系。不表达模块内部实现细节。

```text
platform/
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │  P1 Interface Plane  接口平面                                     │      │
│   │  api/ · webhook/ · channel-gateway/ · scheduler/                 │      │
│   │  console-backend/ · ingress/                                     │      │
│   └────────────────────────────────┬─────────────────────────────────┘      │
│                                    │ request-envelope                       │
│   ┌────────────────────────────────▼─────────────────────────────────┐      │
│   │  P2 Control Plane  控制平面                                       │      │
│   │  tenant/ · iam/ · policy-center/ · approval-center/              │      │
│   │  rollout-controller/ · incident-control/ · replay-repair/        │      │
│   │  config-center/ · audit-export/                                  │      │
│   └────────────────────────────────┬─────────────────────────────────┘      │
│                                    │ control-directive                      │
│   ┌────────────────────────────────▼─────────────────────────────────┐      │
│   │  P3 Orchestration Plane  编排平面 ◀╌╌╌╌╌╌┐                      │      │
│   │  oapeflir/ · planner/ · replan/ · routing/│ · escalation/ · hitl │      │
│   └────────────────────────────────┬──────────│──────────────────────┘      │
│                                    │ exec-plan│                             │
│   ┌────────────────────────────────▼──────────│──────────────────────┐      │
│   │  P4 Execution Plane  执行平面  ◀╌╌╌╌╌╌╌╌╌┘                      │      │
│   │  dispatcher/ · lease/ · worker-pool/ · execution-engine/         │      │
│   │  state-transition/ · ha/ · hot-upgrade/ · recovery/              │      │
│   │  tool-executor/ · plugin-executor/ · distributed-lock/           │      │
│   │  queue/ · resource/ · startup/                                   │      │
│   └────────────────────────────────┬─────────────────────────────────┘      │
│                                    │ state-command / execution-receipt      │
│   ┌────────────────────────────────▼─────────────────────────────────┐      │
│   │  P5 State & Evidence Plane  状态与证据平面                        │      │
│   │  truth/ · events/ · projections/ · artifacts/ · memory/          │      │
│   │  knowledge/ · audit/ · incident/ · checkpoints/ · dlq/          │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│   ┌───── AI 运营（并列支撑，非线性主链，深度插入多平面）─────────────┐      │
│   │  model-gateway/       │  prompt-engine/  │  compliance/          │      │
│   │  Provider·Router·Cost │  Registry·Render │  Erasure·Encrypt     │      │
│   │  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌   │      │
│   │  侧向支撑关系:                                                   │      │
│   │  P3/P4 ◀╌╌╌▶ model-gateway  (模型路由 + 熔断)                   │      │
│   │  P3    ◀╌╌╌▶ prompt-engine  (Prompt 渲染 + 评估)                │      │
│   │  P2/P5 ◀╌╌╌▶ compliance     (数据合规 + 审计)                   │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│   ┌─────────────────────── 跨平面基础 ───────────────────────────────┐      │
│   │  contracts/ (types · errors · envelopes · directives)            │      │
│   │  shared/    (utils · lifecycle · cache · observability · stability)│     │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│   ═══════ X1 Reliability & Security Fabric (横切全层，定义见 §一) ═══════   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §三 P1 Interface Plane 模块归属图

> **图类型: 结构图** — 表达 P1 内部模块归属及三个职责区域的划分。不表达运行时调用顺序或代码依赖。

```text
platform/interface/
┌─────────────────────────────────────────────────────────────────────┐
│                       P1 Interface Plane                             │
│                                                                      │
│  ┌─────────── A. Ingress & Transport (协议入口) ──────────────┐     │
│  │                                                              │     │
│  │  ┌───────────────┐  ┌──────────────┐  ┌───────────────┐    │     │
│  │  │    api/        │  │  webhook/    │  │   ingress/    │    │     │
│  │  │  http-server   │  │  inbound     │  │  rate-limit   │    │     │
│  │  │  routes        │  │  parser      │  │  routing      │    │     │
│  │  │  oidc/oauth    │  │  verify      │  │  canary       │    │     │
│  │  │  websocket     │  │  dispatch    │  └───────────────┘    │     │
│  │  └───────────────┘  └──────────────┘                        │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌─────────── B. Channel Delivery (通道投递) ─────────────────┐     │
│  │                                                              │     │
│  │  ┌───────────────────────────┐                              │     │
│  │  │   channel-gateway/        │                              │     │
│  │  │   telegram · slack        │                              │     │
│  │  │   webhook-out · sse       │                              │     │
│  │  └───────────────────────────┘                              │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌─────────── C. Operator Backend (运营后端) ─────────────────┐     │
│  │                                                              │     │
│  │  ┌──────────────┐  ┌───────────────────────────┐            │     │
│  │  │ scheduler/   │  │   console-backend/        │            │     │
│  │  │  cron        │  │   dashboard-api           │            │     │
│  │  │  event       │  │   config-ui               │            │     │
│  │  │  trigger     │  │   monitoring-view         │            │     │
│  │  └──────────────┘  └───────────────────────────┘            │     │
│  └──────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  流量方向:                                                           │
│  外部请求 ──▶ ingress ──▶ api/webhook/channel-gateway               │
│  scheduler ──▶ P3（定时触发）                                       │
│  console-backend ──▶ P5（查询）+ P2（管控）                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## §四 P2 Control Plane 模块归属图

> **图类型: 结构图** — 表达 P2 内部模块归属及四个职责区域。不表达运行时调用顺序。

```text
platform/control-plane/
┌─────────────────────────────────────────────────────────────────────────────┐
│                            P2 Control Plane                                  │
│                                                                              │
│  ┌──────── A. Governance (治理) ─────────────────────────────────────┐      │
│  │  ┌──────────────┐  ┌────────────────────┐  ┌──────────────┐      │      │
│  │  │   tenant/    │  │   policy-center/   │  │approval-ctr/ │      │      │
│  │  │  租户管理    │  │   策略中心         │  │  审批中心    │      │      │
│  │  │  CRUD/quota/ │  │  risk-level/       │  │  flow/route/ │      │      │
│  │  │  billing     │  │  security/comply   │  │  SoD         │      │      │
│  │  └──────────────┘  └────────────────────┘  └──────────────┘      │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  ┌──────── B. Security & Access (安全与访问) ────────────────────────┐      │
│  │  ┌─────────────────────────────────────────────────────────┐      │      │
│  │  │                     iam/                                 │      │      │
│  │  │  sandbox-policy · policy-engine · field-encrypt          │      │      │
│  │  │  data-classify · audit-event · secret-mgmt               │      │      │
│  │  │  network-egress · cve-intel · trusted-context-scanner    │      │      │
│  │  └─────────────────────────────────────────────────────────┘      │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  ┌──────── C. Release & Ops Control (发布与运维管控) ────────────────┐      │
│  │  ┌────────────────────┐  ┌──────────────────────────────────┐     │      │
│  │  │rollout-controller/ │  │      incident-control/           │     │      │
│  │  │  traffic-route     │  │  ┌──────────┐ ┌──────────────┐  │     │      │
│  │  │  canary            │  │  │doctor    │ │deployment    │  │     │      │
│  │  │  auto-rollback     │  │  │takeover  │ │stop-loss     │  │     │      │
│  │  └────────────────────┘  │  │ops-gov   │ │release-pipe  │  │     │      │
│  │  ┌────────────────────┐  │  └──────────┘ └──────────────┘  │     │      │
│  │  │replay-repair-ctrl/ │  └──────────────────────────────────┘     │      │
│  │  │  重放修复控制       │                                          │      │
│  │  └────────────────────┘                                           │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  ┌──────── D. Config & Audit (配置与审计) ───────────────────────────┐      │
│  │  ┌──────────────┐  ┌──────────────┐                               │      │
│  │  │config-center/│  │audit-export/ │                               │      │
│  │  │  runtime/env │  │  审计导出    │                               │      │
│  │  │  provider/   │  └──────────────┘                               │      │
│  │  │  model/billing│                                                │      │
│  │  └──────────────┘                                                 │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  控制流:                                                                    │
│  P1 ──▶ iam 鉴权 ──▶ policy 评估 ──▶ approval 审批                        │
│  ──▶ 生成 control-directive ──▶ P3                                         │
│  incident-ctrl ◀── P5 事件（异常触发管控）                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §五 P3 Orchestration Plane 模块归属图

> **图类型: 结构图** — 表达 P3 内部模块归属与协作方向。不表达运行时调用顺序或代码依赖。

### P3 模块边界规则

| 模块 | 职责 | 决定什么 |
|------|------|---------|
| `routing/` | 任务路由 | "谁来做"（选择 Agent/Team/Workflow） |
| `planner/` | 任务分解 | "怎么拆"（DAG 分解 + 策略选择） |
| `oapeflir/` | 认知循环 | "怎么循环执行与学习"（8 阶段受控内核） |
| `hitl/` | 人机协作 | "需要人参与的控制节点"（审批/接管/解释） |
| `replan/` | 重规划 | "上下文变化后怎么调整" |
| `escalation/` | 升级处理 | "异常超出当前能力后怎么升级" |

```text
platform/orchestration/
┌─────────────────────────────────────────────────────────────────────────────┐
│                       P3 Orchestration Plane                                 │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐        │
│  │  oapeflir/  OAPEFLIR 受控认知内核                                  │        │
│  │                                                                    │        │
│  │  O ──▶ A ──▶ P ──▶ E ──▶ F ──▶ L ──▶ I ──▶ R                    │        │
│  │  Observe  Assess  Plan  Execute  Feedback  Learn  Improve  Rollout│        │
│  │                                                                    │        │
│  │  ┌──────────┐  ┌────────────────┐  ┌───────────────────┐         │        │
│  │  │workflow/ │  │    learn/      │  │ improve-rollout/  │         │        │
│  │  └──────────┘  └────────────────┘  └───────────────────┘         │        │
│  └──────────────────────────────────────────────────────────────────┘        │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   routing/   │  │   planner/   │  │ escalation/  │  │   replan/    │    │
│  │  "谁来做"    │  │  "怎么拆"    │  │  "怎么升级"  │  │  "怎么调整"  │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
│  ┌──────────────┐                                                           │
│  │    hitl/     │  编排流:                                                  │
│  │  "需人参与"  │  control-directive ──▶ routing ──▶ planner ──▶ oapeflir   │
│  └──────────────┘  ──▶ 生成 execution-plan ──▶ P4                          │
│                     异常 ──▶ escalation / replan                             │
│                     需人工 ──▶ hitl ──▶ P1 推送                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §六 P4 Execution Plane 模块框架图

> P4 是模块数量最多的平面，以下用三种不同类型的图分别展示。

### §六.1 P4 Bounded Context 框架图

> **图类型: 结构图** — 表达 P4 内 14 个 BC 级模块的归属与分组。不表达运行时调用顺序。

```text
platform/execution/
┌─────────────────────────────────────────────────────────────────────┐
│  ┌────── 调度与 Worker ──────────────────────────────────────┐      │
│  │  dispatcher/  │  lease/  │  worker-pool/                   │      │
│  └───────────────────────────────────────────────────────────┘      │
│  ┌────── 执行引擎 ──────────────────────────────────────────┐      │
│  │  execution-engine/  │  state-transition/                   │      │
│  └───────────────────────────────────────────────────────────┘      │
│  ┌────── 可靠性 ────────────────────────────────────────────┐      │
│  │  ha/  │  hot-upgrade/  │  recovery/                       │      │
│  └───────────────────────────────────────────────────────────┘      │
│  ┌────── 工具与插件 ────────────────────────────────────────┐      │
│  │  tool-executor/  │  plugin-executor/                       │      │
│  └───────────────────────────────────────────────────────────┘      │
│  ┌────── 基础设施 ──────────────────────────────────────────┐      │
│  │  distributed-lock/  │  queue/  │  resource/  │  startup/  │      │
│  └───────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

### §六.2 P4 执行时序图

> **图类型: 时序图** — 表达一次任务执行的运行时步骤先后。不表达模块归属或代码依赖。

```text
execution-plan (from P3)
    │
    ▼
dispatcher ─── 准入控制 + 优先级排序
    │
    ▼
lease ──────── 分配执行租约
    │
    ▼
worker-pool ── 选择目标 Worker + handshake
    │
    ▼
execution-engine ── agent-executor → model-call → tool/plugin 调用
    │                   │
    │                   ├── loop-detect (死循环检测)
    │                   ├── effect-buffer (副作用缓冲)
    │                   └── context-compact (上下文压缩)
    │
    ▼
state-transition ── 状态机驱动状态变更
    │
    ▼
P5 ◀── state-command (持久化)
P3 ◀── execution-receipt (回执)

异常路径:
    stalled-detect ──▶ recovery ──▶ replay/repair
    region-fail ──▶ ha ──▶ failover
    version-change ──▶ hot-upgrade ──▶ graceful-migrate
```

### §六.3 P4 工具调用安全图

> **图类型: 数据流图** — 表达工具调用链路中的安全控制点。不表达模块归属。

```text
execution-engine
    │
    ▼
tool-executor
    ├── command-security ──── 命令安全校验
    ├── tool-contract-validator ── 契约合规检查
    ├── tool-path-scope ──── 路径作用域限制
    ├── tool-output-sanitizer ── 输出消毒
    ├── mcp-tool-guard ──── MCP 协议守卫
    └── role-tool-exposure ── 角色工具可见性

plugin-executor
    ├── runtime-sandbox ──── 沙箱隔离执行
    ├── plugin-host ──── 子进程宿主
    └── plugin-protocol ──── 通信协议守卫
```

---

## §七 P5 State & Evidence Plane 模块归属图

> **图类型: 结构图** — 表达 P5 内部按 7 个 Bounded Context 分组的模块归属关系，以及 Truth / Derived / Evidence 三层数据分区。不表达运行时读写时序与具体表结构。

### §七.1 BC 分组结构图

```text
platform/state-evidence/
┌─────────────────────────────────────────────────────────────────────────────┐
│                     P5 State & Evidence Plane                                │
│                                                                              │
│  ════════════════════ Zone A: Truth 权威真相区 ════════════════════          │
│  (事务一致; 写路径: P4 state-command ──▶ truth + event 同事务提交)           │
│                                                                              │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  BC1 Core Task Engine  (~73 方法)│  │  BC2 Worker Infrastructure(~47) │  │
│  │  task · workflow · execution ·  │  │  worker · dispatch · lease ·    │  │
│  │  session                         │  │  lock                           │  │
│  │  ─────────────────────────────  │  │  ─────────────────────────────  │  │
│  │  任务生命周期 · 工作流状态 ·    │  │  调度分配 · 租约获取/续期 ·    │  │
│  │  执行管理 · 会话控制            │  │  分布式锁 · Worker 注册         │  │
│  └─────────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  BC3 Event Infrastructure (~24) │  │  BC4 Billing & Cost (~29)       │  │
│  │  event                           │  │  billing                        │  │
│  │  ─────────────────────────────  │  │  ─────────────────────────────  │  │
│  │  事件发布 · 确认 · DLQ 管理 ·  │  │  账户 · 发票 · 配额 ·          │  │
│  │  持久化总线 · 类型注册          │  │  用量 · 账本 · 权益             │  │
│  └─────────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  BC5 Governance & Compliance    │  │  BC6 Platform & Commerce (~47)  │  │
│  │  (~50)                           │  │  marketplace · release ·        │  │
│  │  approval · organization ·      │  │  division · intelligence ·      │  │
│  │  secret · compliance · ops      │  │  evolution                       │  │
│  │  ─────────────────────────────  │  │  ─────────────────────────────  │  │
│  │  审批路由 · 组织层级 ·          │  │  市场清单 · 发布生命周期 ·      │  │
│  │  密钥管理 · 合规策略 ·          │  │  Division 管理 · 分析 ·         │  │
│  │  运营治理                        │  │  演进提案                        │  │
│  └─────────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────┐                                        │
│  │  BC7 Memory & Artifacts (~10)   │                                        │
│  │  memory · artifact               │                                        │
│  │  ─────────────────────────────  │                                        │
│  │  记忆 CRUD + 质量管理 ·         │                                        │
│  │  制品存储 · 版本管理             │                                        │
│  └─────────────────────────────────┘                                        │
│                                                                              │
│  ════════════════════ Zone B: Derived 派生查询区 ═════════════════════       │
│  (最终一致; 从 Truth 事件流派生; 可幂等重建; 不反写真相)                     │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                       │
│  │projections/  │  │  knowledge/  │  │  incident/   │                       │
│  │ 查询投影视图 │  │  知识检索    │  │  事件聚合    │                       │
│  │ query-view   │  │  semantic    │  │  record      │                       │
│  │ rebuild      │  │  keyword     │  │  timeline    │                       │
│  │ event-id 去重│  │  ingest      │  │              │                       │
│  └──────────────┘  └──────────────┘  └──────────────┘                       │
│                                                                              │
│  ════════════════════ Zone C: Evidence 证据链区 ═════════════════════        │
│  (只增不改; 审计/合规/恢复用途; 构成不可篡改证据链)                          │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   audit/     │  │  artifacts/  │  │checkpoints/  │  │    dlq/      │    │
│  │  审计日志    │  │  证据制品    │  │  恢复检查点  │  │  死信队列    │    │
│  │  who-what-   │  │  evidence-   │  │  workflow/   │  │  failed-     │    │
│  │  when        │  │  chain       │  │  step-ckpt   │  │  event       │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
│  ──────────────────── 基础设施层 ────────────────────                        │
│  storage-backend-factory · migration-runner · async-repo-registry           │
│  session-dual-write · storage-quota                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### §七.2 数据流向简图

```text
  P4 state-command
        │
        ▼
  ┌──────────┐    同事务     ┌──────────┐
  │  Truth   │ ═══════════▶ │  Event   │
  │  (BC1-7) │              │  (BC3)   │
  └──────────┘              └────┬─────┘
                                 │ 异步投影
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                   ▼
        ┌──────────┐      ┌──────────┐        ┌──────────┐
        │ Derived  │      │ Evidence │        │ 上层系统 │
        │projections│      │audit/ckpt│        │L4-L7 订阅│
        │knowledge │      │artifacts │        │事件消费  │
        └──────────┘      └──────────┘        └──────────┘
```

### §七.3 BC 分组边界规则

| 规则 | 说明 |
|------|------|
| BC 间通信 | 仅通过 Event Bus (BC3)；禁止 BC 间直接 import |
| Truth 写入 | 必须经 state-command 契约；BC 各自管理自己的表 |
| Projection 重建 | 任意 Projection 可从 Event Log 幂等重建；rebuild 命令为标准运维操作 |
| Evidence 不可变 | audit / artifact / checkpoint 只增不改；用于合规审计与故障恢复 |
| 迁移顺序 | Zone B (Derived) → Zone C (Evidence) → Zone A (Truth)；先迁读多写少表 |

---

## §八 AI Runtime Support Stack 模块归属图

> **图类型: 结构图** — 表达 AI 运营侧车三大组件（Model Gateway · Prompt Engine · Compliance）的模块归属与职责分区。不表达模型调用时序与 Prompt 渲染细节。
>
> **定位说明**: 此三组件在 §一 全景图中属于"AI 运营侧车"视觉带，与五平面主核 **并列支撑**（虚线跨平面关系），不是任何单一平面的子模块。P3/P4 通过契约调用 model-gateway 和 prompt-engine，P5 通过契约调用 compliance。

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                     AI Runtime Support Stack                                 │
│               (并列支撑，非五平面子组件; 通过契约为各平面服务)                │
│                                                                              │
│  ┌───────────────────────────────┐  ┌──────────────────────────────────┐    │
│  │     model-gateway/ 模型网关    │  │      prompt-engine/              │    │
│  │                                │  │      Prompt 工程引擎             │    │
│  │  ┌─────────────┐ ┌──────────┐ │  │  ┌──────────┐ ┌──────────────┐  │    │
│  │  │provider-    │ │  router/ │ │  │  │registry/ │ │  renderer/   │  │    │
│  │  │ registry    │ │ cost     │ │  │  │ version  │ │  template    │  │    │
│  │  │ base-chat   │ │ latency  │ │  │  │ history  │ │  variable    │  │    │
│  │  │ unified-chat│ │ capabil  │ │  │  └──────────┘ └──────────────┘  │    │
│  │  │ circuit-    │ └──────────┘ │  │  ┌──────────┐ ┌──────────────┐  │    │
│  │  │  breaker    │ ┌──────────┐ │  │  │rollout/  │ │    eval/     │  │    │
│  │  │ credential- │ │  cache/  │ │  │  │ canary   │ │  llm-eval    │  │    │
│  │  │  pool       │ │ kv-cache │ │  │  │ a/b test │ │  outcome     │  │    │
│  │  └─────────────┘ │ prompt-  │ │  │  │ rollback │ │  quality     │  │    │
│  │  ┌─────────────┐ │  cache   │ │  │  └──────────┘ │  policy-gov  │  │    │
│  │  │cost-tracker │ └──────────┘ │  │               └──────────────┘  │    │
│  │  │ budget-guard│ ┌──────────┐ │  └──────────────────────────────────┘    │
│  │  │ token-meter │ │fallback/ │ │                                          │
│  │  └─────────────┘ │ provider │ │  ┌──────────────────────────────────┐    │
│  │  ┌─────────────┐ │ failover │ │  │      compliance/ 合规             │    │
│  │  │  messages/  │ └──────────┘ │  │  ┌──────────┐ ┌──────────────┐  │    │
│  │  │ token-est   │              │  │  │ erasure/ │ │ encryption/  │  │    │
│  │  │ message-    │              │  │  │ crypto-  │ │ field-level  │  │    │
│  │  │  parts      │              │  │  │  shred   │ │  encrypt     │  │    │
│  │  └─────────────┘              │  │  └──────────┘ └──────────────┘  │    │
│  └───────────────────────────────┘  │  ┌──────────┐ ┌──────────────┐  │    │
│                                      │  │data-     │ │  lineage/    │  │    │
│  调用契约:                           │  │ residency│ │  data-lineage│  │    │
│  P3 ══model-request══▶ model-gw     │  └──────────┘ └──────────────┘  │    │
│  P4 ══model-request══▶ model-gw     └──────────────────────────────────┘    │
│  P3 ══prompt-render══▶ prompt-engine                                        │
│  P5 ══compliance-cmd══▶ compliance                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §九 平台协议图（Contracts 跨平面协议链 + Shared 基础设施）

> **图类型: 数据流图** — 表达跨平面契约的传递方向与共享基础设施的服务范围。不表达契约内部字段定义与 shared 模块的实现细节。
>
> **协议链核心路径**: P1→P2→P3→P4→P5 的信号传递由 7 个契约信封串联，每个信封定义了上下游平面的通信协议。

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         跨平面协议与共享基础设施                               │
│                                                                              │
│  ┌──────────────────────────────────────────────────────┐                   │
│  │  contracts/  跨平面协议链                              │                   │
│  │                                                        │                   │
│  │  ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────────┐ │                   │
│  │  │types/  │ │errors  │ │constants/│ │result-       │ │                   │
│  │  │domain  │ │.ts     │ │ time.ts  │ │ envelope/    │ │                   │
│  │  │ids     │ └────────┘ └──────────┘ └──────────────┘ │                   │
│  │  │status  │                                            │                   │
│  │  └────────┘ ┌──────────────┐ ┌──────────────────────┐ │                   │
│  │              │request-      │ │control-directive/    │ │                   │
│  │              │ envelope/    │ │ P2 ══▶ P3 传递控制   │ │                   │
│  │              │ P1 ══▶ P2   │ └──────────────────────┘ │                   │
│  │              └──────────────┘                          │                   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │                   │
│  │  │execution-    │ │execution-    │ │state-        │   │                   │
│  │  │ plan/        │ │ receipt/     │ │ command/     │   │                   │
│  │  │ P3 ══▶ P4   │ │ P4 ══▶ P3   │ │ P4 ══▶ P5   │   │                   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘   │                   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │                   │
│  │  │delegation-   │ │model-        │ │compliance-   │   │                   │
│  │  │ request/     │ │ request/     │ │ command/     │   │                   │
│  │  │ P3 ══▶ HITL │ │ P3/P4 ══▶ AI│ │ P5 ══▶ Comp  │   │                   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘   │                   │
│  │                                                        │                   │
│  │  协议链串联:                                           │                   │
│  │  request-envelope ──▶ control-directive ──▶            │                   │
│  │  execution-plan ──▶ execution-receipt ──▶              │                   │
│  │  state-command                                         │                   │
│  └──────────────────────────────────────────────────────┘                   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────┐                   │
│  │  shared/  跨平面共享基础设施                           │                   │
│  │                                                        │                   │
│  │  ┌──────────┐ ┌───────────┐ ┌────────────────────┐   │                   │
│  │  │ utils/   │ │lifecycle/ │ │      cache/        │   │                   │
│  │  │bounded-  │ │service-   │ │  cache-facade      │   │                   │
│  │  │ cache    │ │ registry  │ │  cache-bootstrap   │   │                   │
│  │  └──────────┘ │evolution  │ │  cache-policy      │   │                   │
│  │                └───────────┘ │  cache-invalidate  │   │                   │
│  │                               │  cache-key-factory│   │                   │
│  │  ┌──────────────────────┐    │  cache-metrics     │   │                   │
│  │  │   observability/     │    └────────────────────┘   │                   │
│  │  │  structured-logger   │                              │                   │
│  │  │  otel-bootstrap      │    ┌────────────────────┐   │                   │
│  │  │  metrics-service     │    │    stability/       │   │                   │
│  │  │  health-service      │    │  golden-task-runner │   │                   │
│  │  │  diagnostics         │    │  vcr-replay         │   │                   │
│  │  │  inspect-service     │    │  stable-acceptance  │   │                   │
│  │  │  sli/slo/anomaly     │    │  30+ rehearsal      │   │                   │
│  │  │  agent-state-view    │    │   scenarios         │   │                   │
│  │  └──────────────────────┘    └────────────────────┘   │                   │
│  └──────────────────────────────────────────────────────┘                   │
│                                                                              │
│  契约数据流向:                                                               │
│  P1 ──request-envelope──▶ P2 ──control-directive──▶ P3                      │
│  P3 ──execution-plan──▶ P4 ──execution-receipt──▶ P3                        │
│  P4 ──state-command──▶ P5                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §十 Layer 3 `domains/` 业务域接入层框架图

> **图类型: 结构图** — 表达 domains/ 下各模块的归属与职责分区。不表达域注册的运行时流程与 Plugin SPI 调用细节。

```text
domains/
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Layer 3: 业务域接入层                                      │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────┐               │
│  │  registry/  域注册中心（核心枢纽）                         │               │
│  │  ┌────────────┐ ┌──────────────┐ ┌──────────────────┐   │               │
│  │  │domain-     │ │contract-     │ │workflow-registry │   │               │
│  │  │ registry   │ │ registry     │ │tool-bundle-      │   │               │
│  │  │domain-     │ │plugin-spi    │ │ registry         │   │               │
│  │  │ model      │ │plugin-spi-   │ │registry-         │   │               │
│  │  │domain-     │ │ registry     │ │ bootstrap        │   │               │
│  │  │ event      │ │plugin-       │ └──────────────────┘   │               │
│  │  │smoke-test  │ │ runtime-host │                         │               │
│  │  └────────────┘ └──────────────┘                         │               │
│  └──────────────────────────────────────────────────────────┘               │
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │risk-profile/ │ │knowledge-    │ │eval-         │ │prompt-       │       │
│  │ 域风险画像   │ │ schema/      │ │ framework/   │ │ library/     │       │
│  │ [NEW §37]    │ │ 域知识结构   │ │ 域评测框架   │ │ 域 Prompt 库 │       │
│  └──────────────┘ │ [NEW §37]    │ │ [NEW §37]    │ │ [NEW §37]    │       │
│                    └──────────────┘ └──────────────┘ └──────────────┘       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                        │
│  │recipes/      │ │interaction-  │ │governance/   │                        │
│  │ DomainRecipe │ │ policy/      │ │ 域治理       │                        │
│  │ 原型模板     │ │ 跨域交互策略 │ │ division-    │                        │
│  │ [NEW §38]    │ │ [NEW §37]    │ │  loader      │                        │
│  └──────────────┘ └──────────────┘ │ hr-role-gov  │                        │
│                                     └──────────────┘                        │
│  ┌──────────────┐ ┌──────────────┐                                         │
│  │  coding/     │ │ operations/  │  域实例示例                              │
│  │  代码开发域  │ │  运维域       │  (基于 registry 注册的具体业务域)       │
│  └──────────────┘ └──────────────┘                                         │
│                                                                              │
│  接入流: 业务方 ──▶ registry(注册 DomainDescriptor) ──▶                     │
│          risk-profile + knowledge + eval + prompt ──▶                       │
│          recipes(生成 Recipe) ──▶ platform/(P3 编排可用)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §十一 Layer 4 `interaction/` 智能交互层框架图

> **图类型: 结构图** — 表达 interaction/ 下各模块的归属与职责分区。不表达自然语言解析流水线与自主权状态机转换细节。
>
> 本层全部为新建模块（NEW），无老系统迁移文件。

```text
interaction/
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Layer 4: 智能交互层（用户侧操作系统）                         │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │   nl-gateway/ [§39]      │  │  goal-decomposer/ [§40]  │                 │
│  │   自然语言任务入口        │  │  目标分解引擎             │                 │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                 │
│  │  │ intent-parser/     │  │  │  │ planner/           │  │                 │
│  │  │  意图解析           │  │  │  │  template/LLM/     │  │                 │
│  │  │ slot-resolver/     │  │  │  │  hybrid/human      │  │                 │
│  │  │  槽位提取           │  │  │  │ dependency-graph/  │  │                 │
│  │  │ ambiguity-handler/ │  │  │  │  任务依赖 DAG      │  │                 │
│  │  │  歧义消解对话       │  │  │  │ validator/         │  │                 │
│  │  └────────────────────┘  │  │  │  分解结果校验      │  │                 │
│  └──────────────────────────┘  │  └────────────────────┘  │                 │
│                                 └──────────────────────────┘                 │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │  proactive-agent/ [§41]  │  │    autonomy/ [§42]       │                 │
│  │  主动 Agent 框架         │  │  渐进自主权模型           │                 │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                 │
│  │  │ trigger-engine/    │  │  │  │ trust-scorer/      │  │                 │
│  │  │  cron/event/thresh │  │  │  │  信任评分           │  │                 │
│  │  │ schedule-manager/  │  │  │  │ level-manager/     │  │                 │
│  │  │  调度管理           │  │  │  │  自主权级别状态机  │  │                 │
│  │  │ event-watcher/     │  │  │  │ promotion-engine/  │  │                 │
│  │  │  事件驱动唤醒       │  │  │  │  升降级规则引擎    │  │                 │
│  │  └────────────────────┘  │  │  └────────────────────┘  │                 │
│  └──────────────────────────┘  └──────────────────────────┘                 │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │   dashboard/ [§43]       │  │      ux/ [§44]           │                 │
│  │   统一运维看板           │  │   非技术用户体验          │                 │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                 │
│  │  │ metric-aggregator/ │  │  │  │ wizard/            │  │                 │
│  │  │  指标聚合           │  │  │  │  可视化域接入向导  │  │                 │
│  │  │ health-scorer/     │  │  │  │ template-engine/   │  │                 │
│  │  │  健康评分           │  │  │  │  可视化工作流搭建  │  │                 │
│  │  │ alert-router/      │  │  │  │ onboarding/        │  │                 │
│  │  │  告警路由           │  │  │  │  首次使用引导体验  │  │                 │
│  │  └────────────────────┘  │  │  └────────────────────┘  │                 │
│  └──────────────────────────┘  └──────────────────────────┘                 │
│                                                                              │
│  交互流:                                                                    │
│  用户自然语言 ──▶ nl-gateway(解析) ──▶ goal-decomposer(分解)               │
│  ──▶ platform/P3(编排) ──▶ autonomy(自主权控制)                            │
│  proactive-agent(主动触发) ──▶ nl-gateway ──▶ 编排                         │
│  dashboard ◀── P5(聚合展示)   ux ──▶ domains/(引导接入)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §十二 Layer 5 `org-governance/` 组织治理层框架图

> **图类型: 结构图** — 表达 org-governance/ 下各模块的归属与职责分区。不表达审批路由算法与 SCIM 同步协议细节。

```text
org-governance/
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Layer 5: 组织治理层                                     │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │   org-model/ [§46]       │  │ approval-routing/ [§47]  │                 │
│  │   组织层次模型           │  │  组织审批路由             │                 │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                 │
│  │  │ hierarchy/         │  │  │  │ route-engine/      │  │                 │
│  │  │  company/division/ │  │  │  │  org-chart/amount/ │  │                 │
│  │  │  department/team   │  │  │  │  SoD routing       │  │                 │
│  │  │ org-node/          │  │  │  │ escalation/        │  │                 │
│  │  │  CRUD + 继承       │  │  │  │  审批升级           │  │                 │
│  │  │ sync/              │  │  │  │ delegation/        │  │                 │
│  │  │  SCIM/HR-API/手动  │  │  │  │  请假代理           │  │                 │
│  │  └────────────────────┘  │  │  └────────────────────┘  │                 │
│  └──────────────────────────┘  └──────────────────────────┘                 │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │   sso-scim/ [§48]        │  │compliance-engine/ [§49]  │                 │
│  │   SSO/SCIM 集成          │  │  部门级合规策略引擎       │                 │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                 │
│  │  │ saml/              │  │  │  │ policy-resolver/   │  │                 │
│  │  │  SAML SSO          │  │  │  │  继承 + override   │  │                 │
│  │  │ oidc/              │  │  │  │ inheritance/       │  │                 │
│  │  │  OIDC SSO          │  │  │  │  子级只能收紧      │  │                 │
│  │  │ scim-sync/         │  │  │  │ audit-enforcer/    │  │                 │
│  │  │  用户/组同步        │  │  │  │  合规审计执行      │  │                 │
│  │  └────────────────────┘  │  │  └────────────────────┘  │                 │
│  └──────────────────────────┘  └──────────────────────────┘                 │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │knowledge-boundary/ [§50] │  │delegated-governance/[§51]│                 │
│  │  知识域隔离与受控共享    │  │  层级治理委托             │                 │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                 │
│  │  │ boundary-manager/  │  │  │  │ scope-manager/     │  │                 │
│  │  │  strict/controlled │  │  │  │  委托范围管理      │  │                 │
│  │  │  /open             │  │  │  │ delegation-        │  │                 │
│  │  │ sharing-gate/      │  │  │  │  registry/         │  │                 │
│  │  │  跨域共享网关      │  │  │  │  委托注册表        │  │                 │
│  │  │ access-log/        │  │  │  └────────────────────┘  │                 │
│  │  │  访问审计          │  │  └──────────────────────────┘                 │
│  │  └────────────────────┘  │                                                │
│  └──────────────────────────┘                                                │
│                                                                              │
│  治理流:                                                                    │
│  org-model(组织树) ──▶ approval-routing(审批路由)                           │
│  sso-scim(身份同步) ──▶ platform/P2/iam                                    │
│  compliance-engine ──▶ platform/P2/policy-center                           │
│  knowledge-boundary ──▶ platform/P5/knowledge(隔离控制)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §十三 Layer 6 `scale-ecosystem/` 规模化运行 + 生态层框架图

> **图类型: 结构图** — 表达 scale-ecosystem/ 下各模块的归属与职责分区。不表达跨 Region 数据同步协议与 SLA 分级算法细节。

```text
scale-ecosystem/
┌─────────────────────────────────────────────────────────────────────────────┐
│                  Layer 6: 规模化运行 + 生态层                                 │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │  multi-region/ [§52]     │  │ resource-manager/ [§53]  │                 │
│  │  多 Region 部署          │  │  资源竞争管理             │                 │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                 │
│  │  │ region-router/     │  │  │  │ fair-queue/        │  │                 │
│  │  │  Region 路由决策   │  │  │  │  加权公平队列      │  │                 │
│  │  │ data-replicator/   │  │  │  │ quota-enforcer/    │  │                 │
│  │  │  跨 Region 数据同步│  │  │  │  配额执行          │  │                 │
│  │  │ failover-ctrl/     │  │  │  │ preemption/        │  │                 │
│  │  │  Region 故障切换   │  │  │  │  优先级抢占        │  │                 │
│  │  └────────────────────┘  │  │  └────────────────────┘  │                 │
│  └──────────────────────────┘  └──────────────────────────┘                 │
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │   sla-engine/ [§54]      │  │   marketplace/ [§55]     │                 │
│  │   SLA 分级保障引擎       │  │   Agent 市场与生态        │                 │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │                 │
│  │  │ tier-resolver/     │  │  │  │ catalog/           │  │                 │
│  │  │  SLA 级别解析      │  │  │  │  市场目录           │  │                 │
│  │  │ resource-allocator/│  │  │  │ certification/     │  │                 │
│  │  │  资源分配          │  │  │  │  认证与安全扫描    │  │                 │
│  │  │ breach-detector/   │  │  │  │ publisher/         │  │                 │
│  │  │  SLA 违约检测      │  │  │  │  发布管理          │  │                 │
│  │  └────────────────────┘  │  │  │ billing-service    │  │                 │
│  └──────────────────────────┘  │  │ marketplace-gov    │  │                 │
│                                 │  └────────────────────┘  │                 │
│  ┌──────────────────────────┐  └──────────────────────────┘                 │
│  │  feedback-loop/ [§56]    │                                                │
│  │  反馈驱动持续改进        │  ┌──────────────────────────┐                 │
│  │  ┌────────────────────┐  │  │  integration/ [§57]      │                 │
│  │  │ collector/         │  │  │  外部系统集成框架        │                 │
│  │  │  信号采集           │  │  │  ┌────────────────────┐  │                 │
│  │  │ analyzer/          │  │  │  │ connector-registry/ │  │                 │
│  │  │  信号分析           │  │  │  │  连接器注册         │  │                 │
│  │  │ improvement-       │  │  │  │ connector-runtime/  │  │                 │
│  │  │  tracker/          │  │  │  │  连接器运行时       │  │                 │
│  │  │  改进跟踪          │  │  │  │ health-monitor/     │  │                 │
│  │  └────────────────────┘  │  │  │  连接器健康监控     │  │                 │
│  └──────────────────────────┘  │  └────────────────────┘  │                 │
│                                 └──────────────────────────┘                 │
│  规模化流:                                                                  │
│  multi-region ──▶ platform/P4/ha(跨 Region 协调)                           │
│  resource-manager ──▶ platform/P4/dispatcher(配额+抢占)                    │
│  sla-engine ──▶ resource-manager(按 SLA 分配)                              │
│  marketplace ──▶ domains/registry(Agent 上架)                              │
│  feedback-loop ◀── P5/events(信号采集) ──▶ ops-maturity/(改进)            │
│  integration ──▶ platform/P4/tool-executor(外部连接器)                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §十四 Layer 7 `ops-maturity/` 运营成熟度层框架图

> **图类型: 结构图** — 表达 ops-maturity/ 下 11 个模块的归属与职责分区。不表达证据链采集流水线与漂移检测算法细节。
>
> 本层含 11 个模块，是系统能力的 "顶层封装"，大部分为新建。

```text
ops-maturity/
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Layer 7: 运营成熟度层                                    │
│                                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐               │
│  │explainability/  │ │  emergency/     │ │agent-lifecycle/ │               │
│  │ 可解释性 [§59]  │ │  紧急制动 [§60] │ │ Agent 生命周期  │               │
│  │ evidence-       │ │  panic-ctrl     │ │  [§61]          │               │
│  │  collector      │ │  forensic-      │ │ agent-registry  │               │
│  │ causal-chain    │ │   snapshot      │ │ version-mgr     │               │
│  │ explanation-    │ │  resume-        │ │ canary-ctrl     │               │
│  │  renderer/cache │ │   protocol      │ │ retirement      │               │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘               │
│                                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐               │
│  │ edge-runtime/   │ │drift-detection/ │ │ cost-optimizer/ │               │
│  │  离线/边缘 [§62]│ │ 行为漂移 [§63]  │ │ 成本优化 [§64]  │               │
│  │ edge-orchestratr│ │ fingerprint     │ │ attribution     │               │
│  │ edge-executor   │ │ changepoint     │ │ recommendation  │               │
│  │ local-model     │ │ cross-agent     │ │ simulator       │               │
│  │ sync-queue      │ │ evolution-*     │ │                 │               │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘               │
│                                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐               │
│  │workflow-debugger│ │compliance-      │ │capacity-planner/│               │
│  │ 可视化调试[§65] │ │ reporter/ [§66] │ │ 容量规划 [§67]  │               │
│  │ timeline-render │ │ template-reg    │ │ trend-analyzer  │               │
│  │ breakpoint-mgr  │ │ evidence-mapper │ │ forecaster      │               │
│  │ run-comparator  │ │ report-renderer │ │ simulator       │               │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘               │
│                                                                              │
│  ┌─────────────────┐ ┌──────────────────────────────────┐                   │
│  │  multimodal/    │ │   platform-ops-agent/ [§69]      │                   │
│  │  多模态 [§68]   │ │   平台自运维 Agent                │                   │
│  │ image-processor │ │  ┌─────────────┐ ┌────────────┐  │                   │
│  │ speech-process  │ │  │incident-    │ │config-     │  │                   │
│  │ document-parser │ │  │ diagnoser   │ │ optimizer  │  │                   │
│  │ modality-router │ │  │capacity-    │ │dev-        │  │                   │
│  └─────────────────┘ │  │ predictor   │ │ assistant  │  │                   │
│                       │  │health-      │ └────────────┘  │                   │
│                       │  │ monitor     │                  │                   │
│                       │  └─────────────┘                  │                   │
│                       └──────────────────────────────────┘                   │
│                                                                              │
│  运营流:                                                                    │
│  explainability ◀── P5/events+artifacts(采集证据链)                         │
│  emergency ──▶ platform/P2/incident-control(全局制动)                       │
│  drift-detection ◀── P5/events(行为指纹对比)                               │
│  platform-ops-agent ──▶ 自身调用 platform/ 各平面(自运维闭环)              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §十五 跨层模块框架图（plugins · sdk · apps）

> **图类型: 结构图** — 表达 plugins/ · sdk/ · apps/ 的模块归属与跨层调用入口。不表达插件沙箱隔离机制与 CLI 命令实现细节。

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           跨层模块                                           │
│                                                                              │
│  ┌───────────────────────────────────────┐                                  │
│  │  plugins/  插件生态系统                │                                  │
│  │                                        │                                  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────┐ │                                  │
│  │  │adapters/ │ │planners/ │ │present-│ │                                  │
│  │  │ asset    │ │ basic-   │ │ ers/   │ │                                  │
│  │  │ crm      │ │ planner  │ │coding  │ │                                  │
│  │  │ game-dev │ └──────────┘ │growth  │ │                                  │
│  │  │ github   │ ┌──────────┐ │ops     │ │                                  │
│  │  │ livestrm │ │retriever│ └────────┘ │                                  │
│  │  └──────────┘ │ asset   │ ┌────────┐ │                                  │
│  │                │ coding  │ │validat-│ │                                  │
│  │                │ game    │ │ ors/   │ │                                  │
│  │                │ growth  │ │basic-  │ │                                  │
│  │                │ livestrm│ │eval    │ │                                  │
│  │                │ ops     │ └────────┘ │                                  │
│  │                └──────────┘            │                                  │
│  │  builtin-plugin-registry               │                                  │
│  └───────────────────────────────────────┘                                  │
│                                                                              │
│  ┌───────────────────────────────────────┐  ┌──────────────────────────┐    │
│  │  sdk/  SDK 与开发者体验                │  │  apps/  应用入口         │    │
│  │                                        │  │                          │    │
│  │  ┌──────────┐ ┌──────────┐            │  │  ┌────────────────────┐ │    │
│  │  │pack-sdk/ │ │plugin-   │            │  │  │  api/              │ │    │
│  │  │ Pack 开发│ │ sdk/     │            │  │  │  API Server 入口   │ │    │
│  │  │  SDK     │ │ Plugin   │            │  │  ├────────────────────┤ │    │
│  │  └──────────┘ │  开发SDK │            │  │  │  console/          │ │    │
│  │  ┌──────────┐ └──────────┘            │  │  │  Console UI 入口   │ │    │
│  │  │client-   │ ┌──────────┐            │  │  ├────────────────────┤ │    │
│  │  │ sdk/     │ │  cli/    │            │  │  │  workers/          │ │    │
│  │  │ REST +   │ │  78 CLI  │            │  │  │  Worker 进程入口   │ │    │
│  │  │ WebSocket│ │  scripts │            │  │  └────────────────────┘ │    │
│  │  └──────────┘ └──────────┘            │  └──────────────────────────┘    │
│  └───────────────────────────────────────┘                                  │
│                                                                              │
│  调用关系:                                                                  │
│  apps/api ──▶ platform/P1/api(启动 HTTP 服务)                              │
│  apps/workers ──▶ platform/P4/worker-pool(启动 Worker 进程)                │
│  apps/console ──▶ platform/P1/console-backend(启动控制台)                  │
│  sdk/cli ──▶ platform/ 各模块(CLI 命令入口)                                │
│  plugins/* ──▶ domains/registry(通过 SPI 注册)                             │
│             ──▶ platform/P4/plugin-executor(沙箱执行)                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §十六 端到端数据流全景图

> **图类型: 数据流图** — 表达用户请求从 P1 到 P5 的完整信号传递路径，以及上层系统的事件订阅关系。不表达模块内部处理逻辑与错误分支。

```text
                        ┌──────────────┐
                        │   用户/外部   │
                        └──────┬───────┘
                               │ HTTP / WebSocket / Webhook / Channel
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ P1 Interface   ingress ──▶ api / webhook / channel-gateway / scheduler      │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ request-envelope
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ P2 Control     iam(鉴权) ──▶ policy(评估) ──▶ approval(审批)                │
│                config-center(配置) · incident-control(异常管控)              │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ control-directive
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ P3 Orchestrate routing ──▶ planner ──▶ oapeflir(O-A-P-E-F-L-I-R)           │
│                hitl(人机协作) · escalation(升级) · replan(重规划)            │
│                prompt-engine(渲染 Prompt) · model-gateway(选择模型)          │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ execution-plan
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ P4 Execution   dispatcher ──▶ lease ──▶ worker-pool ──▶ execution-engine    │
│                ──▶ tool-executor / plugin-executor                           │
│                state-transition · recovery · ha · hot-upgrade                │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ state-command / execution-receipt
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ P5 State       truth(持久化) ──▶ events(事件广播) ──▶                        │
│                projections(查询视图) · artifacts(制品) · memory(记忆)        │
│                knowledge(知识) · audit(审计) · checkpoints(检查点)           │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ events / query
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Layer 4      │ │ Layer 6      │ │ Layer 7      │
    │ interaction/ │ │ scale-       │ │ ops-maturity/ │
    │ dashboard    │ │ ecosystem/   │ │ explainability│
    │ autonomy     │ │ feedback-    │ │ drift-detect  │
    │              │ │  loop        │ │ compliance-rpt│
    └──────────────┘ └──────────────┘ └──────────────┘
```

---

## §十七 依赖方向与分层约束图

> **图类型: 约束图** — 表达各层之间允许和禁止的依赖方向，以及同层解耦方式。不表达具体的 import 路径与运行时调用链。

```text
依赖方向规则: 上层可依赖下层，下层不可依赖上层；同层通过事件/契约解耦。

  ┌─────────────────────────────────────────────────┐
  │  Layer 7  ops-maturity/                          │  可依赖 ──▶ L1-6
  │  (11 modules)                                    │
  ├─────────────────────────────────────────────────┤
  │  Layer 6  scale-ecosystem/                       │  可依赖 ──▶ L1-5
  │  (6 modules)                                     │
  ├─────────────────────────────────────────────────┤
  │  Layer 5  org-governance/                        │  可依赖 ──▶ L1-4
  │  (6 modules)                                     │
  ├─────────────────────────────────────────────────┤
  │  Layer 4  interaction/                           │  可依赖 ──▶ L1-3
  │  (6 modules, ALL NEW)                            │
  ├─────────────────────────────────────────────────┤
  │  Layer 3  domains/                               │  可依赖 ──▶ L1-2
  │  (10 modules)                                    │
  ├─────────────────────────────────────────────────┤
  │  Layer 1-2  platform/                            │  仅依赖 contracts/ shared/
  │  (P1-P5 + model-gw + prompt + compliance)        │
  │  (contracts/ + shared/)                          │
  └─────────────────────────────────────────────────┘

  跨层模块:
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ plugins/ │ │   sdk/   │ │  apps/   │  可依赖任意层（通过 interface 注入）
  └──────────┘ └──────────┘ └──────────┘

  禁止方向 (✗):
  ✗  platform/ ──▶ interaction/       (下层不可依赖上层)
  ✗  platform/ ──▶ org-governance/    (下层不可依赖上层)
  ✗  domains/  ──▶ scale-ecosystem/   (下层不可依赖上层)

  同层解耦方式:
  ┌──────────┐  events/contracts   ┌──────────┐
  │ Module A │ ◀═══════════════▶  │ Module B │  (同一层内通过 event bus 或
  └──────────┘                     └──────────┘   platform/contracts/ 通信)
```

---

## §十八 稳定性七层模型框架图

> **图类型: 结构图** — 表达稳定性七层模型的层级划分与各层包含的能力模块。不表达各层间的运行时触发顺序与降级决策逻辑。
>
> 稳定性七层模型横切五平面，是 X1 Reliability & Security Fabric 的实现骨架。

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       稳定性七层模型 (§9)                                     │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────┐       │
│  │  层 7: 可观测性  Observability                                     │       │
│  │  structured-logger · otel-tracer · metrics · health · diagnostics │       │
│  │  sli-collection · slo-alerting · anomaly-detection                │       │
│  │  agent-state-view · task-board · situation-report                  │       │
│  ├───────────────────────────────────────────────────────────────────┤       │
│  │  层 6: 恢复能力  Recovery                                          │       │
│  │  lease-reclaim · execution-recovery · workflow-recovery            │       │
│  │  replay · repair · projection-rebuild · stalled-detection          │       │
│  ├───────────────────────────────────────────────────────────────────┤       │
│  │  层 5: 降级模式  Degradation                                       │       │
│  │  full_auto ──▶ supervised_auto ──▶ read_only ──▶ manual_only     │       │
│  │  no-write · no-external-call · no-rollout · incident-mode         │       │
│  ├───────────────────────────────────────────────────────────────────┤       │
│  │  层 4: 断路器  Circuit Breaker                                     │       │
│  │  closed ──▶ open ──▶ half-open (对 API/Provider/Tool/Plugin)      │       │
│  │  per-provider · per-tool · per-external-api                       │       │
│  ├───────────────────────────────────────────────────────────────────┤       │
│  │  层 3: 超时与重试  Timeout & Retry                                 │       │
│  │  step-timeout · attempt-timeout · tool-timeout                    │       │
│  │  exponential-backoff + jitter · max-retries                       │       │
│  ├───────────────────────────────────────────────────────────────────┤       │
│  │  层 2: 限流与背压  Rate Limiting & Backpressure                    │       │
│  │  per-tenant concurrency · per-workflow active                     │       │
│  │  Level 0(正常) ──▶ Level 1(预警) ──▶ Level 2(限流) ──▶ Level 3(保护) │   │
│  ├───────────────────────────────────────────────────────────────────┤       │
│  │  层 1: 隔离  Isolation                                             │       │
│  │  tenant · project · domain · worker-pool · executor               │       │
│  │  sandbox · process-isolation · network-namespace                   │       │
│  └───────────────────────────────────────────────────────────────────┘       │
│                                                                              │
│  稳定性演练 (platform/shared/stability/):                                   │
│  30+ rehearsal scenarios:                                                    │
│  golden-task · vcr-replay · dispatch · worker · lease · concurrency         │
│  queue · event · chaos · prompt-injection · rolling-upgrade · rollback       │
│  backup · maintenance · gray-release · db-writability · db-queue-disconnect │
│  migration · runtime-soak · cross-division                                  │
│                                                                              │
│  触发方式:                                                                  │
│  CI/CD 自动 ──▶ golden-task-runner ──▶ stable-acceptance-line              │
│  手动 ──▶ npm run test:golden / npm run *:stable                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## §十九 P4 Runtime Bounded Context 专项图

> **图类型: 结构图** — 表达 P4 Execution Plane 内 `core/runtime/` 拆分为 12 个 Bounded Context 的归属与依赖关系。不表达各 BC 内部类/方法级实现细节。
>
> **背景**: 老系统 `core/runtime/` 为单体模块（101 文件 / 30K 行），需拆分为独立 BC 以降低耦合。6 个 BC 零内部依赖（可独立提取），2 个为组合根（保留在 runtime/ 核心）。

### §十九.1 BC 归属与依赖图

```text
platform/execution/
┌─────────────────────────────────────────────────────────────────────────────┐
│                    P4 Execution Plane — 12 Bounded Contexts                  │
│                                                                              │
│  ══════════ 独立提取区 (零内部依赖，Wave 1-2 优先提取) ══════════           │
│                                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐               │
│  │ BC3 Worker Mgmt │ │ BC5 HA Coord    │ │ BC6 Hot Upgrade │               │
│  │ (10 files)      │ │ (8 files)       │ │ (6 files)       │               │
│  │ worker-registry │ │ leader-election │ │ zero-downtime   │               │
│  │ load-balancing  │ │ cluster-member  │ │ repository      │               │
│  │ health-track    │ │ failover-ctrl   │ │ upgrade-factory │               │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘               │
│                                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐               │
│  │ BC8 State Trans │ │ BC11 Infra      │ │ BC12 HITL & Gov │               │
│  │ (4 files)       │ │ (13 files)      │ │ (2 files)       │               │
│  │ state-machine   │ │ rate-limiter    │ │ hitl-explain    │               │
│  │ transition-svc  │ │ resource-mon    │ │ call-governance │               │
│  │                 │ │ startup-check   │ │ admission-ctrl  │               │
│  └────────┬────────┘ │ graceful-shutdn │ └─────────────────┘               │
│           │          └─────────────────┘                                     │
│           │ (唯一被依赖)                                                     │
│  ══════════ 有序提取区 (有限依赖，Wave 2-3) ══════════                      │
│           │                                                                  │
│  ┌────────┴────────┐ ┌─────────────────┐                                    │
│  │ BC9 Agent Exec  │ │ BC2 Lease Mgmt  │                                    │
│  │ (12 files)      │ │ (8 files)       │                                    │
│  │ agent-executor  │ │ lease-lifecycle │                                    │
│  │ middleware-chain│ │ lease-compete   │                                    │
│  │ model-call      │ │ lease-repo      │                                    │
│  │ loop-detection  │ └────────┬────────┘                                    │
│  └─────────────────┘          │                                              │
│                                │                                              │
│  ┌─────────────────────────────┴───────────────────────────────┐             │
│  │ BC4 Handshake/Writeback (10 files) — 依赖 BC1 + BC2        │             │
│  │ worker-handshake · capability-negotiate · result-writeback  │             │
│  └─────────────────────────────────────────────────────────────┘             │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────┐             │
│  │ BC7 Recovery & Repair (13 files) — 依赖 BC1+BC2+BC5+BC8    │             │
│  │ crash-recovery · stall-detection · orphan-cleanup · replay  │             │
│  │ repair · deviation-detect · escalation                      │             │
│  └─────────────────────────────────────────────────────────────┘             │
│                                                                              │
│  ══════════ 组合根 (保留在 runtime/ 核心，Wave 4 精简) ══════════           │
│                                                                              │
│  ┌──────────────────────────────┐ ┌──────────────────────────────┐          │
│  │ BC1 Execution Dispatch       │ │ BC10 Multi-Step Orchestration│          │
│  │ (12 files) — 组合根          │ │ (13 files) — 组合根           │          │
│  │ dispatch-service · reconcile │ │ phase-mgmt · complexity-route│          │
│  │ dispatch-async · support     │ │ session-lifecycle · planner  │          │
│  └──────────────────────────────┘ │ supervisor · checkpoint      │          │
│                                    └──────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### §十九.2 提取波次计划

```text
Wave 1 (零风险)    BC3 + BC5 + BC6 + BC8              6,136 行  20%
                    验证门: 各 BC 单元测试独立通过
                          │
Wave 2 (低风险)    BC2 + BC9 + BC12 + BC11             6,461 行  21%
                    验证门: Lease/Agent 集成测试通过
                          │
Wave 3 (中风险)    BC4 + BC7                           5,678 行  19%
                    验证门: Recovery 演练场景通过
                          │
Wave 4 (收尾)      BC1 + BC10 精简为 runtime/ 核心      5,171 行  17%
                    验证门: npm test 全量回归 + stable-* 通过
```

---

## §二十 P5 Storage Bounded Context 专项图

> **图类型: 结构图** — 表达 P5 State & Evidence Plane 内 `AuthoritativeTaskStore` 拆分为 7 个 Bounded Context 的归属与通信规则。不表达各 BC 内部 SQL 表结构与查询细节。
>
> **背景**: 老系统 `AuthoritativeTaskStore` 为 god object（~278 方法 + 21 Repository + ~123 消费方），需拆分为独立 BC 并通过 Event Bus 通信。

### §二十.1 BC 归属图

```text
platform/state-evidence/
┌─────────────────────────────────────────────────────────────────────────────┐
│               P5 — AuthoritativeTaskStore 7 BC 拆分                          │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ BC1 Core Task Engine (~73 方法)                                      │   │
│  │ Repositories: task · workflow · execution · session                   │   │
│  │ 职责: 任务生命周期 · 工作流状态 · 执行管理 · 会话控制                │   │
│  │ 策略: 保留为核心 — 内部方法耦合度高，不再细拆                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────┐  ┌────────────────────────┐                       │
│  │ BC2 Worker Infra     │  │ BC3 Event Infra (~24)  │                       │
│  │ (~47 方法)            │  │ Repo: event             │                       │
│  │ Repos: worker ·      │  │ 职责: 事件发布 · 确认 · │                       │
│  │  dispatch · lease ·  │  │  DLQ · 持久化总线 ·     │                       │
│  │  lock                │  │  类型注册                │                       │
│  │ 职责: 调度分配 ·     │  │ 策略: 边界清晰，         │                       │
│  │  租约 · 分布式锁 ·   │  │  直接提取               │                       │
│  │  Worker 注册          │  └────────────────────────┘                       │
│  │ 策略: 独立域提取      │                                                    │
│  └──────────────────────┘  ┌────────────────────────┐                       │
│                              │ BC4 Billing & Cost     │                       │
│  ┌──────────────────────┐  │ (~29 方法)              │                       │
│  │ BC5 Governance &     │  │ Repo: billing            │                       │
│  │  Compliance (~50)    │  │ 职责: 账户 · 发票 ·     │                       │
│  │ Repos: approval ·   │  │  配额 · 用量 · 账本     │                       │
│  │  organization ·      │  │ 策略: 与核心执行解耦     │                       │
│  │  secret · compliance│  └────────────────────────┘                       │
│  │  · operations        │                                                    │
│  │ 职责: 审批路由 ·     │  ┌────────────────────────┐                       │
│  │  组织层级 · 密钥 ·   │  │ BC6 Platform & Commerce│                       │
│  │  合规 · 运营治理      │  │ (~47 方法)              │                       │
│  │ 策略: 对齐 L5        │  │ Repos: marketplace ·   │                       │
│  └──────────────────────┘  │  release · division ·  │                       │
│                              │  intelligence ·        │                       │
│  ┌──────────────────────┐  │  evolution              │                       │
│  │ BC7 Memory &         │  │ 策略: 对齐 L6-L7       │                       │
│  │  Artifacts (~10)     │  └────────────────────────┘                       │
│  │ Repos: memory ·     │                                                    │
│  │  artifact             │                                                    │
│  │ 职责: 记忆 CRUD ·    │                                                    │
│  │  质量管理 · 制品 ·   │                                                    │
│  │  版本管理             │                                                    │
│  │ 策略: 对齐 L4        │                                                    │
│  └──────────────────────┘                                                    │
│                                                                              │
│  ──── BC 间通信规则 ────                                                     │
│  BC1 ◀══ Event Bus (BC3) ══▶ BC2/BC4/BC5/BC6/BC7                           │
│  禁止 BC 间直接 import；仅通过事件 + 契约通信                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### §二十.2 拆分波次计划

```text
Wave 1 (低风险)    BC3 Event Infra → BC7 Memory & Artifacts
                    验证门: 所有 event 相关测试通过
                          │
Wave 2 (中风险)    BC4 Billing & Cost → BC2 Worker Infra
                    验证门: 所有 dispatch/lease 相关测试通过
                          │
Wave 3 (高风险)    BC5 Governance & Compliance → BC6 Platform & Commerce
                    验证门: 所有 organization/approval/marketplace 测试通过
                          │
Wave 4 (收尾)      移除 Facade；BC1 Core Task Engine 成为独立模块
                    验证门: npm test 全量通过 + stable-* 演练通过
```

---

## §二一 横切能力控制面图

> **图类型: 结构图** — 表达三类横切能力（X1 稳定性 · X2 可观测性 · X3 安全合规）如何跨越五平面提供统一服务。不表达各横切能力的内部实现与配置参数。

```text
                    P1 Interface  P2 Control  P3 Orchestr  P4 Execution  P5 State
                    ───────────  ──────────  ───────────  ────────────  ────────
┌──────────────┐
│ X1 Reliability│   sandbox      incident    escalation    circuit-     recovery
│ & Security    │   rate-limit   policy-     replan        breaker      checkpoint
│ Fabric        │   auth-guard   enforcement               timeout      lease
│               │                                           backpressure
├──────────────┤
│ X2 Observ-   │   access-log   config-     oapeflir-     execution-   event-
│ ability       │   request-     audit       trace         resource-    audit
│ Stack         │    trace                                  monitor      projection
│               │   ingress-     sli/slo     step-trace    worker-      rebuild-
│               │    metrics                                health       job-log
├──────────────┤
│ X3 Compliance│   data-        approval-   prompt-       tool-        erasure
│ & Governance  │    residency   sla         injection-    sandbox-     encryption
│               │   field-       org-policy  guard         policy       data-
│               │    encrypt                                            lineage
└──────────────┘

横切能力供给方式:
  X1 → platform/shared/stability/ + platform/execution/ 各 BC 内嵌
  X2 → platform/shared/observability/ 统一注入 (structured-logger · otel · metrics)
  X3 → platform/compliance/ + org-governance/compliance-engine/
```

---

## §二二 老系统模块 → 新平台落点图

> **图类型: 结构图** — 表达老系统 `src/core/` 42 个模块迁移到新平台 7 层架构的落点映射。不表达迁移步骤与时间顺序（见 §二三）。

```text
老系统 src/core/ (42 模块)              新平台 src/ (7 层 + 跨层)
═══════════════════════              ═══════════════════════════

types ─────────────────────────────▶ platform/contracts/types
errors ────────────────────────────▶ platform/contracts/errors
constants ─────────────────────────▶ platform/contracts/constants
results ───────────────────────────▶ platform/contracts/result-envelope
utils ─────────────────────────────▶ platform/shared/utils
lifecycle ─────────────────────────▶ platform/shared/lifecycle
cache ─────────────────────────────▶ platform/shared/cache

config ────────────────────────────▶ platform/control-plane/config-center (P2)
api ───────────────────────────────▶ platform/interface/api (P1)
storage ───────────────────────────▶ platform/state-evidence/ (P5, 7 BC 拆分)
events ────────────────────────────▶ platform/state-evidence/events (P5 BC3)
locking ───────────────────────────▶ platform/execution/ (P4)
queue ─────────────────────────────▶ platform/execution/ (P4)
resource ──────────────────────────▶ platform/execution/ (P4)

runtime ───────────────────────────▶ platform/execution/ (P4, 12 BC 拆分)
agent-loop ────────────────────────▶ platform/orchestration/oapeflir (P3)
planning ──────────────────────────▶ platform/orchestration/planner (P3)
orchestration ─────────────────────▶ platform/orchestration/routing (P3)
providers ─────────────────────────▶ platform/model-gateway/
tools ─────────────────────────────▶ platform/execution/tool-executor/
workflow ──────────────────────────▶ platform/orchestration/oapeflir/workflow/
artifacts ─────────────────────────▶ platform/state-evidence/artifacts (P5 BC7)
feedback ──────────────────────────▶ scale-ecosystem/feedback-loop (L6)
learning ──────────────────────────▶ scale-ecosystem/feedback-loop (L6)
evaluation ────────────────────────▶ platform/prompt-engine/eval/ (L7)

domain-registry ───────────────────▶ domains/registry (L3)
divisions ─────────────────────────▶ domains/governance (L3)
plugins ───────────────────────────▶ plugins/ (跨层)

memory ────────────────────────────▶ platform/state-evidence/memory/ (L5)
knowledge ─────────────────────────▶ interaction/knowledge (L4, 新建 wrapper)
messages ──────────────────────────▶ interaction/message (L4)
gateway ───────────────────────────▶ platform/interface (P1) + interaction/nl-gw (L4)

security ──────────────────────────▶ platform/control-plane/iam/ (L5)
approvals ─────────────────────────▶ org-governance/approval-routing (L5)
compliance ────────────────────────▶ org-governance/compliance-engine (L5)
cost ──────────────────────────────▶ org-governance/cost (L5)
hr ────────────────────────────────▶ org-governance/org-model (L5)

deployment ────────────────────────▶ scale-ecosystem/multi-region (L6)
improvement ───────────────────────▶ scale-ecosystem/feedback-loop (L6)
product ───────────────────────────▶ scale-ecosystem/marketplace (L6)

observability ─────────────────────▶ ops-maturity/observability (L7, 新建 wrapper)
ops ───────────────────────────────▶ ops-maturity/platform-ops-agent (L7)
stability ─────────────────────────▶ ops-maturity/stability (L7, 新建 wrapper)
evolution ─────────────────────────▶ ops-maturity/evolution (L7)
reliability ───────────────────────▶ ops-maturity/reliability (L7)

cli ───────────────────────────────▶ sdk/cli (跨层)
```

### §二二.1 迁移类型统计

| 映射类型 | 模块数 | 说明 |
|----------|--------|------|
| 1:1 直迁 | ~8 | types, errors, constants, utils 等共享内核 |
| 1:1 改造 | ~16 | config, api, security 等需适配新契约 |
| 1:N 拆分 | 2 | runtime (→12 BC) · storage (→7 BC) |
| 语义重定义 | ~6 | gateway, evaluation 等职责边界重划 |
| 仅参考 | ~3 | 部分模块代码不迁移，仅参考设计 |

---

## §二三 迁移波次路线图

> **图类型: 时序图** — 表达十阶段代码迁移的先后顺序与依赖关系。不表达各阶段的内部任务分解。

```text
         P0 Test Helpers (19 files, 0.5 pd)
          │
          ▼
         P1 Shared Kernel — types/errors/constants/utils/results/lifecycle
          │  (68 files, 1.5 pd)
          │
          ▼
         P2 Infra Foundation — storage/events/config/locking/queue/cache
          │  (325 files, 7 pd)
          │
    ┌─────┴─────┐
    ▼           ▼
   P3 Security   P4 AI Ops Primitives
   & Governance   providers/tools/workflow/artifacts
   (141 files,    (163 files, 4.5 pd)
    3.5 pd)       │
    │             │
    └──────┬──────┘
           ▼
          P5 Runtime Core (12 BC 拆分，4 个子波次)
           │  (264 files, 10 pd) ← 最高风险阶段
           │
           ▼
          P6 OAPEFLIR Pipeline
           │  (119 files, 3.5 pd)
           │
     ┌─────┴─────┐
     ▼           ▼
    P7 Interaction  P8 Business Domain
    Layer            domain-registry/divisions/plugins
    (124 files,      (78 files, 2.5 pd)
     4 pd)           │
     │               │
     └───────┬───────┘
             ▼
            P9 Operational Maturity
             │  (271 files, 7 pd)
             │
             ▼
            P10 CLI + E2E + Golden + Perf
                (146 files, 4 pd)

总计: ~1,868 files / ~406K lines / 70-100 person-days
(不含 24 个全新模块开发)
```

### §二三.1 双轨并行策略

```text
Lane A (迁移)           Lane B (新能力)
═══════════           ═══════════════
P0-P2 ──────────────▶ P0-base: 6 个基础新模块 (stub 接口先行)
P3-P5 ──────────────▶ P1-diff: 10 个差异化新模块
P6-P10 ─────────────▶ P2-enhance: 8 个增强新模块

可提前启动的新模块 (stub 接口):
  org-hierarchy (stub 单级组织)
  autonomy (stub 最低自主权级别)
  nl-gateway (stub 直通模式)

必须等待迁移完成的新模块:
  agent-lifecycle (依赖 P6 OAPEFLIR)
  multi-region (依赖 P5 HA Coordinator)
  marketplace (依赖 P8 domain-registry)
```

---

## §二四 交互 · 治理 · 平台 三轴协作图

> **图类型: 数据流图** — 表达 interaction (L4) · org-governance (L5) · platform (L1-2) 三个主要系统轴之间的协作信号流。不表达各轴内部模块间的调用关系。

```text
                         ┌──────────────────────┐
                         │   interaction/ (L4)   │
                         │   智能交互层           │
                         │   nl-gateway           │
                         │   goal-decomposer      │
                         │   proactive-agent      │
                         │   autonomy             │
                         │   dashboard · ux       │
                         └──────────┬─────────────┘
                                    │
               任务请求 (经 NL 解析) │  ▲ 状态推送 (dashboard 订阅 P5 事件)
                                    │  │
                                    ▼  │
┌──────────────────────┐  契约调用  ┌──┴───────────────────────────────────┐
│  org-governance/ (L5)│ ◀════════▶│           platform/ (L1-2)           │
│  组织治理层           │           │           平台内核                    │
│                       │           │                                      │
│  org-model            │ SSO 身份  │  P1 Interface ──▶ P2 Control        │
│  approval-routing ────┼──────────▶│  P2 ──▶ P3 Orchestration            │
│  sso-scim             │ 审批结果  │  P3 ──▶ P4 Execution                │
│  compliance-engine ───┼──────────▶│  P4 ──▶ P5 State & Evidence         │
│  knowledge-boundary   │ 合规策略  │                                      │
│  delegated-governance │           │  AI Runtime Support Stack            │
└──────────────────────┘           │  (model-gw · prompt · compliance)   │
                                    └─────────────────────────────────────┘

信号流说明:
  interaction/ ══任务══▶ platform/P1 (用户请求入口)
  interaction/ ◀══事件══ platform/P5 (dashboard 数据源)
  org-governance/ ══身份══▶ platform/P2/iam (SSO/SCIM 同步)
  org-governance/ ══审批══▶ platform/P3/hitl (审批结果回写)
  org-governance/ ══策略══▶ platform/P2/policy-center (合规策略下发)
  platform/ ══查询══▶ org-governance/knowledge-boundary (知识隔离控制)
  
三轴协作不变量:
  1. interaction/ 和 org-governance/ 不直接通信；通过 platform/ 中转
  2. platform/ 不主动调用上层系统；仅通过事件通知
  3. 所有跨轴通信使用 platform/contracts/ 定义的信封格式
```

---

## 附录 A: 模块统计汇总

> 统计口径: 规划口径，非最终落地文件数。含迁移映射与新建占位模块估算。

| 顶层目录 | 层级 | 二级模块数 | 迁移文件 | 新建文件 | 合计 |
|----------|------|-----------|---------|---------|------|
| `platform/` | Layer 1-2 | 10 (含 P1-P5 + AI Ops + contracts + shared) | ~608 | ~53 | ~661 |
| `domains/` | Layer 3 | 10 | ~18 | ~8 | ~26 |
| `interaction/` | Layer 4 | 6 | 0 | ~24 | ~24 |
| `org-governance/` | Layer 5 | 6 | ~2 | ~18 | ~20 |
| `scale-ecosystem/` | Layer 6 | 6 | ~27 | ~18 | ~45 |
| `ops-maturity/` | Layer 7 | 11 | ~12 | ~44 | ~56 |
| `plugins/` | 跨层 | 5 | ~20 | 0 | ~20 |
| `sdk/` | 跨层 | 4 | ~78 | ~5 | ~83 |
| `apps/` | 入口 | 3 | 0 | ~3 | ~3 |
| **src/ 总计** | | **61** | **~765** | **~173** | **~938** |

## 附录 B: 高风险拆分统计

| 拆分目标 | Bounded Contexts | 方法/文件数 | 估算工期 |
|----------|-----------------|------------|----------|
| P4 `core/runtime/` | 12 BC | 101 files / 30K lines | ~20 person-days |
| P5 `AuthoritativeTaskStore` | 7 BC | ~278 methods / 21 repos | ~20 person-days |

## 附录 C: 图集索引

| 章节 | 图类型 | v1.1 变更说明 |
|------|--------|--------------|
| §一 | 结构图 | 修正视觉权重；分三视觉带 |
| §二 | 数据流图 | 标注 AI 运营为并列支撑 |
| §三 | 结构图 | 拆分 3 个职责区 |
| §四 | 结构图 | 重组为 4 个区域 |
| §五 | 结构图 | 增加模块边界规则表 |
| §六 | 结构图 + 时序图 | 拆分为 3 张独立图 |
| §七 | 结构图 | **重写**: 7 BC 分组 + Truth/Derived/Evidence 三区 |
| §八 | 结构图 | **重写**: 重命名 + 并列支撑定位说明 |
| §九 | 数据流图 | **重写**: 升级为平台协议图 + 协议链串联 |
| §十~§十五 | 结构图 | 增加"表达/不表达"声明 |
| §十六 | 数据流图 | 增加"表达/不表达"声明 |
| §十七 | 约束图 | 增加"表达/不表达"声明 |
| §十八 | 结构图 | 增加"表达/不表达"声明 |
| §十九 | 结构图 | **新增**: P4 Runtime 12 BC 专项图 |
| §二十 | 结构图 | **新增**: P5 Storage 7 BC 专项图 |
| §二一 | 结构图 | **新增**: 横切能力控制面图 |
| §二二 | 结构图 | **新增**: 老系统→新平台落点图 |
| §二三 | 时序图 | **新增**: 迁移波次路线图 |
| §二四 | 数据流图 | **新增**: 三轴协作图 |
