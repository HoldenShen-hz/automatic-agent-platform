# Contributing

## Objective

The split document structure reduces maintenance difficulty. New content should be written to corresponding small files first, rather than continuing to pile into a single long document.

## Document Division

- `../architecture/00-platform-architecture.md`
  Platform architecture overview, containing objectives, overview, core process, phase plan, and navigation.
- `../adr/`
  Stores stable architecture decisions, emphasizing background, decisions, results, and cross-references.
- `./`
  Stores operational content, writing guidelines, and implementation procedures.
- `docs_en/`
  No longer maintains historical archive directory; only currently valid formal documents are kept.

## Update Rules

- New architecture decisions go into corresponding ADR.
- Changes affecting global cognition, synchronize updates to overview summary and navigation.
- Division writing, development process, maintenance constraints go into guides.
- When tracing source is needed, supplement "source chapter" at file bottom.
- When original large document conflicts with split documents, split documents are the subsequent maintenance target.

## Writing Rules

- A decision is explained in only one ADR as main explanation; other files only link, do not copy long passages.
- Try to use stable titles to reduce future link breakage.
- Each modification should supplement at least one cross-link to avoid orphaned documents.
- Design, implementation order, risk, and boundaries should be expressed separately as much as possible; avoid mixing into a流水账 (chronological listing).

## Migration Rules

When migrating old document content:

1. First determine whether content belongs to overview, ADR, or Guide.
2. Then determine whether it is "design decision" or "operational method".
3. If just historical context, put summary and links; do not copy entire paragraphs.
4. If original content has duplication, use the first complete occurrence as the standard.

## Recommended Submission Process

1. First locate which category the change belongs to: overview, ADR, or Guide.
2. Modify corresponding small file.
3. Check if cross-links need to be supplemented.
4. If change affects phase scope or milestones, synchronize update to overview.
5. If just historical archive change, should not reverse-cover main document.
