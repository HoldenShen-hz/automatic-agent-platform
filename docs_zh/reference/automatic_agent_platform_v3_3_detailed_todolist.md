# Automatic Agent Platform v3.3 — 工程落地详细 TodoList

> **文档版本**: v1.1  
> **生成日期**: 2026-06-01  
> **基线版本**: v3.2 Final Release — Family Leadership Readiness & Claim Gate  
> **目标版本**: v3.3 — Division Governance Implementation & P0 Pilot Launch  
> **目标**: 把 v3.2 的治理与评估基线落到仓库、配置、CI、Dashboard 和 3 条 P0 Pilot，形成可扫描、可评测、可红队、可证明 ROI 的工程闭环。  
> **范围边界**: 本 TodoList 不要求所有 Family 立刻行业领先；v3.3 的目标是让行业领先治理系统真实运行，并完成 Engineering / Knowledge / Customer Service 三条 P0 Pilot 的最小闭环。

> **实现状态（2026-06-01）**: WS0–WS16 已在仓库中落地；本 TodoList 中所有明确定义的 P0 / P1 可执行项已完成。本文未单独定义新的 P2 交付项，P2 在本版本中仍表示“后续增强”分类，不构成额外交付清单。v3.3 当前状态为 `implementation baseline + P0 pilot launch ready`，不是全量 `industry-leading` 声明版本。

---

## 0. 总体执行原则

### 0.1 不再继续横向扩展文档

下一阶段重点不是继续增加大文档，而是：

```text
SOT
→ Inventory Scanner
→ CoverageCard Generator
→ P0 ScenarioCard
→ Eval / Red-team / ToolRisk / TrainingDataPolicy
→ CI Gate
→ P0 Pilot
→ Dashboard
→ Leadership Claim Gate
```

### 0.2 优先级定义

| 优先级 | 含义 | 阻断范围 |
|---|---|---|
| P0 | v3.3 release 必须完成 | 阻断 v3.3 RC |
| P1 | v3.3 可带部分完成，但需有 backlog | 不阻断 RC，但阻断 final 或 v3.4 |
| P2 | 后续增强 | 不阻断 v3.3 |

### 0.3 v3.3 只做 3 条 P0 Pilot

| Pilot | 覆盖 division | v3.3 目标 |
|---|---|---|
| Engineering Pilot | coding + qa/devops/security 子能力 | issue / CI failure → patch → tests → PR draft |
| Knowledge Pilot | knowledge-base + research | source reliability → citation verification → evidence graph → conclusion |
| Customer Service Pilot | customer-service + support | customer message → policy lookup → tool action draft → HITL → response / handoff |

### 0.4 暂不做的事项

以下事项不进入 v3.3 主线，避免范围爆炸：

```text
legal / healthcare / finance / HR 的自动高影响动作
自动交易 / 自动付款 / 自动退款无审批
完整 CRM 自动写入
完整 desktop computer-use
完整 Figma / asset production 自动化
所有 division 同步 production-ready
在线编辑 CoverageCard / policy / release gate
```

---

## 1. 里程碑总览

| 里程碑 | 时间建议 | 目标 | 关键产物 |
|---|---|---|---|
| M1 | 第 1–2 周 | 建立 SOT 与真实 division inventory | scanner、inventory JSON、aliases |
| M2 | 第 3–4 周 | 生成 CoverageCard / FamilyPolicy / ScenarioCard 草稿 | YAML registry、schema、warning-only CI |
| M3 | 第 5–8 周 | 启动 3 条 P0 Pilot 的 eval / red-team / tool risk | eval datasets、redteam suite、tool descriptors |
| M4 | 第 9–12 周 | 接入 P0 blocking CI、只读 Admin Console、ROI baseline | CI gate、dashboard、pilot report |
| M5 | 第 13 周 | v3.3 Release Candidate | release-readiness report |

---

## 2. 工作流总表

| Workstream | 名称 | 优先级 | Owner 建议 |
|---|---|---:|---|
| WS0 | v3.2 Release Baseline 核验 | P0 | Architecture Owner |
| WS1 | Division Inventory Scanner | P0 | Platform Infra Owner |
| WS2 | SOT / Schema / Registry | P0 | Governance Owner |
| WS3 | CoverageCard Generator | P0 | Platform Infra Owner |
| WS4 | BusinessScenarioCard Registry | P0 | Product / Domain Owner |
| WS5 | ToolAction R0–R5 风险体系 | P0 | Security Owner |
| WS6 | EvalDatasetCard 与 Eval Suite | P0 | Eval Owner |
| WS7 | Red-team Suite 与 Severity | P0 | Security / Red-team Owner |
| WS8 | TrainingDataPolicy 与 Revocation | P0 | Data Governance Owner |
| WS9 | CI Gate 接入 | P0 | DevOps Owner |
| WS10 | P0 Engineering Pilot | P0 | Engineering Agent Owner |
| WS11 | P0 Knowledge Pilot | P0 | Knowledge Platform Owner |
| WS12 | P0 Customer Service Pilot | P0 | Enterprise Ops Owner |
| WS13 | ROI / Dashboard / Evidence Package | P0 | Ops Analytics Owner |
| WS14 | Admin Console 只读版 | P1 | UI Owner |
| WS15 | Leadership Claim Scanner | P1 | Governance Owner |
| WS16 | v3.3 Release Readiness | P0 | Release Owner |

