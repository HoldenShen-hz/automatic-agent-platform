# DriftDetector Contract

## 1. 范围

本 contract 定义 `§63` 的漂移检测器接口和行为规范。

## 2. Canonical 对象

- `DriftDetector`
- `DriftDetectorConfig`
- `DriftDetectionResult`

## 3. `DriftDetector` 接口

```typescript
interface DriftDetector {
  detector_id: string;
  detector_type: DriftDetectorType;
  enabled: boolean;
  config: DriftDetectorConfig;
}

type DriftDetectorType =
  | "statistical_test"
  | "threshold_monitoring"
  | "sequence_comparison"
  | "sliding_window";
```

## 4. `DriftDetectorConfig` 最小字段

- `window_size` — 统计窗口大小（采样数）
- `threshold` — 漂移判定阈值
- `sensitivity` — 检测灵敏度 (0-1)
- `method` — 检测方法

## 5. `DriftDetectionResult` 最小字段

- `detector_id`
- `drift_detected` — boolean
- `drift_type` — input_drift | output_drift | behavioral_drift | quality_drift
- `confidence` — 置信度 (0-1)
- `severity` — SEV2 | SEV3 | SEV4
- `details` — 具体漂移信息

## 6. 规则

- DriftDetector 必须对每种漂移类型提供独立检测能力
- 检测结果必须包含 severity 和 confidence
- 配置变更必须触发重新校准

## 7. 测试要求

- unit：各类漂移检测算法覆盖
- integration：检测器 -> 告警 -> 响应链路
- contract：检测器类型与配置完整性校验
