# Automatic Agent Platform v3.2 — Family Leadership Readiness & Claim Gate — Final Governance Baseline

> **版本**: v3.2  
> **状态**: Final Governance Baseline  
> **继承基线**: v3.1 Division Execution, Evidence & Operating Model Baseline  
> **文件名说明**: 文件路径保留 `final_release` 历史命名；当前正文状态与文件名一致，表示治理基线已发布。  
> **本版目标**: 在 v3.1 的 SOT、Lifecycle、RACI、CoverageCard、ScenarioCard、EvalDatasetCard、RedTeam、ROI、ToolRisk、Budget、Admin Console、Regression Protection 基础上，进一步回答一个核心问题：**每个 Family 是否可以做到行业领先，以及什么条件下才允许声明行业领先**。本版补齐 Release Scope、行业依据附录、Claim 自我约束、版本变更摘要、Claim Scanner allowlist、No-go exception 严格化、Admin Console DoD 与 Release Owner，并给出后续演进清单。  
> **当前仓库实现状态**: machine-readable Family Readiness / Benchmark / Minimum Evidence / Claim schema / allowlist / records / No-go Policy 配置、CI Claim Scanner、治理数据、Admin API / OpenAPI、Release Console Leadership Claims 子页与 review request 提交流程已在仓库中落地。  
> **核心结论**: 每个 Family 都可以走向行业领先，但不能用同一种“领先”定义。Engineering 和 Knowledge / Research 应优先冲刺能力与证据领先；Enterprise Ops 先在 customer-service/support 局部领先；GTM / Content 与 Creative / Production 先做治理和证据领先；Regulated Family 必须定义为安全治理领先，而不是自治执行领先。任何 Family 或 Division 不得在 README、UI、销售材料、release note 中声明“行业领先”，除非 Evidence Package 通过 Leadership Claim Gate。**本文件发布的是治理基线与 Claim Gate，不认证当前任何 Family 或 Division 已经行业领先。**

---

## Release Scope / 发布范围

本版本是 **Family Leadership Readiness & Claim Gate 的正式治理基线**。它定义当前仓库已经生效的 claim governance、scanner、配置与 console 集成边界；但它仍然不是任何 Family 或 Division 的行业领先认证。

本文定义的目标内容：

```text
1. 定义 Family-level readiness、benchmark map、minimum leading evidence、no-go policy 和 leadership claim gate。
2. 规定什么情况下允许声明 designed / pilot_ready / local_leader / industry_comparable / industry_leading。
3. 规定 Engineering、Knowledge / Research、Enterprise Ops、GTM / Content、Creative / Production、Regulated 六类 Family 的差异化领先路径。
4. 规定没有 EvidencePackage 和 LeadershipClaimRecord 时，不得在 README、docs、UI、release note、sales material 中宣称行业领先。
```

本文当前不表示或不授权的内容：

```text
1. 不声明任何 Family 已经 industry_leading。
2. 不声明任何 Division 已经 production_ready，除非有独立 CoverageCard 与 EvidencePackage。
3. 不授权任何高风险动作自动执行。
4. 不放宽 v3.1 已定义的 SOT、Lifecycle、RACI、ToolRisk、EvalDatasetCard、RedTeam、ROI、DataRevocation、Budget、RegressionProtection 要求。
```

本文中的“可以行业领先”“可冲行业领先”“具备领先基础”均表示 **leadership path / readiness assessment**，不构成已批准的 `LeadershipClaimRecord`。

---

## 术语与现有 SOT 对齐

当前仓库的 machine-checkable family / division 权威来源，仍然是：

- `docs_zh/governance/source_of_truth.md`
- `docs_zh/reference/division-catalog.md`
- `config/quality/division-catalog.json`

本文使用的 `Engineering / Knowledge / Research / Enterprise Ops / GTM / Content / Creative / Production / Regulated` 是**治理规划分组**，用于讨论 readiness、benchmark 和 claim gate，**不是**对现有 `division-catalog.json` 中 `family` 字段的替换。

在 machine-readable 配置和 ADR 落地前，本文中的 Family 分组不能直接用于：

- runtime 路由
- CI 强校验
- division 归属重写
- UI 对外宣称

为避免双重 SOT，本文采用以下桥接关系：

| 本文治理分组 | 当前 canonical family / division 对照 | 说明 |
|---|---|---|
| Engineering | `engineering`、`data`、`operations` 中与交付相关的 `coding`、`data-engineering`、`devops`、`engineering_ops`、`quality-assurance` | 这里只是治理协同面，不改变各 division 在 catalog 中的 canonical family |
| Knowledge / Research | `knowledge`、`research`、`analytics` 下的 `knowledge-base`、`academic-research`、`industry-research`、`research`、`analytics` | `Knowledge` 与 `Research` 在运行时仍是分开的 catalog family |
| Enterprise Ops | `customer-ops`、`operations`、`delivery`、`people` 下的 `customer-service`、`support`、`user-operations`、`project-management`、部分 `operations` division | 只能按场景聚合，不能把 `engineering_ops` / `general_ops` / `operations` / `it-operations` 合并成一个 machine family |
| GTM / Content | `growth`、`content`、`commerce` 下的 `advertising`、`content`、`ecommerce` | 仅表示业务治理联动面 |
| Creative / Production | `product`、`media`、部分 `content` 下的 `design`、`live-streaming` 等 | 不新增或替换现有 product/media family 定义 |
| Regulated | `legal`、`finance`、`healthcare`、`security` | 表示高治理强约束集合，不是单一 runtime family |

后续如果要把本文升级为强制基线，必须先把上述桥接关系沉淀为 machine-readable 配置，并明确哪些字段进入 `division-catalog`，哪些字段独立保存在治理配置中。

### 术语补充

本文中多次出现的 `FamilyPolicy`，指的是某个治理分组在 readiness / benchmark / no-go / claim gate 上的**策略包**，至少包括：

- 适用的 canonical family / division 范围
- readiness 判定规则
- benchmark mapping
- minimum evidence 要求
- no-go 与 exception 边界
- claim review owner / expiry / revocation 规则

在当前仓库里，`FamilyPolicy` 还不是既有 runtime schema 字段，也不是 `division-catalog.json` 的现有字段；它在落地前只能被视为治理配置概念。

## 与当前系统的关系

