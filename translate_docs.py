#!/usr/bin/env python3
"""Translate Chinese markdown files in docs_en/ to English.

Maintenance notes:
- This is a legacy batch translation helper for archived docs, not a CI gate.
- Keep the file list explicit so bulk translation scope is reviewable.
- Do not place API tokens or provider credentials in this script; use the
  provider's local credential mechanism when running it manually.
"""

import os
import re
import time
import translators as ts

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
DOC_EN = os.path.join(PROJECT_ROOT, "docs_en")

# Files containing Chinese (from grep)
FILES = [
    "research/analysis/claude_code_analysis.md",
    "research/analysis/aider_analysis.md",
    "research/analysis/hermes_agent_analysis.md",
    "research/analysis/all_analysis_summary.md",
    "research/analysis/codex_analysis.md",
    "research/analysis/langgraph_analysis.md",
    "research/analysis/metagpt_analysis.md",
    "research/analysis/deerflow_analysis.md",
    "research/analysis/temporal_analysis.md",
    "research/analysis/opencode_analysis.md",
    "research/analysis/goose_analysis.md",
    "research/analysis/claw_code_analysis.md",
    "research/reference-alignment/reference_industrial_goal.md",
    "research/reference-alignment/reference_agent_team.md",
    "research/reference-alignment/reference_agent_evolution.md",
    "research/reference-alignment/opencode_reference_alignment_review.md",
    "research/reference-alignment/reference_claude_managed_agents.md",
    "research/reference-alignment/reference_weaker_llm_agent.md",
    "research/reference-alignment/reference_memory_manage.md",
    "research/reference-alignment/codex_reference_alignment_review.md",
    "research/reference-alignment/open_multi_agent_reference_alignment_review.md",
    "research/reference-alignment/advertising_system_reference_alignment_review.md",
    "research/reference-alignment/hermes_agent_reference_alignment_review.md",
    "research/reference-alignment/README.md",
    "research/reference-alignment/goose_reference_alignment_review.md",
    "research/reference-alignment/claude_code_rev_reference_alignment_review.md",
    "research/reference-alignment/reference_cross_analysis_and_todolist_v3_archived.md",
    "research/reference-alignment/openclaw_reference_alignment_review.md",
    "research/reference-alignment/reference_cache_orchestration_skeleton.md",
    "research/reference-alignment/reference_cross_analysis_and_todolist.md",
    "research/platform/Automatic_Agent_Platform_Analysis.md",
    "research/frameworks/OpenClaw_Framework_Analysis.md",
    "research/frameworks/Six_AI_Agent_Framework_Analysis.md",
    "research/frameworks/OpenAI_Codex_CLI_Framework_Analysis.md",
    "research/frameworks/Aider_Framework_Analysis.md",
    "research/frameworks/OpenCode_Framework_Analysis.md",
    "research/frameworks/DeerFlow_Framework_Analysis.md",
    "research/frameworks/Goose_Framework_Analysis.md",
    "research/frameworks/Claude_Code_Reverse_Engineered_Analysis.md",
    "archive/reviews/design_quality_and_production_readiness_review_20260414.md",
    "archive/reviews/20260414-current/stable_runtime_blockers_checklist.md",
    "archive/reviews/20260414-current/security_governance_special_review.md",
    "archive/reviews/20260414-current/stability_contract_special_review.md",
    "archive/reviews/20260414-current/research_analysis_absorption_matrix.md",
    "archive/reviews/20260414-current/reference_master_completion_review.md",
    "archive/reviews/20260414-current/system_architecture_holistic_review.md",
    "archive/reviews/20260414-current/final_goal_architecture_gap_plan.md",
    "archive/reviews/document_system_cleanup_plan_20260414.md",
    "operations/src_module_test_matrix.md",
    "operations/runbook.md",
    "operations/system_gap_analysis_20260412.md",
    "operations/system_gap_analysis_20260412a.md",
    "module-inventory.md",
    "reference/architecture.md",
    "reference/monolith_split_coverage_index.md",
    "reference/02-organization-and-divisions.md",
    "reference/12-storage-deployment-testing-observability.md",
    "reference/glossary.md",
    "reference/03-perception-module.md",
    "reference/07-core-execution-flows.md",
    "reference/04-memory-system-detailed.md",
    "reference/terminology.md",
    "reference/14-business-architecture-and-commercialization.md",
    "reference/16-competitive-differentiation.md",
    "reference/09-tools-skills-and-plugins.md",
    "reference/06-typescript-platform-architecture.md",
    "reference/15-implementation-plan-detailed.md",
    "reference/05-gateway-and-supervisor.md",
    "reference/17-glossary.md",
    "reference/10-llm-provider-strategy-detailed.md",
    "reference/11-security-and-permissions-detailed.md",
    "reference/13-extension-mechanisms.md",
    "reference/01-overview-and-principles.md",
    "reference/08-agent-communication.md",
    "reviews/reference_industrial_goal.md",
    "reviews/reference_agent_team.md",
    "reviews/reference_agent_evolution.md",
    "reviews/opencode_reference_alignment_review.md",
    "reviews/industrial_production_readiness_gap_checklist.md",
    "reviews/opeli_detailed_design.md",
    "reviews/coding_entry_gate_review.md",
    "reviews/document_readiness_review.md",
    "reviews/industrial_readiness_by_module_matrix.md",
    "reviews/reference_claude_managed_agents.md",
    "reviews/reference_weaker_llm_agent.md",
    "reviews/stable_runtime_blockers_checklist.md",
    "reviews/reference_memory_manage.md",
    "reviews/security_governance_special_review.md",
    "reviews/production_readiness_assessment_v2.md",
    "reviews/codex_reference_alignment_review.md",
    "reviews/open_multi_agent_reference_alignment_review.md",
    "reviews/advertising_system_reference_alignment_review.md",
    "reviews/test_strategy_plan.md",
    "reviews/architecture_issue_triage.md",
    "reviews/hermes_agent_reference_alignment_review.md",
    "reviews/goose_reference_alignment_review.md",
    "reviews/stability_contract_special_review.md",
    "reviews/platform_core_subsystems_review.md",
    "reviews/research_analysis_absorption_matrix.md",
    "reviews/reference_20260413_system_alignment_review.md",
    "reviews/reference_new_requierment.md",
    "reviews/documentation_final_signoff_review.md",
    "reviews/claude_code_rev_reference_alignment_review.md",
    "reviews/platform_plane_special_review.md",
    "reviews/openclaw_reference_alignment_review.md",
    "reviews/test_strategy_paly.md",
    "reviews/system_architecture_holistic_review.md",
    "reviews/phase_readiness_matrix.md",
    "reviews/reference_cache_orchestration_skeleton.md",
    "reviews/final_goal_architecture_gap_plan.md",
    "reviews/pre_stable_launch_blockers_checklist.md",
    "reviews/authoritative_task_store_refactoring_plan.md",
    "reviews/opeli_reference_completion_review.md",
    "reviews/reference_cross_analysis_and_todolist.md",
    "reviews/production_gap_solution_v2.md",
]

CHINESE_PATTERN = re.compile(r'[\u4e00-\u9fff]')
TRANSLATION_MAX_ATTEMPTS = 3
TRANSLATION_BASE_BACKOFF_SECONDS = 1.0

def has_chinese(text):
    return bool(CHINESE_PATTERN.search(text))

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
    for attempt in range(1, TRANSLATION_MAX_ATTEMPTS + 1):
        try:
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

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(result)

    return True

def main():
    translated_count = 0
    skipped = 0

    for rel_path in FILES:
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

    print(f"\nTotal translated: {translated_count}")
    print(f"Skipped (not found): {skipped}")

if __name__ == '__main__':
    main()
