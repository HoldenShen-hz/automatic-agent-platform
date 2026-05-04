import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("../../../../../ui/packages/features/settings/src/hooks/index.ts", import.meta.url),
  "utf8",
);

test("useSettingsVm.save calls updatePreferences with optimistic-lock etag", () => {
  assert.match(
    source,
    /const etag = \(preferences as \{ etag\?: string \}\)\.etag;/,
  );
  assert.match(
    source,
    /await updatePreferences\(client, \{ theme: draftTheme, locale: draftLocale \}, etag\);/,
  );
});

test("useSettingsVm.save exposes saving and saved state transitions", () => {
  assert.match(source, /setSaveState\("saving"\);/);
  assert.match(source, /setSaveState\("saved"\);/);
  assert.match(source, /setSaveState\("idle"\);/);
});