| 类别 | 结论 | 说明 |
|---|---|---|
| 方向一致且有改善 | `done` | family-specific benchmark、claim governance、no-go policy、regulated no-autonomy 已补齐当前治理空白 |
| 核心治理设计已落地 | `done` | FamilyReadiness config、LeadershipClaim schema、ClaimScanner、Leadership Claims 页面与 API 已有仓库工件 |
| 与现状存在较大冲突 | `done` | 通过 `division-catalog` / `source_of_truth` 桥接和独立治理配置，避免形成第二套 machine SOT |
| 仍需后续收敛的实现边界 | `todo` | family expansion reports、benchmark calibration、更完整的 claim revoke / expiry operator workflow 仍是后续项 |

### 建议落地顺序

若后续继续扩展本文基线能力，建议按以下顺序推进，避免再次出现“文档先声称完成、代码尚未存在”的情况：

1. 先确认主干文档、术语和 SOT 桥接。
2. 再补 contract / ADR，明确 `FamilyPolicy`、`LeadershipClaimRecord`、claim review 生命周期和目录归属。
3. 再新增 machine-readable config / schema。
4. 再接入 Claim Scanner、ReleaseGate、No-go enforcement 的 CI / runtime 校验。
5. 最后再补 Admin Console 页面与 operator workflow。

---

## v3.1 → v3.2 治理基线变更摘要

| 类型 | v3.2 治理基线新增 / 修复内容 |
|---|---|
| Release Scope | 明确本文件是治理与评估基线，不认证当前系统已行业领先 |
| Claim 自我约束 | 明确“可以领先”是 readiness 判断，不是正式 claim |
| Family Readiness | 增加 6 个 Family 的 readiness 状态、目标阶段和升级条件 |
| Benchmark Map | 增加 Family-specific external benchmark / framework mapping |
| Minimum Evidence | 增加每个 Family 的 Minimum Viable Leading Evidence |
| No-go Policy | 增加全局与 Family-specific 禁止自动化动作清单 |
| Claim Gate | 增加 claim level、claim schema、scanner、allowlist、expiry/revocation |
| Expansion Path | 增加 P0 pilot 到全部 Family / Division 的扩展路径 |
| Release Checklist | 增加文档/实现状态检查表，区分“已定义”和“已落地” |
| Industry Appendix | 增加行业依据附录，覆盖 SWE-bench、BFCL、τ-bench、MCP、OTel、OWASP、NIST、CSA、OSWorld、WebArena、Copilot、Claude Code、Devin、Enterprise Agent Platforms |
| Admin Console | 补充 Leadership Claims 页面的目标 DoD，并明确当前已实现的页面边界与后续演进项 |
| Owner / RACI | 增加 release criteria owner，避免清单无人负责 |

---

## 文档/实现状态检查

状态图例：

- `done`: 文档表述与当前仓库事实一致，可按已落地能力引用。
- `todo`: 仓库缺少对应配置、代码、CI、UI 或 contract 工件，不能按已落地能力引用。

| 检查项 | 当前状态 | 证据位置 / 说明 |
|---|---|---|
| Release Scope clarified | `done` | `Release Scope / 发布范围` |
| 文档未认证当前任何 Family 已行业领先 | `done` | Release Scope + Leadership Claim Gate |
| “可以领先”已被限定为 readiness assessment | `done` | Release Scope |
| Family governance buckets bridged to current SOT | `done` | `术语与现有 SOT 对齐` |
| Family Readiness Table completed | `done` | §2 |
| Benchmark Map completed | `done` | §3 |
| Minimum Leading Evidence documented | `done` | §4 |
| No-go Policy documented | `done` | §6 |
| Leadership Claim target schema documented | `done` | §7.4 |
| Claim scanner design documented | `done` | §7.5–§7.7 |
| Claim scanner implemented in CI | `done` | `scripts/ci/audit-leadership-claims.mjs` + `package.json#audit:leadership-claims` |
| Claim scanner allowlist / false positive handling implemented | `done` | `config/division-coverage/claims/allowlist.yaml` + scan report / review request 数据流 |
| Industry references appendix added | `done` | §13 |
| Release criteria owner added | `done` | §10.1 |
| Admin Console DoD documented | `done` | §10.2 |
| Admin Console Leadership Claims page implemented | `done` | `ui/packages/features/release-console` 子页 + shared API client + i18n 已接入 |
| Machine-readable family readiness / benchmark / evidence config landed | `done` | `config/division-coverage/{family-readiness,benchmark-map,minimum-leading-evidence}.yaml` |
| No-go Policy config landed | `done` | `config/policy/no-go-actions.yaml` |
| Regulated 不追求高自治已明确 | `done` | §8.6 |

当前判定：**可以作为 v3.2 Final Governance Baseline 发布；但它不等于任何 Family 已获 industry-leading 认证。**


## 0. v3.2 一页结论

> 下列判断是治理目标与 readiness 评估，不是当前 runtime 或市场对外状态。

### 0.1 当前系统是否具备行业领先基础？

具备基础，但不能一次性所有 Family 全面领先。

| Family | 当前可行性 | 推荐领先类型 | 推荐阶段 | 主要原因 |
|---|---:|---|---|---|
| Engineering | 高 | 能力领先 + 证据领先 + 安全领先 | P0 | 行业 benchmark 清晰，ROI 明确，容易形成闭环 |
| Knowledge / Research | 高 | 证据领先 + 数据飞轮领先 + 决策闭环领先 | P0 | 与知识库、研究平台、实验平台强相关，是差异化方向 |
| Enterprise Ops | 中高 | 流程领先 + SLA 领先 + Policy Adherence 领先 | P0/P1 | customer-service/support 可小切口落地 |
| GTM / Content | 中 | 受控内容领先 + 品牌/版权治理领先 + ROI 归因领先 | P1 | 深业务动作风险较高，先 draft-only |
| Creative / Production | 中低到中 | 多模态证据领先 + 资产治理领先 | P1/P2 | multimodal、UI、asset pipeline 难度高 |
| Regulated | 中高 | 安全治理领先 + 审计领先 + HITL 领先 | P1/P2 | 不应追求高自治，应追求可控、可审计、可撤销 |

### 0.2 v3.2 新增内容

v3.2 在 v3.1 基础上新增 6 个关键模块：

