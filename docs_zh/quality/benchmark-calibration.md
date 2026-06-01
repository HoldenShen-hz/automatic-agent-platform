# Benchmark Calibration Plan

## 目标

把 Family-level external benchmark 与当前平台的 internal evidence、release gate、claim gate 对齐，避免把“参考 benchmark”误写成“已经通过 claim”。

## 校准原则

- 外部 benchmark 只定义参考坐标，不直接等同于内部 claim 结论。
- internal metric 必须能映射到 `EvidencePackage`、`ScenarioCard`、`EvalDatasetCard`、`RedTeam` 或 release evidence。
- claim level 升级必须同时看 capability、safety、evidence、operation，不接受单一榜单替代治理结论。
- release gate 消费的是“是否满足治理断言”，claim review 消费的是“证据是否足以支撑对外文案”。

## 校准矩阵

| Family | External benchmark | Internal metric / evidence artifact | Owner | Refresh cadence | Release gate / claim review consumption |
|---|---|---|---|---|---|
| Engineering | SWE-bench Verified / BFCL / agentic PR studies | `patch_correctness`、`pr_acceptance`、`awi_redteam`、`eval://divisions/coding/*` | Engineering Eval Owner + Eng Platform Owner | monthly | release gate 关注 correctness / rollback / unsafe command；claim review 关注 heldout 规模、PR 接受率和红队结果 |
| Knowledge / Research | citation grounding / OTel GenAI spans / source-grounded QA studies | `citation_verifier`、`source_reliability`、`claim_evidence_graph`、`stale_doc_detector` | Knowledge Eval Owner + Knowledge Governance Owner | bi-weekly | release gate 关注 stale source / evidence completeness；claim review 关注 citation 样本量、结论可追溯性 |
| Enterprise Ops | tau-bench / policy adherence / workflow handoff studies | `policy_adherence`、`handoff_audit`、`sla_dashboard`、`roi_report` | Ops Eval Owner + Service Ops Owner | bi-weekly | release gate 关注 policy fail-close / handoff / SLA；claim review 关注真实 pilot 任务与 ROI |
| GTM / Content | brand safety / copyright / commerce action benchmarks | `brand_safety_eval`、`copyright_risk_eval`、`crm_action_safety`、`campaign_roi` | GTM Governance Owner + Growth Ops Owner | monthly | release gate 关注未审查发布与关键 CRM 写入；claim review 关注人审通过率与版权风险闭环 |
| Creative / Production | OSWorld / WebArena / VisualWebArena / visual grounding studies | `visual_grounding_eval`、`visual_regression`、`asset_provenance`、`copyright_risk_eval` | Creative Eval Owner + Design Systems Owner | monthly | release gate 关注资产溯源与视觉回归；claim review 关注多模态证据完整度和人工创意评审 |
| Regulated | NIST / OWASP / CSA agentic governance profiles | `hitl_coverage`、`audit_export_completeness`、`data_residency`、`restricted_data_redteam` | Policy Owner + Security Owner | monthly or on policy change | release gate 直接消费 no-autonomy guard；claim review 只允许 advisory / audit / evidence acceleration 范围的对外表述 |

## 操作步骤

1. 为每个 Family 在 `benchmark-map.yaml` 中声明 benchmark refs 与 internal metric mapping。
2. 为每个 mapping 绑定 owner、evidence artifact 和 refresh cadence。
3. 对 external benchmark 与内部真实任务差异大的部分建立 replayable heldout / red-team。
4. 把 release gate 必须消费的治理断言显式写入 gate criterion，不靠文档暗示。
5. 把 claim review 必须检查的 evidence completeness、freshness、owner signoff 固化到 operator workflow。

## v3.2 基线结论

- `benchmark-map.yaml` 已提供 machine-readable benchmark refs 与 internal mapping 基础。
- 本文现在补齐了 owner、refresh cadence、release gate / claim review consumption path。
- 后续新增 benchmark 时，必须同时更新本文与 `config/division-coverage/benchmark-map.yaml`，否则不得宣称 calibration 完整。
