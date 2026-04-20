# Contributing

## Objective

The split documentation structure reduces maintenance difficulty. New content should be written to corresponding small files first, rather than continuing to pile into a single long document.

## Documentation Division

- `docs_zh/automatic-agent-architecture.md`
  Keep only objectives, overview, core flows, phase plans, and navigation.
- `docs_zh/adr/`
  Stores stable architectural decisions, emphasizing background, decisions, consequences, and cross-references.
- `docs_zh/guides/`
  Stores operational content, writing guidelines, and implementation processes.
- `docs_zh/`
  No longer maintains historical archive directory; only currently valid official documents are kept.

## Update Rules

- New architectural decisions go into corresponding ADRs.
- Changes affecting overall understanding should synchronously update summaries and navigation in the main document.
- Division authoring, development processes, and maintenance constraints go into guides.
- When source tracking is needed, add "Source Section" at the bottom of the file.
- When the original large document conflicts with split documents, the split document is the subsequent maintenance target.

## Writing Rules

- A decision should have only one primary explanation in one ADR; other files only link, do not extensively copy.
- Try to use stable headings to reduce future link breakage.
- Each modification should include at least one cross-link to avoid orphaned documents.
- Design, implementation sequence, risks, and boundaries should be expressed separately where possible; avoid mixing into a running narrative.

## Migration Rules

When migrating old document content:

1. First determine whether the content belongs in the main document, ADR, or Guide.
2. Then determine whether it is a "design decision" or "operational method".
3. If it is just historical context, put it in the summary and link; do not copy entire paragraphs.
4. If original content has duplication, the first complete occurrence in the main text prevails.

## Recommended Submission Process

1. First locate which category the change belongs to: main document, ADR, or Guide.
2. Modify the corresponding small file.
3. Check if cross-links need to be added.
4. If the change affects phase scope or milestones, synchronously update the main document.
5. If it is only a historical archive change, do not reverse-overwrite the main document.