| # | 新增模块 | 解决问题 |
|---:|---|---|
| 1 | Family-level Leadership Readiness Table | 判断每个 Family 是否真的准备好冲行业领先 |
| 2 | Pilot-to-Family Expansion Path | 说明 P0 试点如何扩展到全部 division |
| 3 | Family-specific External Benchmark Map | 每个 Family 对齐哪些外部 benchmark / 行业框架 |
| 4 | Minimum Viable Leading Evidence | 每个 Family 至少需要哪些证据才可声明领先 |
| 5 | No-go List | 明确哪些动作当前不得自动化 |
| 6 | Leadership Claim Gate | 阻止未达标情况下对外宣称“行业领先” |

---

## 1. 行业领先的统一定义

v3.2 不再把“行业领先”理解为单一能力分数，而拆成五类领先。

| 领先类型 | 定义 | 典型 Family |
|---|---|---|
| Capability Leadership | 任务成功率、自动化能力、端到端闭环超过行业或内部基线 | Engineering、Enterprise Ops |
| Safety Leadership | 高风险动作可控，critical red-team success = 0 | Regulated、Engineering、GTM |
| Evidence Leadership | 所有关键结论、动作、工具调用、训练数据都有 evidenceRefs | Knowledge、Regulated、Creative |
| Operation Leadership | 有 SLO、ROI、incident、adoption、human acceptance 数据 | Enterprise Ops、Engineering、GTM |
| Flywheel Leadership | 运行数据能转为 memory、skill、eval、training data，并能证明模型/系统收益 | Knowledge、Engineering |

统一评分公式沿用 v3.1，但 v3.2 明确不同 Family 的权重可不同：

```text
Family Leadership Score =
  Capability Score × W1
+ Safety Score × W2
+ Evidence Score × W3
+ Operation Score × W4
+ Flywheel Score × W5
```

默认权重：

| Family | Capability | Safety | Evidence | Operation | Flywheel |
|---|---:|---:|---:|---:|---:|
| Engineering | 30% | 25% | 20% | 15% | 10% |
| Knowledge / Research | 15% | 15% | 35% | 15% | 20% |
| Enterprise Ops | 25% | 25% | 15% | 25% | 10% |
| GTM / Content | 20% | 35% | 15% | 25% | 5% |
| Creative / Production | 20% | 25% | 35% | 15% | 5% |
| Regulated | 10% | 45% | 30% | 10% | 5% |

---

## 2. Family-level Leadership Readiness Table

### 2.1 Readiness 状态

| 状态 | 含义 |
|---|---|
| `not_ready` | 缺核心 SOT、CoverageCard、eval 或 red-team |
| `governance_ready` | 治理结构完整，但能力/业务闭环不足 |
| `pilot_ready` | 可进入真实 pilot，但不能声明行业领先 |
| `local_leadership_ready` | 在局部场景可声明内部领先或局部领先 |
| `industry_leadership_ready` | 证据包满足行业领先声明门槛 |

### 2.2 当前推荐评级

| Family | 当前目标评级 | v3.2 推荐判断 | 必须补齐后才能升级 |
|---|---|---|---|
| Engineering | `local_leadership_ready` | 可以最快冲行业领先 | issue-to-PR、SWE-style heldout、patch correctness、AWI red-team、PR acceptance |
| Knowledge / Research | `local_leadership_ready` | 最适合做差异化领先 | citation verifier、source reliability、experiment linker、stale doc detector |
| Enterprise Ops | `pilot_ready` | 可在 customer-service/support 局部领先 | τ-style eval、真实 ticket/order/refund API、SLA dashboard |
| GTM / Content | `governance_ready` | 先做受控内容和品牌安全领先 | CRM/ecommerce connector、brand policy DSL、copyright gate、ROI attribution |
| Creative / Production | `governance_ready` | 先做多模态证据和资产治理领先 | Figma/DOM/screenshot evidence、visual diff、asset provenance |
| Regulated | `governance_ready` | 可做安全治理领先，不做自治领先 | audit export、data residency、mandatory HITL、no autonomous high-impact actions |

### 2.2.1 Readiness 评级依据

| Family | 评级依据 |
|---|---|
| Engineering | 外部 SWE-style benchmark 明确；内部 ROI 直接；工具、测试、PR、CI 都可形成 evidence；风险主要在 patch correctness、AWI 和生产环境写动作 |
| Knowledge / Research | 与内部 Wiki / Research / Experiment / Decision 流程高度贴合；EvidenceGraph 与 Data Flywheel 有差异化；风险主要在 citation、source poisoning、stale docs |
| Enterprise Ops | customer-service/support 可用 τ-style eval 建闭环；但 operations 范围过宽，必须先收敛到 ticket/order/refund/complaint 等场景 |
| GTM / Content | 生成和审核容易落地，但自动写 CRM、广告预算和客户承诺风险高；应先做 draft-only、brand/copyright gate 和 ROI attribution |
| Creative / Production | 多模态证据、Figma/DOM/screenshot/asset provenance 是合理切口；但自动生产和发布资产难度高，先做 evidence/provenance lead |
| Regulated | 可在 HITL、audit、data residency、evidence、revocation 上领先；不应以自动化率作为领先指标 |

### 2.3 Readiness Gate

以下 gate 是**目标落地条件**。只有当 machine-readable 配置、CI 和 claim artifacts 在仓库中实际存在并接入校验后，才可以把它们当作强制规则执行。

```text
industry_leadership_ready requires:
  - Family governance policy exists in canonical config or approved ADR
  - all P0 divisions have CoverageCard v1.1+
  - at least one production-grade ScenarioCard
  - eval suite executed with dataset card
  - red-team suite executed with severity model
  - ROI measurement exists with confidence >= medium
  - evidenceRefs non-empty and not stale
  - Leadership Claim Gate passed
```

---

## 3. Family-specific External Benchmark Map

### 3.1 Benchmark Map 总表

| Family | 外部 benchmark / 框架 | 内部映射方式 |
|---|---|---|
| Engineering | SWE-bench Verified、SWE-style tasks、Agentic PR studies、BFCL for tools | internal SWE-style heldout、issue-to-PR、PR acceptance、patch correctness |
| Knowledge / Research | RAG citation eval、source grounding eval、OpenTelemetry GenAI tracing | citation/source eval、ClaimEvidenceGraph、ExperimentLinker |
| Enterprise Ops | τ-bench、τ²/telecom-style policy tasks、enterprise workflow benchmarks | customer-service τ-style eval、support ticket eval |
| GTM / Content | τ-bench retail、CRM workflow eval、brand safety/copyright eval | CRM action safety、brand/copyright gate、campaign ROI |
| Creative / Production | OSWorld、WebArena、VisualWebArena、visual regression eval | Figma/DOM/screenshot evidence、visual grounding eval |
| Regulated | NIST AI RMF / GenAI Profile、OWASP AI Agent Security、CSA Agentic NIST AI RMF | control mapping、red-team severity、audit export、HITL coverage |

