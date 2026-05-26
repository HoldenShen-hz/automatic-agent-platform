# Skill Authoring

## Objective

This guide defines how to use the system's built-in `skill creator` generation feature to initialize a skill skeleton, and how to integrate the skill into existing governance/runtime.

## Minimum Process

1. Use `skill creator` to generate skill directory skeleton.
2. Edit generated `SKILL.md` to supplement real workflow, input constraints, and safety notes.
3. If needed, register the skill in the skill registry.
4. Before going live, execute scaffold validate, permission check, and authoring review.

## Minimum Structure

Each skill should contain at least:

- `SKILL.md`

Creator optionally generates:

- `scripts/`
- `references/`
- `assets/`
- `agents/openai.yaml`

## SKILL.md Required Sections

Generated `SKILL.md` should at least retain and complete:

- `Description`
- `When To Use`
- `Inputs`
- `Workflow`
- `Safety Notes`

## Authoring Rules

- Skill name should use stable lowercase kebab-case `skill_id`.
- `required_tools` should maintain least privilege principle.
- `SKILL.md` must not contain secrets, private tokens, or environment-specific endpoints.
- Skills depending on `scripts/` or `references/` must specify usage order in `Workflow`.

## Registration Suggestions

- Skills requiring platform governance should enter skill registry after scaffold generation.
- Registry metadata should be consistent with skill files, especially `skill_id / version / required_tools / cache policy`.

## Related Documents

- [Tool Skill Plugin Contract](../contracts/tool_skill_plugin_contract.md)
- [Quickstart](./quickstart.md)
