# v4.3 Budget Ledger Contract

> v4.3 canonical contract. Covers `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.

## 1. Scope

Budget is runtime truth, not observational statistics. All tokens, tools, external APIs, human labor, compute, and side effect costs must be expressed through ledger reservation/settlement, and hard caps do not allow concurrent over-commitment.

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
- Expired reservations must be released and cannot continue to participate in commit.
- After hard cap is reached, new reservations must be rejected or human escalation/downgrade must be initiated; implicit overdraft is not allowed.

## 4. BudgetSettlement

Minimum fields:

- `budgetSettlementId`
- `budgetReservationId`
- `actualAmount`
- `settlementKind` (`final | partial | release_unused | correction`)
- `evidenceRefs`
- `createdAt`

Rules:

- Settlement cannot exceed reservation unless explicit `correction` is provided and hard cap is still satisfied.
- Release unused must append settlement/release records; directly rewriting historical reservation is not allowed.

## 5. State Transition

- Truth mutations for `BudgetReservation` / `BudgetSettlement` must go through `RuntimeStateMachine.transition(command)` or its budget sub-commands.
- Soft cap can trigger policy warning; hard cap must block execution.
- Budget events must be written to `platform.*` fact events.

## 6. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| `actual_cost_usd` | Projection / report field |
| token cost counter | Ledger-derived statistics |
| cost report | Read model, not budget truth |

## 7. Test Requirements

- Budget hard-cap concurrency test must cover concurrent reservations.
- Settlement exceeding reservation must be rejected or go through correction gate.
- After hard cap is triggered, NodeRun must not receive new budget.