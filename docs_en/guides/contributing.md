# Contributing

## Goal

The split document structure is designed to reduce maintenance difficulty. New content should first be written to the corresponding small files, rather than continuing to pile into a single overly long document.

## Document Division

- `docs_zh/architecture/00-platform-architecture.md`
  Platform architecture overview, containing goals, overview, core flows, phase plans, and navigation.
- `docs_zh/adr/`
  Contains stable architectural decisions, emphasizing background, decisions, outcomes, and cross-references.
- `docs_zh/guides/`
  Contains operational content, writing standards, and implementation procedures.
- `docs_zh/`
  No longer maintaining historical archive directory, only keeping currently active formal documents.

## Update Rules

- New architectural decisions go into the corresponding ADR.
- Changes affecting overall understanding should synchronously update the overview's summary and navigation.
- Division authoring, development processes, and maintenance constraints belong in guides.
- When source tracing is needed, add a "Source Section" at the bottom of the file.
- When the original large document conflicts with split documents, the split documents become the maintenance target.

## Writing Rules

- A decision should only have a primary explanation in one ADR; other files should only link, not repeat long passages.
- Use stable titles as much as possible to reduce future link breakage.
- Each modification should include at least one cross-link to avoid orphaned documents.
- Design, implementation order, risks, and boundaries should be expressed separately to avoid becoming a stream of mixed content.

## Migration Rules

When migrating content from old documents:

1. First determine whether the content belongs to Overview, ADR, or Guide.
2. Then determine whether it is a "design decision" or an "operation method".
3. If it is only historical context, put a summary and link, do not copy entire sections.
4. If the original content has duplication, use the first complete occurrence as the standard.

## Recommended Submission Process

1. First locate whether the change belongs to Overview, ADR, or Guide.
2. Modify the corresponding small file.
3. Check if cross-links need to be added.
4. If the change affects phase scope or milestones, synchronously update the overview.
5. If it is only historical archive change, do not overwrite the main document in reverse.