#!/usr/bin/env python3
"""
Translate Chinese documentation to English.
Uses the translators package with Google Translate as backend.
"""

import re
import os
from pathlib import Path

try:
    import translators as ts
except ImportError:
    print("Installing translators package...")
    os.system("pip install translators")
    import translators as ts

# Configuration
SOURCE_FILE = "/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_zh/architecture/00-platform-architecture.md"
TARGET_FILE = "/Users/holden/Project/automatic_agent/automatic_agent_platform/docs_en/architecture/00-platform-architecture.md"

# Translation settings
TRANSLATOR = 'google'  # Uses Google Translate by default
FROM_LANG = 'zh'
TO_LANG = 'en'

# Chunk size for translation (in lines)
CHUNK_SIZE = 50


def translate_text(text, translator='google'):
    """Translate text from Chinese to English."""
    if not text or not text.strip():
        return text

    # Skip if text appears to be mostly English
    english_chars = sum(1 for c in text if ord(c) < 128)
    if english_chars / len(text) > 0.9:
        return text

    try:
        result = ts.translate_text(
            text,
            translator=translator,
            from_language=FROM_LANG,
            to_language=TO_LANG
        )
        return result
    except Exception as e:
        print(f"Translation error: {e}")
        return text


def is_code_block(text):
    """Check if text is inside a code block."""
    return text.startswith('```') or text.startswith('    ')


def is_table_row(text):
    """Check if text looks like a table row."""
    return text.strip().startswith('|')


def split_into_translatable_chunks(lines):
    """Split lines into chunks that can be translated together."""
    chunks = []
    current_chunk = []
    in_code_block = False

    for line in lines:
        stripped = line.strip()

        # Handle code blocks - translate separately line by line or skip
        if stripped.startswith('```'):
            if current_chunk:
                chunks.append(('\n'.join(current_chunk), False))
                current_chunk = []
            chunks.append((line, False))  # Code block marker
            in_code_block = not in_code_block
        elif in_code_block or stripped.startswith('    '):
            # Inside code block or indented - don't translate
            if current_chunk:
                chunks.append(('\n'.join(current_chunk), False))
                current_chunk = []
            chunks.append((line, False))
        elif is_table_row(stripped) and '|' in stripped:
            # Table row - translate cell by cell
            if current_chunk:
                chunks.append(('\n'.join(current_chunk), True))
                current_chunk = []
            chunks.append((line, True))
        else:
            current_chunk.append(line)

            # Flush chunk when it reaches size limit
            if len(current_chunk) >= CHUNK_SIZE:
                chunks.append(('\n'.join(current_chunk), True))
                current_chunk = []

    # Flush remaining
    if current_chunk:
        chunks.append(('\n'.join(current_chunk), True))

    return chunks


def translate_document():
    """Main translation function."""
    print(f"Reading source: {SOURCE_FILE}")

    with open(SOURCE_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    print(f"Total lines: {len(lines)}")

    # Split into translatable chunks
    chunks = split_into_translatable_chunks(lines)
    print(f"Split into {len(chunks)} chunks")

    # Translate
    translated_lines = []
    total_chunks = len(chunks)

    for i, (chunk, should_translate) in enumerate(chunks):
        if should_translate:
            translated = translate_text(chunk)
            translated_lines.append(translated)
        else:
            translated_lines.append(chunk)

        if (i + 1) % 10 == 0:
            print(f"Progress: {i + 1}/{total_chunks} chunks")

    # Write output
    print(f"Writing target: {TARGET_FILE}")

    # Ensure directory exists
    Path(TARGET_FILE).parent.mkdir(parents=True, exist_ok=True)

    with open(TARGET_FILE, 'w', encoding='utf-8') as f:
        f.write('\n'.join(translated_lines))

    print("Translation complete!")


if __name__ == "__main__":
    translate_document()