# ROI Measurement Protocol

v3.3 P0 pilot 的 ROI 统一按以下方法记录：

- `before_after`
- `ab_test`
- `assisted_vs_manual`
- `cohort_comparison`

每条 pilot 至少记录：

- `timeSaved`
- `costDelta`
- `qualityDelta`
- `riskDelta`

P0 当前默认采用 `assisted_vs_manual`，并补充 `before_after` 作为周度回顾基线。
