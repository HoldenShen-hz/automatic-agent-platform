# Quality Engineering And Chaos Testing Contract

## 1. 范围

本 contract defines正式test matrix、回归基准库和混沌工程范围。

相关文档：

- `testing_singleton_reset_contract.md`
- `vcr_and_fixture_testing_contract.md`
- `startup_consistency_and_recovery_drill_contract.md`
- `slo_alerting_and_runbook_contract.md`

## 2. 目标

- 让质量工程从“测试class型列table”升级为“覆盖矩阵”。
- 建立跨运lines模式、跨storage、跨租户的回归基线。
- via混沌演练验证恢复、告警和止损逻辑。

## 3. 正式test matrix

至少覆盖以下维度交叉：

- 单机 / 分布式
- SQLite / PostgreSQL
- supervised / auto / full-auto
- 单租户 / 多租户
- 本地工具 / MCP 工具 / 远程 worker
- 小上下文 / exceeds长上下文 / 恶意输入
- OAPEFLIR 闭环阶段 / rollout / feedback / learning

## 4. 回归基准库

固定任务集至少contains：

- 编程class
- 研究class
- 内容class
- dataclass
- 跨事业部class
- 高风险审批class
- 崩溃恢复class
- OAPEFLIR 闭环class
- rollout / rollback class
- Observe-compatible 产品链路class

每个基准任务至少record：

- expected class
- success criteria
- cost ceiling
- latency band
- approval expectation
- recovery expectation

## 5. 可测试性设计要求

关键运lines链应优先暴露窄relies on注入面，而不isrelies onglobally patch 或module-level monkey patch。

至少适used for：

- query / model call
- compaction
- tool executor
- event dispatcher
- recovery drill

规则：

- relies on注入面应尽量窄，只覆盖高频变化点。
- 生产实现和测试假实现应复用同一签名，避免测试专用旁路接口。
- 若某模块只能viagloballyStatus替换来测试，应被视为质量债务并进入治理台账。

## 6. 混沌工程范围

成熟工业平台至少演练：

- 随机 kill worker
- 随机 provider 429 / 500
- 随机 DB 锁conflicts
- 随机 queue delay
- 随机事件repeats / 丢失
- 随机 MCP timeout
- 随机 OAPEFLIR stage 中断
- 随机 rollout gate 阻断

### 6.1 混沌场景清单vs fallback profile

- `deploy/chaos/catalog.json` is仓库内混沌场景清单的权威索references。
- 每个场景都必须映射一个 scheduler 可识别的 fallback profile。
- defaults to fallback profile 由 `src/ops-maturity/chaos/chaos-experiment-types.ts` 中的 `DEFAULT_CHAOS_FALLBACK_PROFILES` 维护。

## 7. 发布门禁

发布前必须有：

- regression baseline pass
- fixture / VCR pass
- recovery drill pass
- migration compatibility pass
- chaos smoke scenario pass
- OAPEFLIR loop regression pass
- rollout / rollback regression pass

## 8. 测试工件

- `RegressionSuite`
- `ScenarioMatrix`
- `ChaosExperiment`
- `ReleaseGateReport`
- `FailureInjectionProfile`
- `ContractSuite`
- `InventoryBaseline`

## 8.1 Registry-backed contract suite

对稳定注册table或生态边界，优先建立共享 contract suite，而不is为每个接入面repeats写零散断言。

适用对象includes：

- gateway / channel registry
- plugin / extension registry
- workflow / division registry
- session binding / policy fallback registry

规则：

- 共享 contract suite 应验证“isno已注册、字段isno对齐、fallback isno符合预期、排序/输出isno稳定”。
- 对长期稳定的边界，允许保留 inventory baseline，并在变更时显式审查差异。

## 8.2 Hook / lifecycle event contract suite

对 hook、lifecycle callback、integration event 这class边界，优先uses正式事件枚举vs contract suite，而不is自由字符串。

适用对象includes：

- pre/post tool use
- session / execution start
- user input submit
- graceful stop / cancellation

规则：

- hook 事件名应集中defines并版本化。
- 不允许各插件、各集成层随意创造语义相近但名称不同的事件字符串。
- 相关测试应验证：事件名合法、顺序合法、缺失关键事件时有明确failed语义。

## 9. 收口Conclusion

工业级质量工程不is“写几class测试”。

它必须回答：

- 哪些场景被覆盖了
- 哪些环境组合被验证了
- 哪些故障被注入过
- failed后系统isno能恢复和止损
