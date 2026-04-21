# ADR-050 Knowledge Domain Isolation and Controlled Sharing

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Different department knowledge needs boundary isolation to prevent data leakage while supporting controlled knowledge sharing.

## Decision

### Knowledge Domain Model

```typescript
interface KnowledgeDomain {
  domain_id: string;
  name: string;
  owner_department_id: string;
  isolation_level: IsolationLevel;
  sharing_policy: SharingPolicy;
}

type IsolationLevel = 'strict' | 'moderate' | 'open';

interface SharingPolicy {
  allowed_domains: string[];
  requires_approval: boolean;
  audit_sharing: boolean;
}
```

### Isolation Levels

| Level | Description | Cross-domain Retrieval |
|-------|-------------|------------------------|
| strict | Fully isolated | Not allowed |
| moderate | Share after approval | Requires approval |
| open | Visible but requires authorization | Requires authorization |

### Knowledge Sharing Flow

1. Apply for sharing (specify target domain and purpose)
2. Source domain approval
3. Target domain confirmation
4. Audit log recording

### Trust Model

- Inter-department trust relationships
- Knowledge source verification
- Sharing history tracking

## Consequences

Positive:
- Strict isolation prevents data leakage
- Controlled sharing supports business collaboration
- Audit trail ensures clear accountability

Negative:
- Isolation affects knowledge reuse
- Sharing process adds latency

Trade-offs:
- Security vs. collaboration
- Isolation vs. accessibility

## Cross-References

- [ADR-046 Organization Hierarchy Model](./046-organization-hierarchy-model.md)
- [ADR-085 Organization Governance and Knowledge Boundary](./085-organization-governance-and-knowledge-boundary.md)

## Source Sections

- `§50` Knowledge Domain Isolation and Controlled Sharing