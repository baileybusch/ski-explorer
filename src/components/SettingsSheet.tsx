import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

export function SettingsSheet({
  open, onOpenChange, pass, setPass, trip, setTrip, units, setUnits,
  sort, setSort, watchOnly, setWatchOnly, lodgingOn, setLodgingOn, win, setCustomDates,
  radarOn, setRadarOn, cloudsOn, setCloudsOn, stormsOn, setStormsOn, nwsOn, setNwsOn,
  stormMin, setStormMin, onResetGlobe,
}: any) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Trip &amp; map</SheetTitle>
          <SheetDescription>Pass, dates, people, and layers. The globe stays clean.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-8">
          <FieldGroup>
            <Field>
              <FieldLabel>Pass</FieldLabel>
              <ToggleGroup type="single" value={pass} onValueChange={v => v && setPass(v)} className="w-full">
                <ToggleGroupItem value="all" className="min-h-11 flex-1">Both</ToggleGroupItem>
                <ToggleGroupItem value="ikon" className="min-h-11 flex-1">Ikon</ToggleGroupItem>
                <ToggleGroupItem value="epic" className="min-h-11 flex-1">Epic</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="home">Home airport</FieldLabel>
              <Input id="home" maxLength={3} value={trip.home} className="min-h-11 uppercase" onChange={e => setTrip({ ...trip, home: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="adults">Adults</FieldLabel>
                <Input id="adults" type="number" min={1} max={12} value={trip.adults} className="min-h-11" onChange={e => setTrip({ ...trip, adults: Math.min(12, Math.max(1, +e.target.value || 1)) })} />
              </Field>
              <Field>
                <FieldLabel htmlFor="kids">Kids</FieldLabel>
                <Input id="kids" type="number" min={0} max={12} value={trip.kids} className="min-h-11" onChange={e => setTrip({ ...trip, kids: Math.min(12, Math.max(0, +e.target.value || 0)) })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="from">From</FieldLabel>
                <Input id="from" type="date" value={win.start} className="min-h-11" onChange={e => setCustomDates(e.target.value, win.end)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="to">To</FieldLabel>
                <Input id="to" type="date" value={win.end} className="min-h-11" onChange={e => setCustomDates(win.start, e.target.value)} />
              </Field>
            </div>
            <FieldDescription>Dates after the 7-day forecast use typical past-season snow — labeled typical, not a forecast.</FieldDescription>
          </FieldGroup>
          <Separator />
          <FieldGroup>
            <Field>
              <FieldLabel>Sort list</FieldLabel>
              <ToggleGroup type="single" value={sort} onValueChange={v => v && setSort(v)} className="w-full">
                <ToggleGroupItem value="snow" className="min-h-11 flex-1">Most snow</ToggleGroupItem>
                <ToggleGroupItem value="name" className="min-h-11 flex-1">Name</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field>
              <FieldLabel>Units</FieldLabel>
              <ToggleGroup type="single" value={units} onValueChange={v => v && setUnits(v)} className="w-full">
                <ToggleGroupItem value="in" className="min-h-11 flex-1">Inches</ToggleGroupItem>
                <ToggleGroupItem value="cm" className="min-h-11 flex-1">cm</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="watch">Watchlist only</FieldLabel>
              <Switch id="watch" checked={watchOnly} onCheckedChange={setWatchOnly} />
            </Field>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="lodge">Lodging pins (OSM)</FieldLabel>
              <Switch id="lodge" checked={lodgingOn} onCheckedChange={setLodgingOn} />
            </Field>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="radar">Radar (RainViewer)</FieldLabel>
              <Switch id="radar" checked={radarOn} onCheckedChange={setRadarOn} />
            </Field>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="clouds">Clouds / IR sat</FieldLabel>
              <Switch id="clouds" checked={cloudsOn} onCheckedChange={setCloudsOn} />
            </Field>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="storms">Storm rings</FieldLabel>
              <Switch id="storms" checked={stormsOn} onCheckedChange={setStormsOn} />
            </Field>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="nws">NWS winter alerts (US only)</FieldLabel>
              <Switch id="nws" checked={nwsOn} onCheckedChange={setNwsOn} />
            </Field>
            <Field>
              <FieldLabel>Storm badge minimum (72h forecast)</FieldLabel>
              <ToggleGroup type="single" value={String(stormMin)} onValueChange={v => v && setStormMin(+v)} className="w-full">
                <ToggleGroupItem value="6" className="min-h-11 flex-1">6″</ToggleGroupItem>
                <ToggleGroupItem value="12" className="min-h-11 flex-1">12″</ToggleGroupItem>
                <ToggleGroupItem value="18" className="min-h-11 flex-1">18″</ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>From the Open-Meteo forecast snapshot. No wind tiles (no free no-key source). No named tropical tracks.</FieldDescription>
            </Field>
          </FieldGroup>
          <Button
            type="button"
            variant="secondary"
            className="min-h-12 w-full text-base"
            onClick={() => { onResetGlobe?.(); onOpenChange(false); }}
          >
            Reset globe
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
