import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';

export function SettingsSheet({
  open, onOpenChange, trip, setTrip, units, setUnits, sort, setSort,
  stormMin, setStormMin, win, setCustomDates,
}: any) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md" data-testid="settings-sheet">
        <SheetHeader>
          <SheetTitle>Trip</SheetTitle>
          <SheetDescription>Dates, people, airport, units. Pass and storms live on the list. Map layers live on the map.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-8">
          <FieldGroup>
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
