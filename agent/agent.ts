import { defineAgent } from 'eve';
import { eveModel } from '../lib/eve/models';

/**
 * Cheap + fast chat: low reasoning effort, compact tool payloads (toModelOutput
 * in agent/tools), short answers (instructions.md). eve 1.0 has no per-call
 * max-output-token field, so cost is capped per public chat session instead:
 * once a session passes these totals eve stops starting model calls and the
 * chat shows its retry/error state.
 */
export default defineAgent({
  model: eveModel(),
  defaultTools: false,
  reasoning: 'low',
  limits: {
    sessionUsage: ({ window }) =>
      window.outputTokens >= 12_000 ||
      window.inputTokens - window.cacheReadTokens >= 400_000 ||
      (window.costUsd ?? 0) >= 0.1,
    sessionTimeoutMs: 24 * 60 * 60 * 1000,
  },
});
