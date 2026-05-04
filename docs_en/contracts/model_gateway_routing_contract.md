# Model Gateway Routing Contract

## 1. Scope

This contract defines request routing, provider fallback, auth profile selection, and session stickiness boundaries for `src/platform/model-gateway/`.

Related documents:

- `prompt_model_policy_governance_contract.md`
- `cost_and_budget_contract.md`
- `supply_chain_and_dependency_security_contract.md`

## 2. Route Request Object

```typescript
interface ModelRouteRequest {
  requestId: string;
  /** Canonical runtime chain anchor - use instead of deprecated taskId */
  harnessRunId: string | null;
  /** Node run for node-level routing decisions */
  nodeRunId: string | null;
  /** @deprecated Use harnessRunId instead */
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

- `preferredModel` only represents a preference, not a mandatory pin; if the caller explicitly pins, it must be modeled separately.
- When `requiredCapabilities` are not satisfied, must fail-close and must not silently degrade to an incompatible model.
- `decisionReason` must include at least one auditable reason, such as `policy_allow`, `cost_guard`, `latency_guard`, `provider_cooldown`.
- `compliance_constrained` must prioritize satisfying residency, policy, allowlist, and provider trust boundary before considering cost or latency.
- `hybrid` must explicitly declare its primary and secondary objectives and must not serve as an "any discretionary" fallback mode.

## 4. Fallback and Stickiness

- By default, the same session prioritizes maintaining `providerId + modelId + authProfileId` stickiness.
- When a provider trips its circuit breaker or a profile is in cooldown, may switch to the next available candidate in the fallback chain.
- When fallback occurs, must produce logs and audit events, and must not lose the original route request.
- Models/profiles explicitly pinned by the user must not be automatically replaced without permission.

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

- `route.no_candidate` and `route.policy_denied` must be distinguishable to avoid disguising governance rejections as resource insufficiency.
- When a provider temporarily fails and enters cooldown, must not pollute the long-term allowlist.

## 6. Test Requirements

- unit: preferred model, fallback, cooldown, sticky session, cost guard.
- integration: stickiness and fault switching across multiple requests in the same session.
- contract: `ModelRouteDecision` fields are stable; failure codes and audit events correspond one-to-one.


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` shall prevail.

- T-10: The routing strategy enumeration had 3 types (cost_optimized/latency_optimized/quality_optimized), while architecture `§19` defines 5 types including compliance_constrained/hybrid. Root cause: old routing documentation only covered performance/cost three objectives and did not write compliance constraints and multi-objective trade-off strategies into the canonical request. Fix: `ModelRouteRequest.routingStrategy` has been supplemented with 5 canonical enumerations, and governance constraints for `compliance_constrained` and `hybrid` have been added.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR may only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
