# ADR-066 Compliance Report Auto-generation Engine

- Status: Accepted
- Decision Date: 2026-04-20

## Background

Compliance audits require a lot of evidence materials, manual organization is inefficient and error-prone.

## Decision

### Report Types

| Type | Frequency | Audience |
|------|-----------|---------|
| Audit log report | Real-time | Auditor |
| Compliance summary | Monthly | Compliance team |
| Risk assessment report | Quarterly | Management |
| Incident report | Event-driven | Regulatory authority |

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

### Report Generation Process

1. Trigger condition met
2. Evidence collection
3. Data validation
4. Template filling
5. Signature and seal
6. Distribution and archiving

### Report Content

| Content | Description |
|---------|-------------|
| Executive summary | Key findings |
| Evidence list | Detailed evidence |
| Compliance assessment | Each clause evaluation |
| Exception records | Deviations and remediation |
| Signatures | Responsible person signatures |

### Compliance Framework Mapping

| Framework | Requirements |
|-----------|--------------|
| EU AI Act | Art. 12, 13, 14 |
| GDPR | Art. 5, 30, 35 |
| SOC 2 | CC1, CC2, CC6 |

## Consequences

Advantages:

- Automation improves efficiency
- Reduces manual errors
- Meets regulatory requirements

Trade-offs:

- Evidence collection adds system overhead
- Report templates require maintenance

## Cross References

- [ADR-059 Agent Explainability](./059-agent-explainability-and-decision-transparency.md)
- [ADR-085 Organization Governance and Knowledge Boundary](./085-organization-governance-and-knowledge-boundary.md)
- [Platform Architecture §23 Compliance and Data Governance](../architecture/00-platform-architecture.md)

## Source Section

- `§66` Compliance Report Auto-generation Engine

## v4.3 ADR Remediation

- R5-65: This ADR originally referenced non-existent `§B`/`§G` appendices, removed. Compliance framework mapping content retained, but reference paths corrected to actually existing documents.