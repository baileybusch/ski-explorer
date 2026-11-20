import '../../lib/eve/embeddedData';
import { defineTool } from 'eve/tools';
import { json, lookupForModel } from '../../lib/eve/modelView.js';
import { z } from 'zod';
import { lookupUnknownResort } from '../../lib/eve/skiTools.js';

export default defineTool({
  description: 'Look up a mountain that is not in the SkiScope catalog via Open-Meteo geocoding + multi-model forecast (snow, liquid equivalent, wind, snow level, spread). Always label as a web lookup, never as a station observation. All numbers are est.',
  inputSchema: z.object({
    query: z.string().min(2).describe('Mountain name, e.g. Chamonix, Mt Baker'),
  }),
  async execute(input) {
    return lookupUnknownResort(input);
  },
  // Model sees a compact gist; UI cards still get the full output.
  toModelOutput(output) {
    return json(lookupForModel(output));
  },
});
