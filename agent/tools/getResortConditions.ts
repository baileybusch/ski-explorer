import '../../lib/eve/embeddedData';
import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { getResortConditionsLive } from '../../lib/eve/skiTools.js';

export default defineTool({
  description: 'One catalog mountain: last 72h / 24h new-snow proxy (not recorded snowfall), station pillow SWE/depth, powder-day-call grade, plus live Open-Meteo extras when available (storm liquid equivalent / SLR, wind speed/gusts/direction, snow/freezing level, GFS vs ECMWF spread). All forecast extras are est.',
  inputSchema: z.object({
    resort: z.string().describe('Resort id or name, e.g. alta, Mammoth'),
  }),
  async execute(input) {
    return getResortConditionsLive(input);
  },
});
