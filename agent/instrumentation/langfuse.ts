import { OTLPHttpProtoTraceExporter } from '@vercel/otel';
import { otelIntegration } from 'eve/instrumentation/otel';

const pk = process.env.LANGFUSE_PUBLIC_KEY;
const sk = process.env.LANGFUSE_SECRET_KEY;
const host = (process.env.LANGFUSE_BASE_URL || process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com').replace(/\/$/, '');

function basicAuth(publicKey: string, secretKey: string) {
  return Buffer.from(`${publicKey}:${secretKey}`).toString('base64');
}

/** No-op when Langfuse keys are unset so local/preview still boot. */
const noopExporter = {
  export(_spans: unknown, resultCallback: (result: { code: number }) => void) {
    resultCallback({ code: 0 });
  },
  shutdown() {
    return Promise.resolve();
  },
};

export default otelIntegration({
  exportPolicy: {
    span: () => (pk && sk ? { emit: true, inputs: true, outputs: true } : { emit: false }),
  },
  traceExporter: (pk && sk)
    ? new OTLPHttpProtoTraceExporter({
      url: `${host}/api/public/otel/v1/traces`,
      headers: { Authorization: `Basic ${basicAuth(pk, sk)}` },
    })
    : noopExporter as ConstructorParameters<typeof OTLPHttpProtoTraceExporter> extends never ? never : any,
});
