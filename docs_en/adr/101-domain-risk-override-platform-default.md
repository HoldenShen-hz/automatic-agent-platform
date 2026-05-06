# ADR-101 Domain Risk Override Over Platform Default

---

## OAPEFLIR Association

- **Observe**: Platform default risk matrix and domain-specific risk input
- **Assess**: Determine whether domain override is allowed
- **Plan**: Form domain risk profile
- **Execute**: Apply domain risk priority before task execution
- **Feedback**: Record override reasons and audit evidence
- **Learn**: Identify high-risk domain commonalities
- **Improve**: Optimize domain risk baseline
- **Release**: High-risk domains must complete override review before release

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Platform default risk matrix is insufficient to cover high-sensitivity domains such as finance, legal, and healthcare.

## Decision

- Domain risk profile takes priority over platform default risk matrix
- Any override must leave an audit reason
- Without explicit domain risk profile, high-risk automation is prohibited

### DomainRiskSpec Definition

```typescript
interface DomainRiskSpec {
  domain_id: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  // Required fields for high-risk domains (choose one or equivalent responsibility boundary)
  advisory_only?: boolean;              // Advisory only, requires human confirmation
  human_accountable?: boolean;          // Full human accountability
  deterministic_hot_path_only?: boolean; // Deterministic execution path only
  // Override fields
  overrides?: RiskOverride[];
  justification: string;                // Override reason required
  approver?: string;                   // Approver
}
```

Note: **DomainRiskSpec required fields**: high/critical domains must explicitly declare one of `advisory_only`, `human_accountable`, `deterministic_hot_path_only` (or equivalent responsibility boundary). When not declared, the platform handles it in more conservative mode, defaulting to disallow full_auto (see §10 risk control, §37.3 DomainRiskProfile). Validator enforces required field validation and blocks domain release (see INV-DOMAIN-001).

## Consequences

- High-risk domains have clear governance boundaries
- DomainRiskSpec validator enforces required field validation and blocks domain release (see INV-DOMAIN-001)