## 2.1 TODO 完成矩阵

| TODO | 优先级 | 当前状态 | 备注 |
|---|---|---|---|
| TODO-0001 | P0 | done | 唯一 v3.2 release 文档与 docs index / root guide 索引已收口 |
| TODO-0002 | P0 | done | v3.2 baseline verification 已落仓 |
| TODO-0101 | P0 | done | inventory scanner / generated report / diff 已可运行 |
| TODO-0102 | P0 | done | division inventory schema 已落仓并用于校验 |
| TODO-0103 | P0 | done | alias map 已落仓并纳入 scanner |
| TODO-0201 | P0 | done | division coverage SOT 已落仓 |
| TODO-0202 | P0 | done | 6 个 FamilyPolicy 已落仓 |
| TODO-0203 | P0 | done | 核心 schema 已落仓 |
| TODO-0301 | P0 | done | CoverageCard generator 已支持 write/check |
| TODO-0302 | P0 | done | EvidenceScore / EvidenceRefs / lastUpdatedAt 已落仓 |
| TODO-0401 | P0 | done | 6 个 P0 ScenarioCard 已落仓 |
| TODO-0501 | P0 | done | ToolAction risk taxonomy 已落仓 |
| TODO-0502 | P0 | done | P0 tool action descriptors 已全覆盖 |
| TODO-0503 | P0 | done | ToolGateway runtime enforcement + tests 已接入 |
| TODO-0601 | P0 | done | EvalDatasetCard schema 已落仓 |
| TODO-0602 | P0 | done | SWE-style eval baseline 已落仓 |
| TODO-0603 | P0 | done | Knowledge citation/source eval baseline 已落仓 |
| TODO-0604 | P0 | done | Customer Service τ-style eval baseline 已落仓 |
| TODO-0701 | P0 | done | RedTeam severity schema 已落仓 |
| TODO-0702 | P0 | done | Engineering AWI red-team suite 已落仓 |
| TODO-0703 | P0 | done | Knowledge red-team suite 已落仓 |
| TODO-0704 | P0 | done | Customer Service red-team suite 已落仓 |
| TODO-0801 | P0 | done | P0 TrainingDataPolicy 已覆盖 |
| TODO-0802 | P0 | done | Data Revocation Policy 已落仓 |
| TODO-0901 | P0 | done | warning-only governance audit 可本地复现 |
| TODO-0902 | P0 | done | P0 blocking gate 已落仓并有测试覆盖 |
| TODO-0903 | P1 | done | production-ready gate 已实现，仍保持非 RC 阻断定位 |
| TODO-1001 | P0 | done | Engineering pilot workflow / scenario / docs 已落仓 |
| TODO-1002 | P0 | done | PatchGate 初版已实现并导出 structured report |
| TODO-1003 | P0 | done | Engineering pilot 指标报告已落仓 |
| TODO-1101 | P0 | done | Knowledge pilot workflow / scenario / docs 已落仓 |
| TODO-1102 | P0 | done | CitationVerifier 初版已实现 |
| TODO-1103 | P0 | done | Knowledge pilot 指标报告已落仓 |
| TODO-1201 | P0 | done | Customer Service pilot workflow / scenario / docs 已落仓 |
| TODO-1202 | P0 | done | Policy adherence evaluator 初版已实现 |
| TODO-1203 | P0 | done | Customer Service pilot 指标报告已落仓 |
| TODO-1301 | P0 | done | ROI measurement protocol 已落仓 |
| TODO-1302 | P0 | done | P0 ROI config 已落仓 |
| TODO-1303 | P0 | done | 3 个 leadership evidence package 已落仓 |
| TODO-1401 | P1 | done | Admin Console read-only spec 已落仓 |
| TODO-1402 | P1 | done | Division Inventory read-only 页面已接入 |
| TODO-1501 | P1 | done | claim scanner + allowlist / false-positive 治理已接入 |
| TODO-1601 | P0 | done | v3.3 release-readiness report 已落仓 |
| TODO-1602 | P0 | done | RC gate 条件已由资产与治理脚本覆盖 |

---

# 3. WS0 — v3.2 Release Baseline 核验

## 当前状态

| Workstream | 状态 | 关键产物 |
|---|---|---|
| WS0 | done | `docs_zh/reviews/v3_2_release_baseline_verification.md` |
| WS1 | done | `scripts/ci/audit-division-inventory.mjs` |
| WS2 | done | `docs_zh/governance/division-coverage-sot.md` |
| WS3 | done | `scripts/generate-division-coverage-cards.mjs` |
| WS4 | done | `config/division-coverage/scenarios/*.yaml` |
| WS5 | done | `config/tool-risk/*` + runtime enforcement |
| WS6 | done | `eval/schemas` + `eval/divisions/*` |
| WS7 | done | `redteam/severity.schema.json` + `redteam/divisions/*` |
| WS8 | done | `training-data-policy/*` |
| WS9 | done | `scripts/ci/audit-domain-coverage.mjs` + CI workflow |
| WS10 | done | `docs_zh/pilots/engineering-pilot.md` + `patch-gate.ts` |
| WS11 | done | `docs_zh/pilots/knowledge-pilot.md` + `citation-verifier.ts` |
| WS12 | done | `docs_zh/pilots/customer-service-pilot.md` + `policy-adherence-evaluator.ts` |
| WS13 | done | `roi/*` + leadership evidence packages |
| WS14 | done | `ui/packages/features/division-inventory/` |
| WS15 | done | `audit-leadership-claims.mjs` warning scanner |
| WS16 | done | `docs_zh/releases/automatic_agent_platform_v3_3_release_readiness.md` |

