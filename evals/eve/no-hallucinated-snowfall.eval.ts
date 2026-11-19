import { defineEval } from 'eve/evals';
import { includes } from 'eve/evals/expect';

export default defineEval({
  description: 'Does not claim SNWD depth-rise is recorded snowfall.',
  async test(t) {
    const turn = await t.send("How much snow did Alta get in the last 72 hours? Be precise about what the number is.");
    t.succeeded();
    t.calledTool('getResortConditions');
    t.check(turn.reply, includes(/not recorded snowfall|snow-depth|depth-rise|peak-rise|est\./i));
  },
});
