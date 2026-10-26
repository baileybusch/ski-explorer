import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChoiceTile, FlowShell, useAutoAdvance } from '@/components/FlowShell';
import { loadTrip, peopleLabel, saveTrip } from '../../lib/trip.js';
import { flightLinks, lodgingLinks, outboundRel, partyOf, tripDates } from '../../lib/links.js';
import { fmtShort } from '../../lib/util.js';

const STEPS = ['dates', 'who', 'stay', 'results'] as const;
type Step = typeof STEPS[number];

const MONTHS = [
  { id: '2026-11', label: 'November' },
  { id: '2026-12', label: 'December' },
  { id: '2027-01', label: 'January' },
  { id: '2027-02', label: 'February' },
  { id: '2027-03', label: 'March' },
];

const LODGING = [
  { id: 'any', label: 'Any stay', hint: 'Hotel or condo' },
  { id: 'hotel', label: 'Hotel', hint: 'Lodge or hotel' },
  { id: 'condo', label: 'Condo', hint: 'Kitchen, more room' },
] as const;

const BUDGET = [
  { id: 'value', label: 'Value' },
  { id: 'mid', label: 'Mid' },
  { id: 'splurge', label: 'Splurge' },
] as const;

function monthRange(id: string) {
  const [y, m] = id.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-08`;
  const endMonth = m === 12 ? 1 : m + 1;
  const endYear = m === 12 ? y + 1 : y;
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-08`;
  return { start, end };
}

