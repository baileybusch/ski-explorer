import '../../lib/eve/embeddedData';
import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { getSnowForecast } from '../../lib/eve/skiTools.js';

export default defineTool({
  description: 'Daily Open-Meteo forecast for one catalog mountain (est.): snowfall, liquid equivalent / SLR, wind speed/gusts/direction, snow/freezing level, and GFS vs ECMWF model spread. Not observed snowfall. Numbers are modeled estimates.',
  inputSchema: z.object({
    resort: z.string(),
    days: z.number().int().min(1).max(10).optional(),
    units: z.enum(['in', 'cm']).optional(),
  }),
  async execute(input) {
    return getSnowForecast(input);
  },
});
