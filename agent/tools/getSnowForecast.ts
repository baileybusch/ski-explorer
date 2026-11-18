import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { getSnowForecast } from '../../lib/eve/skiTools.js';

export default defineTool({
  description: 'Daily Open-Meteo forecast snowfall for one catalog mountain (est.). Not observed snowfall.',
  inputSchema: z.object({
    resort: z.string(),
    days: z.number().int().min(1).max(10).optional(),
    units: z.enum(['in', 'cm']).optional(),
  }),
  execute(input) {
    return getSnowForecast(input);
  },
});
