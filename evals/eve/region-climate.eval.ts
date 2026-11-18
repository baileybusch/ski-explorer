import { defineEval } from 'eve/evals';
import { includes } from 'eve/evals/expect';

export default defineEval({
  description: 'Resort questions load regional-snow-climates for the mapped slug.',
  async test(t) {
    const turn = await t.send("How's Alta looking this weekend? Use the Wasatch climate, not Sierra defaults.");
    t.succeeded();
    t.calledTool('getResortConditions');
    t.calledSkill('regional-snow-climates');
    t.check(turn.reply, includes(/wasatch|lake effect|intermountain/i));
  },
});