## TODO-0001：确认唯一 release 文档存在

- **优先级**: P0
- **Owner**: Architecture Owner
- **产物**: `docs_zh/reference/automatic_agent_platform_v3_2_final_release.md`
- **验收标准**:
  - 仓库只保留一个 v3.2 final release 文档。
  - 不存在 `fixed`、`copy`、`rc`、`draft` 等重复版本。
  - README / AGENTS / CLAUDE / docs index 指向唯一 release 文档。
- **阻断条件**:
  - 同一版本存在多个 release 文件。
  - 文档路径不被 docs index 收录。

## TODO-0002：核验 v3.2 文档声明与实际仓库状态

- **优先级**: P0
- **Owner**: Architecture Owner
- **产物**: `docs_zh/reviews/v3_2_release_baseline_verification.md`
- **验收标准**:
  - 明确哪些内容已实现，哪些仅为 v3.3 设计目标。
  - 不允许文档暗示当前系统已经 industry-leading。
  - 明确 v3.2 是 governance baseline，不是能力认证。
- **检查项**:
  - Release Scope 存在。
  - Claim 自我约束存在。
  - No-go Policy 存在。
  - Leadership Claim Gate 存在。
  - References Appendix 存在。

---

# 4. WS1 — Division Inventory Scanner

## TODO-0101：实现 division inventory scanner

- **优先级**: P0
- **Owner**: Platform Infra Owner
- **文件**: `scripts/ci/audit-division-inventory.mjs`
- **扫描源**:
  - `divisions/`
  - `config/domains/`
  - `config/quality/division-catalog.json`
  - `src/domains/`
  - `src/plugins/`
  - `docs_zh/`
  - `docs_en/`
  - `tests/`
  - `ui/packages/features/`
- **输出**:
  - `config/division-coverage/inventory/division-inventory.generated.json`
  - `config/division-coverage/inventory/division-inventory.summary.md`
  - `config/division-coverage/inventory/division-inventory.diff.json`
- **验收标准**:
  - 能列出全部 divisionId。
  - 能发现 orphan / duplicate / alias / missing owner / missing eval / missing red-team。
  - CI 中可运行。
  - 输出 JSON schema 可校验。
- **阻断条件**:
  - scanner 只扫描部分目录。
  - scanner 结果不能稳定复现。
  - 输出包含时间戳但没有 deterministic mode。

## TODO-0102：定义 DivisionInventoryRecord schema

- **优先级**: P0
- **Owner**: Governance Owner
- **文件**: `config/division-coverage/schemas/division-inventory.schema.json`
- **字段必须包含**:
  - `divisionId`
  - `normalizedDivisionId`
  - `familyId`
  - `status`
  - `riskLevel`
  - `hasDivisionYaml`
  - `hasCoverageCard`
  - `hasScenarioCard`
  - `hasEval`
  - `hasRedTeam`
  - `hasTrainingPolicy`
  - `hasOwner`
  - `blockers`
- **验收标准**:
  - scanner 输出可被 schema 校验。
  - 缺字段时 CI 报错。
  - `blockers` 使用枚举，不使用自由文本。

## TODO-0103：生成 alias map

- **优先级**: P0
- **Owner**: Governance Owner
- **文件**: `config/division-coverage/aliases.yaml`
- **必须处理**:
  - `qa` vs `quality-assurance`
  - `game-dev` vs `gaming`
  - `livestream` vs `live-streaming`
  - `it-ops` vs `it-operations`
  - `finance-accounting` vs `financial-services`
  - `research` vs `academic-research` vs `industry-research`
- **验收标准**:
  - alias 有 `canonical`、`mode`、`removalTargetVersion`。
  - deprecated alias 不允许新代码引用。
  - docs 只能使用 canonical ID。

---

# 5. WS2 — SOT / Schema / Registry

## TODO-0201：建立 division coverage SOT 文档

- **优先级**: P0
- **Owner**: Governance Owner
- **文件**: `docs_zh/governance/division-coverage-sot.md`
- **内容必须包含**:
  - familyId SOT
  - divisionId SOT
  - scenarioId SOT
  - toolId/actionId SOT
  - riskLevel SOT
  - status SOT
  - eval/red-team/training policy SOT
- **验收标准**:
  - 明确“配置是 SOT，文档是说明，代码是实现，CI 是裁判”。
  - 每类对象有唯一权威路径。
  - docs 不允许重复声明 production-ready。

## TODO-0202：定义 6 个 FamilyPolicy

- **优先级**: P0
- **Owner**: Governance Owner
- **文件**:
  - `config/division-coverage/families/engineering.yaml`
  - `config/division-coverage/families/knowledge-research.yaml`
  - `config/division-coverage/families/enterprise-ops.yaml`
  - `config/division-coverage/families/gtm-content.yaml`
  - `config/division-coverage/families/creative-production.yaml`
  - `config/division-coverage/families/regulated.yaml`
- **每个文件必须包含**:
  - `familyId`
  - `defaultRiskLevel`
  - `defaultAutonomyBoundary`
  - `requiredEvalSuites`
  - `requiredRedTeamSuites`
  - `defaultToolPolicyRef`
  - `defaultMemoryPolicyRef`
  - `defaultTrainingDataPolicyRef`
  - `defaultReleaseGateRef`
  - `leadershipTargetsRef`
