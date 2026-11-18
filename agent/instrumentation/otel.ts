import { otel } from 'eve/instrumentation/otel';

export default otel({
  resource: {
    'service.name': 'skiscope-eve',
    'deployment.environment': process.env.VERCEL_ENV ?? 'development',
  },
  tracePolicy: ({ audience, environment }) => ({
    emit: true,
    recordInputs: audience === 'public' || environment === 'development',
    recordOutputs: audience === 'public' || environment === 'development',
  }),
});
