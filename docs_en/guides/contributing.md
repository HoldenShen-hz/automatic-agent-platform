# Contributing

## Objective

The split documentation structure is used to reduce maintenance difficulty. New content should be written to the corresponding small files first, rather than continuing to pile into a single long document.

## Documentation Responsibilities

- `docs_en/architecture/00-platform-architecture.md`
  Platform architecture overview, containing objectives, overview, core flows, phase plans, and navigation.
- `docs_en/adr/`
  Contains stable architecture decisions, emphasizing background, decisions, results, and cross-references.
- `docs_en/guides/`
  Contains operational content, writing guidelines, and implementation procedures.
- `docs_en/`
  Historical archive directory is no longer maintained; only currently valid official documents are kept.

## Update Rules

- New architecture decisions go to the corresponding ADR.
- Changes affecting global understanding should sync the summary and navigation in the overview.
- Division authoring, development processes, and maintenance constraints go to guides.
- When tracking sources is needed, add "Source Section" at the bottom of the file.
- If the original large document conflicts with split documents, the split document is the maintenance target.

## Writing Rules

- A decision should only be primarily explained in one ADR; other files should only link, not duplicate long passages.
- Try to use stable headings to reduce future link breakage.
- Each modification should add at least one cross-link to avoid isolated documents.
- Design, implementation order, risks, and boundaries should be expressed separately as much as possible, avoiding mixed walkthrough style.

## Migration Rules

When migrating old document content:

1. First determine whether the content belongs to overview, ADR, or Guide.
2. Then determine if it's "design decision" or "operational method".
3. If it's just historical context, put it in the summary and links, do not copy entire paragraphs.
4. If original content has duplication, use the first full appearance as the standard.

## Recommended Submission Process

1. First locate the change as overview, ADR, or Guide.
2. Modify the corresponding small file.
3. Check if cross-links need to be added.
4. If the change affects phase scope or milestones, sync the overview.
5. If it's just historical archive change, it should not reverse-overwrite the main document.