import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { lookupUnknownResort } from '../../lib/eve/skiTools.js';

export default defineTool({
  description: 'Look up a mountain that is not in the SkiScope catalog via Open-Meteo geocoding + forecast. Always label the result as a web lookup, never as a station observation.',
  inputSchema: z.object({
    query: z.string().min(2).describe('Mountain name, e.g. Chamonix, Mt Baker'),
  }),
  async execute(input) {
    return lookupUnknownResort(input);
  },
});
