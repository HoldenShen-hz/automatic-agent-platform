# Guides Index

This directory contains operational content, writing guidelines, and implementation procedures.

## Guides List

| File | Title | Description |
|------|-------|-------------|
| `contributing.md` | Contributing Guide | Maintenance responsibilities, writing rules, migration rules, and submission process after documentation split |
| `quickstart.md` | Quickstart Guide | Recommended reading order, current implementation scope, Phase implementation order, troubleshooting |
| `division-authoring.md` | Division Authoring Guide | How to create and configure new business divisions |
| `skill-authoring.md` | Skill Authoring Guide | How to develop and register new Agent skills |

## Documentation Hierarchy

| Type | Responsibility | Location |
|------|---------------|----------|
| **Architecture Overview** | What the platform is | `docs_zh/architecture/00-*.md` |
| **ADR** | Why this design was chosen | `docs_zh/adr/*.md` |
| **Guide** | How to do it | `docs_zh/guides/*.md` |

## Update Rules

- New architectural decisions go into the corresponding ADR
- Changes affecting overall understanding should synchronize updates to the summary and navigation in the Architecture Overview
- Division writing, development processes, and maintenance constraints go into guides
- When source tracing is needed, add a "Source Section" at the bottom of the file
- If the original monolithic document conflicts with split documents, the split documents are the target for future maintenance