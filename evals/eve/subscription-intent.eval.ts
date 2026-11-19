import { defineEval } from 'eve/evals';
import { includes } from 'eve/evals/expect';

export default defineEval({
  description: 'Weekly report intent collects email rather than sending immediately.',
  async test(t) {
    const turn = await t.send('Send me a weekly Utah snow report');
    t.succeeded();
    t.check(turn.reply, includes(/email|weekly|confirm/i));
  },
});
