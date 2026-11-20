import '../../lib/eve/embeddedData';
import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { getTrending } from '../../lib/eve/skiTools.js';

export default defineTool({
  description: 'Who is getting the most new snow. Default sort is Last 72h (SNOTEL SNWD peak-rise or model est., not recorded snowfall). Use forecast7d for the coming week.',
  inputSchema: z.object({
    sort: z.enum(['actual72h', 'actual24h', 'forecast7d']).optional(),
    pass: z.enum(['ikon', 'epic', 'all']).optional(),
    region: z.string().optional(),
    limit: z.number().int().min(1).max(8).optional(),
  }),
  execute(input) {
    return getTrending(input);
  },
});
