# Platform Promote Criteria Contract

## 1. 范围

本 contract 定义模块从“已有设计或局部实现”提升为“正式平台能力”时必须满足的 promote criteria。

它回答的问题是：一个模块不能只因为“有服务、有代码、有 contract”就被判断为完成，还必须满足哪些冻结、测试、观测、runbook、回滚和 ownership 条件。

相关文档：

- `docs_zh/operations/operations-checklist.md`
- `docs_zh/quality/01-release-checklist.md`
- `docs_zh/contracts/release_rollout_and_rollback_contract.md`
- `docs_zh/contracts/slo_alerting_and_runbook_contract.md`
- `docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md`

## 2. 目标

- 统一“从 partial 到 platform-ready”的判断标准。
- 避免以“服务存在”“测试占位”“有 dashboard 但没有 alert”这类假完成判断模块成熟度。
- 让 promote 和 rollback 有正式证据链。

## 3. Promote Criteria

`PromoteCriteria` 最小字段：

- `component_id`
- `current_status`
- `target_status`
- `required_criteria`
- `optional_criteria`
- `overall_verdict`
- `blockers?`

`current_status` 推荐枚举：

- `draft`
- `partial`
- `contract_frozen`
- `canary`
- `production_ready`

`overall_verdict` 推荐枚举：

- `promote_approved`
- `promote_blocked`
- `conditional`

## 4. 必需 criteria

| criteria | 最低要求 |
| --- | --- |
| `contracts_frozen` | 相关主干文档、contract、ADR 已冻结且互不冲突 |
| `conformance_tests` | 对应 conformance / integration / recovery 测试已通过 |
| `telemetry_instrumented` | metrics、trace、alerts 至少到位到当前阶段要求 |
| `runbooks_documented` | deployment、rollback、incident runbook 存在 |
| `rollback_tested` | 至少有一次成功的 rollback rehearsal 或 drill |
| `ownership_defined` | owner、backup、incident contact 清楚 |
| `oapeflir_loop_tested` | OAPEFLIR loop 与 stage timeline 已有覆盖 |
| `knowledge_plane_tested` | 若启用 knowledge，namespace / trust / freshness 已验证 |
| `memory_promotion_tested` | 若启用 memory promotion，晋升/降级/撤销已验证 |
| `plugin_spi_conformance` | 若启用 plugin SPI，共享 contract suite 已通过 |
| `rollout_rehearsed` | release / rollback 演练已通过 |

## 5. 可选 criteria

- `performance_benchmarks`
- `load_test_results`
- `security_review`
- `chaos_drill_results`

规则：

- 可选项不能替代必需项。
- 若目标状态为 `production_ready`，建议至少补齐 `performance_benchmarks` 与 `security_review`。

## 6. Promote 阶段要求

| 路径 | 最低要求 |
| --- | --- |
| `draft -> partial` | contract 初版、happy path tests、最小 owner 明确 |
| `partial -> contract_frozen` | 所有当前阶段 contract 冻结、测试通过、边界清楚 |
| `contract_frozen -> canary` | telemetry、runbook、ownership、rollback path 到位 |
| `canary -> production_ready` | rollback rehearse、alerting、benchmarks、security review 到位 |

## 7. 反模式

以下情况不得作为 promote 依据：

- `service_exists_only`
- `tests_without_assertions`
- `telemetry_without_alerts`
- `runbook_without_rehearsal`
- `owner_without_backup`
- `contract_exists_but_not_consumed`

## 8. Evidence Package

`PromoteEvidencePackage` 最小字段：

- `package_id`
- `component_id`
- `contract_refs`
- `test_result_refs`
- `telemetry_refs`
- `runbook_refs`
- `rollback_rehearsal_refs`
- `ownership_ref`
- `oapeflir_evidence_refs?`
- `rollout_refs?`
- `created_at`

## 9. 收口结论

平台成熟度不能只靠“看起来做完了”判断。

只有当 contract、测试、观测、runbook、回滚和 owner 一起闭合时，模块才有资格从“局部能力”被提升为“正式平台能力”。
