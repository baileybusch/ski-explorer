import { useEffect, useState } from 'react';
import { LogoMark } from '@/components/LogoMark';
import { SiteFooter } from '@/components/SiteFooter';
import { AlertsList } from '@/components/AlertsList';
import { AlertOnboarding, type AlertContext } from '@/components/AlertOnboarding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Field, FieldLabel } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { alertsUiState, withAlerts } from '@/lib/alertsUi';
import { loadCatalog } from '@/lib/catalog';
import {
  type LocalRule, accountEmail, deleteLocalRule, loadRules, setAccountEmail, signOutAccount,
} from '@/lib/alertRules';
import { clearSession, loadPrefs, savePrefs, sessionEmail, setSession } from '@/lib/session';
import { defaultPrefs, normalizePrefs, RECAP_DAYS } from '../../lib/accountPrefs.js';

export function ManagePage() {
  const [mode] = useState(() => alertsUiState().mode);
  const preview = mode === 'preview';
  const [email, setEmail] = useState('');
  const [session, setSessionState] = useState('');
  const [prefs, setPrefs] = useState(defaultPrefs);
  const [rules, setRules] = useState<LocalRule[]>([]);
  const [resorts, setResorts] = useState<{ id: string; name: string }[]>([]);
  const [msg, setMsg] = useState('');
  const [alertOpen, setAlertOpen] = useState(false);
  const [editRule, setEditRule] = useState<LocalRule | null>(null);
  const [alertCtx] = useState<AlertContext>({ source: 'menu' });

  const signedIn = !!session;
  const hashAlerts = typeof location !== 'undefined' && location.hash === '#alerts';

  useEffect(() => {
    setEmail(sessionEmail() || accountEmail());
    setSessionState(sessionEmail());
    setPrefs(loadPrefs());
    setRules(loadRules());
    loadCatalog().then(c => setResorts(c.resorts || [])).catch(() => {});
    const token = new URLSearchParams(location.search).get('token');
    if (!token || preview) return;
    fetch(`/api/auth?action=verify&token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(j => {
        if (j.email) {
          setSession(j.email);
          setAccountEmail(j.email);
          setSessionState(j.email);
          setEmail(j.email);
          if (j.prefs) {
            savePrefs(j.prefs);
            setPrefs(normalizePrefs(j.prefs));
          }
        }
      })
      .catch(() => {});
  }, [preview]);

  function refresh() {
    setRules(loadRules());
    setPrefs(loadPrefs());
    setSessionState(sessionEmail());
  }

  function signInLocal(addr = email) {
    const next = addr.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      setMsg('Enter a valid email');
      return;
    }
    setSession(next);
    setAccountEmail(next);
    setSessionState(next);
    setMsg(preview ? 'Signed in on this device. Nothing was emailed.' : 'Signed in.');
  }

  async function requestLink() {
    const next = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      setMsg('Enter a valid email');
      return;
    }
    try {
      const r = await fetch('/api/auth?action=request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: next }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.preview) {
        setMsg('Preview — nothing was emailed. Use the dev sign-in link.');
        return;
      }
      setMsg(j.error || (j.sent ? 'Check your inbox for a sign-in link.' : 'Could not send.'));
    } catch {
      setMsg('Preview — use the dev sign-in link.');
    }
  }

  function patchPrefs(next: Partial<typeof prefs>) {
    const merged = normalizePrefs({ ...prefs, ...next });
    setPrefs(merged);
    savePrefs(merged);
  }

  function unsubAll() {
    loadRules().forEach(r => deleteLocalRule(r.id));
    const off = { ...defaultPrefs(), stormAlerts: false, recap: false, sponsor: false };
    savePrefs(off);
    setPrefs(off);
    refresh();
    setMsg('Unsubscribed on this device.');
  }

  function deleteData() {
    unsubAll();
    signOutAccount();
    clearSession();
    setSessionState('');
    setEmail('');
    setMsg('Local account data deleted.');
  }

  return (
    <div className="min-h-dvh bg-background text-foreground" data-testid="manage-page" data-signed-in={signedIn ? '1' : '0'}>
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-3 pt-[max(0.55rem,env(safe-area-inset-top))]">
        <a href={withAlerts('/')} className="flex min-h-11 items-center gap-2">
          <LogoMark className="size-7" />
          <span className="font-display text-xl tracking-wide">SKISCOPE</span>
        </a>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-3 py-8">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">No password</p>
          <h1 className="font-display text-5xl tracking-wide">{hashAlerts && signedIn ? 'My alerts' : 'Manage account'}</h1>
        </div>

        {!signedIn ? (
          <section className="flex flex-col gap-3" data-testid="manage-signed-out">
            <p className="text-sm text-muted-foreground">
              Enter the email you use for alerts. We send a one-time sign-in link. Nothing is emailed while sending is paused.
            </p>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              className="min-h-12"
              placeholder="you@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              data-testid="manage-email"
            />
            <Button type="button" className="min-h-12 w-full text-base" onClick={requestLink} data-testid="manage-send-link">
              Email me a sign-in link
            </Button>
            {preview ? (
              <Button type="button" variant="outline" className="min-h-12 w-full text-base" onClick={() => signInLocal()} data-testid="manage-dev-signin">
                Dev: sign-in link
              </Button>
            ) : null}
          </section>
        ) : (
          <section className="flex flex-col gap-5" data-testid="manage-signed-in">
            <div>
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="text-lg font-medium" data-testid="manage-session-email">{session}</p>
            </div>
            <Button type="button" variant="ghost" className="min-h-11 justify-start px-0" onClick={() => { clearSession(); signOutAccount(); setSessionState(''); }}>
              Sign out
            </Button>

            <div className="flex flex-col gap-3" data-testid="manage-prefs">
              <h2 className="text-base font-medium">Email preferences</h2>
              <label className="flex min-h-14 items-center justify-between gap-3 rounded-2xl px-4 ring-1 ring-foreground/12">
                <span>Storm alerts</span>
                <Switch checked={prefs.stormAlerts} onCheckedChange={v => patchPrefs({ stormAlerts: v })} data-testid="pref-storm" />
              </label>
              <label className="flex min-h-14 items-center justify-between gap-3 rounded-2xl px-4 ring-1 ring-foreground/12">
                <span>Weekly recap</span>
                <Switch checked={prefs.recap} onCheckedChange={v => patchPrefs({ recap: v })} data-testid="pref-recap" />
              </label>
              <label className="flex min-h-14 items-center justify-between gap-3 rounded-2xl px-4 ring-1 ring-foreground/12">
                <span>Sponsor / partner content</span>
                <Switch checked={prefs.sponsor} onCheckedChange={v => patchPrefs({ sponsor: v })} data-testid="pref-sponsor" />
              </label>
              <Field>
                <FieldLabel>Recap day</FieldLabel>
                <ToggleGroup type="single" value={prefs.recapDay} onValueChange={v => v && patchPrefs({ recapDay: v })} className="flex flex-wrap">
                  {RECAP_DAYS.map(d => (
                    <ToggleGroupItem key={d.id} value={d.id} className="min-h-11 px-3">{d.label}</ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
            </div>

            <div id="alerts">
              <h2 className="mb-3 text-base font-medium">My alerts</h2>
              <AlertsList
                rules={rules}
                resorts={resorts}
                onAlert={() => { setEditRule(null); setAlertOpen(true); }}
                onEdit={rule => { setEditRule(rule); setAlertOpen(true); }}
                onChange={refresh}
              />
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button type="button" variant="outline" className="min-h-12 w-full text-base" data-testid="manage-unsub" onClick={unsubAll}>
                Unsubscribe from everything
              </Button>
              <Button type="button" variant="ghost" className="min-h-12 w-full text-base" data-testid="manage-delete" onClick={deleteData}>
                Delete my data
              </Button>
            </div>
          </section>
        )}

        {hashAlerts && !signedIn ? (
          <section id="alerts" className="flex flex-col gap-3">
            <h2 className="text-base font-medium">Alerts on this device</h2>
            <AlertsList
              rules={rules}
              resorts={resorts}
              onAlert={() => { setEditRule(null); setAlertOpen(true); }}
              onEdit={rule => { setEditRule(rule); setAlertOpen(true); }}
              onChange={refresh}
            />
          </section>
        ) : null}

        {msg ? <p className="text-sm text-muted-foreground" data-testid="manage-msg">{msg}</p> : null}
      </main>

      <SiteFooter />

      <AlertOnboarding
        open={alertOpen}
        onOpenChange={v => { setAlertOpen(v); if (!v) { setEditRule(null); refresh(); } }}
        ctx={{ ...alertCtx, email: session || email }}
        mode={mode}
        resorts={resorts}
        editRule={editRule}
        onSaved={refresh}
      />
    </div>
  );
}
