# Admin Console And Human Takeover Contract

## 1. 范围

本 contract definesmanage员控制台、值班入口和人工兜底接管能力。

相关文档：

- `debug_inspect_health_backpressure_contract.md`
- `diagnostics_snapshot_and_repro_bundle_contract.md`
- `approval_and_hitl_contract.md`

## 2. 目标

- 让生产值班人员可以看懂、接管、止损。
- 让任务failed时不只能“重试”，还能人工修复执lines链。
- 让manage员能力vs普通user能力隔离。

## 3. 控制台最小模块

- worker management
- queue management
- tenant management
- approval management
- audit search
- feature flag management
- incident timeline
- oapeflir loop management
- rollout management
- feedback / learning management

## 4. Human Takeover 最小动作

- 接管任务
- 修改下一步输入
- 跳过某个 `NodeRun`
- 重试某个 `NodeAttempt`
- 切换模型
- 切换 worker
- 手动补充 artifact
- 手动注入 feedback signal
- 手动创建 improvement candidate
- 手动推进或回滚 rollout
- 结束任务并record原因

## 5. 关键对象

- `TakeoverSession`
- `OperatorAction`
- `ManualOverride`
- `IncidentContextBundle`

## 6. security边界

- human takeover 必须写审计。
- 高风险 takeover 动作必须再iterationsvia过 Policy Engine。
- 普通manage员不得defaults to拥有 break-glass permission。
- takeover 动作必须带 tenant / workspace / harness run / node run 作用域，不能以globally模糊操作替代。
- 手动补充 artifact、切换 worker、mandatory结束任务等动作必须保留前后Status差异证据。
- 任何改变运lines态的 takeover 动作都必须via `RuntimeStateMachine.transition(command)` vsbudget预留检查，不得directly改写Status字段。

## v4.3 Contract Remediation

- T-70: 本文原先把人工接管动作table述成“某步/某 execution”的directly操作，Root cause: 值班控制台 contract accesses along用旧 step/execution 运维语义，没有接入 runtime authority 和 budget gate。修复：正文现把 takeover 锚点切到 `HarnessRun / NodeRun / NodeAttempt`，并mandatoryStatus迁移vsbudget预留走正式控制链。

## 7. UI 目标

manage员应能看到：

- 当前任务树
- 当前 execution vs lease
- 最近事件
- 当前模型、prompt、policy 版本
- 当前 OAPEFLIR stage / loop iteration / timeline
- 当前告警和限制原因
- 当前 tenant / workspace 归属和 capability / entitlement 限制

## 8. 收口Conclusion

工业级系统必须defaults to考虑“自动化会failed”，并给人class一个security、可审计、可收口的接管入口。