- **验收标准**:
  - 6 个 Family 全覆盖。
  - regulated family 默认 `noAutonomousHighImpactAction=true`。
  - high-risk override 明确外部模型路由和训练导出策略。

## TODO-0203：定义核心 schema

- **优先级**: P0
- **Owner**: Governance Owner
- **文件**:
  - `config/division-coverage/schemas/domain-family-policy.schema.json`
  - `config/division-coverage/schemas/division-coverage-card.schema.json`
  - `config/division-coverage/schemas/business-scenario-card.schema.json`
  - `config/division-coverage/schemas/division-raci.schema.json`
  - `config/division-coverage/schemas/division-lifecycle.schema.json`
  - `config/division-coverage/schemas/division-training-data-policy.schema.json`
- **验收标准**:
  - schema 可被 CI 校验。
  - 不允许自由文本状态枚举。
  - risk/autonomy/tool/action 均使用枚举。

---

# 6. WS3 — CoverageCard Generator

## TODO-0301：实现 CoverageCard 自动生成器

- **优先级**: P0
- **Owner**: Platform Infra Owner
- **文件**: `scripts/generate-division-coverage-cards.mjs`
- **输入**:
  - inventory generated JSON
  - family policy
  - aliases map
- **输出**:
  - `config/division-coverage/divisions/<divisionId>.yaml`
- **验收标准**:
  - 所有 division 都有 CoverageCard。
  - 未知字段用 `TBD` 或 blocker 表示，不允许缺卡。
  - 已人工维护的 card 不被无保护覆盖。
  - generator 支持 `--check` 和 `--write`。
- **阻断条件**:
  - 有 division 无 CoverageCard。
  - 生成器每次运行产生非确定性 diff。

## TODO-0302：补齐 EvidenceScore / EvidenceRefs

- **优先级**: P0
- **Owner**: Governance Owner
- **文件**: `config/division-coverage/schemas/division-coverage-card.schema.json`
- **字段**:
  - `evidence.design`
  - `evidence.implementation`
  - `evidence.evaluation`
  - `evidence.operation`
  - `evidence.flywheel`
  - 每项包含 `score`、`refs`、`lastUpdatedAt`、`evaluator`、`confidence`
- **验收标准**:
  - `production_ready` card 不允许 evidence refs 为空。
  - `confidence=low` 不允许进入 pilot 以上状态。
  - evidence ref 指向不存在的 artifact 时 CI 失败。

---

# 7. WS4 — BusinessScenarioCard Registry

## TODO-0401：定义 P0 ScenarioCard

- **优先级**: P0
- **Owner**: Product / Domain Owner
- **文件**:
  - `config/division-coverage/scenarios/issue-to-patch.yaml`
  - `config/division-coverage/scenarios/ci-failure-analysis.yaml`
  - `config/division-coverage/scenarios/knowledge-citation-answer.yaml`
  - `config/division-coverage/scenarios/research-conclusion-to-experiment.yaml`
  - `config/division-coverage/scenarios/customer-refund-policy.yaml`
  - `config/division-coverage/scenarios/customer-complaint-escalation.yaml`
- **每个 ScenarioCard 必须包含**:
  - `scenarioId`
  - `divisionId`
  - `familyId`
  - `userGoal`
  - `canonicalWorkflow`
  - `supportedAgentTasks`
  - `inputDataTypes`
  - `outputActions`
  - `toolActions`
  - `riskLevel`
  - `autonomyAllowed`
  - `evalSuiteRef`
  - `redTeamSuiteRef`
  - `successMetrics`
  - `safetyMetrics`
  - `roiMetrics`
  - `releaseGateRef`
- **验收标准**:
  - P0 pilot 全部有 ScenarioCard。
  - `outputActions` 中有 write action 时必须绑定 ToolAction risk。
  - `riskLevel >= high` 必须有 red-team suite。

---

# 8. WS5 — ToolAction R0–R5 风险体系

## TODO-0501：定义 ToolAction Risk Taxonomy

- **优先级**: P0
- **Owner**: Security Owner
- **文件**: `config/tool-risk/taxonomy.yaml`
- **风险等级**:
  - R0 Read-only
  - R1 Draft-only
  - R2 Internal Write
  - R3 External Write
  - R4 Destructive
  - R5 Regulated / Financial / Legal
- **验收标准**:
  - 每级有定义、示例、默认策略。
  - R3+ 默认需要 HITL 或 PreparedAction。
  - R5 默认禁止自动执行。

## TODO-0502：标注 P0 工具 action descriptor

- **优先级**: P0
- **Owner**: Security Owner
- **文件**:
  - `config/tool-risk/tool-action-descriptors/github.yaml`
  - `config/tool-risk/tool-action-descriptors/shell.yaml`
  - `config/tool-risk/tool-action-descriptors/test-runner.yaml`
  - `config/tool-risk/tool-action-descriptors/knowledge-search.yaml`
  - `config/tool-risk/tool-action-descriptors/order.yaml`
  - `config/tool-risk/tool-action-descriptors/refund.yaml`
  - `config/tool-risk/tool-action-descriptors/ticket.yaml`
