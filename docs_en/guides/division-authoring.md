# Division Authoring

## Objective

A division is the basic unit for platform to extend business capabilities. This guide defines how to add or maintain a division configuration, and tries to ensure new business does not break main chain constraints of the platform.

## Minimum Structure

Each division should contain at least:

- `division.yaml`
- `roles/*.prompt.md`
- Optional `AGENT.md` or rule files

Recommended template:

```yaml
id: engineering
name: Engineering Division
description: Full software development process
triggers:
  - "write code|Programming|develop|implement|fix|bug|feature|refactor"

roles:
  - id: pm
    name: Product Manager
    prompt: roles/pm.prompt.md
    model: balanced
    tools: [read, write_doc]

  - id: developer
    name: Development Engineer
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

Each division should clarify:

- What types of tasks it handles.
- How it is hit by VP Operations.
- What roles it has, and their boundaries.
- How workflow passes inputs and outputs.
- Which steps allow retry.
- Which outputs become artifacts.

## Role Design Rules

- `id` should be stable, short, and machine-friendly.
- `triggers` should cover high-frequency expressions, but avoid being too broad.
- `roles` should only declare what is actually needed; do not pile up roles for "looking complete".
- `tools` must follow least privilege principle.
- `model` selection should match responsibility intensity.
- Each role should clearly write responsibilities and boundaries; avoid two roles being able to do the same core thing.

## Workflow Rules

- When `input` references upstream output, field names must be traceable.
- `output` should align with downstream consuming fields.
- Large outputs should prioritize being designed as artifact references rather than unlimited inline text.
- For processes that need fallback or rework, prioritize modeling through explicit steps and limited retries.
- If a step may naturally partially succeed, consider how to express it through schema and precondition.

## Contracts and Validation

When adding roles or steps, check:

- Whether input schema is satisfied by upstream output.
- Whether output schema is clear enough.
- Whether precondition is needed.
- Whether it conflicts with existing role boundaries.
- Whether it introduces high-risk tools never seen before in the division.

## Boundary with HR Agent

- HR Agent can only add roles within existing divisions.
- Workflow changes suggested by HR Agent are just suggestions by default and do not take effect automatically.
- New divisions must be added manually.
- If new tool collections are needed, prioritize having humans extend division definition first, then consider letting HR use.

## Acceptance Suggestions

After adding a division, prepare at least:

- One `fast` path task.
- One `standard` or `full` path task.
- One failure retry scenario.
- One scenario requiring artifact output.

## Templates and Trust Hints

If later exposing division/workflow as distributable templates or recipes:

- Templates should explicitly show `title / description / instructions / parameters / required_extensions`.
- At first execution or when source changes, trust warning should be shown rather than directly running silently.
- If template content detects hidden characters, suspicious control characters, or other risk signals, should default to blocking or at least strong warning.
- Experience layer trust warning cannot replace runtime policy, sandbox, or capability validation.

## Recommended Practices

- Start small with the division, then gradually add roles.
- First ensure `fast` or `standard` path works, then extend to `full`.
- First verify hit rate and success rate with 1-2 high-frequency tasks, then continue adding capabilities.

## Related Documents

- [ADR-002 Division System](../adr/002-division-system.md)
- [ADR-004 Workflow and Routing](../adr/004-workflow-routing.md)
- [Quickstart](./quickstart.md)
