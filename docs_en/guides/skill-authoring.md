# Skill Authoring

## Goal

This guide defines how to use the built-in `skill creator` generation feature to initialize a skill skeleton and integrate the skill into existing governance/runtime.

## Minimum Flow

1. Use `skill creator` to generate the skill directory skeleton.
2. Edit the generated `SKILL.md`, supplementing with real workflow, input constraints, and safety notes.
3. If needed, register the skill to the skill registry.
4. Before going live, execute scaffold validate, permission check, and authoring review.

## Minimum Structure

Each skill must contain at least:

- `SKILL.md`

Creator can optionally generate:

- `scripts/`
- `references/`
- `assets/`
- `agents/openai.yaml`

## Required Sections in `SKILL.md`

The generated `SKILL.md` should at least retain and complete:

- `Description`
- `When To Use`
- `Inputs`
- `Workflow`
- `Safety Notes`

## Authoring Rules

- Skill names should use stable lowercase kebab-case `skill_id`.
- `required_tools` should follow the principle of least privilege.
- `SKILL.md` must not contain secrets, private tokens, or environment-specific endpoints.
- Skills depending on `scripts/` or `references/` must specify the usage order in `Workflow`.

## Registration Suggestions

- Skills that need to be included in platform governance should be registered in the skill registry after scaffold generation.
- Registry metadata should be consistent with skill files, especially `skill_id / version / required_tools / cache policy`.

## Related Documents

- [Tool Skill Plugin Contract](../contracts/tool_skill_plugin_contract.md)
- [Quickstart](./quickstart.md)
