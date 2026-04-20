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

- `preferredModel` only represents a preference, not a mandatory pin; if the caller explicitly pins a model, it must be modeled separately.
- When `requiredCapabilities` are not satisfied, fail-close is mandatory; silent degradation to an incompatible model is prohibited.
- `decisionReason` must include at least one auditable reason, such as `policy_allow`, `cost_guard`, `latency_guard`, or `provider_cooldown`.

## 4. Fallback and Sticky

- By default, a session prioritizes maintaining `providerId + modelId + authProfileId` stickiness.
- When a provider is under circuit break or a profile is in cooldown, the next available candidate in the fallback chain may be selected.
- When a fallback occurs, a log and audit event must be generated, and the original route request must not be lost.
- A model/profile explicitly pinned by the user must not be automatically replaced without permission.

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

- `route.no_candidate` and `route.policy_denied` must be distinguishable; governance rejections must not be disguised as resource insufficiency.
- When a provider temporarily fails and enters cooldown, the long-term allowlist must not be contaminated.

## 6. Testing Requirements

- unit: preferred model, fallback, cooldown, sticky session, cost guard.
- integration: stickiness and failover across multiple requests within the same session.
- contract: `ModelRouteDecision` fields are stable; failure codes correspond one-to-one with audit events.