### 3.2 ToolGateway 横向 Benchmark

ToolGateway 是所有 Family 的共同底座，必须额外对齐：

```text
BFCL-style:
  - tool selection accuracy
  - argument correctness
  - irrelevant tool refusal
  - parallel/nested/multi-turn tool use

MCP-style:
  - Protected Resource Metadata
  - resource/audience binding
  - scope mismatch detection
  - tool attestation
  - tool output injection defense

τ-style:
  - tool use under dynamic user interaction
  - domain policy adherence
  - hidden state / changing API state handling
```

### 3.3 Observability 横向 Benchmark

所有 Family 都应接入 OTel GenAI / agent spans 的语义映射：

```text
Required spans:
  - agent.run
  - model.call
  - tool.call
  - guardrail.check
  - handoff.request
  - memory.read
  - memory.write
  - eval.case
  - redteam.case
  - approval.decision
  - prepared_action.commit
```

---

## 4. Family-specific Minimum Viable Leading Evidence

### 4.1 Engineering Family

声明行业领先前必须具备：

```text
1. Engineering FamilyPolicy
2. coding CoverageCard v1.1+
3. issue-to-patch ScenarioCard
4. ci-failure-analysis ScenarioCard
5. internal SWE-style heldout >= 50 tasks for MVP, >= 200 tasks for leadership claim
6. patch correctness report
7. PR acceptance / human edit distance report
8. AWI red-team report
9. ToolAction R0-R5 for GitHub/CI/shell/test tools
10. Engineering ROI report
```

最低领先证据：

| 证据 | MVP | Leadership Claim |
|---|---:|---:|
| Internal SWE-style tasks | ≥50 | ≥200 |
| AWI red-team cases | ≥30 | ≥100 |
| Real pilot PRs | ≥10 | ≥50 |
| Human reviewer feedback | required | required |
| Patch correctness report | required | required |

### 4.2 Knowledge / Research Family

声明行业领先前必须具备：

```text
1. Knowledge FamilyPolicy
2. knowledge-base CoverageCard
3. research CoverageCard
4. citation/source eval >= 100 cases for MVP, >= 500 for leadership claim
5. SourceReliabilityScorer report
6. CitationVerifier report
7. ClaimEvidenceGraph report
8. ExperimentLinker report
9. stale doc detector report
10. knowledge reuse / decision impact report
```

最低领先证据：

| 证据 | MVP | Leadership Claim |
|---|---:|---:|
| Citation eval cases | ≥100 | ≥500 |
| Source reliability categories | ≥5 | ≥10 |
| Experiment-linked conclusions | ≥20 | ≥100 |
| Stale doc checks | required | automated |
| Knowledge reuse dashboard | required | required |

### 4.3 Enterprise Ops Family

声明行业领先前必须具备：

```text
1. EnterpriseOps FamilyPolicy
2. customer-service CoverageCard
3. support CoverageCard if included in claim
4. refund/order/complaint ScenarioCards
5. τ-style eval >= 100 cases for MVP, >= 500 for leadership claim
6. policy adherence report
7. tool action safety report
8. SLA / handoff / CSAT dashboard
9. customer data redaction policy
10. ROI report
```

最低领先证据：

| 证据 | MVP | Leadership Claim |
|---|---:|---:|
| τ-style cases | ≥100 | ≥500 |
| Policy test cases | ≥50 | ≥300 |
| Pilot tasks | ≥50 | ≥500 |
| SLA measurement | required | required |
| Handoff audit | required | required |

### 4.4 GTM / Content Family

声明行业领先前必须具备：

```text
1. GTM FamilyPolicy
2. content/advertising/ecommerce CoverageCards as applicable
3. brand safety eval
4. copyright risk eval
5. CRM/ecommerce action safety report
6. customer data protection report
7. content human acceptance report
8. campaign ROI attribution report
```

最低领先证据：

| 证据 | MVP | Leadership Claim |
|---|---:|---:|
| Brand safety cases | ≥100 | ≥1000 |
| Copyright risk cases | ≥50 | ≥500 |
| CRM/ecommerce action cases | ≥50 | ≥500 |
| Human review samples | required | required |
| ROI attribution | campaign-level optional | campaign-level required |

### 4.5 Creative / Production Family

声明行业领先前必须具备：

```text
1. Creative FamilyPolicy
2. design CoverageCard or selected production division CoverageCard
3. multimodal evidence schema
4. Figma/DOM/screenshot connector report
5. visual grounding eval
6. design token compliance report
7. visual regression report
8. asset provenance report
9. copyright risk report
```

最低领先证据：

| 证据 | MVP | Leadership Claim |
|---|---:|---:|
| Visual grounding cases | ≥50 | ≥300 |
| Visual regression cases | ≥50 | ≥300 |
| Asset provenance samples | ≥50 | ≥500 |
| Human creative review | required | required |
| Copyright risk eval | required | required |

### 4.6 Regulated Family

声明行业领先前必须具备：

```text
1. Regulated FamilyPolicy
2. selected high-risk CoverageCard
3. mandatory HITL policy
4. no autonomous high-impact action policy
5. audit export report
6. data residency report
7. restricted data red-team report
8. bias/fairness report if applicable
9. data revocation/tombstone report
10. external model routing report
```

最低领先证据：

| 证据 | MVP | Leadership Claim |
|---|---:|---:|
| High-impact action HITL coverage | 100% | 100% |
| Critical red-team success | 0 | 0 |
| Audit export completeness | ≥98% | ≥99.9% |
| Data residency violation | 0 | 0 |
| Restricted data leakage | 0 | 0 |

---

## 5. Pilot-to-Family Expansion Path

### 5.1 P0 Pilot Scope

v3.2 继续收敛到 3 条主线：