- **每个 action 必须包含**:
  - `toolId`
  - `actionId`
  - `riskClass`
  - `sideEffect`
  - `reversible`
  - `requiresHITL`
  - `requiresPreparedAction`
  - `rollbackPolicyRef`
  - `dataClassesTouched`
  - `allowedFamilies`
- **验收标准**:
  - P0 scenario 引用的 tool action 100% 有 descriptor。
  - R4/R5 没有 HITL 直接 CI fail。
  - shell / GitHub write action 默认不允许由 untrusted source 直接驱动。

## TODO-0503：ToolGateway enforcement 设计接入

- **优先级**: P0
- **Owner**: Execution / ToolGateway Owner
- **文件**:
  - `src/platform/.../tool-gateway/tool-risk-enforcer.ts`
  - `tests/unit/.../tool-risk-enforcer.test.ts`
- **验收标准**:
  - runtime 调用工具前读取 ToolActionDescriptor。
  - R3+ 无 HITL/preparedAction 时拒绝。
  - R5 自动执行永远拒绝。
  - 拒绝产生结构化 receipt 和 audit event。

---

# 9. WS6 — EvalDatasetCard 与 Eval Suite

## TODO-0601：定义 EvalDatasetCard schema

- **优先级**: P0
- **Owner**: Eval Owner
- **文件**: `eval/schemas/eval-dataset-card.schema.json`
- **字段**:
  - `datasetId`
  - `divisionId`
  - `scenarioId`
  - `version`
  - `source`
  - `taskCount`
  - `split`
  - `contaminationStatus`
  - `privacyStatus`
  - `labelingMethod`
  - `allowedForTraining`
  - `allowedForReleaseGate`
  - `retentionPolicyRef`
  - `frozenHash`
- **验收标准**:
  - P0 eval dataset 均有 card。
  - release / heldout split 默认 no-train。
  - contaminationStatus=unknown 不允许用于 release gate。

## TODO-0602：Engineering SWE-style eval 初版

- **优先级**: P0
- **Owner**: Engineering Eval Owner
- **目录**: `eval/datasets/swe-style/`
- **要求**:
  - internal heldout tasks ≥ 50。
  - 每个 task 有 issue、repo snapshot、expected test、baseline result。
  - heldout no-train。
  - frozenHash 固定。
- **指标**:
  - patch apply success
  - targeted test pass
  - human edit distance
  - P2P preservation
  - failure taxonomy
- **验收标准**:
  - eval runner 可运行。
  - 输出 report 可被 EvidenceRefs 引用。

## TODO-0603：Knowledge citation/source eval 初版

- **优先级**: P0
- **Owner**: Knowledge Eval Owner
- **目录**: `eval/datasets/citation-source/`
- **要求**:
  - eval cases ≥ 100。
  - 覆盖 source reliability、citation correctness、source freshness、hallucinated claim。
  - 内部资料与公开资料区分 privacyStatus。
- **验收标准**:
  - CitationVerifier 初版可跑。
  - 输出 citation coverage/correctness。
  - stale source detector 有报告。

## TODO-0604：Customer Service τ-style eval 初版

- **优先级**: P0
- **Owner**: Enterprise Ops Eval Owner
- **目录**: `eval/datasets/tau-style/`
- **要求**:
  - scenario cases ≥ 100。
  - 覆盖 order/refund/complaint/escalation。
  - 每个 case 有 policy reference 和 expected tool action。
- **验收标准**:
  - 输出 task completion、policy violation、tool argument correctness、handoff correctness。
  - refund/write action 无 HITL 时必须失败。

---

# 10. WS7 — Red-team Suite 与 Severity

## TODO-0701：定义 RedTeam Severity schema

- **优先级**: P0
- **Owner**: Red-team Owner
- **文件**: `redteam/severity.schema.json`
- **Severity**:
  - Critical
  - High
  - Medium
  - Low
- **验收标准**:
  - 每个 red-team result 必须有 severity。
  - Critical success > 0 阻断 release。
  - High success > 0 阻断 high-risk division release。

## TODO-0702：Engineering AWI red-team

- **优先级**: P0
- **Owner**: Security Owner
- **文件**: `redteam/divisions/coding/redteam-suite.yaml`
- **覆盖攻击**:
  - malicious issue body
  - malicious PR comment
  - CI log injection
  - tool output injection
  - secret exfiltration request
  - model-derived shell command injection
- **要求**:
  - cases ≥ 30。
  - critical success = 0。
  - 所有 case 有 evidenceRefs。

## TODO-0703：Knowledge source/citation poisoning red-team

- **优先级**: P0
- **Owner**: Security + Knowledge Owner
- **文件**: `redteam/divisions/knowledge-base/redteam-suite.yaml`
- **覆盖攻击**:
  - fake citation
  - source poisoning
  - stale document trap
  - citation laundering
  - conclusion overclaim
- **要求**:
  - cases ≥ 30。
  - fake citation critical/high success = 0。

## TODO-0704：Customer Service policy bypass red-team

- **优先级**: P0
- **Owner**: Enterprise Ops Security Owner
- **文件**: `redteam/divisions/customer-service/redteam-suite.yaml`
- **覆盖攻击**:
  - malicious customer message
  - policy bypass request
  - fake identity / fake entitlement
  - tool argument injection
  - refund escalation bypass
- **要求**:
  - cases ≥ 30。
  - refund/write action bypass = 0。

---

# 11. WS8 — TrainingDataPolicy 与 Revocation

## TODO-0801：定义 P0 TrainingDataPolicy

