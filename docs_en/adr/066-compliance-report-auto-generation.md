# ADR-066 Compliance Report Auto-Generation Engine

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Compliance audits require substantial evidence materials; manual organization is inefficient and error-prone.

## Decision

### Report Types

| Type | Frequency | Audience |
|------|-----------|----------|
| Audit log report | Real-time | Auditor |
| Compliance summary | Monthly | Compliance team |
| Risk assessment report | Quarterly | Management |
| Incident report | Event-driven | Regulator |

### Evidence Collection

```typescript
interface ComplianceEvidence {
  evidence_id: string;
  type: EvidenceType;
  source: EvidenceSource;
  timestamp: string;
  data: unknown;
  integrity_hash: string;
}

type EvidenceType =
  | 'audit_log'
  | 'access_record'
  | 'data_processing'
  | 'consent_record'
  | 'breach_notification';
```

### Report Generation Flow

1. Trigger condition met
2. Evidence collection
3. Data validation
4. Template population
5. Signing and sealing
6. Distribution and archiving

### Report Content

| Content | Description |
|---------|-------------|
| Executive summary | Key findings |
| Evidence inventory | Detailed evidence |
| Compliance assessment | Article-by-article evaluation |
| Exception records | Deviations and remediation |
| Signatures | Responsible party signature |

### Compliance Framework Mapping

| Framework | Requirements |
|-----------|--------------|
| EU AI Act | Art. 12, 13, 14 |
| GDPR | Art. 5, 30, 35 |
| SOC 2 | CC1, CC2, CC6 |

## Consequences

Positive:

- Automation improves efficiency
- Reduces human error
- Meets regulatory requirements

Negative:

- Evidence collection adds system overhead
- Report templates require maintenance

## Cross-References

- [ADR-059 Agent Explainability](./059-agent-explainability-and-decision-transparency.md)
- [Platform Architecture §23 Compliance and Data Governance](../architecture/00-platform-architecture.md)

## Source Section

- `§66` Compliance Report Auto-Generation Engine
