# v4.3 Budget Ledger Contract

> v4.3 canonical contract. Covers `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.

## 1. Scope

Budget is runtime truth, not observation statistics. All token, tool, external API, human, compute, and side-effect costs must be expressed through ledger reservation / settlement, and hard cap does not allow concurrent overbooking.

## 2. BudgetLedger

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `budgetLedgerId` | `string` | Ledger ID |
| `tenantId` | `string` | Tenant |
| `harnessRunId` | `string` | Associated run |
| `currency` | `string` | Pricing currency |
| `hardCap` | `number` | Hard cap |
| `softCap` | `number?` | Soft cap |
| `reservedAmount` | `number` | Reserved |
| `settledAmount` | `number` | Settled |
| `releasedAmount` | `number` | Released |
| `status` | `open \| soft_cap_reached \| hard_cap_reached \| closed` | Status |
| `version` | `number` | CAS version |

## 3. BudgetReservation

Minimum fields:

- `budgetReservationId`
- `budgetLedgerId`
- `harnessRunId`
- `nodeRunId?`
- `amount`
- `resourceKind` (`token | tool_call | api | compute | storage | bandwidth | memory | human | side_effect | other`)
- `status` (`reserved | settled | released | expired | rejected`)
- `expiresAt`
- `createdAt`

Rules:

- Reservation must atomically check `settledAmount + activeReservedAmount + requestedAmount <= hardCap`.
- Expired reservation must be released and must not continue participating in commit.
- After hard cap is reached, only reject new reservation or enter manual scaling/degrading is allowed; implicit overdraft is not allowed.

## 4. BudgetSettlement

Minimum fields:

- `budgetSettlementId`
- `budgetReservationId`
- `actualAmount`
- `settlementKind` (`final | partial | release_unused | correction`)
- `evidenceRefs`
- `createdAt`

Rules:

- Settlement cannot exceed reservation unless there is explicit `correction` and still satisfies hard cap.
- Release unused must append settlement / release record; rewriting historical reservation directly is not allowed.

## 5. State Progression

- `BudgetReservation` / `BudgetSettlement` truth mutation must go through `RuntimeStateMachine.transition(command)` or its budget subcommand.
- Soft cap can trigger policy warning; hard cap must block execution.
- Budget events must write `platform.*` fact event.

## 6. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| `actual_cost_usd` | projection / report field |
| token cost counter | ledger derived statistics |
| cost report | read model, not budget truth |

## 7. Testing Requirements

- Budget hard-cap concurrency test must cover concurrent reservation.
- Settlement exceeding reservation must reject or go through correction gate.
- After hard cap triggers, NodeRun must not receive new budget.

## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 to ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-3: Used "settle" verb to describe budget consumption; architecture §18 uniformly uses "consume"; resourceKind enum only token/api_call/compute; architecture additionally defines storage/bandwidth/memory. Fix: This semantics converges to v4.3 canonical contract; old fields, old status, old DTO, or old terminology are only allowed as legacy/deprecated/projection/migration input and must not be used as new implementation entry points.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.