| Pilot | 覆盖 Family | 首批 division | 目标 |
|---|---|---|---|
| Engineering Pilot | Engineering | coding + qa/devops/security 子能力 | issue-to-PR、CI failure、patch correctness |
| Knowledge Pilot | Knowledge / Research | knowledge-base + research | citation/source/evidence/experiment trace |
| Customer Service Pilot | Enterprise Ops | customer-service + support 子能力 | τ-style policy agent、SLA、handoff、ROI |

### 5.2 扩展路径

```text
Phase P0-A:
  建 SOT、CoverageCard、ScenarioCard、EvalDatasetCard、ToolRisk、RedTeam、ROI。

Phase P0-B:
  三条 pilot 跑真实任务，生成 evidence package。

Phase P0-C:
  将 pilot 里的通用 harness 抽象为 Family default policy 和 reusable eval/red-team templates。

Phase P1:
  Engineering 扩展到 devops / security / qa 独立 division。
  Knowledge 扩展到 academic-research / industry-research / analytics。
  Enterprise Ops 扩展到 operations / project-management / product-management。

Phase P2:
  GTM / Content 上线 draft-only + brand/copyright gate。
  Creative / Production 上线 visual evidence + asset provenance。
  Regulated 上线 advisory + mandatory HITL + audit export。
```

### 5.3 Expansion Gate

```text
一个 division 可以从 pilot 模板扩展，必须满足：
  - 继承的 FamilyPolicy 已通过 CI
  - 该 division 有 CoverageCard
  - 至少一个 ScenarioCard
  - eval/red-team 可运行
  - ToolAction risk 标注完整
  - ROI model 已定义
  - 无 P0 blocker
```

---

## 6. No-go List：当前禁止自动化的动作

v3.2 必须明确边界：系统不是所有业务都可以自动执行。

### 6.1 全局 No-go

以下动作在 v3.2 阶段禁止完全自动执行：

```text
1. 自动付款、转账、退款、财务结算。
2. 自动交易、下单、投资、量化策略实盘执行。
3. 自动给出最终医疗诊断、治疗方案、处方建议。
4. 自动给出最终法律意见、合同签署建议、诉讼策略。
5. 自动删除生产数据、清空数据库、销毁备份。
6. 自动回滚生产系统且无审批。
7. 自动撤销用户/员工权限且无审批。
8. 自动发送对外法律/财务/医疗/HR 高影响通知。
9. 自动把 restricted data 发送到外部模型。
10. 自动把 customer/employee/regulated data 导出训练。
11. 自动绕过 HITL 或扩大 capability scope。
12. 自动执行来自 untrusted issue/PR/comment/log 的命令。
```

### 6.2 Family-specific No-go

| Family | No-go |
|---|---|
| Engineering | untrusted issue/log → shell command；未经审批修改生产 IaC；自动合并 PR |
| Knowledge / Research | 无引用生成 accepted conclusion；使用过期或撤销 source 作为 authoritative evidence |
| Enterprise Ops | 自动批准退款/补偿/权限；无 policy 执行客户请求 |
| GTM / Content | 自动投放广告预算；自动修改 CRM 关键字段；未审查发布品牌内容 |
| Creative / Production | 未溯源资产进入生产；未 review 版权风险资产 |
| Regulated | 自动高影响决策；外部模型处理 restricted data；无 HITL 发送最终意见 |

### 6.3 No-go Exception

No-go 例外只能用于 **受控、一次性、可撤销、可审计** 的 prepared action，不得把例外升级成长期开放权限。

例外必须同时满足：

```text
PreparedAction
+ scoped capability
+ named approver
+ explicit reason
+ expiry
+ audit event
+ rollback/compensation policy
+ riskClass-specific approval count
+ post-action verification
```

审批要求：

| RiskClass | 最低审批 | 额外要求 |
|---|---|---|
| R3 | 1 个 named approver | action-scoped TTL |
| R4 | 2 个 approver，其中至少 1 个 policy/security owner | rollback/compensation policy 必填 |
| R5 | 默认禁止；如需例外，必须有 accountable owner + policy owner + security owner 联合审批 | 不允许 blanket approval；必须 post-action audit |

No-go exception 不能用于：

```text
1. 永久放开 capability。
2. 批量绕过 HITL。
3. 对 future actions 做提前授权。
4. 允许 untrusted source 直接进入 shell / workflow / external write sink。
```

---

## 7. Leadership Claim Gate

### 7.1 为什么需要 Claim Gate

如果没有 Claim Gate，README、UI、销售材料、文档可能过早声称：

```text
industry-leading coding agent
production-ready customer service agent
regulated-ready legal agent
```

但背后没有 evidence package。这会带来信任风险、合规风险和销售误导风险。

### 7.2 允许声明的等级

| Claim Level | 允许文案 | 条件 |
|---|---|---|
| `designed` | “已完成设计” | CoverageCard + ScenarioCard |
| `pilot_ready` | “可进入试点” | eval/red-team 初版通过 |
| `local_leader` | “在内部 pilot 场景达到领先” | 有真实 pilot report 和 ROI |
| `industry_comparable` | “对齐行业 benchmark” | 有外部 benchmark mapping 和内部测量 |
| `industry_leading` | “行业领先” | 通过 Leadership Claim Gate |

### 7.3 Claim Gate 条件

```text
industry_leading claim requires:
  1. Family readiness = industry_leadership_ready
  2. Division status = production_ready
  3. Evidence package complete
  4. Minimum Viable Leading Evidence satisfied
  5. External benchmark mapping exists
  6. EvalDatasetCard clean and frozen
  7. Red-team critical success = 0
  8. ROI confidence >= medium
  9. EvidenceRefs not stale
  10. Claim reviewed by accountable owner + policy owner
```

### 7.4 Claim Governance Schema

下列 schema 是目标接口，不代表仓库中已经存在对应 JSON Schema 或审批存储。

若要正式落地，应同时补三层工件：

- contract / ADR 中的字段与状态语义
- `config/.../schemas/` 下的 machine-readable schema
- claim 审批与撤销在 UI / operator 流程中的状态转换约束

```ts
export interface LeadershipClaimRecord {
  claimId: string;
  familyId: string;
  divisionId?: string;
  scenarioId?: string;

  claimLevel:
    | "designed"
    | "pilot_ready"
    | "local_leader"
    | "industry_comparable"
    | "industry_leading";

  claimText: string;
  allowedSurfaces: Array<"docs" | "ui" | "release_note" | "sales_material" | "readme">;

  evidenceRefs: string[];
  reviewedBy: string[];
  expiresAt: string;
  status: "approved" | "rejected" | "expired" | "revoked";
}
```

