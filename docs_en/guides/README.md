# Guides Index

This directory contains operational content, writing standards, and implementation procedures.

## Guides List

| File | Title | Description |
|------|-------|-------------|
| `contributing.md` | Contributing Guide | Maintenance responsibilities, writing rules, migration rules, and submission process after document split |
| `quickstart.md` | Quickstart | Recommended reading order, current implementation scope, Phase rollout sequence, and troubleshooting |
| `division-authoring.md` | Division Authoring Guide | How to create and configure new business divisions |
| `skill-authoring.md` | Skill Authoring Guide | How to develop and register new Agent skills |

## Document Hierarchy

| Type | Responsibility | Location |
|------|---------------|----------|
| **Overview** | What the platform is | `docs_zh/architecture/00-*.md` |
| **ADR** | Why the design is this way | `docs_zh/adr/*.md` |
| **Guide** | How to do specific things | `docs_zh/guides/*.md` |

## Update Rules

- New architectural decisions go into the corresponding ADR
- Changes affecting overall understanding should synchronously update the overview's summary and navigation
- Division authoring, development processes, and maintenance constraints belong in guides
- When source tracing is needed, add a "Source Section" at the bottom of the file
- When the original large document conflicts with split documents, the split documents become the maintenance target