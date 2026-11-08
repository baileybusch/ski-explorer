import { BrandLogo } from '@/components/BrandLogo';
import { BRAND } from '@/lib/brand';
import { SiteFooter } from '@/components/SiteFooter';
import { withAlerts } from '@/lib/alertsUi';
import { CONSENT_TEXT, CONSENT_VERSION } from '../../lib/consentText.js';

type Block = string | { h: string };

const COPY = {
  about: {
    title: 'About',
    body: [
      `${BRAND.name} is an iPhone-first board for Ikon and Epic snow. It ranks mountains by recent snow plus the next week of modeled forecast, then opens a resort page with storm status, a 7-day, radar, and a trip brief.`,
      'Snow is modeled Open-Meteo, not resort-reported. Terrain is Mapterhorn. The basemap is OpenFreeMap (OpenMapTiles + OpenStreetMap). Runs and lifts are our own OpenSkiMap / OpenStreetMap GeoJSON. Radar is RainViewer. US winter alerts are NWS. Flights and lodging are search links. We may earn a commission if an affiliate id is set — see the disclosure.',
      'Data sources: OpenStreetMap contributors; OpenFreeMap / OpenMapTiles; Mapterhorn terrain; OpenSkiMap piste data; RainViewer radar (personal/educational API — licensing to-do before commercial radar); NWS; NIFC fire perimeters. Weather data by Open-Meteo.com (CC BY 4.0). Open-Meteo’s free tier is non-commercial — a paid plan is required before sponsors go live.',
      'Email alerts are paused until a sending domain exists. This page is product copy, not a legal filing.',
      `${BRAND.name} is headless: the same typed data tools power the public MCP endpoint at /api/mcp, on-site search, the alert evaluator, and the readout writer. Install: claude mcp add --transport http skiscope https://skiscope.vercel.app/api/mcp`,
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    draft: true,
    body: [
      `Draft pending lawyer review, not a finished privacy policy. It describes what ${BRAND.name} collects today, how it is linked to your email, and how you opt out. Last updated November 8, 2026.`,
      { h: 'Your email is your account' },
      'There are no passwords. You enter an email, we send a confirmation link, and you become an active subscriber only after you click it. To manage alerts later we email a one-time sign-in link. Every email has a one-click unsubscribe link.',
      { h: 'What we collect' },
      'Subscription details: your email, the resorts, regions, passes, and trips you ask us to watch, your email preferences (storm alerts, recaps, sensitivity, quiet hours, sponsor content, Do Not Sell), and a consent record (time, the page you signed up on, the consent-text version, and a hashed IP address).',
      `Ask ${BRAND.name} questions: the text of every question you type into Ask, the resorts, regions, and months we infer from it, the time, and whether an AI model or our built-in answers replied. Questions are processed by AI models through Vercel AI Gateway.`,
      'Browsing interests: which category pages (for example /region/california), resort pages, and signup prompts you use, including when an alert offer in Ask is shown, accepted, or dismissed.',
      'An anonymous browser id: a random id stored on your device, sent with your questions and these events. It is not your name or email.',
      { h: 'How it is linked to your email' },
      'Before you sign up, questions and interests are tied only to the anonymous browser id. When you sign up or sign in from that browser, we link the id to your email, including questions you asked from it before signing up. From then on, your questions, browsing interests, and watched mountains form one interest profile tied to your email.',
      { h: 'How we use it' },
      'To send the alerts, recaps, and welcome emails you asked for; to personalize them (which mountains and regions to suggest, what to put in a recap); to understand what skiers want so we can improve the product; and for sponsors and partners. That last use means we may use interest profiles (for example, skiers watching Utah and asking about March) to sell sponsorships, and we may share or sell interest data, including your email, with sponsors and partners, unless you opt out.',
      { h: 'Do Not Sell or Share My Personal Information' },
      'California residents (and anyone else who asks) can opt out of the sale or sharing of personal information. Use the Do Not Sell or Share My Personal Information link in the footer, or the switch on My alerts. Opting out flags your account and this browser, and every sponsor or partner export excludes you. We keep using your data only to run your own alerts.',
      { h: 'Your other choices' },
      'My alerts and Preferences let you change what we watch, turn emails off, unsubscribe from everything, or delete your subscriber record. To request a copy of your data or deletion of your question history, write to baileybusch@gmail.com.',
      { h: 'Retention and service providers' },
      'We keep subscriber records while you are subscribed and delete them on request. Question and interest events are kept for up to 24 months. Data is stored in private Vercel Blob storage; Vercel hosts the site and routes AI requests; Resend delivers email.',
      { h: 'Consent' },
      `Signup copy and this page share consent-text version ${CONSENT_VERSION}: “${CONSENT_TEXT}”`,
      'Snow data on the board comes from Open-Meteo and other public sources listed in About. That is weather data, not your personal data.',
    ],
  },
  terms: {
    title: 'Terms',
    draft: true,
    body: [
      'This is a draft for lawyer review. It is not a finished terms of use.',
      `${BRAND.name} is a snow-monitoring board. Forecast totals are modeled, not resort-reported, and can be wrong. Do not treat an alert as a guarantee of powder, travel conditions, or open terrain.`,
      'The site and emails are provided as-is while the product is in preview. Features can change. Email sending is off until we say otherwise.',
      `Outbound flight and lodging links may be affiliate links. You are buying from those companies, not from ${BRAND.name}.`,
    ],
  },
  disclosure: {
    title: 'Affiliate disclosure',
    draft: true,
    body: [
      'This is a draft for lawyer review.',
      `Some flight and lodging buttons are search links. If an affiliate id is configured, those links may earn ${BRAND.name} a commission when you book. That does not change the price you see. Rel="sponsored" is added when an id is present.`,
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
          <BrandLogo size="page" />
        </a>
      </header>
      <main className="mx-auto w-full max-w-xl px-3 py-8">
        {'draft' in page && page.draft ? (
          <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground" data-testid="draft-flag">Draft pending lawyer review</p>
        ) : null}
        <h1 className="font-display text-5xl tracking-wide">{page.title}</h1>
        <div className="mt-5 flex flex-col gap-4 text-base leading-relaxed text-muted-foreground">
          {(page.body as readonly Block[]).map((p, i) => (typeof p === 'string'
            ? <p key={i}>{p}</p>
            : <h2 key={i} className="mt-3 text-lg font-semibold text-foreground">{p.h}</h2>))}
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
