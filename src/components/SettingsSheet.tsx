import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { REGION_CHIPS } from '@/lib/design';

export function SettingsSheet({
  open, onOpenChange, units, setUnits, stormMin, setStormMin,
  trip, setTrip, win, setCustomDates,
  pass, setPass,
  regions, onRegion, onWorldwide, onMyResorts, watchCount,
  stormsOn, setStormsOn,
  radarOn, setRadarOn, cloudsOn, setCloudsOn, stormsLayerOn, setStormsLayerOn,
  nwsOn, setNwsOn, lodgingOn, setLodgingOn,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  units: 'in' | 'cm';
  setUnits: (u: 'in' | 'cm') => void;
  stormMin: number;
  setStormMin: (n: number) => void;
  trip: any;
  setTrip: (t: any) => void;
  win: any;
  setCustomDates: (start: string, end: string) => void;
  pass: string;
  setPass: (p: string) => void;
  regions: { id: string; name: string }[];
  onRegion: (id: string) => void;
  onWorldwide: () => void;
  onMyResorts: () => void;
  watchCount: number;
  stormsOn: boolean;
  setStormsOn: (on: boolean) => void;
  radarOn: boolean;
  setRadarOn: (v: boolean) => void;
  cloudsOn: boolean;
  setCloudsOn: (v: boolean) => void;
  stormsLayerOn: boolean;
  setStormsLayerOn: (v: boolean) => void;
  nwsOn: boolean;
  setNwsOn: (v: boolean) => void;
  lodgingOn: boolean;
  setLodgingOn: (v: boolean) => void;
}) {
  const bump = (key: 'adults' | 'kids', delta: number) => {
    const lo = key === 'adults' ? 1 : 0;
    const next = Math.min(12, Math.max(lo, (trip[key] || 0) + delta));
    setTrip({ ...trip, [key]: next });
  };
  const chips = REGION_CHIPS.map(id => regions.find(r => r.id === id)).filter(Boolean) as { id: string; name: string }[];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md" data-testid="settings-sheet">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Trip, pass, scope, layers, and credits.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-10">
          <FieldGroup>
            <Field>
              <FieldLabel>People and dates</FieldLabel>
              <div className="grid grid-cols-2 gap-3">
                <Stepper label="Adults" value={trip.adults} onMinus={() => bump('adults', -1)} onPlus={() => bump('adults', 1)} />
                <Stepper label="Kids" value={trip.kids} onMinus={() => bump('kids', -1)} onPlus={() => bump('kids', 1)} />
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="menu-home">Home airport</FieldLabel>
              <Input
                id="menu-home"
                maxLength={3}
                value={trip.home}
                className="min-h-11 uppercase"
                onChange={e => setTrip({ ...trip, home: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="menu-from">From</FieldLabel>
                <Input id="menu-from" type="date" value={win?.start || ''} className="min-h-11" onChange={e => setCustomDates(e.target.value, win.end)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="menu-to">To</FieldLabel>
                <Input id="menu-to" type="date" value={win?.end || ''} className="min-h-11" onChange={e => setCustomDates(win.start, e.target.value)} />
              </Field>
            </div>
            <Field>
              <FieldLabel>Units</FieldLabel>
              <ToggleGroup type="single" value={units} onValueChange={v => v && setUnits(v as 'in' | 'cm')} className="w-full">
                <ToggleGroupItem value="in" className="min-h-11 flex-1">Inches</ToggleGroupItem>
                <ToggleGroupItem value="cm" className="min-h-11 flex-1">cm</ToggleGroupItem>
              </ToggleGroup>
            </Field>
          </FieldGroup>

          <Separator />

          <FieldGroup>
            <Field>
              <FieldLabel>Pass</FieldLabel>
              <ToggleGroup type="single" value={pass} onValueChange={v => v && setPass(v)} className="w-full">
                <ToggleGroupItem value="ikon" className="min-h-11 flex-1" data-testid="pass-ikon">Ikon</ToggleGroupItem>
                <ToggleGroupItem value="epic" className="min-h-11 flex-1" data-testid="pass-epic">Epic</ToggleGroupItem>
                <ToggleGroupItem value="all" className="min-h-11 flex-1" data-testid="pass-all">All</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field>
              <FieldLabel>Region / scope</FieldLabel>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" className="min-h-11 rounded-full px-3 text-sm" onClick={onWorldwide}>Worldwide</Button>
                {chips.map(g => (
                  <Button key={g.id} type="button" variant="secondary" className="min-h-11 rounded-full px-3 text-sm" onClick={() => onRegion(g.id)}>
                    {g.name}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant={stormsOn ? 'default' : 'secondary'}
                  className="min-h-11 rounded-full px-3 text-sm"
                  data-testid="menu-storms"
                  aria-pressed={stormsOn}
                  onClick={() => setStormsOn(!stormsOn)}
                >
                  Storms
                </Button>
              </div>
            </Field>
            <Field>
              <FieldLabel>Storm badge minimum (72h forecast)</FieldLabel>
              <ToggleGroup type="single" value={String(stormMin)} onValueChange={v => v && setStormMin(+v)} className="w-full">
                <ToggleGroupItem value="6" className="min-h-11 flex-1">6″</ToggleGroupItem>
                <ToggleGroupItem value="12" className="min-h-11 flex-1">12″</ToggleGroupItem>
                <ToggleGroupItem value="18" className="min-h-11 flex-1">18″</ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>Open-Meteo forecast snapshot. Not typical, not observed.</FieldDescription>
            </Field>
          </FieldGroup>

          <Separator />

          <FieldGroup>
            <Field>
              <FieldLabel>Map layers</FieldLabel>
              <Field orientation="horizontal">
                <FieldLabel htmlFor="menu-radar">Radar</FieldLabel>
                <Switch id="menu-radar" checked={radarOn} onCheckedChange={setRadarOn} />
              </Field>
              <Field orientation="horizontal">
                <FieldLabel htmlFor="menu-clouds">Clouds / IR</FieldLabel>
                <Switch id="menu-clouds" checked={cloudsOn} onCheckedChange={setCloudsOn} />
              </Field>
              <Field orientation="horizontal">
                <FieldLabel htmlFor="menu-rings">Storm rings</FieldLabel>
                <Switch id="menu-rings" checked={stormsLayerOn} onCheckedChange={setStormsLayerOn} />
              </Field>
              <Field orientation="horizontal">
                <FieldLabel htmlFor="menu-nws">NWS winter (US)</FieldLabel>
                <Switch id="menu-nws" checked={nwsOn} onCheckedChange={setNwsOn} />
              </Field>
              <Field orientation="horizontal">
                <FieldLabel htmlFor="menu-lodge">Lodging pins</FieldLabel>
                <Switch id="menu-lodge" checked={lodgingOn} onCheckedChange={setLodgingOn} />
              </Field>
            </Field>
          </FieldGroup>

          <Separator />

          <FieldGroup>
            <Field>
              <FieldLabel>My Resorts</FieldLabel>
              <Button type="button" variant="secondary" className="min-h-12 w-full text-base" data-testid="my-resorts" onClick={onMyResorts}>
                Watchlist{watchCount ? ` · ${watchCount}` : ''}
              </Button>
              <FieldDescription>Opens the board on resorts you are watching.</FieldDescription>
            </Field>
          </FieldGroup>

          <Separator />

          <div data-testid="about-credits">
            <p className="text-sm font-medium">About</p>
            <p className="mt-2 text-sm text-muted-foreground">
              SkiScope monitors Ikon and Epic snow. Snow: Open-Meteo. Terrain: Mapterhorn (terrarium, no key).
              Imagery: Esri. Basemap: CARTO. Runs and lifts: OpenSkiMap / OSM. Radar: RainViewer. US alerts: NWS.
              Flights and lodging are search links only. Email alerts are paused.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: number; onMinus: () => void; onPlus: () => void }) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" className="min-h-11 min-w-11" onClick={onMinus} aria-label={`Fewer ${label}`}>−</Button>
        <div className="min-w-8 text-center text-lg font-semibold">{value}</div>
        <Button type="button" variant="secondary" className="min-h-11 min-w-11" onClick={onPlus} aria-label={`More ${label}`}>+</Button>
      </div>
    </Field>
  );
}
