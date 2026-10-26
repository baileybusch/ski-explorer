import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { REGION_CHIPS } from '@/lib/design';
import { THRESHOLDS, WINDOWS, type AlertsUiMode } from '@/lib/alertsUi';
import { watchlist } from '@/lib/watchlist';

export type AlertContext = {
  resortId?: string | null;
  resortName?: string | null;
  pass?: string;
  source?: 'incoming' | 'resort';
};

export function AlertMeSheet({
  open, onOpenChange, ctx, mode, regions = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ctx: AlertContext;
  mode: AlertsUiMode;
  regions?: { id: string; name: string }[];
}) {
  const saved = watchlist();
  const defaultWatch = ctx.resortId ? 'resort' : saved.length ? 'saved' : 'pass';
  const [email, setEmail] = useState(() => localStorage.getItem('ss_email') || '');
  const [watch, setWatch] = useState(defaultWatch);
  const [pass, setPass] = useState(ctx.pass && ctx.pass !== 'all' ? ctx.pass : 'both');
  const [region, setRegion] = useState('utah');
  const [minSnowIn, setMinSnowIn] = useState(12);
  const [windowHours, setWindowHours] = useState(72);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWatch(ctx.resortId ? 'resort' : saved.length ? 'saved' : 'pass');
    setPass(ctx.pass && ctx.pass !== 'all' ? ctx.pass : 'both');
    setMsg('');
  }, [open, ctx.resortId, ctx.pass, saved.length]);

  const chips = useMemo(
    () => REGION_CHIPS.map(id => regions.find(r => r.id === id)).filter(Boolean) as { id: string; name: string }[],
    [regions],
  );

  const summary = useMemo(() => {
    const where = watch === 'resort' && ctx.resortName
      ? ctx.resortName
      : watch === 'saved'
        ? `${saved.length || 0} saved resorts`
        : watch === 'region'
          ? (chips.find(c => c.id === region)?.name || region)
          : pass === 'ikon' ? 'Ikon' : pass === 'epic' ? 'Epic' : 'Ikon + Epic';
    const win = WINDOWS.find(w => w.id === windowHours)?.label || '72h';
    return `${minSnowIn}″ in ${win} at ${where}`;
  }, [watch, ctx.resortName, saved.length, chips, region, pass, minSnowIn, windowHours]);

  async function submit() {
    const addr = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setMsg('Enter a valid email');
      return;
    }
    setBusy(true);
    setMsg('');
    const payload = {
      email: addr,
      watch,
      pass,
      region: watch === 'region' ? region : null,
      resorts: watch === 'resort' && ctx.resortId ? [ctx.resortId] : [],
      savedResorts: watch === 'saved' ? saved : [],
      minSnowIn,
      windowHours,
      freq: 'on-trigger',
    };
    try {
      localStorage.setItem('ss_email', addr);
      if (mode === 'preview') {
        try {
          const r = await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const j = await r.json().catch(() => ({}));
          setMsg(j.message || 'Preview only — nothing was saved or sent.');
        } catch {
          setMsg('Preview only — nothing was saved or sent.');
        }
        return;
      }
      const r = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({ error: 'Could not save' }));
      setMsg(j.error || j.message || 'Saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto" data-testid="alert-me-sheet">
        <SheetHeader>
          <SheetTitle>Alert me</SheetTitle>
          <SheetDescription>
            {mode === 'preview'
              ? 'Preview only — submissions are not saved and nothing is emailed.'
              : 'A dump alert when modeled forecast snow crosses your line. Not exact totals.'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4 pb-10">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="alert-email">Email</FieldLabel>
              <Input
                id="alert-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                className="min-h-12"
                placeholder="you@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                data-testid="alert-email"
              />
            </Field>
            <Field>
              <FieldLabel>Watch</FieldLabel>
              <ToggleGroup type="single" value={watch} onValueChange={v => v && setWatch(v)} className="flex flex-wrap">
                {ctx.resortId ? <ToggleGroupItem value="resort" className="min-h-11 px-3 text-sm">This resort</ToggleGroupItem> : null}
                <ToggleGroupItem value="saved" className="min-h-11 px-3 text-sm">Saved</ToggleGroupItem>
                <ToggleGroupItem value="region" className="min-h-11 px-3 text-sm">Region</ToggleGroupItem>
                <ToggleGroupItem value="pass" className="min-h-11 px-3 text-sm">My pass</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            {watch === 'region' ? (
              <Field>
                <FieldLabel>Region</FieldLabel>
                <ToggleGroup type="single" value={region} onValueChange={v => v && setRegion(v)} className="flex flex-wrap">
                  {chips.map(c => (
                    <ToggleGroupItem key={c.id} value={c.id} className="min-h-11 px-3 text-sm">{c.name}</ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </Field>
            ) : null}
            {watch === 'pass' ? (
              <Field>
                <FieldLabel>Pass</FieldLabel>
                <ToggleGroup type="single" value={pass} onValueChange={v => v && setPass(v)} className="w-full">
                  <ToggleGroupItem value="ikon" className="min-h-11 flex-1 text-sm">Ikon</ToggleGroupItem>
                  <ToggleGroupItem value="epic" className="min-h-11 flex-1 text-sm">Epic</ToggleGroupItem>
                  <ToggleGroupItem value="both" className="min-h-11 flex-1 text-sm">Both</ToggleGroupItem>
                </ToggleGroup>
              </Field>
            ) : null}
            <Field>
              <FieldLabel>Threshold</FieldLabel>
              <ToggleGroup type="single" value={String(minSnowIn)} onValueChange={v => v && setMinSnowIn(Number(v))} className="w-full">
                {THRESHOLDS.map(t => (
                  <ToggleGroupItem key={t.id} value={String(t.id)} className="min-h-11 flex-1 text-sm">{t.label}</ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <Field>
              <FieldLabel>Window</FieldLabel>
              <ToggleGroup type="single" value={String(windowHours)} onValueChange={v => v && setWindowHours(Number(v))} className="w-full">
                {WINDOWS.map(w => (
                  <ToggleGroupItem key={w.id} value={String(w.id)} className="min-h-11 flex-1 text-sm">{w.label}</ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
            <FieldDescription>{summary}. Weekly recap is included. One-click unsubscribe in every email.</FieldDescription>
          </FieldGroup>
          <Button type="button" className="min-h-12 w-full text-base" disabled={busy} onClick={submit} data-testid="alert-submit">
            {busy ? 'Saving…' : 'Alert me'}
          </Button>
          {msg ? <p className="text-sm text-muted-foreground" data-testid="alert-msg">{msg}</p> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
