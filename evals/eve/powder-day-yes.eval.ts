import { defineEval } from 'eve/evals';
import { includes } from 'eve/evals/expect';

export default defineEval({
  description: 'Clear powder-day scenario loads powder-day-call and grades it as a powder day.',
  async test(t) {
    const turn = await t.send(
      "Using the powder-day-call skill, grade this morning at Alta: 10 inches by the 6 AM report, snow-to-liquid 14:1, winds 15 mph with 25 mph gusts, snow level well below the base. Is it a powder day?",
    );
    t.succeeded();
    t.calledSkill('powder-day-call');
    t.check(turn.reply, includes(/powder day/i));
  },
});
