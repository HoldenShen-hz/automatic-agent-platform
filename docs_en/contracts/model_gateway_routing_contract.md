# Model Gateway Routing Contract

## 1. Scope

This contract defines request routing, provider fallback, auth profile selection, and session sticky boundaries for `src/platform/model-gateway/`.

Related documents:

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

## 3. Route Decision Object

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

- `harnessRunId` is required for budget tracking (INV-BUDGET-001); `nodeRunId` / `attemptId` may be empty when the node has not yet been scheduled.
- `harnessRunId / nodeRunId / attemptId` are the authoritative association keys for tracking routing decision context.
- `preferredModel` only represents a preference, not a mandatory pin; if the caller explicitly pins, it must be modeled separately.
- When `requiredCapabilities` are not satisfied, must fail-close and must not silently degrade to an incompatible model.
- `decisionReason` must include at least one auditable reason such as `policy_allow`, `cost_guard`, `latency_guard`, `provider_cooldown`.
- `compliance_constrained` must prioritize satisfying residency, policy, allowlist, and provider trust boundaries before considering cost or latency.
- `hybrid` must explicitly declare its primary and secondary objectives and must not serve as an "any discretionary" fallback mode.

## 4. Fallback and Stickiness

- By default, the same session prioritizes maintaining `providerId + modelId + authProfileId` stickiness.
- When a provider trips the circuit breaker or a profile is in cooldown, it may switch to the next available candidate in the fallback chain.
- When fallback occurs, it must produce logs and audit events, and must not lose the original route request.
- Model/profile explicitly pinned by the user must not be automatically replaced without permission.

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

- `route.no_candidate` and `route.policy_denied` must be distinguishable to prevent governance rejections from being disguised as resource insufficiency.
- When a provider temporarily fails and enters cooldown, it must not pollute the long-term allowlist.

## 6. Test Requirements

- unit: preferred model, fallback, cooldown, sticky session, cost guard.
- integration: stickiness and fault switching across multiple requests in the same session.
- contract: `ModelRouteDecision` fields are stable; failure codes and audit events correspond one-to-one.

## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-10: The routing strategy enumeration had only 3 types—cost_optimized/latency_optimized/quality_optimized—while architecture §19 defines 5 including compliance_constrained/hybrid. The root cause was that the old routing documentation covered only performance/cost three objectives and did not include compliance constraints and multi-objective trade-off strategies in the canonical request. Fix: `ModelRouteRequest.routingStrategy` has been supplemented with all 5 canonical enumerations, and governance constraints for `compliance_constrained` and `hybrid` have been added.
- T-21: The original `ModelRouteRequest.harnessRunId` was optional, unable to satisfy INV-BUDGET-001 budget tracking requirements. Fix: `harnessRunId` is now required; `nodeRunId` / `attemptId` may be empty when the node has not been scheduled; routing decision context uses `harnessRunId` as the primary budget association key.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR must only appear as `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.