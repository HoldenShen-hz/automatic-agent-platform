# Seeded evasion sample: docs source-of-truth with split / obfuscated references

This markdown fixture hides the bad references in a code-fenced block
and inside backticks so a naive reader might miss them. The
audit:docs-sot script MUST still catch the broken reference inside
the fenced TypeScript snippet AND the broken schema reference at the
end of the file.

## Snippet with a fake source path

```ts
import { thing } from "../../../../src/platform/__missing_in_evasion__.ts";
console.log(thing);
```

## Inline reference to a non-existent schema

`schemas/__definitely_missing_evasion__.schema.json` is required.
