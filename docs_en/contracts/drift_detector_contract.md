# DriftDetector Contract

## 1. Scope

This contract defines the detector interface and behavior for `§63` drift detection.

## 2. Canonical Objects

- `DriftDetector`
- `DriftDetectorConfig`
- `DriftDetectionResult`

## 3. `DriftDetector` Interface

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

## 4. `DriftDetectorConfig` Minimum Fields

- `window_size` — statistical window size
- `threshold` — drift threshold
- `sensitivity` — detection sensitivity (0-1)
- `method` — detection method

## 5. `DriftDetectionResult` Minimum Fields

- `detector_id`
- `drift_detected` — boolean
- `drift_type` — input_drift | output_drift | behavioral_drift | quality_drift
- `confidence` — confidence (0-1)
- `severity` — SEV2 | SEV3 | SEV4
- `details` — detailed drift information

## 6. Rules

- DriftDetector must provide independent detection capability for each drift type.
- Detection results must include severity and confidence.
- Configuration changes must trigger recalibration.

## 7. Test Requirements

- unit: coverage for each drift detection algorithm
- integration: detector -> alert -> response chain
- contract: detector type and configuration integrity validation
