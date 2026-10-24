import { parseTripSentence, parsedToActions } from '../../lib/agent/parseTrip.js';

export async function askAgent(text: string, ctx: any, onStatus?: (s: string) => void) {
  try {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, pass: ctx.pass }),
    });
    if (res.ok && res.body) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let last: any = null;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === 'status') onStatus?.(ev.text);
          if (ev.type === 'done') last = ev;
        }
      }
      if (last) return last;
    }
  } catch { /* fall through */ }
  onStatus?.('Using the local parser.');
  const parsed = parseTripSentence(text, ctx);
  return { mode: 'deterministic', parsed, actions: parsedToActions(parsed, ctx), llm: false };
}
