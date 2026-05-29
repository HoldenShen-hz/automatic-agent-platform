# Skill Authoring

## Goal

This guide defines how to use the system's built-in `skill creator` generation functionality to initialize a skill skeleton, and how to integrate the skill into existing governance/runtime.

## Minimum Process

1. Use `skill creator` to generate the skill directory skeleton.
2. Edit the generated `SKILL.md` to add real workflow, input constraints, and safety descriptions.
3. If needed, register the skill in the skill registry.
4. Before launch, execute scaffold validation, permission check, and authoring review.

## Minimum Structure

Each skill should contain at minimum:

- `SKILL.md`

Creator optionally generates:

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
- Skills relying on `scripts/` or `references/` must specify the usage order in `Workflow`.

## Registration Recommendations

- Skills that need to be under platform governance should enter the skill registry after scaffold generation.
- Registry metadata should remain consistent with skill files, especially `skill_id / version / required_tools / cache policy`.

## Related Documents

- [Tool Skill Plugin Contract](../contracts/tool_skill_plugin_contract.md)
- [Quickstart](./quickstart.md)