- **优先级**: P0
- **Owner**: Data Governance Owner
- **文件**:
  - `training-data-policy/divisions/coding.yaml`
  - `training-data-policy/divisions/knowledge-base.yaml`
  - `training-data-policy/divisions/research.yaml`
  - `training-data-policy/divisions/customer-service.yaml`
  - `training-data-policy/divisions/support.yaml`
- **策略**:
  - coding: allowed / redacted_only；secrets/logs 必须脱敏。
  - knowledge-base: public allowed；internal restricted。
  - customer-service: redacted_only。
  - regulated: no_train。
- **验收标准**:
  - P0 division 100% 有 policy。
  - 任何 production-derived 数据默认需要 DataBatchCard。
  - heldout eval 默认 no-train。

## TODO-0802：定义 Data Revocation Policy

- **优先级**: P0
- **Owner**: Data Governance Owner
- **文件**: `training-data-policy/revocation.yaml`
- **affectedStores**:
  - memory
  - eval
  - training_export
  - analytics
  - evidence_projection
  - dashboard_cache
- **验收标准**:
  - customer-service 删除请求必须传播到 memory/dashboard/training export。
  - stale/invalid source 必须影响 citation eval。
  - high-risk division 默认 requiresModelDataTombstone=true。

---

# 12. WS9 — CI Gate 接入

## TODO-0901：接入 warning-only CI

- **优先级**: P0
- **Owner**: DevOps Owner
- **文件**:
  - `scripts/ci/audit-domain-coverage.mjs`
  - `.github/workflows/ci.yml`
- **warning-only 检查**:
  - division inventory
  - coverage card
  - family policy
  - tool risk
  - training data policy
  - eval dataset card
  - red-team severity
- **验收标准**:
  - CI 输出 report，但不阻断非 P0。
  - report 上传为 artifact。
  - 本地命令可复现。

## TODO-0902：接入 P0 blocking CI

- **优先级**: P0
- **Owner**: DevOps Owner
- **阻断范围**:
  - coding
  - knowledge-base
  - research
  - customer-service
  - support
- **阻断条件**:
  - P0 division 无 CoverageCard。
  - P0 scenario 无 ScenarioCard。
  - P0 tool action 无 riskClass。
  - P0 eval dataset 无 DatasetCard。
  - P0 red-team 无 severity。
  - P0 training policy 缺失。
  - critical red-team success > 0。
- **验收标准**:
  - PR 中破坏 P0 gate 会失败。
  - blocking 规则有测试覆盖。

## TODO-0903：接入 production-ready blocking gate

- **优先级**: P1
- **Owner**: DevOps Owner
- **阻断条件**:
  - 任意 division 声明 production_ready 但证据不足。
  - leadership claim 无 LeadershipClaimRecord。
  - R3+ tool action 无 HITL。
  - eval/red-team 结果过期。
- **验收标准**:
  - 不阻断 v3.3 RC，但必须进入 v3.3 backlog。

---

# 13. WS10 — P0 Engineering Pilot

## TODO-1001：定义 Engineering Pilot workflow

- **优先级**: P0
- **Owner**: Engineering Agent Owner
- **流程**:

```text
GitHub Issue / CI Failure
→ Repo Map
→ Fault Localization
→ Plan
→ Patch
→ Targeted Tests
→ PR Draft
→ Reviewer Feedback
→ Evidence Package
```

- **产物**:
  - `config/division-coverage/scenarios/issue-to-patch.yaml`
  - `eval/divisions/coding/eval-suite.yaml`
  - `docs_zh/pilots/engineering-pilot.md`
- **验收标准**:
  - dry-run 可跑通。
  - 每一步有 receipt。
  - 失败进入 failure taxonomy。

## TODO-1002：实现 PatchGate 初版

- **优先级**: P0
- **Owner**: Engineering Agent Owner
- **能力**:
  - patch apply check
  - targeted tests
  - P2P preservation subset
  - unsafe file path check
  - secret diff scan
  - generated command check
- **验收标准**:
  - patch 未通过 gate 不生成 PR draft。
  - gate 输出 structured report。
  - report 可作为 EvidenceRef。

## TODO-1003：Engineering Pilot 指标报告

- **优先级**: P0
- **Owner**: Engineering Eval Owner
- **指标**:
  - heldout tasks ≥ 50
  - patch apply success
  - targeted test pass
  - human edit distance
  - PR draft rate
  - AWI critical success
- **v3.3 初始目标**:
  - patch apply success ≥ 80%
  - targeted test pass ≥ 40%
  - PR draft generated ≥ 70%
  - AWI critical success = 0
- **验收标准**:
  - 指标可计算，不要求立即行业领先。
  - 输出 pilot report。

---

# 14. WS11 — P0 Knowledge Pilot

## TODO-1101：定义 Knowledge Pilot workflow

- **优先级**: P0
- **Owner**: Knowledge Platform Owner
- **流程**:

```text
User research question
→ Source collection
→ Source reliability scoring
→ Claim extraction
→ Citation verification
→ Evidence graph
→ Conclusion
→ Experiment suggestion
→ Decision record
```

- **产物**:
  - `config/division-coverage/scenarios/knowledge-citation-answer.yaml`
  - `eval/divisions/knowledge-base/eval-suite.yaml`
  - `docs_zh/pilots/knowledge-pilot.md`
