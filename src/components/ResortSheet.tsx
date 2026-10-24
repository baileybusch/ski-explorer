import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { snowAmount, passLabel } from '@/lib/format';
import { interestingBlurb, peopleLabel, partyOf, tripDates } from '../../lib/trip.js';
import { flightLinks, lodgingLinks, outboundRel, shareURL } from '../../lib/links.js';
import { fmtFt, fmtShort } from '../../lib/util.js';
import { isWatched, toggleWatch } from '@/lib/watchlist';
import { WeatherPanel } from '@/components/WeatherPanel';
import { useState } from 'react';

function Outbound({ link }: { link: any }) {
  return (
    <Button variant={link.primary ? 'default' : 'outline'} className="min-h-12 w-full text-base" asChild>
      <a href={link.href} target="_blank" rel={outboundRel(link.sponsored)}>{link.label}</a>
    </Button>
  );
}

export function ResortSheet({
  resort, open, onOpenChange, win, trip, units, pass, snow, typical, onPlan, onWatch,
}: {
  resort: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  win: any;
  trip: any;
  units: 'in' | 'cm';
  pass: string;
  snow: any;
  typical: any;
  onPlan: () => void;
  onWatch: () => void;
}) {
  const [watched, setWatched] = useState(() => resort ? isWatched(resort.id) : false);
  if (!resort) return null;
  const { start, end } = tripDates(trip, win);
  const { adults, kids } = partyOf(trip);
  const fl = flightLinks({ home: trip.home, iata: resort.iata, start, end, adults, kids });
  const ld = lodgingLinks({ name: resort.name, lat: resort.center[1], lon: resort.center[0], start, end, adults, kids });
  const passName = passLabel(resort);
  const recent = snowAmount(resort.d7, units);
  const outlook = snowAmount(resort.fc, units);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto" data-testid="resort-sheet">
        <SheetHeader>
          <SheetTitle className="pr-10 text-2xl font-bold tracking-tight">{resort.name}</SheetTitle>
          <SheetDescription className="text-base">
            {resort.town ? `${resort.town}, ` : ''}{resort.region || resort.state}
            {passName ? <> · <Badge className="align-middle">{passName}</Badge></> : null}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-8">
          <p className="text-base leading-relaxed text-muted-foreground">{interestingBlurb(resort)}</p>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Recent 7d" value={recent} />
            <Stat label="Next 7d" value={outlook} />
            <Stat label="Vertical" value={resort.summit && resort.base ? `${fmtFt(resort.summit - resort.base)} ft` : '—'} />
          </div>
          <WeatherPanel resort={resort} snow={snow} units={units} />
          <p className="text-sm text-muted-foreground">
            {fmtShort(start)}–{fmtShort(end)} · {peopleLabel(trip)}
            {resort.iata ? ` · ${trip.home} → ${resort.iata}` : ''}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={watched ? 'secondary' : 'outline'}
              className="min-h-12 text-base"
              onClick={() => { setWatched(toggleWatch(resort.id)); onWatch(); }}
            >
              {watched ? '★ Watching' : '☆ Watch'}
            </Button>
            <Button className="min-h-12 text-base" onClick={onPlan}>Plan trip</Button>
          </div>
          <Separator />
          <h3 className="text-lg font-bold">Flights</h3>
          <p className="text-sm text-muted-foreground">Google Flights first. Search links only — no invented prices.</p>
          {fl.length ? fl.map(link => <Outbound key={link.id} link={link} />) : <p className="text-sm text-muted-foreground">No nearby airport on file.</p>}
          <h3 className="text-lg font-bold">Lodging</h3>
          {ld.map(link => <Outbound key={link.id} link={link} />)}
          <Button
            variant="outline"
            className="min-h-12 text-base"
            onClick={async () => {
              const url = shareURL({ resort: resort.id, from: start, to: end, adults, kids, home: trip.home, mode: 'explore', pass });
              try { await navigator.clipboard.writeText(url); toast('Link copied'); }
              catch { toast(url); }
            }}
          >
            Share link
          </Button>
          {resort.id === 'eagle-point' ? (
            <p className="rounded-xl bg-destructive/15 p-3 text-sm">Closed 26/27 after the Cottonwood Fire. Targeting Nov 2027.</p>
          ) : null}
          <div className="flex flex-col gap-2 text-base">
            {resort.web ? <a className="underline" href={resort.web} target="_blank" rel="noopener">Resort site</a> : null}
            <a className="underline" href={`https://openskimap.org/#13/${resort.center[1]}/${resort.center[0]}`} target="_blank" rel="noopener">OpenSkiMap</a>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/80 px-3 py-3">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
