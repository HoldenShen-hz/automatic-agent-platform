# ADR-044 Non-Technical User Experience Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Non-technical users (business operators, operations staff) need simplified interaction patterns without requiring understanding of underlying APIs and technical details.

## Decision

### User Roles

| Role | Description | Interface |
|------|-------------|-----------|
| business_operator | Business Operator | Simplified Interface |
| team_lead | Team Lead | Management View |
| executive | Executive | Report View |
| admin | Administrator | Full-Feature Interface |

### Simplified Interaction Patterns

- Templated task creation
- Natural language input
- Visual progress tracking
- One-click approve/reject

### Notifications and Feedback

- Push notifications
- Email notifications
- In-system messaging
- Real-time status updates

### Auxiliary Features

| Feature | Description |
|---------|-------------|
| Task Templates | Pre-defined templates for common tasks |
| Quick Actions | One-click execution for frequent operations |
| History | Traceable operation history |
| Export Reports | Data export support |

## Consequences

Benefits:

- Lower barrier to entry for non-technical users
- Templating improves efficiency
- Real-time feedback enhances user experience

Tradeoffs:

- Multi-role interface increases complexity
- Template maintenance requires ongoing investment

## Cross References

- [ADR-039 Natural Language Task Entry Architecture](./039-natural-language-task-entry.md)
- [ADR-043 Unified Operations Dashboard](./043-unified-operations-dashboard.md)

## Source Section

- `§44` Non-Technical User Experience Architecture
