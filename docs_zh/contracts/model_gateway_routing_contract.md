# Model Gateway Routing Contract

## 1. 范围

本 contract 定义 `src/platform/model-gateway/` 的请求路由、provider fallback、auth profile 选择与会话粘性边界。

相关文档：

- `prompt_model_policy_governance_contract.md`
- `cost_and_budget_contract.md`
- `supply_chain_and_dependency_security_contract.md`

## 2. 路由请求对象

```typescript
interface ModelRouteRequest {
  requestId: string;
  taskId: string | null;
  sessionId: string | null;
  tenantId: string | null;
  purpose: "plan" | "execute" | "evaluate" | "summarize" | "chat";
  preferredModel: string | null;
  requiredCapabilities: string[];
  maxLatencyMs: number | null;
  maxCostUsd: number | null;
}
```

## 3. 路由结果对象

```typescript
interface ModelRouteDecision {
  providerId: string;
  modelId: string;
  authProfileId: string;
  fallbackChain: string[];
  stickySession: boolean;
  decisionReason: string[];
}
```

规则：

- `preferredModel` 仅代表偏好，不代表强制 pin；若调用方显式 pin，必须单独建模。
- `requiredCapabilities` 不满足时必须 fail-close，不得静默降级到不兼容模型。
- `decisionReason` 必须包含至少一个可审计原因，如 `policy_allow`、`cost_guard`、`latency_guard`、`provider_cooldown`。

## 4. Fallback 与粘性

- 同一会话默认优先保持 `providerId + modelId + authProfileId` 粘性。
- provider 熔断或 profile 冷却时，可切换到 fallback chain 中下一个可用候选。
- fallback 发生时必须产生日志和审计事件，且不得丢失原始 route request。
- 用户显式 pin 的 model/profile 未经允许不得被自动替换。

## 5. 失败语义

```typescript
type RouteFailureCode =
  | "route.no_candidate"
  | "route.policy_denied"
  | "route.cost_guard"
  | "route.provider_cooldown"
  | "route.capability_mismatch";
```

规则：

- `route.no_candidate` 与 `route.policy_denied` 必须可区分，避免把治理拒绝伪装成资源不足。
- provider 暂时失败进入 cooldown 时，不得污染长期 allowlist。

## 6. 测试要求

- unit：优选模型、fallback、cooldown、sticky session、cost guard。
- integration：同一会话跨多次请求的粘性与故障切换。
- contract：`ModelRouteDecision` 字段稳定，失败码与审计事件一一对应。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-10: 路由策略枚举 cost_optimized/latency_optimized/quality_optimized 3种，架构§19定义5种含 compliance_constrained/hybrid。修复：该语义收敛到 v4.3 canonical contract；旧字段、旧状态、旧 DTO 或旧术语仅允许作为 legacy/deprecated/projection/migration input，不得作为新实现入口。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
