/**
 * Evolution CLI Tool
 *
 * This module provides a command-line interface for agent evolution operations
 * including budget policy proposals, experience promotion proposals, proposal
 * synchronization, application, rollback, listing, and budget policy resolution.
 *
 * Usage:
 *   npm run evolution propose_budget            # Propose budget adjustment
 *   npm run evolution propose_experience        # Propose experience promotion
 *   npm run evolution sync                      # Sync proposal approval status
 *   npm run evolution apply                      # Apply approved proposal
 *   npm run evolution rollback                   # Rollback applied proposal
 *   npm run evolution list                       # List proposal views
 *   npm run evolution resolve_budget              # Resolve budget policy
 *   npm run evolution evaluate_budget            # Evaluate task spend against policy
 *
 * Environment Variables:
 *   - AA_EVOLUTION_ACTION: The evolution operation to perform
 *   - AA_TASK_ID: Target task identifier
 *   - AA_EXECUTION_ID: Target execution identifier
 *   - AA_SOURCE_AGENT_ID: Source agent identifier
 *   - AA_SCOPE_TYPE: Scope type (agent, task, workflow, etc.)
 *   - AA_SCOPE_REF: Scope reference identifier
 *   - Additional action-specific variables documented in the CLI env loader
 *
 * @see {@link docs_zh/contracts/} - Evolution contracts
 * @see {@link docs_zh/governance/glossary_and_terminology.md} - Evolution terminology
 * @see {@link docs_zh/architecture/00-platform-architecture.md} - Architecture
 */
export {};
