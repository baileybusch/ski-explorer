import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { DownloadIcon, LogOutIcon, MailIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { BrandLogo } from '@/components/BrandLogo';
import { BRAND } from '@/lib/brand';

type Count = { id: string | number; name?: string; count: number };
type Subscriber = {
  email: string; firstSource: string | null; signedUpAt: string | null;
  watchingResorts: string[]; watchingRegions: string[];
  askedResorts: string[]; askedRegions: string[]; askedMonths: number[];
  questions: number; lastQuestion: string | null; doNotSell: boolean; demo: boolean;
};
type Dash = {
  generatedAt: string; days: number; demo: boolean; env: string; store: string;
  totals: { subscribers: number; signups: number; chats: number; sessions: number; linkedSessions: number; doNotSell: number; referred: number; offers: { shown: number; accepted: number; dismissed: number } };
  signupsByDay: ({ date: string } & Record<string, number>)[];
  signupsBySource: Record<string, number>;
  topSubscribed: { resorts: Count[]; regions: Count[] };
  topQuestions: { q: string; count: number }[];
  topAsked: { resorts: Count[]; regions: Count[]; months: Count[] };
  subscribers: Subscriber[];
};

const SOURCES = [
  { id: 'home', label: 'Home', color: '#e8eaee' },
  { id: 'resort', label: 'Resort page', color: '#8fa6ba' },
  { id: 'region', label: 'Region / pass page', color: '#b6a6d9' },
  { id: 'chat', label: 'Ask chat', color: '#9fc7b0' },
  { id: 'other', label: 'Other', color: '#5b616b' },
] as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Card({ title, children, className = '', testId }: { title: string; children: ReactNode; className?: string; testId?: string }) {
  return (
    <section className={`rounded-2xl bg-card p-4 ring-1 ring-foreground/10 ${className}`} data-testid={testId}>
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-4xl leading-none tabular">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function Bars({ rows, empty = 'Nothing yet' }: { rows: { label: string; count: number }[]; empty?: string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map(r => r.count), 1);
  return (
    <ol className="flex flex-col gap-1.5">
      {rows.map(r => (
        <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-3 text-sm">
          <div className="relative min-w-0 overflow-hidden rounded-md px-2 py-1">
            <div className="absolute inset-y-0 left-0 rounded-md bg-foreground/12" style={{ width: `${(r.count / max) * 100}%` }} />
            <span className="relative block truncate">{r.label}</span>
          </div>
          <span className="text-right tabular text-muted-foreground">{r.count}</span>
        </li>
      ))}
    </ol>
  );
}

function SignupChart({ days }: { days: Dash['signupsByDay'] }) {
  const max = Math.max(1, ...days.map(d => SOURCES.reduce((n, s) => n + (d[s.id] || 0), 0)));
  return (
    <div>
      <div className="flex h-44 items-end gap-[3px]" data-testid="admin-signup-chart">
        {days.map(d => {
          const total = SOURCES.reduce((n, s) => n + (d[s.id] || 0), 0);
          return (
            <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.date}: ${total} signups`}>
              {SOURCES.map(s => (d[s.id] ? (
                <div key={s.id} style={{ height: `${(d[s.id] / max) * 100}%`, background: s.color }} className="w-full first:rounded-t-[3px]" />
              ) : null))}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>{days[0]?.date.slice(5)}</span><span>{days.at(-1)?.date.slice(5)}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {SOURCES.map(s => (
          <span key={s.id} className="inline-flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-[2px]" style={{ background: s.color }} />{s.label}</span>
        ))}
      </div>
    </div>
  );
}

export function AdminPage() {
  const [phase, setPhase] = useState<'loading' | 'login' | 'ready' | 'error'>('loading');
  const [demo, setDemo] = useState(() => new URLSearchParams(location.search).get('demo') === '1');
  const [dash, setDash] = useState<Dash | null>(null);
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    document.title = `Admin · ${BRAND.name}`;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  async function load(nextDemo = demo) {
    setPhase(p => (p === 'ready' ? p : 'loading'));
    const r = await fetch(`/api/admin?action=dashboard${nextDemo ? '&demo=1' : ''}`, { cache: 'no-store' }).catch(() => null);
    if (!r) { setErr('Could not reach /api/admin.'); setPhase('error'); return; }
    if (r.status === 401) { setPhase('login'); return; }
    if (!r.ok) { setErr((await r.json().catch(() => ({}))).error || `Error ${r.status}`); setPhase('error'); return; }
    setDash(await r.json());
    setPhase('ready');
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function login(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const r = await fetch('/api/admin?action=login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    if (!r?.ok) {
      setErr((await r?.json().catch(() => ({})))?.error || 'Sign-in failed');
      return;
    }
    setPassword('');
    load();
  }

  async function logout() {
    await fetch('/api/admin?action=logout', { method: 'POST' }).catch(() => null);
    setDash(null);
    setPhase('login');
  }

  function toggleDemo(on: boolean) {
    setDemo(on);
    const url = new URL(location.href);
    if (on) url.searchParams.set('demo', '1'); else url.searchParams.delete('demo');
    history.replaceState(null, '', url);
    load(on);
  }

  const subs = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = dash?.subscribers || [];
    if (!q) return list;
    return list.filter(s => [s.email, ...s.watchingResorts, ...s.watchingRegions, ...s.askedResorts, ...s.askedRegions, s.lastQuestion || ''].join(' ').toLowerCase().includes(q));
  }, [dash, filter]);

  const names = useMemo(() => {
    const m = new Map<string, string>();
    if (dash) for (const xs of [dash.topSubscribed.resorts, dash.topSubscribed.regions, dash.topAsked.resorts, dash.topAsked.regions]) for (const x of xs) if (x.name) m.set(String(x.id), x.name);
    return m;
  }, [dash]);
  const nm = (id: string) => names.get(id) || id;

  const exportHref = (kind: string, audience: string) => `/api/admin?action=export&kind=${kind}&audience=${audience}${demo ? '&demo=1' : ''}`;
  const named = (xs: Count[]) => xs.map(x => ({ label: x.name || String(x.id), count: x.count }));

  if (phase === 'login' || phase === 'loading' || phase === 'error') {
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-4 text-foreground" data-testid="admin-login" data-phase={phase}>
        <form className="w-full max-w-sm rounded-2xl bg-card p-6 ring-1 ring-foreground/10" onSubmit={login}>
          <BrandLogo size="page" />
          <h1 className="mt-5 font-display text-4xl tracking-wide">Insights</h1>
          <p className="mt-1 text-sm text-muted-foreground">Admin only. The password is the ADMIN_PASSWORD environment variable.</p>
          {phase === 'error' ? <p className="mt-3 text-sm text-destructive" data-testid="admin-error">{err}</p> : null}
          <Input type="password" autoComplete="current-password" className="mt-5 min-h-12" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} data-testid="admin-password" disabled={phase === 'loading'} />
          {phase === 'login' && err ? <p className="mt-2 text-sm text-destructive" data-testid="admin-login-error">{err}</p> : null}
          <Button type="submit" className="mt-3 min-h-12 w-full text-base" disabled={phase === 'loading' || !password} data-testid="admin-login-submit">Sign in</Button>
        </form>
      </div>
    );
  }

  const d = dash!;
  const offerRate = d.totals.offers.shown + d.totals.offers.accepted + d.totals.offers.dismissed
    ? Math.round((d.totals.offers.accepted / Math.max(1, d.totals.offers.shown + d.totals.offers.accepted + d.totals.offers.dismissed)) * 100)
    : null;

  return (
    <div className="min-h-dvh bg-background text-foreground" data-testid="admin-page" data-demo={d.demo ? '1' : '0'}>
      {d.demo ? (
        <div className="sticky top-0 z-10 bg-[#b6a6d9] px-4 py-2 text-center text-sm font-semibold text-[#08090b]" data-testid="admin-demo-banner">
          DEMO DATA: seeded fake events (demo+N@example.com). Not real subscribers or questions.
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <header className="flex flex-wrap items-center gap-3">
          <BrandLogo size="page" />
          <h1 className="font-display text-4xl tracking-wide">Insights</h1>
          <span className="rounded-full px-2.5 py-1 text-xs ring-1 ring-foreground/15" data-testid="admin-env">{d.demo ? 'demo' : `${d.env} · ${d.store}`}</span>
          <div className="ml-auto flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={demo} onCheckedChange={toggleDemo} data-testid="admin-demo-toggle" /> Demo data
            </label>
            <Button type="button" variant="ghost" className="min-h-10 gap-1.5" onClick={logout}><LogOutIcon className="size-4" />Sign out</Button>
          </div>
        </header>
        <p className="mt-1 text-sm text-muted-foreground">Last {d.days} days · generated {new Date(d.generatedAt).toLocaleString()}</p>

        <div className="mt-5 grid grid-cols-2 gap-3 min-[900px]:grid-cols-6" data-testid="admin-kpis">
          <Kpi label="Subscribers" value={d.totals.subscribers} />
          <Kpi label="Ask questions" value={d.totals.chats} />
          <Kpi label="Visitors" value={d.totals.sessions} hint={`${d.totals.linkedSessions} linked to an email`} />
          <Kpi label="Chat offer accept" value={offerRate == null ? '—' : `${offerRate}%`} hint={`${d.totals.offers.accepted} of ${d.totals.offers.shown + d.totals.offers.accepted + d.totals.offers.dismissed}`} />
          <Kpi label="Do Not Sell" value={d.totals.doNotSell} hint="CCPA opt-out recorded" />
          <Kpi label="From a share" value={d.totals.referred || 0} hint="signups with ?ref=" />
        </div>

        <div className="mt-3 grid gap-3 min-[900px]:grid-cols-3">
          <Card title="Signups over time by source" className="min-[900px]:col-span-2" testId="admin-signups">
            <SignupChart days={d.signupsByDay} />
          </Card>
          <Card title="Signups by first source" testId="admin-sources">
            <Bars rows={SOURCES.map(s => ({ label: s.label, count: d.signupsBySource[s.id] || 0 }))} />
          </Card>
        </div>

        <div className="mt-3 grid gap-3 min-[700px]:grid-cols-2 min-[1100px]:grid-cols-4">
          <Card title="Top subscribed resorts" testId="admin-top-resorts"><Bars rows={named(d.topSubscribed.resorts)} /></Card>
          <Card title="Top subscribed regions" testId="admin-top-regions"><Bars rows={named(d.topSubscribed.regions)} /></Card>
          <Card title="Resorts asked about" testId="admin-asked-resorts"><Bars rows={named(d.topAsked.resorts)} /></Card>
          <Card title="Regions + months asked" testId="admin-asked-regions">
            <Bars rows={named(d.topAsked.regions).slice(0, 6)} />
            <div className="mt-3"><Bars rows={d.topAsked.months.slice(0, 4).map(m => ({ label: MONTHS[Number(m.id) - 1] || String(m.id), count: m.count }))} empty="No months asked yet" /></div>
          </Card>
        </div>

        <div className="mt-3 grid gap-3 min-[900px]:grid-cols-3">
          <Card title="Top Ask questions" className="min-[900px]:col-span-2" testId="admin-top-questions">
            <Bars rows={d.topQuestions.map(q => ({ label: q.q, count: q.count }))} empty="No questions yet" />
          </Card>
          <Card title="Export" testId="admin-export">
            <div className="flex flex-col gap-2">
              <Button asChild variant="outline" className="min-h-11 justify-start gap-2"><a href={exportHref('aggregates', 'partners')} data-testid="admin-export-aggregates"><DownloadIcon className="size-4" />Aggregates (counts only — what a sponsor would see)</a></Button>
              <Button asChild variant="outline" className="min-h-11 justify-start gap-2"><a href={exportHref('subscribers', 'internal')} data-testid="admin-export-internal"><DownloadIcon className="size-4" />Subscribers · internal only</a></Button>
              <Button asChild variant="outline" className="min-h-11 justify-start gap-2"><a href={exportHref('chats', 'internal')} data-testid="admin-export-chats"><DownloadIcon className="size-4" />Questions · internal only</a></Button>
              <Button asChild variant="ghost" className="min-h-11 justify-start gap-2"><a href="/api/email/preview?type=index" target="_blank" rel="noreferrer" data-testid="admin-templates"><MailIcon className="size-4" />Email template previews</a></Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Individual emails and questions are never exported for sponsors. Aggregates are counts of mountains and sources.</p>
          </Card>
        </div>

        <details className="mt-3" open={d.demo}>
        <summary className="cursor-pointer text-sm text-muted-foreground">Internal profiles ({subs.length}) — emails stay in this dashboard. Not shared with sponsors.</summary>
        <Card title={`Subscriber interest profiles (${subs.length})`} className="mt-2" testId="admin-subscribers">
          <Input className="mb-3 min-h-10 max-w-sm" placeholder="Filter by email, resort, region, question" value={filter} onChange={e => setFilter(e.target.value)} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-foreground/10">
                  <th className="py-2 pr-3 font-medium">Email</th>
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 font-medium">Signed up</th>
                  <th className="py-2 pr-3 font-medium">Watching</th>
                  <th className="py-2 pr-3 font-medium">Asked about</th>
                  <th className="py-2 pr-3 text-right font-medium">Questions</th>
                  <th className="py-2 font-medium">Opt-out</th>
                </tr>
              </thead>
              <tbody>
                {subs.slice(0, 200).map(s => (
                  <tr key={s.email} className="border-b border-foreground/6 align-top" data-testid="admin-subscriber-row">
                    <td className="py-2 pr-3 font-medium">{s.email}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{SOURCES.find(x => x.id === s.firstSource)?.label || s.firstSource}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{s.signedUpAt?.slice(0, 10)}</td>
                    <td className="py-2 pr-3">{[...s.watchingResorts, ...s.watchingRegions].map(nm).join(', ') || '—'}</td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {[...s.askedResorts, ...s.askedRegions].map(nm).concat(s.askedMonths.map(m => MONTHS[m - 1])).join(', ') || '—'}
                      {s.lastQuestion ? <div className="mt-0.5 truncate text-xs italic max-w-[22rem]">“{s.lastQuestion}”</div> : null}
                    </td>
                    <td className="py-2 pr-3 text-right tabular">{s.questions}</td>
                    <td className="py-2">{s.doNotSell ? <span className="whitespace-nowrap rounded-full bg-foreground/10 px-2 py-0.5 text-xs" data-testid="admin-dns-badge">Do Not Sell</span> : <span className="text-xs text-muted-foreground">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        </details>
        <p className="mt-4 text-xs text-muted-foreground">
          Stored in private Vercel Blob under insights/{d.env}/ (batched writes, compacted daily). Sponsors never receive emails or questions — only aggregate counts.
        </p>
      </div>
    </div>
  );
}
