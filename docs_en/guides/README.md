# Guides Index

This directory contains operational content, writing guidelines, and implementation procedures.

## Guide List

| File | Title | Description |
|------|-------|-------------|
| `contributing.md` | Contributing Guide | Maintenance responsibilities, writing rules, migration rules, and submission process after documentation split |
| `quickstart.md` | Quickstart | Recommended reading order, current recommended implementation scope, Phase rollout order suggestions, troubleshooting |
| `division-authoring.md` | Division Authoring | How to create and configure new business divisions |
| `skill-authoring.md` | Skill Authoring | How to develop and register new agent skills |

## Documentation Hierarchy

| Type | Responsibility | Location |
|------|---------------|----------|
| **Overview** | What the platform is | `docs_en/architecture/00-*.md` |
| **ADR** | Why this design | `docs_en/adr/*.md` |
| **Guide** | How to do it | `docs_en/guides/*.md` |

## Update Rules

- New architecture decisions go to the corresponding ADR
- Changes affecting global understanding should sync the summary and navigation in the overview
- Division authoring, development processes, and maintenance constraints go to guides
- When tracking sources is needed, add "Source Section" at the bottom of the file
- If the original large document conflicts with split documents, the split document is the maintenance target