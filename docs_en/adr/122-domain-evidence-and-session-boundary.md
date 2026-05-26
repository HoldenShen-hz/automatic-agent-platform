# ADR-122 Domain Evidence And Session Replay Boundary

- Status: Accepted
- Decision Date: 2026-05-25

## Background

Domain registry, knowledge namespace, checkpoint envelope, session JSONL replay all exist, but their authority boundary was not explicitly written before, causing reviews to mix evidence responsibilities of different layers.

## Decision

### 1. Session Replay Responsibilities

- `SessionDualStorageService` authoritative responsibility is to save session timeline and interaction events.
- Session replay is not domain lifecycle audit bus, nor knowledge namespace policy engine.
- Domain lifecycle event authoritative source is still domain registry published structured events.

### 2. Checkpoint Domain Attribution

- Checkpoint envelope can carry `domainId` / `namespaceId`, used for retention, routing, governance attribution.
- But checkpoint payload schema authority still determined by payload schema / envelope schema contract.
- Domain meta model does not负责替代payload schema version validation.

### 3. Knowledge Namespace and Session Relationship

- Domain registry is responsible for declaring which knowledge namespaces a domain allows.
- Session replay does not re-execute namespace policy judgment on historical messages by default.
- If domain-aware replay/inspection is needed, should combine session timeline with domain registry / checkpoint metadata through upper-layer inspect/governance view, rather than stuffing all domain events into session JSONL.

## Result

- Session chronology, domain lifecycle, checkpoint schema, knowledge namespace each retain single authority.
- If cross-layer inspect view is added later, should go through composite query, rather than making single storage承担all governance responsibilities.
