/**
 * Agent Admin-style model config. Cheap/fast AI Gateway ids, same fallback
 * family as lib/ask/server.js. Override with EVE_MODEL / ASK_MODEL / AI_GATEWAY_MODEL.
 */
import { ASK_MODEL_DEFAULT, ASK_MODEL_SUBSTITUTES } from '../ask/server.js';

export const EVE_MODEL_DEFAULT = ASK_MODEL_DEFAULT as string;

export const EVE_MODEL_FALLBACKS = ASK_MODEL_SUBSTITUTES as readonly string[];

export function eveModel() {
  return process.env.EVE_MODEL || process.env.ASK_MODEL || process.env.AI_GATEWAY_MODEL || EVE_MODEL_DEFAULT;
}
