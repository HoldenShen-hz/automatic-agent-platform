# Skill Authoring

## Objective

This guide defines how to use the built-in `skill creator` to generate a skill skeleton and integrate the skill into existing governance/runtime.

## Minimum Process

1. Use `skill creator` to generate the skill directory skeleton.
2. Edit the generated `SKILL.md` to add real workflow, input constraints, and safety notes.
3. If needed, register the skill in the skill registry.
4. Before going live, execute scaffold validate, permission check, and authoring review.

## Minimum Structure

Each skill should contain at minimum:

- `SKILL.md`

Creator may optionally generate:

- `scripts/`
- `references/`
- `assets/`
- `agents/openai.yaml`

## Required Sections in `SKILL.md`

The generated `SKILL.md` should at minimum retain and complete:

- `Description`
- `When To Use`
- `Inputs`
- `Workflow`
- `Safety Notes`

## Authoring Rules

- Skill names should use stable lowercase kebab-case `skill_id`.
- `required_tools` should follow the principle of least privilege.
- `SKILL.md` must not contain secrets, private tokens, or environment-specific endpoints.
- Skills depending on `scripts/` or `references/` must specify usage order in `Workflow`.

## Registration Recommendations

- Skills that need to be under platform governance should enter the skill registry after scaffold generation.
- Registry metadata should remain consistent with skill files, especially `skill_id / version / required_tools / cache policy`.

## Related Documents

- [Tool Skill Plugin Contract](../contracts/tool_skill_plugin_contract.md)
- [Quickstart](./quickstart.md)
