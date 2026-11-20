import '../../lib/eve/embeddedData';
import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { startReportSubscription } from '../../lib/eve/subscribeReport.js';

export default defineTool({
  description: 'Start a daily or weekly snow report by email after the user asks. Collects email + catalog resort ids. Double opt-in. Consent ss-consent-4. Does not send when EMAIL_ALERTS_ENABLED is false except the test allowlist.',
  inputSchema: z.object({
    email: z.string().email(),
    resorts: z.array(z.string()).min(1).max(12).describe('Catalog resort ids'),
    freq: z.enum(['daily', 'weekly']).default('weekly'),
  }),
  async execute(input, ctx) {
    const ip = ctx.session?.auth?.current?.attributes?.ip as string | undefined;
    return startReportSubscription({ ...input, ip: ip || 'unknown', source: 'chat' });
  },
});
