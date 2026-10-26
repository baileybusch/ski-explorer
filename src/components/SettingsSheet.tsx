import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FREQS, THRESHOLDS, WINDOWS, type AlertsUiMode } from '@/lib/alertsUi';
import { REGION_CHIPS } from '@/lib/design';
import {
  type LocalRule, accountEmail, setAccountEmail, signOutAccount,
  loadRules, updateLocalRule, deleteLocalRule, ruleSummary,
} from '@/lib/alertRules';

export function SettingsSheet({
  open, onOpenChange, units, setUnits, pass, setPass,
  onMyResorts, watchCount, onAlert, mode, snowGenerated, resorts = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  units: 'in' | 'cm';
  setUnits: (u: 'in' | 'cm') => void;
  pass: string;
  setPass: (p: string) => void;
  onMyResorts: () => void;
  watchCount: number;
  onAlert: () => void;
  mode: AlertsUiMode;
  snowGenerated?: string;
  resorts?: { id: string; name: string }[];
}) {
  const [panel, setPanel] = useState<'menu' | 'account' | 'alerts' | 'edit'>('menu');
  const [email, setEmail] = useState('');
  const [rules, setRules] = useState<LocalRule[]>([]);
  const [edit, setEdit] = useState<LocalRule | null>(null);

  useEffect(() => {
    if (!open) return;
    setPanel('menu');
    setEmail(accountEmail());
    setRules(loadRules());
  }, [open]);

  function refresh() {
    setRules(loadRules());
    setEmail(accountEmail());
  }

  function signIn() {
    const addr = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return;
    setAccountEmail(addr);
    refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md" data-testid="settings-sheet">
        <SheetHeader>
          <SheetTitle>
            {panel === 'account' ? 'Manage account' : panel === 'alerts' || panel === 'edit' ? 'My alerts' : 'Menu'}
          </SheetTitle>
          <SheetDescription>
            {mode === 'preview'
              ? 'Preview — alerts on this device only. Nothing is emailed.'
              : mode === 'live'
                ? 'Email-based account. No password.'
                : 'Alerts are paused. Sign-in is email only.'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-10">
          {panel !== 'menu' ? (
            <Button type="button" variant="ghost" className="min-h-11 justify-start px-0 text-base" onClick={() => setPanel(panel === 'edit' ? 'alerts' : 'menu')}>
              Back
            </Button>
          ) : null}

          {panel === 'menu' ? (
            <>
              <FieldGroup>
                <Button type="button" variant="ghost" className="min-h-12 w-full justify-start text-base" data-testid="menu-account" onClick={() => setPanel('account')}>
                  Manage account
                </Button>
                <Button type="button" variant="ghost" className="min-h-12 w-full justify-start text-base" data-testid="menu-alerts" onClick={() => setPanel('alerts')}>
                  My alerts{rules.length ? ` · ${rules.length}` : ''}
                </Button>
                <Button type="button" variant="ghost" className="min-h-12 w-full justify-start text-base" data-testid="menu-alert-me" onClick={onAlert}>
                  Alert me
                </Button>
                <Button type="button" variant="ghost" className="min-h-12 w-full justify-start text-base" data-testid="my-resorts" onClick={onMyResorts}>
                  My Resorts{watchCount ? ` · ${watchCount}` : ''}
                </Button>
              </FieldGroup>

              <Separator />

              <Field>
                <FieldLabel>Board pass</FieldLabel>
                <ToggleGroup type="single" value={pass} onValueChange={v => v && setPass(v)} className="w-full">
                  <ToggleGroupItem value="ikon" className="min-h-11 flex-1" data-testid="pass-ikon">Ikon</ToggleGroupItem>
                  <ToggleGroupItem value="epic" className="min-h-11 flex-1" data-testid="pass-epic">Epic</ToggleGroupItem>
                  <ToggleGroupItem value="all" className="min-h-11 flex-1" data-testid="pass-all">All</ToggleGroupItem>
                </ToggleGroup>
                <FieldDescription>Filters the board. Alert watches have their own pass setting.</FieldDescription>
              </Field>

              <Separator />

              <div data-testid="about-credits">
                <p className="text-sm font-medium">About</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  SkiScope monitors Ikon and Epic snow. Snow: Open-Meteo (modeled, not resort-reported). Terrain: Mapterhorn.
                  Imagery: Esri. Basemap: CARTO. Runs and lifts: OpenSkiMap / OSM. Radar: RainViewer. US alerts: NWS.
                  Flights and lodging are search links only. We may earn a commission if an affiliate id is set.
                </p>
                {snowGenerated ? (
                  <p className="mt-2 text-[11px] text-muted-foreground" data-testid="snow-freshness">
                    Snow snapshot {snowGenerated.slice(0, 10)}
                  </p>
                ) : null}
                <div className="mt-3">
                  <FieldLabel>Units</FieldLabel>
                  <ToggleGroup type="single" value={units} onValueChange={v => v && setUnits(v as 'in' | 'cm')} className="mt-1 w-full">
                    <ToggleGroupItem value="in" className="min-h-11 flex-1">Inches</ToggleGroupItem>
                    <ToggleGroupItem value="cm" className="min-h-11 flex-1">cm</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            </>
          ) : null}

          {panel === 'account' ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="acct-email">Email</FieldLabel>
                <Input
                  id="acct-email"
                  type="email"
                  inputMode="email"
                  className="min-h-12"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  data-testid="account-email"
                />
                <FieldDescription>No password. The same address used for alerts and the manage-preferences link.</FieldDescription>
              </Field>
              {accountEmail() ? (
                <Button type="button" variant="outline" className="min-h-12 w-full text-base" data-testid="account-signout" onClick={() => { signOutAccount(); setEmail(''); refresh(); }}>
                  Sign out
                </Button>
              ) : (
                <Button type="button" variant="outline" className="min-h-12 w-full text-base" data-testid="account-signin" onClick={signIn}>
                  Sign in
                </Button>
              )}
            </FieldGroup>
          ) : null}

          {panel === 'alerts' ? (
            <div className="flex flex-col gap-3" data-testid="my-alerts">
              {rules.length === 0 ? (
                <p className="text-sm text-muted-foreground">No alerts yet. Alert me on the board to add one.</p>
              ) : rules.map(rule => (
                <div key={rule.id} className="rounded-2xl ring-1 ring-foreground/12 p-3" data-testid="alert-rule">
                  <p className="text-base font-medium">{ruleSummary(rule, resorts)}</p>
                  <p className="text-xs text-muted-foreground">
                    {rule.paused ? 'Paused' : 'On'} · quiet {rule.quietStart}–{rule.quietEnd} · {rule.recap ? 'recap on' : 'recap off'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="min-h-11 px-3 text-sm" onClick={() => { updateLocalRule(rule.id, { paused: !rule.paused }); refresh(); }}>
                      {rule.paused ? 'Resume' : 'Pause'}
                    </Button>
                    <Button type="button" variant="ghost" className="min-h-11 px-3 text-sm" onClick={() => { setEdit(rule); setPanel('edit'); }}>
                      Edit
                    </Button>
                    <Button type="button" variant="ghost" className="min-h-11 px-3 text-sm" onClick={() => { deleteLocalRule(rule.id); refresh(); }}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="ghost" className="min-h-12 w-full text-base" onClick={onAlert}>
                Alert me
              </Button>
            </div>
          ) : null}

          {panel === 'edit' && edit ? (
            <FieldGroup data-testid="alert-edit">
              <Field>
                <FieldLabel>Watch</FieldLabel>
                <ToggleGroup type="single" value={edit.watch} onValueChange={v => v && setEdit({ ...edit, watch: v as LocalRule['watch'] })} className="flex flex-wrap">
                  <ToggleGroupItem value="pass" className="min-h-11 px-3">Pass</ToggleGroupItem>
                  <ToggleGroupItem value="saved" className="min-h-11 px-3">Saved</ToggleGroupItem>
                  <ToggleGroupItem value="region" className="min-h-11 px-3">Region</ToggleGroupItem>
                  <ToggleGroupItem value="resort" className="min-h-11 px-3">Resort</ToggleGroupItem>
                </ToggleGroup>
              </Field>
              {edit.watch === 'region' ? (
                <Field>
                  <FieldLabel>Region</FieldLabel>
                  <ToggleGroup type="single" value={edit.region || 'utah'} onValueChange={v => v && setEdit({ ...edit, region: v })} className="flex flex-wrap">
                    {REGION_CHIPS.map(id => (
                      <ToggleGroupItem key={id} value={id} className="min-h-11 px-3 capitalize">{id}</ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </Field>
              ) : null}
              {edit.watch === 'pass' ? (
                <Field>
                  <FieldLabel>Pass filter</FieldLabel>
                  <ToggleGroup type="single" value={edit.pass || 'both'} onValueChange={v => v && setEdit({ ...edit, pass: v })} className="w-full">
                    <ToggleGroupItem value="ikon" className="min-h-11 flex-1">Ikon</ToggleGroupItem>
                    <ToggleGroupItem value="epic" className="min-h-11 flex-1">Epic</ToggleGroupItem>
                    <ToggleGroupItem value="both" className="min-h-11 flex-1">Both</ToggleGroupItem>
                  </ToggleGroup>
                </Field>
              ) : null}
              {edit.watch === 'resort' ? (
                <p className="text-sm text-muted-foreground">{ruleSummary(edit, resorts)}</p>
              ) : null}
              <Field>
                <FieldLabel>Threshold</FieldLabel>
                <ToggleGroup type="single" value={String(edit.minSnowIn)} onValueChange={v => v && setEdit({ ...edit, minSnowIn: +v })} className="w-full">
                  {THRESHOLDS.map(t => <ToggleGroupItem key={t.id} value={String(t.id)} className="min-h-11 flex-1">{t.label}</ToggleGroupItem>)}
                </ToggleGroup>
              </Field>
              <Field>
                <FieldLabel>Window</FieldLabel>
                <ToggleGroup type="single" value={String(edit.windowHours)} onValueChange={v => v && setEdit({ ...edit, windowHours: +v })} className="w-full">
                  {WINDOWS.map(w => <ToggleGroupItem key={w.id} value={String(w.id)} className="min-h-11 flex-1">{w.label}</ToggleGroupItem>)}
                </ToggleGroup>
              </Field>
              <Field>
                <FieldLabel>Frequency</FieldLabel>
                <ToggleGroup type="single" value={edit.freq} onValueChange={v => v && setEdit({ ...edit, freq: v as LocalRule['freq'] })} className="w-full">
                  {FREQS.map(f => <ToggleGroupItem key={f.id} value={f.id} className="min-h-11 flex-1">{f.label}</ToggleGroupItem>)}
                </ToggleGroup>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="q-start">Quiet from</FieldLabel>
                  <Input id="q-start" type="time" className="min-h-11" value={edit.quietStart} onChange={e => setEdit({ ...edit, quietStart: e.target.value })} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="q-end">Quiet to</FieldLabel>
                  <Input id="q-end" type="time" className="min-h-11" value={edit.quietEnd} onChange={e => setEdit({ ...edit, quietEnd: e.target.value })} />
                </Field>
              </div>
              <Field orientation="horizontal">
                <FieldLabel htmlFor="recap-on">Weekly recap</FieldLabel>
                <Switch id="recap-on" checked={edit.recap} onCheckedChange={v => setEdit({ ...edit, recap: v })} />
              </Field>
              <Button
                type="button"
                variant="outline"
                className="min-h-12 w-full text-base"
                onClick={() => { updateLocalRule(edit.id, edit); setPanel('alerts'); refresh(); }}
              >
                Save rule
              </Button>
            </FieldGroup>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
