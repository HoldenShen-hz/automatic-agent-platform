# Guides Index

This directory contains operational content, writing standards, and implementation processes.

## Guides List

| File | Title | Description |
|------|-------|-------------|
| `contributing.md` | Contributing Guide | Maintenance responsibilities after documentation split, writing rules, migration rules, and submission process |
| `quickstart.md` | Quick Start | Recommended reading order, current recommended implementation scope, Phase rollout order suggestions, troubleshooting |
| `division-authoring.md` | Division Authoring Guide | How to create and configure a new business division |
| `skill-authoring.md` | Skill Authoring Guide | How to develop and register a new Agent skill |

## Documentation Hierarchy

| Type | Responsibility | Location |
|------|---------------|----------|
| **Overview** | What the platform is | `docs_zh/architecture/00-*.md` |
| **ADR** | Why it was designed this way | `docs_zh/adr/*.md` |
| **Guide** | How to do it | `docs_zh/guides/*.md` |

## Update Rules

- New architecture decisions go into the corresponding ADR
- Changes affecting overall understanding should sync updates to overview summaries and navigation
- Division writing guidelines, development processes, and maintenance constraints belong in guides
- When tracking sources is needed, add a "Source Section" at the bottom of the file
- When the original large document conflicts with split documents, the split document is the target for future maintenance
