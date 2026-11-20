import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Safe markdown for agent replies: react-markdown never renders raw HTML
 * (skipHtml on top), links open in a new tab with noopener, and only http(s)
 * / mailto URLs survive.
 */
const components: Components = {
  p: ({ children }) => <p className="my-0 [&:not(:first-child)]:mt-2">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 marker:text-muted-foreground">{children}</ul>,
  ol: ({ children }) => <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 marker:text-muted-foreground">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  h1: ({ children }) => <p className="mt-2 font-semibold">{children}</p>,
  h2: ({ children }) => <p className="mt-2 font-semibold">{children}</p>,
  h3: ({ children }) => <p className="mt-2 font-semibold">{children}</p>,
  h4: ({ children }) => <p className="mt-2 font-semibold">{children}</p>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground">
      {children}
    </a>
  ),
  code: ({ children }) => <code className="rounded bg-foreground/[0.06] px-1 py-0.5 text-[0.9em]">{children}</code>,
  pre: ({ children }) => <pre className="mt-2 overflow-x-auto rounded-lg bg-foreground/[0.06] p-2 text-[13px]">{children}</pre>,
  blockquote: ({ children }) => <blockquote className="mt-2 border-l-2 border-foreground/15 pl-3 text-muted-foreground">{children}</blockquote>,
  hr: () => <hr className="my-3 border-foreground/10" />,
  table: ({ children }) => (
    <div className="mt-2 max-w-full overflow-x-auto rounded-lg ring-1 ring-foreground/10" data-testid="chat-md-table">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-foreground/[0.04] text-muted-foreground">{children}</thead>,
  th: ({ children }) => <th className="px-2.5 py-1.5 text-left font-medium">{children}</th>,
  td: ({ children }) => <td className="border-t border-foreground/8 px-2.5 py-1.5 tabular">{children}</td>,
};

function safeUrl(url: string) {
  return /^(https?:|mailto:)/i.test(url) ? url : '';
}

export function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="chat-md min-w-0 break-words" data-testid="chat-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml urlTransform={safeUrl}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
