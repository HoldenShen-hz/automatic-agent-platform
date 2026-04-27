# Contributing

## Goal

The split documentation structure reduces maintenance difficulty. New content should be written to corresponding small files first, rather than continuing to pile into a single extremely long document.

## Documentation Division

- `docs_zh/architecture/00-platform-architecture.md`
  Platform architecture overview, containing goals, overview, core flows, phase plans, and navigation.
- `docs_zh/adr/`
  Stores stable architecture decisions, emphasizing background, decisions, consequences, and cross-references.
- `docs_zh/guides/`
  Stores operational content, writing conventions, and implementation procedures.
- `docs_zh/`
  No longer maintaining the historical archive directory, only keeping currently valid formal documentation.

## Update Rules

- New architecture decisions enter the corresponding ADR.
- Changes affecting overall understanding should synchronize updates to the summary and navigation in the master document.
- Division authoring, development processes, and maintenance constraints should go into guides.
- When source tracing is needed, add "source section" at the bottom of the file.
- When conflicts are found between the original large document and split documents, the split document is the subsequent maintenance target.

## Writing Rules

- A decision should only be primarily explained in one ADR; other files should only link, not duplicate lengthy copies.
- Try to use stable titles to reduce future link breakage.
- Each modification should add at least one cross-link to avoid isolated documents.
- Design, implementation order, risks, and boundaries should be expressed separately when possible, avoiding mixed chronological narratives.

## Migration Rules

When migrating old document content:

1. First determine whether the content belongs in the master document, ADR, or Guide.
2. Then determine whether it is "design decision" or "operational method".
3. If it is just historical context, put it in the summary and link, do not copy entire paragraphs.
4. If the original content has duplication, use the first full appearance in the main text as the standard.

## Recommended Submission Process

1. First locate whether the change belongs in the master document, ADR, or Guide.
2. Modify the corresponding small file.
3. Check if cross-links need to be added.
4. If the change affects phase scope or milestones, synchronize updates to the master document.
5. If it is just a historical archive change, it should not back-cover the main document.