import { useEffect, useState } from 'react';
import { toast } from 'sonner';
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
import { ALERT_SENSITIVITY, sensitivityOf } from '../../lib/alertDefaults.js';
import { loadCatalog } from '@/lib/catalog';
import {
  type LocalRule, accountEmail, deleteLocalRule, loadRules, setAccountEmail, signOutAccount, updateLocalRule,
} from '@/lib/alertRules';
import { clearSession, loadPrefs, savePrefs, sessionEmail, setSession } from '@/lib/session';
import { defaultPrefs, normalizePrefs, RECAP_DAYS } from '../../lib/accountPrefs.js';
import { CONSENT_TEXT } from '../../lib/consentText.js';
import type { SnowUnits, TempUnits } from '@/lib/format';

type Screen = 'out' | 'check' | 'in';

export function ManagePage() {
  const [mode] = useState(() => alertsUiState().mode);
  const preview = mode === 'preview';
  const [screen, setScreen] = useState<Screen>('out');
  const [email, setEmail] = useState('');
  const [session, setSessionState] = useState('');
  const [prefs, setPrefs] = useState(defaultPrefs);
  const [rules, setRules] = useState<LocalRule[]>([]);
  const [resorts, setResorts] = useState<{ id: string; name: string }[]>([]);
  const [alertOpen, setAlertOpen] = useState(false);
  const [editRule, setEditRule] = useState<LocalRule | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [units, setUnits] = useState<SnowUnits>(() => (localStorage.getItem('ss_units') as SnowUnits) || 'in');
  const [tempUnits, setTempUnits] = useState<TempUnits>(() => (localStorage.getItem('ss_temp') as TempUnits) || 'F');
  const hashAlerts = typeof location !== 'undefined' && location.hash === '#alerts';

  useEffect(() => {
    setEmail(sessionEmail() || accountEmail());
    const sess = sessionEmail();
    setSessionState(sess);
    if (sess) setScreen('in');
    setPrefs(loadPrefs());
    setRules(loadRules());
    loadCatalog().then(c => setResorts(c.resorts || [])).catch(() => {});
    const token = new URLSearchParams(location.search).get('token');
    if (token && !preview) {
      fetch(`/api/auth?action=exchange&token=${encodeURIComponent(token)}`, { method: 'POST' })
        .then(r => r.json())
        .then(j => {
          if (j.email) {
            setSession(j.email);
            setAccountEmail(j.email);
            setSessionState(j.email);
            setEmail(j.email);
            setScreen('in');
            if (j.prefs) {
              savePrefs(j.prefs);
              setPrefs(normalizePrefs(j.prefs));
            }
            toast.success('Signed in');
          }
        })
        .catch(() => toast.error('That sign-in link expired.'));
    }
  }, [preview]);

  useEffect(() => { localStorage.setItem('ss_units', units); }, [units]);
  useEffect(() => { localStorage.setItem('ss_temp', tempUnits); }, [tempUnits]);

  function refresh() {
    setRules(loadRules());
    setPrefs(loadPrefs());
    setSessionState(sessionEmail());
  }

  function signInLocal(addr = email) {
    const next = addr.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      toast.error('Enter a valid email');
      return;
    }
    setSession(next);
    setAccountEmail(next);
    setSessionState(next);
    setScreen('in');
    toast.success(preview ? 'Signed in on this device. Nothing was emailed.' : 'Signed in.');
  }

  async function requestLink() {
    const next = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      toast.error('Enter a valid email');
      return;
    }
    setAccountEmail(next);
    try {
      const r = await fetch('/api/auth?action=request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: next }),
      });
      await r.json().catch(() => ({}));
    } catch { /* preview */ }
    setScreen('check');
  }

  function patchPrefs(next: Partial<typeof prefs>) {
    const merged = normalizePrefs({ ...prefs, ...next });
    setPrefs(merged);
    savePrefs(merged);
    if (next.sensitivity && next.sensitivity !== prefs.sensitivity) {
      const sense = sensitivityOf(merged.sensitivity);
      loadRules().forEach(r => updateLocalRule(r.id, { minSnowIn: sense.minSnowIn, windowHours: sense.windowHours }));
      setRules(loadRules());
    }
  }

  async function saveNow() {
    savePrefs(prefs);
    if (!preview) {
      try {
        await fetch('/api/auth?action=save', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prefs, rules }),
        });
      } catch { /* preview / offline */ }
    }
    toast.success('Preferences saved.');
  }

  function unsubAll() {
    loadRules().forEach(r => deleteLocalRule(r.id));
    const off = { ...defaultPrefs(), stormAlerts: false, recap: false, sponsor: false };
    savePrefs(off);
    setPrefs(off);
    refresh();
    toast.success('Unsubscribed on this device.');
  }

  function deleteData() {
    unsubAll();
    signOutAccount();
    clearSession();
    setSessionState('');
    setEmail('');
    setScreen('out');
    setDeleteOpen(false);
    toast.success('Local account data deleted.');
  }

  return (
    <div className="min-h-dvh bg-background text-foreground" data-testid="manage-page" data-signed-in={screen === 'in' ? '1' : '0'} data-screen={screen}>
      <header className="mx-auto flex w-full max-w-lg items-center justify-between px-3 pt-[max(0.55rem,env(safe-area-inset-top))]">
        <a href={withAlerts('/')} className="flex min-h-11 items-center gap-2">
          <LogoMark className="size-7" />
          <span className="font-display text-xl tracking-wide">SKISCOPE</span>
        </a>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-col gap-8 px-3 py-8">
        <div>
          <h1 className="font-display text-5xl tracking-wide">{hashAlerts && screen === 'in' ? 'My alerts' : 'Preferences'}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {preview ? 'Preview on this device. Nothing is emailed while sending is paused.' : 'Manage the emails we send you.'}
          </p>
        </div>

        {screen === 'out' ? (
          <section className="flex flex-col gap-3" data-testid="manage-signed-out">
            <p className="text-sm text-muted-foreground">Enter your email and we&apos;ll send you a sign-in link.</p>
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
            <p className="text-xs leading-relaxed text-muted-foreground">{CONSENT_TEXT}</p>
            {preview ? (
              <Button type="button" variant="outline" className="min-h-12 w-full text-base" onClick={() => signInLocal()} data-testid="manage-dev-signin">
                Dev: sign-in link
              </Button>
            ) : null}
          </section>
        ) : null}

        {screen === 'check' ? (
          <section className="flex flex-col gap-3" data-testid="manage-check-email">
            <p className="text-base">Check {email || 'your inbox'} for a sign-in link.</p>
            <p className="text-sm text-muted-foreground">
              {preview ? 'Sending is paused. Use the preview shortcut below.' : 'The link expires in 30 minutes.'}
            </p>
            <Button type="button" variant="outline" className="min-h-12 w-full text-base" onClick={requestLink} data-testid="manage-resend">
              Resend
            </Button>
            {preview ? (
              <Button type="button" variant="outline" className="min-h-12 w-full text-base" onClick={() => signInLocal()} data-testid="manage-dev-signin">
                Dev: sign-in link
              </Button>
            ) : null}
            <Button type="button" variant="ghost" className="min-h-11 w-full" onClick={() => setScreen('out')}>
              Use a different email
            </Button>
          </section>
        ) : null}

        {screen === 'in' ? (
          <section className="flex flex-col gap-8" data-testid="manage-signed-in">
            <section className="flex flex-col gap-3" data-testid="manage-email-section">
              <h2 className="text-base font-medium">Email</h2>
              <p className="text-lg font-medium" data-testid="manage-session-email">{session}</p>
              <p className="text-xs text-muted-foreground" data-testid="manage-status">
                {preview ? 'Preview session on this device' : 'Signed in with an email link'}
              </p>
              <Button type="button" variant="ghost" className="min-h-11 justify-start px-0" onClick={() => { clearSession(); signOutAccount(); setSessionState(''); setScreen('out'); }}>
                Sign out
              </Button>
            </section>

            <section className="flex flex-col gap-3" data-testid="manage-storm">
              <h2 className="text-base font-medium">Storm alerts</h2>
              <label className="flex min-h-14 items-center justify-between gap-3 rounded-2xl px-4 ring-1 ring-foreground/12">
                <span>Storm alerts</span>
                <Switch checked={prefs.stormAlerts} onCheckedChange={v => patchPrefs({ stormAlerts: v })} data-testid="pref-storm" />
              </label>
              <Field>
                <FieldLabel>Alert sensitivity</FieldLabel>
                <p className="mb-2 text-xs text-muted-foreground">Optional. Standard is 6″ in the next 72 hours. Signup never asks.</p>
                <ToggleGroup type="single" value={prefs.sensitivity} onValueChange={v => v && patchPrefs({ sensitivity: v })} className="flex flex-wrap" data-testid="pref-sensitivity">
                  {ALERT_SENSITIVITY.map(s => (
                    <ToggleGroupItem key={s.id} value={s.id} className="min-h-11 px-3" data-testid={`pref-sensitivity-${s.id}`}>
                      {s.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
              <div id="alerts">
                <AlertsList
                  rules={rules}
                  resorts={resorts}
                  onAlert={() => { setEditRule(null); setAlertOpen(true); }}
                  onEdit={rule => { setEditRule(rule); setAlertOpen(true); }}
                  onChange={refresh}
                />
              </div>
            </section>

            <section className="flex flex-col gap-3" data-testid="manage-recap">
              <h2 className="text-base font-medium">Weekly recap</h2>
              <label className="flex min-h-14 items-center justify-between gap-3 rounded-2xl px-4 ring-1 ring-foreground/12">
                <span>Weekly recap</span>
                <Switch checked={prefs.recap} onCheckedChange={v => patchPrefs({ recap: v })} data-testid="pref-recap" />
              </label>
              <Field>
                <FieldLabel>Recap day</FieldLabel>
                <ToggleGroup type="single" value={prefs.recapDay} onValueChange={v => v && patchPrefs({ recapDay: v })} className="flex flex-wrap">
                  {RECAP_DAYS.map(d => (
                    <ToggleGroupItem key={d.id} value={d.id} className="min-h-11 px-3">{d.label}</ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
            </section>

            <section className="flex flex-col gap-3" data-testid="manage-sponsor">
              <h2 className="text-base font-medium">Sponsored content</h2>
              <label className="flex min-h-14 items-center justify-between gap-3 rounded-2xl px-4 ring-1 ring-foreground/12">
                <span>Sponsor / partner content</span>
                <Switch checked={prefs.sponsor} onCheckedChange={v => patchPrefs({ sponsor: v })} data-testid="pref-sponsor" />
              </label>
            </section>

            <section className="flex flex-col gap-3" data-testid="manage-quiet">
              <h2 className="text-base font-medium">Quiet hours</h2>
              <p className="text-sm text-muted-foreground">We won&apos;t send storm alerts in this window. Recaps still go on recap day.</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  Start
                  <Input type="time" className="mt-1 min-h-12" value={prefs.quietStart} onChange={e => patchPrefs({ quietStart: e.target.value })} data-testid="pref-quiet-start" />
                </label>
                <label className="text-sm">
                  End
                  <Input type="time" className="mt-1 min-h-12" value={prefs.quietEnd} onChange={e => patchPrefs({ quietEnd: e.target.value })} data-testid="pref-quiet-end" />
                </label>
              </div>
            </section>

            <section className="flex flex-col gap-3" data-testid="manage-units">
              <h2 className="text-base font-medium">Units</h2>
              <Field>
                <FieldLabel>Snow</FieldLabel>
                <ToggleGroup type="single" value={units} onValueChange={v => (v === 'in' || v === 'cm') && setUnits(v)} className="w-full">
                  <ToggleGroupItem value="in" className="min-h-11 flex-1">Inches</ToggleGroupItem>
                  <ToggleGroupItem value="cm" className="min-h-11 flex-1">cm</ToggleGroupItem>
                </ToggleGroup>
              </Field>
              <Field>
                <FieldLabel>Temperature</FieldLabel>
                <ToggleGroup type="single" value={tempUnits} onValueChange={v => (v === 'F' || v === 'C') && setTempUnits(v)} className="w-full">
                  <ToggleGroupItem value="F" className="min-h-11 flex-1">Fahrenheit</ToggleGroupItem>
                  <ToggleGroupItem value="C" className="min-h-11 flex-1">Celsius</ToggleGroupItem>
                </ToggleGroup>
              </Field>
            </section>

            <section className="flex flex-col gap-2">
              <Button type="button" variant="outline" className="min-h-12 w-full text-base" data-testid="manage-save" onClick={saveNow}>
                Save
              </Button>
              <Button type="button" variant="outline" className="min-h-12 w-full text-base" data-testid="manage-unsub" onClick={unsubAll}>
                Unsubscribe from everything
              </Button>
              <Button type="button" variant="ghost" className="min-h-12 w-full text-base" data-testid="manage-delete" onClick={() => setDeleteOpen(true)}>
                Delete my data
              </Button>
            </section>
          </section>
        ) : null}
      </main>

      <SiteFooter />

      {deleteOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4" data-testid="manage-delete-confirm">
          <div className="w-full max-w-sm rounded-2xl bg-background p-5 ring-1 ring-foreground/12">
            <h2 className="font-display text-3xl tracking-wide">Delete my data?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Removes alerts and preferences on this device. Live deletes also drop the subscriber record.</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button type="button" className="min-h-12 w-full" data-testid="manage-delete-yes" onClick={deleteData}>
                Delete my data
              </Button>
              <Button type="button" variant="outline" className="min-h-12 w-full" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <AlertOnboarding
        open={alertOpen}
        onOpenChange={v => { setAlertOpen(v); if (!v) { setEditRule(null); refresh(); } }}
        ctx={{ source: 'menu', email: session || email } as AlertContext}
        mode={mode}
        resorts={resorts}
        editRule={editRule}
        onSaved={refresh}
      />
    </div>
  );
}
