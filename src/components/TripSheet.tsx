import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function TripSheet({
  open, onOpenChange, trip, setTrip, win, setCustomDates,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trip: any;
  setTrip: (t: any) => void;
  win: any;
  setCustomDates: (start: string, end: string) => void;
}) {
  const bump = (key: 'adults' | 'kids', delta: number) => {
    const lo = key === 'adults' ? 1 : 0;
    const next = Math.min(12, Math.max(lo, (trip[key] || 0) + delta));
    setTrip({ ...trip, [key]: next });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh]" data-testid="trip-sheet">
        <SheetHeader>
          <SheetTitle>Trip</SheetTitle>
          <SheetDescription>People and dates feed Plan trip and the flight links.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-8">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Stepper label="Adults" value={trip.adults} onMinus={() => bump('adults', -1)} onPlus={() => bump('adults', 1)} />
              <Stepper label="Kids" value={trip.kids} onMinus={() => bump('kids', -1)} onPlus={() => bump('kids', 1)} />
            </div>
            <Field>
              <FieldLabel htmlFor="home">Home airport</FieldLabel>
              <Input
                id="home"
                maxLength={3}
                value={trip.home}
                className="min-h-11 uppercase"
                onChange={e => setTrip({ ...trip, home: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="from">From</FieldLabel>
                <Input id="from" type="date" value={win?.start || ''} className="min-h-11" onChange={e => setCustomDates(e.target.value, win.end)} />
              </Field>
              <Field>
                <FieldLabel htmlFor="to">To</FieldLabel>
                <Input id="to" type="date" value={win?.end || ''} className="min-h-11" onChange={e => setCustomDates(win.start, e.target.value)} />
              </Field>
            </div>
            <FieldDescription>Dates after the 7-day forecast use typical past-season snow — labeled typical, not a forecast.</FieldDescription>
          </FieldGroup>
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
