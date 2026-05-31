# Benchmark Calibration Plan

## 目标

把 Family-level external benchmark 与当前平台的 internal evidence、release gate、claim gate 对齐，避免把“参考了 benchmark”误写成“已经达标”。

## 校准原则

- 外部 benchmark 只定义参考坐标，不直接等同于内部 claim 结论。
- internal metric 必须能映射到 `EvidencePackage`、`ScenarioCard`、`EvalDatasetCard` 或 `RedTeam`。
- claim level 升级必须同时看 capability、safety、evidence、operation，而不是只看单一分数。

## 校准步骤

1. 为每个 Family 明确 benchmark-to-metric mapping。
2. 为每个 mapping 指定 evidence owner 与 refresh cadence。
3. 对差异较大的 benchmark 建立 internal heldout 或 replayable scenario。
4. 把 calibration result 写回 release gate 与 claim review checklist。

## 当前 v3.2 校准范围

- Engineering: SWE-bench / BFCL / agentic PR studies
- Knowledge / Research: citation grounding / OTel GenAI spans
- Enterprise Ops: tau-bench / policy adherence
- GTM / Content: brand safety / copyright / ROI attribution
- Creative / Production: OSWorld / WebArena / VisualWebArena
- Regulated: NIST / OWASP / CSA agentic governance profiles
