import { defineEval } from 'eve/evals';
import { includes } from 'eve/evals/expect';

export default defineEval({
  description: 'Powder-day question uses getResortConditions, loads powder-day-call, and does not treat SNWD as recorded snowfall.',
  async test(t) {
    const turn = await t.send("Is it a powder day at Alta?");
    t.succeeded();
    t.calledTool('getResortConditions');
    t.calledSkill('powder-day-call');
    t.check(turn.reply, includes(/powder|last 72h|last 24h|depth/i));
    t.check(turn.reply, includes(/not recorded snowfall|depth-rise|est\.|heuristic|pillow/i));
  },
});