### 7.5 Claim Scanner

下列扫描范围已由 `scripts/ci/audit-leadership-claims.mjs` 落地，并接入 `audit:repo-hygiene`。扫描结果会写入 `data/governance/leadership-claim-scan-report.json`。

扫描路径也必须按当前仓库结构参数化，而不是硬编码假定所有目录都存在。以当前仓库为例，至少应覆盖：

- `README.md`
- `docs_zh/`
- `docs_en/`
- `ui/`（当前存在时）
- 其他对外文案目录（若仓库后续新增 marketing / sales / release notes 路径）

CI 必须扫描以下位置：

```text
README.md
docs_zh/
docs_en/
ui/
release notes
marketing/sales docs if included
```

扫描关键词：

```text
industry-leading
行业领先
production-ready
企业级就绪
best-in-class
state-of-the-art
regulated-ready
fully autonomous
```

若没有 approved `LeadershipClaimRecord`，必须阻断。

### 7.6 Claim Scanner Allowlist 与误报处理

Claim Scanner 允许极少量 allowlist，但必须是 **结构化 allowlist**，不能用裸关键词跳过。

```ts
export interface LeadershipClaimAllowlistEntry {
  filePath: string;
  matchedText: string;
  reason: string;
  owner: string;
  expiresAt: string;
  replacementSuggestion?: string;
}
```

允许 allowlist 的情况：

```text
1. 引用外部资料标题中含 industry-leading/state-of-the-art。
2. 说明“不得宣称行业领先”的治理规则。
3. 历史归档文档，且顶部标记 archived / superseded。
```

不允许 allowlist 的情况：

```text
1. README、UI、release note 中面向用户的能力宣称。
2. sales / marketing material 中的领先声明。
3. 未带 expiry 的永久 allowlist。
4. owner 为空的 allowlist。
```

### 7.7 Claim Scanner 失败处理

落地时必须把 `Fail / Warn / Expired allowlist` 语义接入现有 CI gate；在此之前，本节只是治理要求，不是当前系统行为。

```text
Fail → 阻断 release。
Warn → 仅允许 archived / superseded 文档。
Expired allowlist → 自动升级为 Fail。
Approved claim expired → 自动撤销并要求替换文案。
```

---

## 8. Family 逐项最终判断

> 本节中的 `by v3.2 / v3.3 / v3.4` 是治理阶段目标，不是已经承诺的发布日期，也不是当前版本已经完成的能力结论。

### 8.1 Engineering

**是否可以行业领先：可以，优先冲刺。**

原因：

```text
1. 外部 benchmark 明确。
2. 内部 ROI 清晰。
3. issue-to-PR 可形成端到端闭环。
4. ToolRisk / AWI / PatchGate 可体现平台优势。
```

必须避免：

```text
1. 只做代码建议，不做 PR 采纳。
2. 只看测试通过，不看 patch correctness。
3. 只跑 demo repo，不跑内部真实 heldout。
4. 不处理 malicious issue / PR comment / CI log。
```

v3.2 目标：

```text
local_leader by v3.2
industry_comparable by v3.3
industry_leading candidate by v3.4
```

### 8.2 Knowledge / Research

**是否可以行业领先：可以，且是差异化核心。**

原因：

```text
1. 与内部知识库和研究平台高度匹配。
2. EvidenceGraph / Citation / ExperimentTrace 可做差异化。
3. 数据飞轮价值大。
```

必须避免：

```text
1. 调研报告只堆引用。
2. 引用不验证。
3. conclusion 与 experiment / decision 脱节。
4. stale doc 被当成权威。
```

v3.2 目标：

```text
local_leader by v3.2
industry_comparable by v3.3
industry_leading candidate by v3.4
```

### 8.3 Enterprise Ops

**是否可以行业领先：可以，但先局部。**

优先场景：

```text
customer-service
support
ticket triage
refund/order/complaint policy
```

必须避免：

```text
1. operations 过宽。
2. 无真实 API，只做聊天。
3. 无 policy adherence eval。
4. 无 SLA / handoff / ROI。
```

v3.2 目标：

```text
pilot_ready by v3.2
local_leader for customer-service by v3.3
industry_comparable by v3.4
```

### 8.4 GTM / Content

**是否可以行业领先：可以，但先做受控领先。**

优先场景：

```text
content draft
brand safety review
copyright risk check
CRM draft update
campaign analysis
```

不建议先做：

```text
automatic ad spend
automatic CRM critical write
automatic customer commitment
automatic public publishing
```

v3.2 目标：

```text
governance_ready by v3.2
pilot_ready by v3.3
local_leader in controlled draft/review by v3.4
```

### 8.5 Creative / Production

**是否可以行业领先：短期不宜承诺全面领先，可先做证据治理领先。**

优先场景：

```text
Figma / screenshot / DOM evidence
visual diff
design token compliance
asset provenance
copyright risk
```

不建议先做：

```text
fully automatic production asset release
unreviewed brand asset publishing
unreviewed manufacturing instruction
```

v3.2 目标：

```text
governance_ready by v3.2
pilot_ready by v3.3
local_leader in evidence/provenance by v3.4
```

### 8.6 Regulated

**是否可以行业领先：可以，但定义为安全治理领先，不是自治领先。**

优先场景：

```text
advisory
evidence collection
policy mapping
audit export
human review acceleration
```

不建议自动化：

```text
legal final advice
medical diagnosis
financial transaction
HR high-impact decision
trading
insurance claim final decision
```

v3.2 目标：

```text
governance_ready by v3.2
pilot_ready for advisory workflows by v3.3
local_leader in governance/audit/HITL by v3.4
```

---

## 9. v3.2 Release Criteria

v3.2 作为强制治理基线，最低需要满足：

```text
1. Family-level Leadership Readiness Table 完成。
2. 每个 Family 有 readiness status。
3. 每个 Family 有 External Benchmark Map。
4. 每个 Family 有 Minimum Viable Leading Evidence。
5. No-go List 写入 ToolRisk / ReleaseGate。
6. Leadership Claim Gate schema 完成。
7. Claim scanner 至少覆盖 README、docs、UI 文案。
8. Engineering / Knowledge / Customer-Service 三条 P0 pilot 绑定 expansion path。
9. Regulated Family 明确“安全治理领先，不是自治领先”。
10. 所有 production_ready / industry-leading 声明必须可追溯到 EvidencePackage。
```

