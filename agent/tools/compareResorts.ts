import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { compareResorts } from '../../lib/eve/skiTools.js';

export default defineTool({
  description: 'Side-by-side last 72h (depth-rise or est.) and next 7 days for up to 4 catalog resort ids.',
  inputSchema: z.object({
    ids: z.array(z.string()).min(2).max(4).describe('Catalog ids, e.g. ["alta","snowbird"]'),
  }),
  execute(input) {
    return compareResorts(input);
  },
});
