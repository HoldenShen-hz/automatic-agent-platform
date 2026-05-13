# Contributing

## Goal

The split documentation structure is designed to reduce maintenance difficulty. New content should primarily be written to corresponding smaller files, rather than continuing to pile into a single monolithic document.

## Documentation Division

- `docs_zh/architecture/00-platform-architecture.md`
  Platform architecture overview, containing goals, overview, core flows, phase plans, and navigation.
- `docs_zh/adr/`
  Contains stable architectural decisions, emphasizing background, decisions, outcomes, and cross-references.
- `docs_zh/guides/`
  Contains operational content, writing guidelines, and implementation procedures.
- `docs_zh/`
  No longer maintaining historical archive directories; only current valid official documents are kept.

## Update Rules

- New architectural decisions go into the corresponding ADR.
- Changes affecting overall understanding should synchronize updates to the summary and navigation in the Architecture Overview.
- Division writing, development processes, and maintenance constraints go into guides.
- When source tracing is needed, add a "Source Section" at the bottom of the file.
- If the original monolithic document conflicts with split documents, the split documents are the target for future maintenance.

## Writing Rules

- A decision should be primarily explained in only one ADR; other files should only link, not duplicate long passages.
- Use stable headings as much as possible to reduce future link breakage.
- Each modification should include at least one cross-link to avoid orphaned documents.
- Design, implementation order, risks, and boundaries should be expressed separately as much as possible, avoiding mixed流水账 (tedious enumeration).

## Migration Rules

When migrating old document content:

1. First determine whether the content belongs in the Architecture Overview, ADR, or Guide.
2. Then determine if it is a "design decision" or "operational method".
3. If it is only historical context, put it in the summary and link, do not copy entire paragraphs.
4. If the original content has duplicates, use the first complete occurrence as the authoritative source.

## Recommended Submission Process

1. First locate which category the change belongs to: Architecture Overview, ADR, or Guide.
2. Modify the corresponding smaller file.
3. Check if cross-links need to be added.
4. If the change affects phase scope or milestones, synchronize updates to the Architecture Overview.
5. If it is only historical archive change, it should not overwrite the main document in reverse.