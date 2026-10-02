# Studio

Read README.md and docs/product-plan.md before changing this project.

- All code, config, lockfiles, docs, secrets and tests stay inside this directory.
- PostgreSQL + Go API/worker + SvelteKit/TypeScript. Mobile first, understated UI.
- Never present unimplemented AI capabilities as working. No fake provider output.
- Never enable paid AI, change provider budgets or expose secrets without user intent.
- Every internal run has persisted, bounded steps, tokens, time and cost. No recursive
  agent spawning. External MCP actors cannot approve, publish or manage credentials.
- Use product-scoped service operations for both human and agent entry points.
- Edits create immutable content versions. Approval and publication refer to an exact
  version, not a moving current-item pointer.
- Test access control, concurrency and budget/termination behavior when changing them.
- Keep docs/product-plan.md honest about completed and remaining scope.
- The user prefers short Norwegian progress updates and final answers.
