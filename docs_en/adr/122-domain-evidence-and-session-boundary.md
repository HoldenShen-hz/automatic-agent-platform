# ADR-122 Domain Evidence and Session Replay Boundary

- Status: Accepted
- Decision Date: 2026-05-25

## Background

Domain registration, knowledge namespaces, checkpoint envelopes, and session JSONL replay already exist, but their authority boundaries were not documented explicitly. That led reviews to conflate evidence responsibilities from different layers.

## Decision

### 1. Responsibilities of session replay

- `SessionDualStorageService` is authoritative for session timelines and interaction events
- session replay is not the domain lifecycle audit bus and not the knowledge namespace policy engine
- the authoritative source for domain lifecycle events remains the structured events published by the domain registry

### 2. Domain ownership in checkpoints

- checkpoint envelopes may carry `domainId` and `namespaceId` for retention, routing, and governance ownership
- schema authority for checkpoint payloads still belongs to the payload schema and envelope schema contracts
- the domain meta model does not replace payload schema version validation

### 3. Relationship between knowledge namespaces and sessions

- the domain registry defines which knowledge namespaces are allowed for a domain
- session replay does not re-evaluate namespace policy for historical messages by default
- if domain-aware replay or inspection is needed, upper-layer inspect or governance views should compose session timelines with domain registry and checkpoint metadata instead of forcing all domain events into session JSONL

## Consequences

- session chronology, domain lifecycle, checkpoint schema, and knowledge namespace each keep a single authority
- if future cross-layer inspection views are added, they should use compositional queries rather than forcing one storage system to own every governance responsibility
