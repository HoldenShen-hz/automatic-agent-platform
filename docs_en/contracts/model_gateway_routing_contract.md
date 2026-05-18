# Model Gateway Routing Contract

## 1. Scope

This contract defines request routing, provider fallback, auth profile selection, and session stickiness boundaries for `src/platform/model-gateway/`.

Related Documents:

- `prompt_model_policy_governance_contract.md`
- `cost_and_budget_contract.md`
- `supply_chain_and_dependency_security_contract.md`

## 2. Route Request Object

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

## 3. Route Result Object

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

Rules:

- `harnessRunId` is required for budget tracking (INV-BUDGET-001); `nodeRunId` / `attemptId` may be null when node is not yet scheduled.
- `harnessRunId / nodeRunId / attemptId` are authoritative association keys for tracing routing decision context.
- `preferredModel` represents only preference, not mandatory pin; if the caller explicitly pins, must be modeled separately.
- When `requiredCapabilities` are not satisfied, must fail-close and must not silently degrade to incompatible model.
- `decisionReason` must contain at least one auditable reason, such as `policy_allow`, `cost_guard`, `latency_guard`, `provider_cooldown`.
- `compliance_constrained` must first satisfy residency, policy, allowlist, and provider trust boundary, then consider cost or latency.
- `hybrid` must explicitly declare its primary and secondary objectives and must not be used as "any discretionary" fallback mode.

## 4. Fallback and Stickiness

- By default, the same session prioritizes maintaining `providerId + modelId + authProfileId` stickiness.
- When provider trips circuit breaker or profile is cooling, can switch to the next available candidate in the fallback chain.
- When fallback occurs, must produce log and audit event, and must not lose the original route request.
- User-explicitly pinned model/profile must not be automatically replaced without permission.

## 5. Failure Semantics

```typescript
type RouteFailureCode =
  | "route.no_candidate"
  | "route.policy_denied"
  | "route.cost_guard"
  | "route.provider_cooldown"
  | "route.capability_mismatch";
```

Rules:

- `route.no_candidate` and `route.policy_denied` must be distinguishable to avoid disguising governance rejection as insufficient resources.
- When provider temporarily fails and enters cooldown, must not contaminate the long-term allowlist.

## 6. Test Requirements

- unit: preferred model, fallback, cooldown, sticky session, cost guard.
- integration: stickiness and fault switching across multiple requests in the same session.
- contract: `ModelRouteDecision` fields stable, failure codes and audit events correspond one-to-one.

## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` shall prevail.

- T-10: Routing strategy enum had 3 types cost_optimized/latency_optimized/quality_optimized, but architecture §19 defines 5 types including compliance_constrained/hybrid. Root cause: Old routing documents covered only performance/cost three objectives and did not write compliance constraints and multi-objective trade-off strategies into canonical request. Fix: `ModelRouteRequest.routingStrategy` has been supplemented with 5 canonical enums, and governance constraints for `compliance_constrained` and `hybrid` have been added.
- T-21: Original `ModelRouteRequest.harnessRunId` was optional, unable to satisfy INV-BUDGET-001 budget tracking requirement. Fix: `harnessRunId` changed to required, `nodeRunId` / `attemptId` may be null when node is not yet scheduled; routing decision context uses `harnessRunId` as the budget primary association key.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
