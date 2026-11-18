import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { getResortConditions } from '../../lib/eve/skiTools.js';

export default defineTool({
  description: 'One catalog mountain: last 72h / 24h new-snow proxy, station base depth (SNWD pillow, not new snow), powder-day flag, pass, storm status, 7-day forecast. Last 72h is not recorded snowfall.',
  inputSchema: z.object({
    resort: z.string().describe('Resort id or name, e.g. alta, Mammoth'),
  }),
  execute(input) {
    return getResortConditions(input);
  },
});
