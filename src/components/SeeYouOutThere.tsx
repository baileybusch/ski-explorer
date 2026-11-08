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
    <section className="border-t border-foreground/12 pt-4" data-testid="see-you-out-there">
      <h2 className="text-lg font-semibold tracking-tight">See you out there</h2>
      <p className="mt-0.5 max-w-[62ch] text-sm text-muted-foreground">
        The mountain after the numbers. Follow {resort.name} for what the cameras catch.
      </p>
      <Button type="button" variant="outline" className="mt-5 min-h-12 w-full text-base min-[840px]:w-auto min-[840px]:px-6" asChild>
        <a href={`https://www.instagram.com/${handle}/`} target="_blank" rel="noopener" data-testid="ig-follow">
          Follow @{handle} on Instagram
        </a>
      </Button>
      {posts.length ? (
        <div className="mt-6 grid gap-4 min-[840px]:grid-cols-3" data-testid="ig-embeds">
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
