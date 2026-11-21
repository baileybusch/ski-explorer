import '../../lib/eve/embeddedData';
import { ensureLiveData } from '../../lib/eve/liveData.js';
import { defineTool } from 'eve/tools';
import { json, forecastForModel } from '../../lib/eve/modelView.js';
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
    await ensureLiveData();
    return getSnowForecast(input);
  },
  // Model sees a compact gist; UI cards still get the full output.
  toModelOutput(output) {
    return json(forecastForModel(output));
  },
});
