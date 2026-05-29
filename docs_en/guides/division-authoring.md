# Division Authoring

## Goal

A division is the basic unit for the platform to extend business capabilities. This guide defines how to add or maintain a division configuration, while ensuring new businesses do not break the platform's main path constraints.

## Minimum Structure

Each division should contain at minimum:

- `division.yaml`
- `roles/*.prompt.md`
- Optional `AGENT.md` or rule files

Recommended template:

```yaml
id: engineering
name: Engineering Division
description: Full software development workflow
triggers:
  - "write code|programming|develop|implement|fix|bug|feature|refactor"

roles:
  - id: pm
    name: Product Manager
    prompt: roles/pm.prompt.md
    model: balanced
    tools: [read, write_doc]

  - id: developer
    name: Software Engineer
    prompt: roles/developer.prompt.md
    model: coding
    tools: [read, edit, bash]
    max_instances: 5

workflow:
  - step: analyze
    role: pm
    input: "{task}"
    output: user_stories

  - step: develop
    role: developer
    input: "{user_stories}"
    output: code_changes

retry:
  max_attempts: 3
  on_failure: [develop]
```

## Required Design Items

Each division should clearly define:

- What types of tasks it handles.
- How it is matched by VP operations.
- What roles it has, and what their boundaries are.
- How the workflow passes inputs and outputs.
- Which steps allow retry.
- Which outputs become artifacts.

## Role Design Rules

- `id` should be stable, concise, and machine-friendly.
- `triggers` should cover high-frequency expressions but avoid being too broad.
- `roles` should only declare what is actually needed; do not pile on roles just to "look complete".
- `tools` must follow the principle of least privilege.
- `model` selection should match responsibility intensity.
- Each role should clearly state its responsibilities and boundaries, avoiding two roles that can do the same core thing.

## Workflow Rules

- When `input` references upstream output, field names must be traceable.
- `output` should align with downstream consumer fields.
- Large outputs should preferentially be designed as artifact references rather than unlimited inline text.
- For processes requiring rollback or rework, prefer modeling through explicit steps and limited iterations.
- If a step may naturally partially succeed, consider how to express it through schema and precondition.

## Contracts and Validation

When adding new roles or steps, check:

- Whether the input schema is satisfied by upstream output.
- Whether the output schema is clear enough.
- Whether precondition is needed.
- Whether it conflicts with existing role boundaries.
- Whether it introduces high-risk tools never seen within the division.

## Boundaries with HR Agent

- HR Agent can only add roles within existing divisions.
- Workflow changes suggested by HR Agent are only recommendations by default and do not take effect automatically.
- New divisions must be added manually.
- If new tool sets are needed, prioritize having humans extend the division definition first, then consider letting HR use it.

## Acceptance Recommendations

After adding a new division, prepare at minimum:

- One `fast` path task.
- One `standard` or `full` path task.
- One failure retry scenario.
- One scenario requiring artifact output.

## Templates and Trust Warnings

If division/workflow is later exposed as distributable templates or recipes:

- Templates should explicitly display `title / description / instructions / parameters / required_extensions`.
- On first execution or source change, display a trust warning instead of running silently.
- If template content detects hidden characters, suspicious control characters, or other risk signals, default to blocking or at least strong warnings.
- Trust warnings at the experience layer cannot replace runtime policy, sandbox, or capability validation.

## Recommended Practices

- Start divisions small, then gradually add roles.
- First ensure `fast` or `standard` path works, then expand to `full`.
- First verify hit rate and success rate with 1-2 high-frequency tasks, then continue adding capabilities.

## Related Documents

- [ADR-002 Division System](../adr/002-division-system.md)
- [ADR-004 Workflow and Routing](../adr/004-workflow-routing.md)
- [Quickstart](./quickstart.md)