import { LogoMark } from '@/components/LogoMark';
import { SiteFooter } from '@/components/SiteFooter';
import { withAlerts } from '@/lib/alertsUi';

const COPY = {
  about: {
    title: 'About',
    body: [
      'SkiScope is an iPhone-first board for Ikon and Epic snow. It ranks mountains by recent snow plus the next week of modeled forecast, then opens a resort page with storm status, a 7-day, radar, and a trip brief.',
      'Snow is modeled Open-Meteo, not resort-reported. Terrain is Mapterhorn. The basemap is OpenFreeMap (OpenMapTiles + OpenStreetMap). Runs and lifts are our own OpenSkiMap / OpenStreetMap GeoJSON. Radar is RainViewer. US winter alerts are NWS. Flights and lodging are search links. We may earn a commission if an affiliate id is set — see the disclosure.',
      'Data sources: OpenStreetMap contributors; OpenFreeMap / OpenMapTiles; Mapterhorn terrain; OpenSkiMap piste data; RainViewer radar (personal/educational API — licensing to-do before commercial radar); NWS; NIFC fire perimeters. Weather data by Open-Meteo.com (CC BY 4.0). Open-Meteo’s free tier is non-commercial — a paid plan is required before sponsors go live.',
      'Email alerts are paused until a sending domain exists. This page is product copy, not a legal filing.',
    ],
  },
  privacy: {
    title: 'Privacy',
    draft: true,
    body: [
      'This is a draft for lawyer review. It describes how SkiScope intends to handle the email address you give us. It is not a finished privacy policy.',
      'There are no accounts or passwords. You enter an email, we email a confirmation link, and only after you click is the subscriber active. Later, Manage account emails a sign-in link. Every alert and recap also has a one-click unsubscribe link.',
      'If you sign up, we use your email to send storm alerts and optional weekly recaps you asked for, and to send a sign-in link so you can manage those alerts. Recaps and alerts may include clearly labeled sponsored or partner content if you leave that preference on. You can turn sponsor content off on the manage page. Signup copy and this page share consent text version ss-consent-1: “By subscribing you agree to get storm alerts and recaps, which may include sponsored content. Unsubscribe anytime.”',
      'We store your email, the resorts you follow, your email preferences, and a consent record (timestamp, source page, consent-text version, hashed IP) so a future sponsor use of the list is backed by consent. We keep a private subscriber record so you can unsubscribe or delete your data. Manage and unsubscribe links sit in every email.',
      'Snow data on the board comes from Open-Meteo and other public map sources listed in About. That is weather data, not your personal data.',
      'The manage page is where you turn storm alerts, recaps, and sponsor content on or off, unsubscribe, or ask us to delete the record. Contact us if those controls are not enough.',
    ],
  },
  terms: {
    title: 'Terms',
    draft: true,
    body: [
      'This is a draft for lawyer review. It is not a finished terms of use.',
      'SkiScope is a snow-monitoring board. Forecast totals are modeled, not resort-reported, and can be wrong. Do not treat an alert as a guarantee of powder, travel conditions, or open terrain.',
      'The site and emails are provided as-is while the product is in preview. Features can change. Email sending is off until we say otherwise.',
      'Outbound flight and lodging links may be affiliate links. You are buying from those companies, not from SkiScope.',
    ],
  },
  disclosure: {
    title: 'Affiliate disclosure',
    draft: true,
    body: [
      'This is a draft for lawyer review.',
      'Some flight and lodging buttons are search links. If an affiliate id is configured, those links may earn SkiScope a commission when you book. That does not change the price you see. Rel="sponsored" is added when an id is present.',
      'No affiliate ids are in the public repo today. The commission line only appears when at least one id is set.',
      'Email sponsor slots, when they exist, are labeled Sponsored and are separate from affiliate lodging/flight links.',
    ],
  },
  contact: {
    title: 'Contact',
    body: [
      'For preview questions, write baileybusch@gmail.com. There is no support desk yet.',
      'To leave the list or delete a preview signup, use Manage account or the unsubscribe link that will sit in every live email.',
    ],
  },
} as const;

export function StaticPage({ kind }: { kind: keyof typeof COPY }) {
  const page = COPY[kind];
  return (
    <div className="min-h-dvh bg-background text-foreground" data-testid="static-page" data-page={kind}>
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-3 pt-[max(0.55rem,env(safe-area-inset-top))]">
        <a href={withAlerts('/')} className="flex min-h-11 items-center gap-2" data-testid="legal-home">
          <LogoMark className="size-7" />
          <span className="font-display text-xl tracking-wide">SKISCOPE</span>
        </a>
      </header>
      <main className="mx-auto w-full max-w-xl px-3 py-8">
        {'draft' in page && page.draft ? (
          <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Draft — review with a lawyer before launch</p>
        ) : null}
        <h1 className="font-display text-5xl tracking-wide">{page.title}</h1>
        <div className="mt-5 flex flex-col gap-4 text-base leading-relaxed text-muted-foreground">
          {page.body.map(p => <p key={p.slice(0, 24)}>{p}</p>)}
          {kind === 'about' || kind === 'privacy' ? (
            <p data-testid="open-meteo-credit">
              Weather data by <a href="https://open-meteo.com/" className="underline-offset-4 hover:underline">Open-Meteo.com</a>
            </p>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