- **验收标准**:
  - CitationVerifier 可运行。
  - SourceReliabilityScorer 可运行。
  - ClaimEvidenceGraph 可输出。

## TODO-1102：CitationVerifier 初版

- **优先级**: P0
- **Owner**: Knowledge Eval Owner
- **能力**:
  - claim-to-source alignment
  - citation existence check
  - stale source detection
  - unsupported claim flag
- **验收标准**:
  - eval cases ≥ 100。
  - citation coverage / correctness 可计算。
  - hallucinated claim rate 可计算。

## TODO-1103：Knowledge Pilot 指标报告

- **优先级**: P0
- **Owner**: Knowledge Platform Owner
- **v3.3 初始目标**:
  - citation eval cases ≥ 100
  - citation coverage ≥ 90%
  - citation correctness ≥ 80%
  - source freshness 100% 记录
  - stale source detector 初版可运行
- **验收标准**:
  - 输出 pilot report。
  - 输出 failure taxonomy。

---

# 15. WS12 — P0 Customer Service Pilot

## TODO-1201：定义 Customer Service Pilot workflow

- **优先级**: P0
- **Owner**: Enterprise Ops Owner
- **流程**:

```text
Customer message
→ Intent
→ Policy lookup
→ Tool planning
→ API action draft
→ HITL if needed
→ Response
→ Handoff / escalation
→ SLA / CSAT / ROI tracking
```

- **产物**:
  - `config/division-coverage/scenarios/customer-refund-policy.yaml`
  - `config/division-coverage/scenarios/customer-complaint-escalation.yaml`
  - `eval/divisions/customer-service/eval-suite.yaml`
  - `docs_zh/pilots/customer-service-pilot.md`
- **验收标准**:
  - τ-style eval 可跑。
  - refund/write action 无 HITL 时被阻断。
  - handoff/escalation 有 receipt。

## TODO-1202：Policy adherence evaluator 初版

- **优先级**: P0
- **Owner**: Enterprise Ops Eval Owner
- **能力**:
  - policy lookup
  - action legality check
  - tool argument validation
  - handoff correctness
- **验收标准**:
  - scenario cases ≥ 100。
  - policy violation critical = 0。
  - tool argument correctness ≥ 80%。

## TODO-1203：Customer Service Pilot 指标报告

- **优先级**: P0
- **Owner**: Enterprise Ops Owner
- **指标**:
  - task completion
  - policy violation
  - handoff accuracy
  - SLA improvement
  - HITL coverage
  - malicious message red-team result
- **验收标准**:
  - 输出 pilot report。
  - 输出 ROI baseline。

---

# 16. WS13 — ROI / Dashboard / Evidence Package

## TODO-1301：定义 ROI Measurement Protocol

- **优先级**: P0
- **Owner**: Ops Analytics Owner
- **文件**: `roi/measurement-protocol.md`
- **方法**:
  - before_after
  - ab_test
  - assisted_vs_manual
  - cohort_comparison
- **验收标准**:
  - P0 pilot 至少使用一种 ROI baseline 方法。
  - ROI 不只记录 timeSaved，还记录 costDelta、qualityDelta、riskDelta。

## TODO-1302：定义 P0 ROI config

- **优先级**: P0
- **Owner**: Ops Analytics Owner
- **文件**:
  - `roi/divisions/coding.yaml`
  - `roi/divisions/knowledge-base.yaml`
  - `roi/divisions/customer-service.yaml`
- **验收标准**:
  - 每个 pilot 有 ROI 指标、采样窗口、sample size 要求。
  - confidence 可计算。

## TODO-1303：生成 Leadership Evidence Package

- **优先级**: P0
- **Owner**: Release Owner
- **目录**:
  - `docs_zh/divisions/coding/leadership-evidence/`
  - `docs_zh/divisions/knowledge-base/leadership-evidence/`
  - `docs_zh/divisions/customer-service/leadership-evidence/`
- **必须包含**:
  - coverage-card.yaml
  - scenario-index.md
  - eval-report.md
  - redteam-report.md
  - roi-report.md
  - risk-report.md
  - release-readiness.md
- **验收标准**:
  - 每份 report 有 EvidenceRefs。
  - 不允许声明 industry-leading，除非 Claim Gate 通过。

---

# 17. WS14 — Admin Console 只读版

## TODO-1401：定义 Admin Console 页面 spec

- **优先级**: P1
- **Owner**: UI Owner
- **文件**: `docs_zh/ui/admin-console-division-governance.md`
- **页面**:
  - Division Inventory
  - CoverageCard Viewer
  - Scenario Registry
  - Eval & Red-team Reports
  - ROI Dashboard
  - Release Gate Board
  - Evidence Explorer
  - Tool Risk Registry
  - Budget Monitor
- **验收标准**:
  - v3.3 只要求只读。
  - UI 数据必须来自 SOT / generated reports。
  - 不允许 UI mock production_ready。

## TODO-1402：实现 Division Inventory 只读页面

- **优先级**: P1
- **Owner**: UI Owner
- **文件建议**:
  - `ui/packages/features/division-inventory/`
  - `ui/apps/web/src/feature-registry.ts`
- **验收标准**:
  - 能展示 generated inventory。
  - 能按 family/status/risk/blocker 过滤。
  - 不做在线编辑。

---

# 18. WS15 — Leadership Claim Scanner

## TODO-1501：实现 claim scanner

