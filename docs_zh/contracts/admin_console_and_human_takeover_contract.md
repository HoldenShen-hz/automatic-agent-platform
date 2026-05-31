# Admin Console And Human Takeover Contract

## 1. 范围

本 contract 定义管理员控制台、值班入口和人工兜底接管能力。

相关文档：

- `debug_inspect_health_backpressure_contract.md`
- `diagnostics_snapshot_and_repro_bundle_contract.md`
- `approval_and_hitl_contract.md`

## 2. 目标

- 让生产值班人员可以看懂、接管、止损。
- 让任务失败时不只能“重试”，还能人工修复执行链。
- 让管理员能力与普通用户能力隔离。

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
- leadership claims governance

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
- 结束任务并记录原因

## 5. 关键对象

- `TakeoverSession`
- `OperatorAction`
- `ManualOverride`
- `IncidentContextBundle`

## 6. 安全边界

- human takeover 必须写审计。
- 高风险 takeover 动作必须再次经过 Policy Engine。
- 普通管理员不得默认拥有 break-glass 权限。
- takeover 动作必须带 tenant / workspace / harness run / node run 作用域，不能以全局模糊操作替代。
- 手动补充 artifact、切换 worker、强制结束任务等动作必须保留前后状态差异证据。
- 任何改变运行态的 takeover 动作都必须通过 `RuntimeStateMachine.transition(command)` 与预算预留检查，不得直接改写状态字段。

## v4.3 Contract Remediation

- T-70: 本文原先把人工接管动作表述成“某步/某 execution”的直接操作，根因是值班控制台 contract 沿用旧 step/execution 运维语义，没有接入 runtime authority 和 budget gate。修复：正文现把 takeover 锚点切到 `HarnessRun / NodeRun / NodeAttempt`，并强制状态迁移与预算预留走正式控制链。

## 7. UI 目标

管理员应能看到：

- 当前任务树
- 当前 execution 与 lease
- 最近事件
- 当前模型、prompt、policy 版本
- 当前 OAPEFLIR stage / loop iteration / timeline
- 当前告警和限制原因
- 当前 tenant / workspace 归属和 capability / entitlement 限制
- Leadership Claims 页面中的 readiness status、claim level、expiry、scanner 命中与 allowlist 状态
- claim review 请求入口，以及与 CI gate 对齐的 review / revoke / expiry 提示

## 8. 收口结论

工业级系统必须默认考虑“自动化会失败”，并给人类一个安全、可审计、可收口的接管入口。
