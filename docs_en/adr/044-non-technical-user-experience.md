# ADR-044 Non-Technical User Experience Architecture

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Non-technical users (business operators, operations personnel) need simplified interaction methods without needing to understand underlying APIs and technical details.

## Decision

### User Roles

| Role | Description | Interface | Alignment with §46 OrgNode hierarchy |
|------|-------------|-----------|----------------------------|
| seat | Individual user/business operator | Simplified interface | §46.1 OrgNodeType.seat |
| team_member | Team member | Standard view | §46.1 OrgNodeType.team |
| team_lead | Team lead | Management view | §46.1 OrgNodeType.team (leader permissions) |
| department_head | Department head | Department view | §46.1 OrgNodeType.department |
| division_head | Division head | Division view | §46.1 OrgNodeType.division |
| executive | Executive | Report view | §46.1 OrgNodeType.division/company |
| admin | Platform administrator | Full-featured interface | §46.1 OrgNodeType.company/tenant |

Note: The user role system should align with §46 OrgNode hierarchy — OrgNodeType enum includes: company / division / department / team / seat (see §46.1). User identity maps to OrgNode, and permission inheritance follows OrgTree upward lookup. Business operators (seat) work within teams (team); team leads (team_lead) manage within departments (department); department heads (department_head) coordinate across departments; executives (executive) correspond to division or company-level views; platform administrators (admin) correspond to company/tenant level.

### Simplified Interaction Patterns

- Templated task creation
- Natural language input
- Visual progress tracking
- One-click approve/reject

### Notifications and Feedback

- Push notifications
- Email notifications
- In-app messages
- Real-time status updates

### Assistive Features

| Feature | Description |
|---------|-------------|
| Task Templates | Predefined templates for common tasks |
| Quick Actions | One-click execution for common operations |
| History | Operation history traceable |
| Export Reports | Data export support |

## Consequences

Pros:

- Reduces barrier for non-technical users
- Templating improves efficiency
- Real-time feedback enhances experience

Cons:

- Multi-role interface increases complexity
- Template maintenance requires ongoing investment

## Cross-references

- [ADR-039 Natural Language Task Entry Architecture](./039-natural-language-task-entry.md)
- [ADR-043 Unified Operations Dashboard](./043-unified-operations-dashboard.md)

## Source Section

- `§44` Non-Technical User Experience Architecture
