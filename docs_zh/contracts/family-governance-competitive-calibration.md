# Family Governance Competitive Calibration

## 目标

本文是 family benchmark / leadership claim / release gate 消费的治理 contract 文档。

把 `automatic_agent_platform_v3_2_final_release.md` 里提到的外部平台对标，从口号变成固定治理输入，明确我们看什么、不看什么，以及这些对标如何进入 family benchmark / claim review。

## 对标矩阵

| 平台 | 主要对标 family | 我们吸收的治理点 | 不直接照搬的部分 | 仓库消费路径 |
| --- | --- | --- | --- | --- |
| Gemini Enterprise | Knowledge / Research, Regulated | citation grounding、workspace evidence、审计可追溯 | 把“接了企业搜索”直接当成领先证明 | `benchmark-map.yaml` + `benchmark-calibration.yaml` + claim review evidenceRefs |
| Copilot Studio | Engineering, Enterprise Ops | connector governance、tool calling discipline、approval boundary | 把 connector 数量当 capability 分数 | benchmark calibration / release gate 的 policy & rollback consumption |
| Agentforce | Enterprise Ops, GTM / Content | workflow orchestration、handoff、customer-facing policy adherence | 允许 customer-visible write 直接自治放行 | `family-expansion.yaml` + no-go policy + tool risk |
| watsonx Orchestrate | Enterprise Ops, Regulated | runbook / approval / audit export 合规性 | 传统 BPM 覆盖率替代 agent safety | regulated no-autonomy guard + audit export completeness |

## 对账规则

1. 对标平台只能作为 benchmark 坐标，不作为 `industry_leading` 直接证据。
2. 任何对标结论必须能落到 family 的 `internalMappings`、`minimum-leading-evidence` 或 claim `evidenceRefs`。
3. 若外部平台强调的是平台广度，我们只吸收其中可 machine-check 的治理约束，不把营销项写入 claim。
4. 对标平台新增或替换时，必须同时更新：
   - `config/division-coverage/benchmark-map.yaml`
   - `config/division-coverage/benchmark-calibration.yaml`
   - 本文档

## 当前状态

- v3.2 已有 benchmark refs、claim scanner、no-go policy 和 release console 基线。
- 本文把 Gemini Enterprise / Copilot Studio / Agentforce / watsonx Orchestrate 的治理输入固定为可复核文档，不再停留在 review 备注。
