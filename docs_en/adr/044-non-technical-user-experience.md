# ADR-044 Non-technical User Experience Architecture

- Status：Accepted
- Decision Date：2026-04-20

## Background

Non-technical users (business operators, operations personnel) need simplified interaction methods without needing to understand underlying APIs and technical details.

## Decision

### User Roles

| Role | Description | Interface |
|------|------|------|
| business_operator | Business operator | Simplified interface |
| org_node_owner(team) | Team leader of `OrgNodeType.team` | Management view |
| executive | Executive | Report view |
| admin | Administrator | Full-featured interface |

### Simplified Interaction Patterns

- Templated task creation
- Natural language input
- Visual progress tracking
- One-click approve/reject

### Notifications and Feedback

- Push notifications
- Email notifications
- In-system messages
- Real-time status updates

### Assistive Features

| Feature | Description |
|------|------|
| Task templates | Common task pre-defined templates |
| Quick actions | One-click common operations |
| History records | Operation history traceable |
| Export reports | Data export supported |

## Consequences

Advantages:

- Reduces non-technical user usage threshold
- Templating improves efficiency
- Real-time feedback enhances experience

Costs:

- Multi-role interface increases complexity
- Template maintenance requires continuous investment

## Cross-references

- [ADR-039 Natural Language Task Entry Architecture](./039-natural-language-task-entry.md)
- [ADR-043 Unified Operations Dashboard](./043-unified-operations-dashboard.md)

## Source Section

- `§44` Non-technical User Experience Architecture