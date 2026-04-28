# v4.3 Budget Ledger Contract

> v4.3 canonical contract. Covers `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.

## 1. Scope

Budget is runtime truth, not observational statistics. All token, tool, external API, human, compute, and side effect costs must be expressed through ledger reservation / settlement, and hard cap does not allow concurrent overbooking.

## 2. BudgetLedger

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `budgetLedgerId` | `string` | Ledger ID |
| `tenantId` | `string` | Tenant |
| `harnessRunId` | `string` | Associated run |
| `currency` | `string` | Billing currency |
| `hardCap` | `number` | Hard cap |
| `softCap` | `number?` | Soft cap |
| `reservedAmount` | `number` | Reserved amount |
| `settledAmount` | `number` | Settled amount |
| `releasedAmount` | `number` | Released amount |
| `status` | `open \| soft_cap_reached \| hard_cap_reached \| closed` | Status |
| `version` | `number` | CAS version |

## 3. BudgetReservation

Minimum fields:

- `budgetReservationId`
- `budgetLedgerId`
- `harnessRunId`
- `nodeRunId?`
- `amount`
- `resourceKind` (`token | tool | api | compute | human | side_effect | other`)
- `status` (`reserved | settled | released | expired | rejected`)
- `expiresAt`
- `createdAt`

Rules:

- Reservation must atomically check `settledAmount + activeReservedAmount + requestedAmount <= hardCap`.
- Expired reservation must be released and must not continue to participate in commit.
- After hard cap is reached, new reservation must be rejected or human capacity expansion / degradation must be entered; implicit overdraft is not allowed.

## 4. BudgetSettlement

Minimum fields:

- `budgetSettlementId`
- `budgetReservationId`
- `actualAmount`
- `settlementKind` (`final | partial | release_unused | correction`)
- `evidenceRefs`
- `createdAt`

Rules:

- Settlement cannot exceed reservation unless there is explicit `correction` and it still satisfies hard cap.
- Release unused must append settlement / release record, not directly rewrite historical reservation.

## 5. Status Progression

- Truth mutation of `BudgetReservation` / `BudgetSettlement` must go through `RuntimeStateMachine.transition(command)` or its budget subcommand.
- Soft cap can trigger policy warning; hard cap must block execution.
- Budget events must be written to `platform.*` fact event.

## 6. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| `actual_cost_usd` | Projection / report field |
| Token cost counter | Ledger-derived statistics |
| Cost report | Read model, not budget truth |

## 7. Testing Requirements

- Budget hard-cap concurrency test must cover concurrent reservation.
- Settlement exceeding reservation must be rejected or go through correction gate.
- After hard cap is triggered, NodeRun must not receive new budget.


## v4.3 Architecture Remediation

The following items fix the contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-3: Used verb "settle" to describe budget consumption, while architecture §18 uniformly uses "consume"; resourceKind enum only includes token/api_call/compute, architecture additionally defines storage/bandwidth/memory. Fix: Semantics converge to v4.3 canonical contract; old fields, old state, old DTOs, or old terminology are only allowed as legacy/deprecated/projection/migration input, not as new implementation entry points.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
