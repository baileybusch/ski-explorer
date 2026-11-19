import { defineEval } from 'eve/evals';
import { includes } from 'eve/evals/expect';

export default defineEval({
  description: 'Windy / high snow-level scenario loads powder-day-call and does not call a powder day.',
  async test(t) {
    const turn = await t.send(
      "Using the powder-day-call skill, grade this morning at Alta: 18 inches overnight but sustained wind 50 mph, gusts 70 mph, and the snow level is 3,000 ft above the base. Is it a powder day?",
    );
    t.succeeded();
    t.calledSkill('powder-day-call');
    t.check(turn.reply, includes(/no|wind hold|rain|not a powder|not powder/i));
  },
});
