# ADR-044 Non-Technical User Experience

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Non-technical users need guided experiences to accomplish tasks without understanding underlying technical details. The platform must provide clear guidance and safe defaults.

## Decision

### Guided Onboarding

| Phase | Description |
|-------|-------------|
| Welcome | Platform introduction |
| Task Creation | Step-by-step task wizard |
| Status Monitoring | Plain-language status updates |
| Troubleshooting | Guided problem resolution |

### Workflow Builder

- Visual workflow construction
- Template library for common tasks
- Drag-and-drop step arrangement

### UX Design Principles

1. **Clarity**: Use plain language, avoid technical jargon
2. **Guidance**: Show next steps clearly
3. **Safety**: Confirm high-risk actions
4. **Feedback**: Provide immediate visual feedback

### WCAG Compliance

- Level A conformance minimum
- Keyboard navigation support
- Screen reader compatible
- Color contrast ratio ≥ 4.5:1

### User Experience Orchestration

- `interaction/ux/user-experience-orchestration-service.ts`
- Converges onboarding/wizard/template/builder into unified service

## Consequences

Positive:
- Guided experiences lower barrier to entry
- Workflow builder enables task automation
- WCAG compliance ensures accessibility

Negative:
- Multiple UX paths increase maintenance
- Visual builder requires significant development

Trade-offs:
- Accessibility vs. complexity
- Guidance vs. flexibility

## Cross-References

- [ADR-043 Unified Operations Dashboard](./043-unified-operations-dashboard.md)
- [ADR-084 Operator Dashboard and User Experience](./084-operator-dashboard-and-user-experience.md)

## Source Sections

- `§44` Non-Technical User UX