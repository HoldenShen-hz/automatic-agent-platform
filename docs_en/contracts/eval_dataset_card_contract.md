# Eval Dataset Card Contract

> v4.3 repository contract. Covers the field semantics and governance boundary of `eval/schemas/eval-dataset-card.schema.json`.

## 1. Scope

`EvalDatasetCard` is the metadata card for an evaluation dataset. It is consumed by the release gate, contamination checks, training boundary enforcement, and retention governance. It is not the sample payload itself.

## 2. Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `datasetId` | `string` | Dataset ID |
| `divisionId` | `string` | Related division |
| `scenarioId` | `string` | Related scenario |
| `version` | `string` | Dataset version |
| `source` | `string` | Source description |
| `taskCount` | `integer >= 1` | Number of samples |
| `split` | `train \| heldout \| release \| shadow` | Dataset usage |
| `samples` | `string` | Repository-local path to the sample file or sample directory |
| `sampleCount` | `integer >= 1` | Declared sample count for the frozen snapshot |
| `contaminationStatus` | `clean \| suspected \| unknown` | Contamination status |
| `contaminationEvidence` | `string[]` | Evidence refs backing the contamination decision |
| `privacyStatus` | `public \| internal \| redacted \| restricted` | Privacy level |
| `labelingMethod` | `string` | Labeling method |
| `allowedForTraining` | `boolean` | Whether training use is allowed |
| `allowedForReleaseGate` | `boolean` | Whether the release gate may consume it |
| `retentionPolicyRef` | `training-data-policy/<path>.yaml` | Retention / training policy reference |
| `frozenHash` | `sha256:<64 hex>` | Frozen content hash |

## 3. Rules

- The schema is currently fail-close with `additionalProperties: false`.
- `samples` must resolve to a real repository file or directory; a dataset without a resolvable sample path must not be consumed by the release gate.
- `frozenHash` means the dataset content, index, and card are all bound to one frozen snapshot; it must be recalculated after any card change.
- `contaminationStatus=clean` may only be claimed when `contaminationEvidence` is non-empty; otherwise use `suspected` or `unknown`.
- `allowedForReleaseGate=true` does not imply automatic release gate pass; threshold evaluation and scenario-owner judgment still apply.

## 4. Legacy / Scope Notes

- This contract only constrains dataset-card metadata. Sample file layout, index format, and runner registration remain defined by each eval suite.
- If `evalset.lock.yaml` or a stronger dataset bundle lock is introduced later, both this contract and the schema must be updated explicitly instead of assuming it already exists.
