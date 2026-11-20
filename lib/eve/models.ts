/**
 * Agent Admin-style model config. Override with EVE_MODEL / ASK_MODEL / AI_GATEWAY_MODEL.
 *
 * Default is a cheap, fast open-weight model that the AI Gateway free tier
 * serves (gpt-5.4-mini 403s on the free tier). Prod sets EVE_MODEL to the same.
 */
import { ASK_MODEL_SUBSTITUTES } from '../ask/server.js';

export const EVE_MODEL_DEFAULT = 'openai/gpt-oss-120b';

export const EVE_MODEL_FALLBACKS = ASK_MODEL_SUBSTITUTES as readonly string[];

export function eveModel() {
  return process.env.EVE_MODEL || process.env.ASK_MODEL || process.env.AI_GATEWAY_MODEL || EVE_MODEL_DEFAULT;
}
