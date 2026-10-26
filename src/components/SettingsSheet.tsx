import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { type AlertsUiMode } from '@/lib/alertsUi';
import {
  type LocalRule, accountEmail, setAccountEmail, signOutAccount,
  loadRules, updateLocalRule, deleteLocalRule, ruleSummary,
} from '@/lib/alertRules';

export function SettingsSheet({
  open, onOpenChange, units, setUnits, pass, setPass,
  onMyResorts, watchCount, onAlert, onEditAlert, mode, snowGenerated, resorts = [],
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
  onEditAlert?: (rule: LocalRule) => void;
  mode: AlertsUiMode;
  snowGenerated?: string;
  resorts?: { id: string; name: string }[];
}) {
  const [panel, setPanel] = useState<'menu' | 'account' | 'alerts'>('menu');
  const [email, setEmail] = useState('');
  const [rules, setRules] = useState<LocalRule[]>([]);

  useEffect(() => {
    if (!open) return;
    setPanel('menu');
    setEmail(accountEmail());
    setRules(loadRules());
  }, [open]);

  useEffect(() => {
    if (open && panel === 'alerts') setRules(loadRules());
  }, [open, panel]);

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
            {panel === 'account' ? 'Manage account' : panel === 'alerts' ? 'My alerts' : 'Menu'}
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
            <Button type="button" variant="ghost" className="min-h-11 justify-start px-0 text-base" onClick={() => setPanel('menu')}>
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

              <Field>
                <FieldLabel>Units</FieldLabel>
                <ToggleGroup type="single" value={units} onValueChange={v => v && setUnits(v as 'in' | 'cm')} className="w-full">
                  <ToggleGroupItem value="in" className="min-h-11 flex-1">Inches</ToggleGroupItem>
                  <ToggleGroupItem value="cm" className="min-h-11 flex-1">cm</ToggleGroupItem>
                </ToggleGroup>
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
                <div className="flex flex-col gap-4" data-testid="alerts-empty">
                  <p className="text-sm text-muted-foreground">No alerts yet. Pick a resort and we&apos;ll email you when it&apos;s about to get dumped on.</p>
                  <Button type="button" className="min-h-12 w-full text-base" data-testid="alerts-empty-cta" onClick={onAlert}>
                    Alert me
                  </Button>
                </div>
              ) : rules.map(rule => (
                <div key={rule.id} className="rounded-2xl p-3 ring-1 ring-foreground/12" data-testid="alert-rule">
                  <p className="text-base font-medium">{ruleSummary(rule, resorts)}</p>
                  <p className="text-xs text-muted-foreground">
                    {rule.paused ? 'Paused' : 'On'} · {rule.recap ? 'recap on' : 'recap off'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" className="min-h-11 px-3 text-sm" onClick={() => { updateLocalRule(rule.id, { paused: !rule.paused }); refresh(); }}>
                      {rule.paused ? 'Resume' : 'Pause'}
                    </Button>
                    <Button type="button" variant="ghost" className="min-h-11 px-3 text-sm" onClick={() => onEditAlert?.(rule)}>
                      Edit
                    </Button>
                    <Button type="button" variant="ghost" className="min-h-11 px-3 text-sm" onClick={() => { deleteLocalRule(rule.id); refresh(); }}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
              {rules.length ? (
                <Button type="button" variant="ghost" className="min-h-12 w-full text-base" onClick={onAlert}>
                  Alert me
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
