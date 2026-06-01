# Automatic Agent Platform v3.3 Release Readiness

## 定位

v3.3 是 `implementation baseline + P0 pilot launch`，不是全 family 行业领先声明版本。

## v3.2 -> v3.3 变化

- 新增 division inventory scanner
- 新增 coverage card generator
- 新增 P0 scenario / tool-risk / eval / red-team / training policy / ROI 资产
- 新增 warning-only 与 P0 blocking coverage gate
- 新增 division inventory readonly UI

## 状态

- inventory scanner: done
- coverage card generator: done
- family policy: done
- P0 pilots: done
- eval / red-team baseline: done
- CI gate: done
- readonly admin console: done

## RC 结论

当前允许进入 v3.3 RC，原因：

- Division Inventory Scanner 可运行
- 所有现存 division 可生成 CoverageCard
- 6 个 FamilyPolicy 已落仓
- P0 三条 pilot 有 scenario / eval / red-team / training policy / ROI baseline
- CI 已可在 warning 和 P0 blocking 模式下运行

## 非目标

- 不宣称整体行业领先
- 不宣称所有 family 已 production-ready
- regulated family 仍以 `HITL + audit + evidence` 为主
