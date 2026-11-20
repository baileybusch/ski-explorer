import '../../lib/eve/embeddedData';
import { defineTool } from 'eve/tools';
import { json, resortForModel } from '../../lib/eve/modelView.js';
import { z } from 'zod';
import { getResortConditionsLive } from '../../lib/eve/skiTools.js';

export default defineTool({
  description: 'One catalog mountain: last 72h / 24h new-snow proxy (not recorded snowfall), station snow depth, a powder verdict, plus live Open-Meteo extras when available (storm liquid equivalent / SLR, wind speed/gusts/direction, snow/freezing level, GFS vs ECMWF spread). All forecast extras are est.',
  inputSchema: z.object({
    resort: z.string().describe('Resort id or name, e.g. alta, Mammoth'),
  }),
  async execute(input) {
    return getResortConditionsLive(input);
  },
  // Model sees a compact gist; UI cards still get the full output.
  toModelOutput(output) {
    return json(resortForModel(output));
  },
});
