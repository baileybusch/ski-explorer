import { defineAgent } from 'eve';
import { eveModel } from '../lib/eve/models';

export default defineAgent({
  model: eveModel(),
  defaultTools: false,
  reasoning: 'low',
});
