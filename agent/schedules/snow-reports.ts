import { defineSchedule } from 'eve/schedules';
import { sendDueReports } from '../../lib/eve/sendReports.js';

export default defineSchedule({
  cron: '30 13 * * *',
  timezone: 'UTC',
  async run() {
    const result = await sendDueReports();
    console.info('[eve snow-reports]', JSON.stringify(result));
  },
});
