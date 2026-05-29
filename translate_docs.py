#!/usr/bin/env python3
"""Translate Chinese markdown files in docs_en/ to English.

Maintenance notes:
- This is a legacy batch translation helper for archived docs, not a CI gate.
- Translation targets are auto-discovered from docs_en/**/*.md files that still
  contain Chinese text so the script does not drift with manual file lists.
- Do not place API tokens or provider credentials in this script; use the
  provider's local credential mechanism when running it manually.
"""

import os
import re
import time
from pathlib import Path
import translators as ts

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
DOC_EN = os.path.join(PROJECT_ROOT, "docs_en")

CHINESE_PATTERN = re.compile(r'[\u4e00-\u9fff]')
TRANSLATION_MAX_ATTEMPTS = 3
TRANSLATION_BASE_BACKOFF_SECONDS = 1.0
TRANSLATION_MIN_INTERVAL_SECONDS = 0.5
_last_translation_started_at = 0.0

def has_chinese(text):
    return bool(CHINESE_PATTERN.search(text))


def discover_files():
    """Return docs_en markdown files that still contain Chinese text."""
    discovered = []
    for path in sorted(Path(DOC_EN).rglob("*.md")):
        try:
            content = path.read_text(encoding="utf-8")
        except OSError as e:
            print(f"SKIP (read error): {path.relative_to(DOC_EN)}: {e}")
            continue
        if has_chinese(content):
            discovered.append(path.relative_to(DOC_EN).as_posix())
    return discovered

def chunk_text(text, max_chars=3000):
    """Split text into chunks, trying to preserve line boundaries."""
    chunks = []
    current = ""
    for line in text.split('\n'):
        if len(current) + len(line) + 1 > max_chars:
            if current:
                chunks.append(current)
            current = line
        else:
            if current:
                current += '\n' + line
            else:
                current = line
    if current:
        chunks.append(current)
    return chunks

def translate_chunk(chunk):
    """Translate a chunk of text, preserving empty strings."""
    if not chunk.strip():
        return chunk
    global _last_translation_started_at
    for attempt in range(1, TRANSLATION_MAX_ATTEMPTS + 1):
        try:
            wait_seconds = TRANSLATION_MIN_INTERVAL_SECONDS - (time.time() - _last_translation_started_at)
            if wait_seconds > 0:
                time.sleep(wait_seconds)
            _last_translation_started_at = time.time()
            return ts.translate_text(chunk, translator='google', from_lang='zh', to_lang='en')
        except Exception as e:
            if attempt == TRANSLATION_MAX_ATTEMPTS:
                print(f"  Translation error after {attempt} attempts: {e}")
                return chunk
            backoff_seconds = TRANSLATION_BASE_BACKOFF_SECONDS * (2 ** (attempt - 1))
            print(f"  Translation retry {attempt}/{TRANSLATION_MAX_ATTEMPTS - 1} in {backoff_seconds:.1f}s: {e}")
            time.sleep(backoff_seconds)


def flush_segment(parts, lines, translate):
    """Flush a text or code segment into parts."""
    if not lines:
        return
    segment = '\n'.join(lines)
    if translate and has_chinese(segment):
        parts.append(translate_chunk(segment))
    else:
        parts.append(segment)

def translate_file(filepath):
    """Read, translate, and write a file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if not has_chinese(content):
        return False

    # Split into code blocks, regular text, etc.
    # We'll translate only text segments, leaving markdown structure intact
    parts = []
    in_code_block = False
    current_lines = []

    for line in content.split('\n'):
        if line.strip().startswith('```'):
            if in_code_block:
                current_lines.append(line)
                flush_segment(parts, current_lines, translate=False)
                current_lines = []
                in_code_block = False
            else:
                flush_segment(parts, current_lines, translate=True)
                current_lines = [line]
                in_code_block = True
        else:
            current_lines.append(line)

    flush_segment(parts, current_lines, translate=not in_code_block)

    result = '\n'.join(parts)
    if content.endswith('\n') and not result.endswith('\n'):
        result += '\n'

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(result)

    return True

def main():
    translated_count = 0
    skipped = 0
    files = discover_files()

    if not files:
        print("No docs_en markdown files with Chinese text found.")
        return

    for rel_path in files:
        filepath = os.path.join(DOC_EN, rel_path)
        if not os.path.exists(filepath):
            print(f"SKIP (not found): {rel_path}")
            skipped += 1
            continue

        print(f"Translating: {rel_path}")
        try:
            was_chinese = translate_file(filepath)
            if was_chinese:
                translated_count += 1
                print(f"  Done: {rel_path}")
            else:
                print(f"  No Chinese: {rel_path}")
        except Exception as e:
            print(f"  ERROR: {e}")

    print(f"\nAuto-discovered targets: {len(files)}")
    print(f"Total translated: {translated_count}")
    print(f"Skipped (not found): {skipped}")

if __name__ == '__main__':
    main()
