import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export function SeeYouOutThere({
  resort, social,
}: {
  resort: { id: string; name: string };
  social?: { instagram?: string; featuredPosts?: string[] } | null;
}) {
  const handle = social?.instagram?.replace(/^@/, '');
  const posts = (social?.featuredPosts || []).filter(Boolean).slice(0, 3);
  useEffect(() => {
    if (!posts.length) return;
    if (document.querySelector('script[data-skiscope-ig]')) return;
    const s = document.createElement('script');
    s.src = 'https://www.instagram.com/embed.js';
    s.async = true;
    s.dataset.skiscopeIg = '1';
    document.body.appendChild(s);
  }, [posts.length]);

  if (!handle) return null;

  return (
    <section className="rounded-[1.6rem] px-4 py-8 ring-1 ring-foreground/12" data-testid="see-you-out-there">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">See you out there</p>
      <h2 className="mt-2 font-display text-4xl tracking-wide">{resort.name}</h2>
      <p className="mt-2 text-base text-muted-foreground">
        The mountain, after the numbers. Follow the resort for what the cameras catch.
      </p>
      <Button type="button" variant="outline" className="mt-5 min-h-12 w-full text-base" asChild>
        <a href={`https://www.instagram.com/${handle}/`} target="_blank" rel="noopener" data-testid="ig-follow">
          Follow @{handle} on Instagram
        </a>
      </Button>
      {posts.length ? (
        <div className="mt-6 flex flex-col gap-4" data-testid="ig-embeds">
          {posts.map(url => (
            <blockquote
              key={url}
              className="instagram-media"
              data-instgrm-permalink={url}
              data-instgrm-version="14"
              style={{ margin: 0 }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
