# Contributing

## Goals

The split document structure is used to reduce maintenance difficulty. New content should first be written to corresponding small files, rather than continuing to pile into a single very long document.

## Document Division

- `doc/automatic-agent-architecture.md`
  Only keeps goals, overview, core processes, phase plans, and navigation.
- `doc/adr/`
  Stores stable architectural decisions, emphasizing background, decisions, results, and cross-references.
- `doc/guides/`
  Stores operational content, writing standards, and implementation processes.
- `doc/archive/`
  Only keeps historical archives, not used as primary maintenance surface.

## Update Rules

- New architectural decisions enter corresponding ADR.
- Changes affecting global awareness synchronously update summary and navigation in the main outline.
- Division writing, development processes, and maintenance constraints enter guides.
- When tracking sources, supplement "source sections" at bottom of file.
- When finding conflicts between original large document and split documents, the split document is the subsequent maintenance target.

## Writing Rules

- One decision is only primarily explained in one ADR; other files only link, do not repeat long passages.
- Try to use stable headings to reduce future link failures.
- Each modification should have at least one cross-link to avoid isolated documents.
- Design, implementation order, risks, and boundaries should be expressed separately as much as possible, avoid mixing into running commentary.

## Migration Rules

When migrating old document content:

1. First determine if content belongs to main outline, ADR, or Guide.
2. Then determine if it is "design decision" or "operational method".
3. If it is just historical context, put in summary and links, do not copy entire paragraphs.
4. If original content has duplication, use the first complete occurrence as the standard.

## Recommended Submission Process

1. First locate if change belongs to main outline, ADR, or Guide.
2. Modify corresponding small file.
3. Check if cross-links need supplementation.
4. If change affects phase scope or milestones, synchronously update main outline.
5. If only historical archive change, should not反向覆盖 main document.

## Source Sections

- `§2`
