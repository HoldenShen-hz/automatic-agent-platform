# Guides Index

This directory stores operational content, writing conventions, and implementation procedures.

## Guides List

| File | Title | Description |
|------|-------|-------------|
| `contributing.md` | Contributing Guide | Documentation maintenance division, writing rules, migration rules, and submission process after documentation split |
| `quickstart.md` | Quickstart | Recommended reading order, current recommended implementation scope, Phase implementation order recommendations, troubleshooting |
| `division-authoring.md` | Division Authoring Guide | How to create and configure new business divisions (Division) |
| `skill-authoring.md` | Skill Authoring Guide | How to develop and register new Agent skills (Skill) |

## Documentation Hierarchy

| Type | Responsibility | Location |
|------|----------------|----------|
| **Master** | What the platform is | `docs_zh/architecture/00-*.md` |
| **ADR** | Why this design | `docs_zh/adr/*.md` |
| **Guide** | How to do it | `docs_zh/guides/*.md` |

## Update Rules

- New architecture decisions enter the corresponding ADR
- Changes affecting overall understanding should synchronize updates to the summary and navigation in the master document
- Division authoring, development processes, and maintenance constraints should go into guides
- When source tracing is needed, add "source section" at the bottom of the file
- When conflicts are found between the original large document and split documents, the split document is the subsequent maintenance target