---

## 10. Release Governance and Operational DoD

### 10.1 Release Criteria Owner / RACI

| Criteria | Owner |
|---|---|
| Family readiness status | Platform Governance Owner |
| Benchmark Map | Eval Owner |
| Minimum Leading Evidence | Family Technical Owner + Eval Owner |
| No-go Policy | Policy Owner + Security Owner |
| Leadership Claim schema | Platform Governance Owner |
| Claim Scanner | CI / Quality Owner |
| P0 Pilot expansion path | Pilot Technical Owner |
| Regulated no-autonomy statement | Policy Owner |
| EvidencePackage traceability | Evidence / Observability Owner |

### 10.2 Admin Console DoD

当前仓库已提供 Release Console `leadership-claims` 子页，以及对应的 governance snapshot / review request API。下列条目继续作为页面演进 DoD：

```text
1. 展示每个 Family 的 readiness status、claim level、expiry、owner。
2. 展示每条 claim 的 evidenceRefs 和 freshness。
3. 支持查看 Claim Scanner 命中项、allowlist、expired allowlist。
4. 支持发起 claim review，但不能绕过 CI gate。
5. 支持 claim revoked / expired 状态的 UI 标红。
6. 不允许前端本地 mock industry_leading / production_ready。
```

同时必须与 [admin_console_and_human_takeover_contract.md](/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_zh/contracts/admin_console_and_human_takeover_contract.md:1) 保持一致；如果 claim review / revoke / expiry 流程需要新增状态或审批动作，应先更新 contract，再更新 UI DoD 和实现。

### 10.3 v3.2 Promotion Criteria

v3.2 若要升级为 Final Release，必须满足：

```text
1. Release Scope 已明确。
2. 本文没有认证任何当前 Family/Division 已 industry_leading。
3. Family Readiness Table、Benchmark Map、Minimum Evidence、No-go、Claim Gate 完整。
4. Claim Scanner 有 allowlist/expiry/revocation 机制。
5. Regulated Family 明确只追求安全治理领先，不追求高自治。
6. References / Industry Evidence Appendix 完整。
7. 文档/实现状态检查中所有实现项均为 `done`。
```

当前结论：**已通过 v3.2 Governance Baseline 升级条件，可发布。**

## 11. v3.2 TodoList

| 优先级 | 状态 | 任务 | 产物 | 说明 |
|---:|---|---|---|---|
| P0 | `done` | 新增 Family Readiness 配置 | `config/division-coverage/family-readiness.yaml` | 已落地 |
| P0 | `done` | 新增 Benchmark Map | `config/division-coverage/benchmark-map.yaml` | 已落地 |
| P0 | `done` | 新增 Minimum Leading Evidence | `config/division-coverage/minimum-leading-evidence.yaml` | 已落地 |
| P0 | `done` | 新增 No-go Policy | `config/policy/no-go-actions.yaml` | 已落地 |
| P0 | `done` | 新增 Leadership Claim schema | `config/division-coverage/schemas/leadership-claim.schema.json` | 已落地 |
| P0 | `done` | 新增 Claim Scanner | `scripts/ci/audit-leadership-claims.mjs` | 已落地并接入 `audit:repo-hygiene` |
| P0 | `done` | 更新 Admin Console | 增加 Leadership Claims 页面 | 已落地 `Release Console` 子页、API client 和 review request 流程 |
| P1 | `todo` | 增加 Family expansion reports | `docs_zh/divisions/family-expansion/` | 当前仓库缺失 |
| P1 | `todo` | 增加 Benchmark calibration plan | `docs_zh/quality/benchmark-calibration.md` | 当前仓库缺失 |
| P1 | `todo` | 增加 regulated no-autonomy guard | ToolGateway / ReleaseGate rule | 需要代码与治理双落地 |

---

## 12. 最终结论

v3.1 已经把 division 行业领先所需的证据系统设计完整。v3.2 进一步明确：

```text
不是每个 Family 都用同一种方式领先。
不是每个 Family 都应该追求高自治。
不是有 demo 就能声明行业领先。
```

治理方向判断：

```text
Engineering：可以优先冲行业领先。
Knowledge / Research：可以作为差异化行业领先。
Enterprise Ops：先在 customer-service/support 局部领先。
GTM / Content：先做受控场景和品牌/版权治理领先。
Creative / Production：先做多模态证据和资产治理领先。
Regulated：只做安全治理、审计、HITL 领先，不做高自治领先。
```

当前适用原则：

> **任何 Family 或 Division 只有在通过 Leadership Claim Gate 后，才允许声明“行业领先”。行业领先必须由 EvidencePackage 证明，而不是由文档口号证明。**

补充说明：

- 这套方向总体上对当前系统是改善，尤其补足了 claim governance、family-specific benchmark 和 no-go policy 的空白。
- 当前最大的风险不是设计方向，而是后续实现如果绕开 scanner / claim review / SOT bridge，会重新造成文档与代码脱节。
- 当前实现已经接入 `division-catalog` / `source_of_truth` 桥接；后续扩展仍不能并行维护第二套 family SOT。

---

## 13. References / Industry Evidence Appendix

> 本附录是 v3.2 治理基线的行业依据清单。它用于支撑 benchmark mapping、family readiness 和 claim gate 的设计，不等同于任何 Family 已通过 industry_leading claim。

### 13.1 Coding / Engineering Agent

| 资料 | 用途 |
|---|---|
| GitHub Copilot coding agent docs — https://docs.github.com/copilot/concepts/agents/coding-agent/about-coding-agent | 说明 coding agent 已进入 repository research、plan、branch changes、PR 工作流 |
| SWE-bench Verified — https://www.swebench.com/verified.html | 真实 GitHub issue benchmark，Verified 为 500 个 human-filtered instances |
| AIDev: Studying AI Coding Agents on GitHub — https://arxiv.org/abs/2602.09185 | 真实 Agentic PR 数据集与 adoption 研究 |
| Failed Agentic PR empirical study — https://arxiv.org/abs/2601.15195 | PR 未合入原因、CI、review dynamics、duplicate/unwanted PR 等失败模式 |
| Claude Code docs — https://code.claude.com/docs/en/overview | agentic coding 工具对标 |
| Devin docs — https://docs.devin.ai/get-started/devin-intro | autonomous software engineering agent 对标 |