- **优先级**: P1
- **Owner**: Governance Owner
- **文件**: `scripts/ci/audit-leadership-claims.mjs`
- **扫描范围**:
  - README
  - docs_zh / docs_en
  - UI copy
  - release notes
  - marketing docs
- **扫描关键词**:
  - industry-leading
  - 行业领先
  - best-in-class
  - production-ready
  - benchmark-leading
  - fully autonomous
- **验收标准**:
  - 没有 LeadershipClaimRecord 时，不能使用正式 claim。
  - 支持 allowlist 和 false positive 记录。
  - v3.3 可 warning-only，v3.4 blocking。

---

# 19. WS16 — v3.3 Release Readiness

## TODO-1601：编写 v3.3 release-readiness report

- **优先级**: P0
- **Owner**: Release Owner
- **文件**: `docs_zh/releases/automatic_agent_platform_v3_3_release_readiness.md`
- **必须包含**:
  - v3.2 → v3.3 change summary
  - inventory scanner 状态
  - CoverageCard 生成状态
  - P0 pilot 状态
  - eval/red-team 状态
  - CI gate 状态
  - blocker 清单
  - 是否允许 v3.3 RC
- **验收标准**:
  - 不允许 claim 当前系统 industry-leading。
  - 明确 v3.3 是 implementation baseline + P0 pilot launch。

## TODO-1602：v3.3 Release Candidate Gate

- **优先级**: P0
- **Owner**: Release Owner
- **v3.3 RC 必须满足**:
  - Division Inventory Scanner 可运行。
  - 所有现存 division 有 CoverageCard 草稿。
  - 6 个 Family 有 FamilyPolicy。
  - P0 三条 pilot 有 ScenarioCard。
  - P0 三条 pilot 有 eval suite 初版。
  - P0 三条 pilot 有 red-team suite 初版。
  - P0 tool actions 有 R0–R5 riskClass。
  - P0 eval datasets 有 EvalDatasetCard。
  - P0 divisions 有 TrainingDataPolicy。
  - warning-only CI 接入。
  - P0 blocking CI 接入。
  - P0 pilot report 初版存在。

---

# 20. 30 / 60 / 90 天排期

## 20.1 前 30 天：治理地基

| 周 | 任务 | 产物 |
|---|---|---|
| Week 1 | Division Inventory Scanner | inventory generated JSON |
| Week 1 | Alias Map | aliases.yaml |
| Week 2 | FamilyPolicy + Schema | families/*.yaml + schemas |
| Week 2 | CoverageCard Generator | divisions/*.yaml |
| Week 3 | P0 ScenarioCard | scenarios/*.yaml |
| Week 3 | ToolAction Taxonomy | tool-risk/*.yaml |
| Week 4 | Warning-only CI | audit reports |
| Week 4 | First blocker report | division-inventory.summary.md |

## 20.2 31–60 天：P0 Pilot 最小闭环

| Pilot | 任务 | 产物 |
|---|---|---|
| Engineering | SWE-style heldout ≥ 50 | eval/datasets/swe-style |
| Engineering | issue-to-patch dry run | engineering pilot report |
| Knowledge | citation/source eval ≥ 100 | citation eval report |
| Knowledge | CitationVerifier 初版 | knowledge pilot report |
| Customer Service | τ-style eval ≥ 100 | customer-service eval report |
| Customer Service | policy adherence evaluator | policy eval report |

## 20.3 61–90 天：运营化与 RC

| 任务 | 产物 |
|---|---|
| P0 red-team reports | redteam reports |
| P0 ROI baseline | roi reports |
| P0 blocking CI | CI gate |
| Admin Console 只读页面 spec | UI spec |
| Leadership Claim scanner warning-only | claim report |
| v3.3 release-readiness | release-readiness.md |

---

# 21. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 所有 division 同时开工 | 范围失控 | 只做 3 条 P0 Pilot |
| 先做 UI 后做 SOT | 再次出现文档/代码漂移 | 先 scanner，再 UI |
| Eval 数据集质量低 | 指标无意义 | EvalDatasetCard + frozenHash + contamination scan |
| ToolRisk 只在配置，不在 runtime enforcement | 安全门禁失效 | ToolGateway 调用前强制检查 |
| ROI 缺 baseline | 无法证明业务价值 | before/after 或 assisted_vs_manual |
| P0 blocking CI 太早过严 | 影响开发效率 | 先 warning-only，再 P0 blocking |
| Leadership claim 被滥用 | 对外承诺风险 | Claim scanner + ClaimRecord |
| 数据撤销不传播 | 合规风险 | DataRevocationPolicy |

---

# 22. 最小成功标准

v3.3 成功不是“每个 family 已经行业领先”，而是：

```text
1. 系统知道自己有哪些 division。
2. 每个 division 都有 CoverageCard。
3. P0 scenario 有真实 eval/red-team/tool-risk/training-policy。
4. P0 pilot 能跑出可复现报告。
5. CI 能阻断最关键的不合规状态。
6. Dashboard / report 能展示真实 blocker。
7. 没有证据的 industry-leading claim 会被阻断。
```

---

# 23. 最终建议

当前仓库已完成 v3.3 所需的治理落地，下一步不是继续补基础资产，而是：

```text
1. 维持 inventory / coverage / domain coverage CI 门禁
2. 按 release-readiness 报告推进 RC 验证
3. 在 v3.4 再决定 production-ready 阻断面是否扩大
```
