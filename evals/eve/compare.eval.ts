import { defineEval } from 'eve/evals';

export default defineEval({
  description: 'Compare two catalog mountains side by side.',
  async test(t) {
    await t.send('Alta vs Snowbird this week');
    t.succeeded();
    t.calledTool('compareResorts');
  },
});
