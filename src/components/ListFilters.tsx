import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export function ListFilters({
  pass, setPass, stormsOn, setStormsOn,
}: {
  pass: string;
  setPass: (p: string) => void;
  stormsOn: boolean;
  setStormsOn: (on: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <ToggleGroup type="single" value={pass} onValueChange={v => v && setPass(v)} className="w-full">
        <ToggleGroupItem value="all" className="min-h-11 flex-1 text-base">Both</ToggleGroupItem>
        <ToggleGroupItem value="ikon" className="min-h-11 flex-1 text-base">Ikon</ToggleGroupItem>
        <ToggleGroupItem value="epic" className="min-h-11 flex-1 text-base">Epic</ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup type="single" value={stormsOn ? 'on' : 'off'} onValueChange={v => setStormsOn(v === 'on')} className="w-full">
        <ToggleGroupItem value="off" className="min-h-11 flex-1 text-base">All snow</ToggleGroupItem>
        <ToggleGroupItem
          value="on"
          className="min-h-11 flex-1 text-base"
          data-testid="storms-chip"
          aria-pressed={stormsOn}
        >
          Storms
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
