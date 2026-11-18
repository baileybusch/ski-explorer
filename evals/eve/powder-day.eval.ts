import { defineEval } from 'eve/evals';
import { includes } from 'eve/evals/expect';

export default defineEval({
  description: 'Powder-day question uses getResortConditions and does not treat SNWD as recorded snowfall.',
  async test(t) {
    const turn = await t.send("Is it a powder day at Alta?");
    t.succeeded();
    t.calledTool('getResortConditions');
    t.check(turn.reply, includes(/powder|last 72h|last 24h|depth/i));
  },
});
