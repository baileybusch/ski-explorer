import { defineEval } from 'eve/evals';
import { includes } from 'eve/evals/expect';

export default defineEval({
  description: 'Unknown mountain uses the labeled web lookup fallback.',
  async test(t) {
    const turn = await t.send("How's Mt Baker looking this weekend? It may not be in your list.");
    t.succeeded();
    t.calledTool('lookupUnknownResort');
    t.check(turn.reply, includes(/web lookup|open-meteo|not in/i));
  },
});
