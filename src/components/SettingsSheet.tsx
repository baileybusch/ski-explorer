import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import type { Design } from '@/lib/design';

export function SettingsSheet({
  open, onOpenChange, units, setUnits, stormMin, setStormMin, design, setDesign,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  units: 'in' | 'cm';
  setUnits: (u: 'in' | 'cm') => void;
  stormMin: number;
  setStormMin: (n: number) => void;
  design: Design;
  setDesign: (d: Design) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md" data-testid="settings-sheet">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>Two board concepts. People and dates live on the Trip pill.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-8">
          <FieldGroup>
            <Field>
              <FieldLabel>Board</FieldLabel>
              <ToggleGroup type="single" value={design} onValueChange={v => (v === 'a' || v === 'b') && setDesign(v)} className="w-full">
                <ToggleGroupItem value="a" className="min-h-11 flex-1" data-testid="design-a">A Leaderboard</ToggleGroupItem>
                <ToggleGroupItem value="b" className="min-h-11 flex-1" data-testid="design-b">B Blocks</ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>Also ?design=a or ?design=b on the URL.</FieldDescription>
            </Field>
          </FieldGroup>
          <Separator />
          <FieldGroup>
            <Field>
              <FieldLabel>Units</FieldLabel>
              <ToggleGroup type="single" value={units} onValueChange={v => v && setUnits(v as 'in' | 'cm')} className="w-full">
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