export function TripOnboarding({
  open, onOpenChange, resort, win, trip, setTrip, setCustomDates, onAskAi,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  resort: any;
  win: any;
  trip: any;
  setTrip: (t: any) => void;
  setCustomDates: (start: string, end: string) => void;
  onAskAi: (r: any) => void;
}) {
  const [step, setStep] = useState<Step>('dates');
  const [flex, setFlex] = useState<string | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(0);
  const [home, setHome] = useState('SAN');
  const [lodging, setLodging] = useState<(typeof LODGING)[number]['id']>('any');
  const [budget, setBudget] = useState<(typeof BUDGET)[number]['id']>('mid');
  const advance = useAutoAdvance();

  useEffect(() => {
    if (!open) return;
    const t = { ...loadTrip(), ...trip };
    setFlex(t.flexMonth || null);
    setStart(t.start || win?.start || '');
    setEnd(t.end || win?.end || '');
    setAdults(t.adults || 2);
    setKids(t.kids ?? 0);
    setHome(t.home || 'SAN');
    setLodging(t.lodging || 'any');
    setBudget(t.budget || 'mid');
    setStep('dates');
    // Hydrate once when the sheet opens. Persisting mid-flow must not rewind the stepper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function persist(extra: Record<string, unknown> = {}) {
    const next = {
      ...trip,
      adults,
      kids,
      home: home.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'SAN',
      start: extra.start ?? (flex ? monthRange(flex).start : start),
      end: extra.end ?? (flex ? monthRange(flex).end : end),
      flexMonth: extra.flexMonth === undefined ? flex : extra.flexMonth,
      lodging,
      budget,
      ...extra,
    };
    saveTrip(next);
    setTrip(next);
    if (next.start && next.end) setCustomDates(next.start, next.end);
    return next;
  }

  function next() {
    if (step === 'dates') {
      if (flex) persist({ flexMonth: flex, ...monthRange(flex) });
      else if (start && end) persist({ flexMonth: null, start, end });
      setStep('who');
      return;
    }
    if (step === 'who') {
      persist();
      setStep('stay');
      return;
    }
    persist();
    setStep('results');
  }

  function back() {
    if (step === 'dates') onOpenChange(false);
    else setStep(STEPS[Math.max(0, STEPS.indexOf(step) - 1)]);
  }

  const draft = persist;
  void draft;
  const live = { ...trip, adults, kids, home, start: flex ? monthRange(flex).start : start, end: flex ? monthRange(flex).end : end, lodging, budget };
  const { start: from, end: to } = tripDates(live, win);
  const { adults: a, kids: k } = partyOf(live);
  const fl = resort ? flightLinks({ home: live.home, iata: resort.iata, start: from, end: to, adults: a, kids: k }) : [];
  const ld = resort ? lodgingLinks({ name: resort.name, lat: resort.center?.[1], lon: resort.center?.[0], start: from, end: to, adults: a, kids: k }) : [];

  const title = {
    dates: 'When?',
    who: 'Who’s going?',
    stay: 'What kind of stay?',
    results: 'Your trip',
  }[step];

  return (
    <FlowShell
      open={open}
      testId="trip-onboarding"
      onClose={() => { persist(); onOpenChange(false); }}
      onBack={back}
      title={title}
      hint="Skip any step. Answers stay on this device."
      progress={STEPS.indexOf(step) + 1}
      total={4}
      footer={step !== 'results' ? (
        <>
          {step !== 'stay' ? (
            <Button type="button" variant="outline" className="min-h-12 w-full text-base" data-testid="trip-next" onClick={next}>
              Continue
            </Button>
          ) : null}
          <Button type="button" variant="ghost" className="min-h-11 w-full text-base" data-testid="trip-skip" onClick={next}>
            Skip
          </Button>
        </>
      ) : (
        <Button type="button" variant="outline" className="min-h-12 w-full text-base" onClick={() => { persist(); onOpenChange(false); }}>
          Done
        </Button>
      )}
    >
      {step === 'dates' ? (
        <div className="mt-6 flex flex-col gap-3" data-testid="trip-dates">
          <p className="text-sm text-muted-foreground">Pick dates, or a flexible month.</p>
          <div className="grid min-w-0 grid-cols-2 gap-3">
            <label className="min-w-0 text-sm">
              From
              <Input type="date" className="mt-1 min-h-12 w-full min-w-0" value={start} onChange={e => { setStart(e.target.value); setFlex(null); }} data-testid="trip-start" />
            </label>
            <label className="min-w-0 text-sm">
              To
              <Input type="date" className="mt-1 min-h-12 w-full min-w-0" value={end} onChange={e => { setEnd(e.target.value); setFlex(null); }} data-testid="trip-end" />
            </label>
          </div>
          <div className="mt-2 flex min-w-0 flex-col gap-2">
            {MONTHS.map(m => (
              <ChoiceTile
                key={m.id}
                selected={flex === m.id}
                title={m.label}
                hint="Flexible week"
                testId={`trip-month-${m.id}`}
                onClick={() => {
                  setFlex(m.id);
                  persist({ flexMonth: m.id, ...monthRange(m.id) });
                  advance(() => setStep('who'));
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {step === 'who' ? (
        <div className="mt-6 flex flex-col gap-4" data-testid="trip-who">
          <div className="flex items-center justify-between rounded-2xl px-4 py-3 ring-1 ring-foreground/12">
            <span>Adults</span>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" className="min-h-11 min-w-11" onClick={() => setAdults(n => Math.max(1, n - 1))}>−</Button>
              <span className="w-6 text-center" data-testid="trip-adults">{adults}</span>
              <Button type="button" variant="outline" className="min-h-11 min-w-11" onClick={() => setAdults(n => Math.min(12, n + 1))}>+</Button>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-2xl px-4 py-3 ring-1 ring-foreground/12">
            <span>Kids</span>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" className="min-h-11 min-w-11" onClick={() => setKids(n => Math.max(0, n - 1))}>−</Button>
              <span className="w-6 text-center" data-testid="trip-kids">{kids}</span>
              <Button type="button" variant="outline" className="min-h-11 min-w-11" onClick={() => setKids(n => Math.min(12, n + 1))}>+</Button>
            </div>
          </div>
          <label className="text-sm">
            Flying from
            <Input
              className="mt-1 min-h-12 uppercase"
              maxLength={3}
              value={home}
              onChange={e => setHome(e.target.value.toUpperCase())}
              placeholder="SAN"
              data-testid="trip-home"
            />
          </label>
        </div>
      ) : null}

      {step === 'stay' ? (
        <div className="mt-6 flex flex-col gap-3" data-testid="trip-stay">
          {LODGING.map(l => (
            <ChoiceTile
              key={l.id}
              selected={lodging === l.id}
              title={l.label}
              hint={l.hint}
              testId={`trip-lodging-${l.id}`}
              onClick={() => {
                setLodging(l.id);
                persist({ lodging: l.id });
                advance(() => setStep('results'));
              }}
            />
          ))}
          <p className="mt-3 text-sm text-muted-foreground">Budget</p>
          <div className="grid min-w-0 grid-cols-3 gap-2">
            {BUDGET.map(b => (
              <button
                key={b.id}
                type="button"
                data-testid={`trip-budget-${b.id}`}
                onClick={() => {
                  setBudget(b.id);
                  persist({ budget: b.id });
                  advance(() => setStep('results'));
                }}
                className={`min-h-12 min-w-0 rounded-2xl ring-1 ${budget === b.id ? 'bg-foreground text-background ring-foreground' : 'ring-foreground/12'}`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === 'results' ? (
        <div className="mt-6 flex flex-col gap-3" data-testid="trip-results">
          <p className="text-base text-muted-foreground">
            {fmtShort(from)}–{fmtShort(to)} · {peopleLabel(live)}
            {resort?.iata ? ` · ${live.home} → ${resort.iata}` : ''}
          </p>
          {fl[0] ? (
            <Button variant="outline" className="min-h-12 w-full text-base" asChild>
              <a href={fl[0].href} target="_blank" rel={outboundRel(fl[0].sponsored)} data-testid="trip-flights">Google Flights</a>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">No nearby airport on file.</p>
          )}
          {ld[0] ? (
            <Button variant="outline" className="min-h-12 w-full text-base" asChild>
              <a href={ld[0].href} target="_blank" rel={outboundRel(ld[0].sponsored)} data-testid="trip-stays">Stays</a>
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="min-h-12 w-full text-base" data-testid="trip-ai" onClick={() => { persist(); onAskAi(resort); }}>
            Ask an AI agent
          </Button>
        </div>
      ) : null}
    </FlowShell>
  );
}
