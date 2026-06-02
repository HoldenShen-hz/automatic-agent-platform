# Eval Dataset Card Contract

> v4.3 repository contract。覆盖 `eval/schemas/eval-dataset-card.schema.json` 的字段语义与治理边界。

## 1. 范围

`EvalDatasetCard` 是评测数据集的元数据卡，用于 release gate、污染检查、训练边界和 retention 治理；它不是样本内容本身。

## 2. 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `datasetId` | `string` | 数据集 ID |
| `divisionId` | `string` | 关联 division |
| `scenarioId` | `string` | 关联 scenario |
| `version` | `string` | 数据集版本 |
| `source` | `string` | 来源说明 |
| `taskCount` | `integer >= 1` | 样本数量 |
| `split` | `train \| heldout \| release \| shadow` | 数据集用途 |
| `contaminationStatus` | `clean \| suspected \| unknown` | 污染状态 |
| `privacyStatus` | `public \| internal \| redacted \| restricted` | 隐私级别 |
| `labelingMethod` | `string` | 标注方式 |
| `allowedForTraining` | `boolean` | 是否允许用于训练 |
| `allowedForReleaseGate` | `boolean` | 是否允许被 release gate 消费 |
| `retentionPolicyRef` | `training-data-policy/<path>.yaml` | retention / training policy 引用 |
| `frozenHash` | `sha256:<64 hex>` | 冻结内容哈希 |

## 3. 规则

- schema 当前按 `additionalProperties: false` fail-close。
- `frozenHash` 表示数据集内容、索引和卡片绑定到一次冻结快照；卡片更新后必须重新计算。
- `contaminationStatus=clean` 只能在有污染检查证据时声明；否则应使用 `suspected` 或 `unknown`。
- `allowedForReleaseGate=true` 不等同于自动通过 release gate，仍需结合 eval threshold 与场景 owner 判定。

## 4. Legacy / Scope Notes

- 本 contract 只约束 dataset card 元数据；样本文件布局、索引格式和 runner 注册表由各 eval suite 自己定义。
- 若未来引入 `evalset.lock.yaml` 或更强的 dataset bundle lock，需要在本文和 schema 中显式增补，而不能直接假定已存在。
