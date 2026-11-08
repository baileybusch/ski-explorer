import { DefaultChatTransport, type ChatTransport, type UIMessageChunk } from 'ai';
import { deterministicStream, lastUserText } from '../../lib/ask/answer.js';
import { observedSnapshot } from '../../lib/boardRank.js';
import { decideOffer, offerChunks } from '../../lib/ask/offer.js';
import { offerState, visitorId } from '@/lib/visitor';
import type { AskUIMessage, BoardScope } from '@/lib/askTypes';

type Ctx = { units: 'in' | 'cm'; catalog: any; board: BoardScope };

let climatology: Promise<any> | null = null;
function loadClimatology() {
  climatology ||= fetch('/data/climatology.json')
    .then(r => (r.ok ? r.json() : { resorts: {} }))
    .catch(() => ({ resorts: {} }));
  return climatology;
}

async function localAnswer(messages: AskUIMessage[], ctx: Ctx): Promise<ReadableStream<UIMessageChunk>> {
  const { catalog, units, board } = ctx;
  const cat = { resorts: catalog.resorts, snow: catalog.snow, regions: catalog.regions, climatology: await loadClimatology(), board };
  const extra = offerChunks(decideOffer({ messages, cat, state: offerState() }));
  return deterministicStream(lastUserText(messages), cat, { units, today: catalog.today }, { extra }) as ReadableStream<UIMessageChunk>;
}

/** Resolve with the server stream only once it has produced a chunk; otherwise answer locally. */
async function firstChunkOr(
  stream: ReadableStream<UIMessageChunk>,
  fallback: () => Promise<ReadableStream<UIMessageChunk>>,
): Promise<ReadableStream<UIMessageChunk>> {
  const reader = stream.getReader();
  let first: ReadableStreamReadResult<UIMessageChunk>;
  try {
    first = await reader.read();
  } catch {
    return fallback();
  }
  if (first.done || first.value?.type === 'error') {
    reader.cancel().catch(() => {});
    return fallback();
  }
  return new ReadableStream<UIMessageChunk>({
    start(controller) { controller.enqueue(first.value as UIMessageChunk); },
    async pull(controller) {
      try {
        const next = await reader.read();
        if (next.done) controller.close();
        else if (next.value.type !== 'error') controller.enqueue(next.value);
      } catch {
        controller.close();
      }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
}

/**
 * /api/ask (AI Gateway model or server-side deterministic) with an in-browser
 * deterministic fallback when the API is unreachable — Vite dev, offline, or a 5xx.
 */
export class AskTransport implements ChatTransport<AskUIMessage> {
  private http: DefaultChatTransport<AskUIMessage>;

  constructor(private ctx: () => Ctx) {
    this.http = new DefaultChatTransport<AskUIMessage>({
      api: '/api/ask',
      // The board's scope and observed snapshot, so server answers rank exactly what the board shows.
      body: () => {
        const { units, board, catalog } = this.ctx();
        return { units, board, snapshot: observedSnapshot(catalog?.snow), sid: visitorId(), offer: offerState() };
      },
    });
  }

  async sendMessages(options: Parameters<ChatTransport<AskUIMessage>['sendMessages']>[0]) {
    const fallback = () => localAnswer(options.messages, this.ctx());
    try {
      const stream = await this.http.sendMessages(options);
      return await firstChunkOr(stream, fallback);
    } catch (err) {
      if (options.abortSignal?.aborted) throw err;
      return fallback();
    }
  }

  async reconnectToStream() {
    return null;
  }
}