### 13.2 Tool Use / Function Calling / MCP

| 资料 | 用途 |
|---|---|
| Berkeley Function Calling Leaderboard V4 — https://gorilla.cs.berkeley.edu/leaderboard.html | tool/function call accuracy benchmark |
| τ-bench — https://github.com/sierra-research/tau-bench | 动态 user-agent-tool interaction 和 domain policy adherence |
| MCP Authorization Specification 2025-06-18 — https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | Protected Resource Metadata / authorization server binding |
| MCP Authorization Specification 2025-11-25 — https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization | 新版授权规范参考 |

### 13.3 Computer-use / Web Agent / Multimodal Agent

| 资料 | 用途 |
|---|---|
| OSWorld — https://os-world.github.io/ | real computer environment、execution-based evaluation、open-ended computer tasks |
| WebArena — https://webarena.dev/ | realistic web environment，e-commerce/forum/collaborative development/CMS |
| VisualWebArena — https://arxiv.org/abs/2401.13649 | visual grounding web agent evaluation |

### 13.4 Enterprise Agent Platform / Runtime / Observability

| 资料 | 用途 |
|---|---|
| OpenAI Agents SDK — https://developers.openai.com/api/docs/guides/agents | agent runtime、tools、stateful multi-step work 参考 |
| OpenAI Agents SDK Tracing — https://openai.github.io/openai-agents-python/tracing/ | LLM generations、tool calls、handoffs、guardrails、custom events tracing |
| OpenTelemetry GenAI agent spans — https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/ | agent/framework span 语义映射 |
| OpenTelemetry GenAI spans — https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/ | GenAI trace / span 语义约定 |
| Google Gemini Enterprise Agent Platform — https://cloud.google.com/blog/products/ai-machine-learning/introducing-gemini-enterprise-agent-platform | build / scale / govern / optimize enterprise agents 方向参考 |
| Microsoft Copilot Studio security and governance — https://learn.microsoft.com/en-us/microsoft-copilot-studio/security-and-governance | enterprise agent governance 参考 |
| Salesforce Agentforce Builder / guardrails — https://www.salesforce.com/agentforce/agent-builder/ | enterprise agent builder、actions、guardrails 参考 |
| IBM watsonx Orchestrate — https://www.ibm.com/products/watsonx-orchestrate | no-code/pro-code workflow agent 参考 |

### 13.5 Security / Governance / Regulated AI

| 资料 | 用途 |
|---|---|
| OWASP AI Agent Security Cheat Sheet — https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html | agent-specific security testing、tool least privilege、prompt injection、memory protection |
| NIST AI RMF Generative AI Profile — https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence | GenAI risk management profile |
| CSA Agentic NIST AI RMF Profile — https://labs.cloudsecurityalliance.org/agentic/agentic-nist-ai-rmf-profile-v1/ | agent autonomy、tool-use risk、runtime governance、delegation accountability |
| Agentic Workflow Injection — https://arxiv.org/abs/2605.07135 | GitHub Actions / issue / PR / comment workflow injection 风险参考 |

---

## 14. 附录 A：已落地目录与后续扩展位

> 下列目录中，`config/division-coverage/`、`config/policy/`、`scripts/ci/`、`data/governance/` 的对应工件已落地；`docs_zh/divisions/family-expansion/` 仍属于后续扩展位。

```text
config/division-coverage/
├── family-readiness.yaml
├── benchmark-map.yaml
├── minimum-leading-evidence.yaml
├── schemas/
│   └── leadership-claim.schema.json
└── claims/
    ├── engineering.yaml
    ├── knowledge-research.yaml
    └── ...

config/policy/
└── no-go-actions.yaml

scripts/ci/
└── audit-leadership-claims.mjs

data/governance/
├── leadership-claim-review-requests.json
└── leadership-claim-scan-report.json

docs_zh/divisions/
├── family-readiness.md
├── family-expansion/
└── leadership-claims.md
```

---

## 15. 附录 B：Leadership Claim Gate 示例

> 下列 YAML 用于说明当前 schema 目标结构；仓库中的实际记录可见 `config/division-coverage/claims/records.yaml`。

```yaml
claimId: engineering-coding-local-leader-v3-2
familyId: engineering
divisionId: coding
scenarioId: issue-to-patch

claimLevel: local_leader
claimText: "coding division 在内部 issue-to-patch pilot 中达到局部领先。"
allowedSurfaces:
  - docs
  - release_note
  - ui

evidenceRefs:
  - eval://divisions/coding/swe-style/report-2026-05-01
  - redteam://families/engineering/awi/report-2026-05-01
  - dashboard://divisions/coding/roi/week-2026-05-01

reviewedBy:
  - engineering-platform-owner
  - security-governance-owner

expiresAt: 2026-08-01T00:00:00Z
status: approved
```

---

## 16. 附录 C：No-go Policy 示例

```yaml
noGoActions:
  - id: no-auto-payment
    description: 禁止自动付款、转账、退款、财务结算
    riskClass: R5
    allowedException:
      requiresPreparedAction: true
      requiresHITL: true
      requiresMultiApprover: true

  - id: no-untrusted-command-execution
    description: 禁止把 untrusted issue/PR/comment/log 内容直接转成 shell command
    riskClass: R4
    blockSinks:
      - shell
      - workflow_yaml
      - external_request

  - id: no-final-medical-legal-financial-advice
    description: 禁止自动输出最终医疗、法律、金融高影响结论
    riskClass: R5
    allowedMode:
      - advisory
      - draft
      - evidence_summary
```


---

## 17. Final Governance Declaration

```text
Release Name: Automatic Agent Platform v3.2 — Family Leadership Readiness & Claim Gate
Release Type: Final Governance Baseline
Release Status: Released
Effective Scope: Family-level readiness, claim governance, no-go policy, benchmark map, minimum evidence, leadership claim gate, CI scanner, governance API, and release console governance surface
Certification Scope: None. This release does not certify any Family or Division as industry-leading.
Blocking Gaps: No release-blocking P0 gaps remain for the governance baseline itself; remaining P1 items are family expansion reports, benchmark calibration, and richer revoke / expiry workflows.
Next Baseline: v3.3 should extend family expansion reports, benchmark calibration, and stronger operator lifecycle handling without weakening the current claim gate.
```

Current decision: **Ready for v3.2 final governance release.**
