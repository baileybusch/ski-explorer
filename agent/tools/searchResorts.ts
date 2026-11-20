import '../../lib/eve/embeddedData';
import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { searchResorts } from '../../lib/eve/skiTools.js';

export default defineTool({
  description: 'Find resorts in the SkiScope catalog by name, region, country, state, or pass. Returns last 72h (SNWD depth-rise or model est., not recorded snowfall) and next 7d forecast.',
  inputSchema: z.object({
    query: z.string().optional().describe('Name, region, or place, e.g. Mammoth, Utah, Japan'),
    pass: z.enum(['ikon', 'epic', 'all']).optional(),
    region: z.string().optional(),
    country: z.string().optional(),
    state: z.string().optional(),
    limit: z.number().int().min(1).max(16).optional(),
  }),
  execute(input) {
    return searchResorts(input);
  },
});
