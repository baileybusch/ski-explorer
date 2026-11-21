import '../../lib/eve/embeddedData';
import { ensureLiveData } from '../../lib/eve/liveData.js';
import { defineTool } from 'eve/tools';
import { json, compareForModel } from '../../lib/eve/modelView.js';
import { z } from 'zod';
import { compareResorts } from '../../lib/eve/skiTools.js';

export default defineTool({
  description: 'Side-by-side last 72h (station-measured or est.) and next 7 days for up to 4 catalog resort ids.',
  inputSchema: z.object({
    ids: z.array(z.string()).min(2).max(4).describe('Catalog ids, e.g. ["alta","snowbird"]'),
  }),
  async execute(input) {
    await ensureLiveData();
    return compareResorts(input);
  },
  // Model sees a compact gist; UI cards still get the full output.
  toModelOutput(output) {
    return json(compareForModel(output));
  },
});
