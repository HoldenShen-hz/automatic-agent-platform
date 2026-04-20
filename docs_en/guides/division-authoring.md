# Division Authoring

## Goal

Division is the basic unit for platform to extend business capabilities. This guide defines how to add or maintain a division configuration, and tries to ensure new business does not break platform main path constraints.

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
  - "write code|program|develop|implement|fix|bug|feature|refactor"

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
- What roles it has and their respective boundaries.
- How workflow passes inputs/outputs.
- Which steps allow retry.
- Which outputs become artifacts.

## Role Design Rules

- `id` should be stable, short, machine-friendly.
- `triggers` should cover high-frequency expressions but avoid being too broad.
- `roles` only declare truly needed roles, do not pile on roles to "look complete".
- `tools` must follow least privilege principle.
- `model` selection should match responsibility intensity.
- Each role should clearly write responsibilities and boundaries, avoid two roles being able to do the same core thing.

## Workflow Rules

- When `input` references upstream output, field name must be traceable.
- `output` should align with downstream consumer fields.
- Large outputs prioritize artifact references over unlimited inline text.
- Processes needing fallback or rework prioritize explicit steps and limited attempts modeling.
- If certain step can naturally partially succeed, consider how to express through schema and precondition.

## Contracts and Validation

When adding new roles or steps, should check:

- Whether input schema is satisfied by upstream output.
- Whether output schema is clear enough.
- Whether precondition is needed.
- Whether it conflicts with existing role boundaries.
- Whether it introduces high-risk tools never seen inside the division.

## Boundary with HR Agent

- HR Agent can only supplement roles within existing divisions.
- HR Agent's workflow change suggestions are default just suggestions, do not automatically take effect.
- New divisions must be manually added.
- If new tool collection is needed, prioritize manual extension of division definition first, then consider letting HR use.

## Acceptance Recommendations

After adding division, prepare at least:

- One `fast` path task.
- One `standard` or `full` path task.
- One failure retry scenario.
- One scenario requiring artifact output.

## Template and Trust Tips

If later exposing division/workflow as distributable template or recipe:

- Template should explicitly show `title/description/instructions/parameters/required_extensions`.
- When first executing or source changes, should show trust warning rather than directly silently running.
- If template content detects hidden characters, suspicious control characters, or other risk signals, should default block or at least strongly alert.
- Experience layer trust warning cannot replace runtime policy, sandbox, or capability validation.

## Recommended Practices

- First make division small, then gradually add roles.
- First ensure `fast` or `standard` path runs through, then expand to `full`.
- First verify hit rate and success rate with 1-2 high-frequency tasks, then continue adding capabilities.

## Related Documents

- [ADR-002 Division System](../adr/002-division-system.md)
- [ADR-004 Workflow and Routing](../adr/004-workflow-routing.md)
- [Quickstart](./quickstart.md)
