import '../../lib/eve/embeddedData';
import { ensureLiveData } from '../../lib/eve/liveData.js';
import { defineTool } from 'eve/tools';
import { json, rankForModel } from '../../lib/eve/modelView.js';
import { z } from 'zod';
import { getTrending } from '../../lib/eve/skiTools.js';

export default defineTool({
  description: 'Who is getting the most new snow. Call this immediately for open-ended questions ("Where\'s it dumping?", "Where should I ski this weekend?") with no region; never ask for a region first. Default sort is Last 72h (new snow at SNOTEL/CDEC stations or model est., not recorded snowfall). Use forecast7d for the coming week, and weekend for "this weekend" (ranks by the Sat + Sun forecast only).',
  inputSchema: z.object({
    sort: z.enum(['actual72h', 'actual24h', 'forecast7d', 'weekend']).optional(),
    pass: z.enum(['ikon', 'epic', 'all']).optional(),
    region: z.string().optional(),
    limit: z.number().int().min(1).max(8).optional(),
  }),
  async execute(input) {
    await ensureLiveData();
    return getTrending(input);
  },
  // Model sees a compact gist; UI cards still get the full output.
  toModelOutput(output) {
    return json(rankForModel(output));
  },
});
