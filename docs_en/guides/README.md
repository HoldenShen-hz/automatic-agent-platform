# Guides Index

This directory contains operational content, writing guidelines, and implementation procedures.

## Guides List

| File | Title | Description |
|------|-------|-------------|
| `contributing.md` | Contributing Guide | Document split maintenance division, writing rules, migration rules, and submission process |
| `quickstart.md` | Quickstart | Recommended reading order, current suggested implementation scope, Phase implementation order, troubleshooting |
| `division-authoring.md` | Division Authoring Guide | How to create and configure a new business division |
| `skill-authoring.md` | Skill Authoring Guide | How to develop and register a new Agent skill |

## Document Hierarchy

| Type | Responsibility | Location |
|------|----------------|----------|
| **Overview** | What the platform is | `docs_zh/architecture/00-*.md` |
| **ADR** | Why the design is this way | `docs_zh/adr/*.md` |
| **Guide** | How to do it specifically | `docs_zh/guides/*.md` |

## Update Rules

- New architecture decisions go into corresponding ADR
- Changes affecting global cognition, synchronize updates to overview summary and navigation
- Division writing, development process, maintenance constraints go into guides
- When tracing source is needed, supplement "source chapter" at file bottom
- When original large document conflicts with split documents, split documents are the subsequent maintenance target
