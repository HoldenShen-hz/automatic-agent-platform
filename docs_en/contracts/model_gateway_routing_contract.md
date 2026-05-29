# Model Gateway Routing Contract

## 1. 范围

本 contract defines `src/platform/model-gateway/` 的request路由、provider fallback、auth profile 选择vs会话粘性边界。

相关文档：

- `prompt_model_policy_governance_contract.md`
- `cost_and_budget_contract.md`
- `supply_chain_and_dependency_security_contract.md`

## 2. 路由request对象

```typescript
interface ModelRouteRequest {
  requestId: string;
  harnessRunId: string;  // v4.3: required for budget tracking (INV-BUDGET-001)
  nodeRunId: string | null;   // null when no node scheduled yet
  attemptId: string | null;  // null before attempt starts
  taskId: string | null;
  sessionId: string | null;
  tenantId: string | null;
  purpose: "plan" | "execute" | "evaluate" | "summarize" | "chat";
  routingStrategy:
    | "cost_optimized"
    | "latency_optimized"
    | "quality_optimized"
    | "compliance_constrained"
    | "hybrid";
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

- `harnessRunId` 为必填，used forbudget追踪（INV-BUDGET-001）；`nodeRunId` / `attemptId` 在节点未调度时可为空。
- `harnessRunId / nodeRunId / attemptId` 为权威关联键，used for追踪路由Decision上下文。
- `preferredModel` only代table偏好，不代tablemandatory pin；若call方显式 pin，必须单独建模。
- `requiredCapabilities` 不满足时必须 fail-close，不得静默降级到不兼容模型。
- `decisionReason` 必须contains至少一个可审计原因，如 `policy_allow`、`cost_guard`、`latency_guard`、`provider_cooldown`。
- `compliance_constrained` 必须优先满足 residency、policy、allowlist vs provider trust boundary，再考虑成本或delay。
- `hybrid` 必须显式声明其主目标vsiterations目标，不得作为”任意自由裁量”兜底模式。

## 4. Fallback vs粘性

- 同一会话defaults to优先保持 `providerId + modelId + authProfileId` 粘性。
- provider 熔断或 profile 冷却时，可切换到 fallback chain 中下一个可用候选。
- fallback 发生时必须产生日志和审计事件，且不得丢失原始 route request。
- user显式 pin 的 model/profile 未via允许不得被自动替换。

## 5. failed语义

```typescript
type RouteFailureCode =
  | "route.no_candidate"
  | "route.policy_denied"
  | "route.cost_guard"
  | "route.provider_cooldown"
  | "route.capability_mismatch";
```

规则：

- `route.no_candidate` vs `route.policy_denied` 必须可区分，避免把治理拒绝as资源不足。
- provider 暂时failed进入 cooldown 时，不得污染长期 allowlist。

## 6. 测试要求

- unit：优选模型、fallback、cooldown、sticky session、cost guard。
- integration：同一会话跨多iterationsrequest的粘性vs故障切换。
- contract：`ModelRouteDecision` 字段稳定，failed码vs审计事件一一对应。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-10: 路由策略枚举 cost_optimized/latency_optimized/quality_optimized 3种，Architecture§19defines5种含 compliance_constrained/hybrid。Root Cause：旧路由文档只覆盖性能/成本三目标，没有把合规约束vs多目标折中策略写进 canonical request。修复：`ModelRouteRequest.routingStrategy` 已补齐 5 种规范枚举，并增加 `compliance_constrained` vs `hybrid` 的治理约束。
- T-21: 原 `ModelRouteRequest.harnessRunId` 为optional，no法满足 INV-BUDGET-001 budget追踪要求。修复：`harnessRunId` 改为必填，`nodeRunId` / `attemptId` 在节点未调度时可为空；路由Decision上下文以 `harnessRunId` 为budget主体关联键。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
