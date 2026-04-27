# Skill Authoring

## Goal

This guide defines how to use the system's built-in `skill creator` generation feature to initialize a skill skeleton and connect the skill to existing governance/runtime.

## Minimal Flow

1. Use `skill creator` to generate the skill directory skeleton.
2. Edit the generated `SKILL.md` to add real workflow, input constraints, and safety instructions.
3. If needed, register the skill with the skill registry.
4. Before going live, execute scaffold validate, permission check, and authoring review.

## Minimal Structure

Each skill must contain at least:

- `SKILL.md`

Creator optionally generates:

- `scripts/`
- `references/`
- `assets/`
- `agents/openai.yaml`

## Required `SKILL.md` Sections

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
- Skills depending on `scripts/` or `references/` must specify the usage order in `Workflow`.

## Registration Recommendations

- Skills that need to be included in platform governance should enter the skill registry after scaffold generation.
- Registry metadata should stay consistent with skill files, especially `skill_id / version / required_tools / cache policy`.

## Related Documentation

- [Tool Skill Plugin Contract](../contracts/tool_skill_plugin_contract.md)
- [Quickstart](./quickstart.md)