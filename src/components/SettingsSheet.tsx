import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Field, FieldLabel } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { type AlertsUiMode, withAlerts } from '@/lib/alertsUi';
import type { SnowUnits, TempUnits } from '@/lib/format';

export function SettingsSheet({
  open, onOpenChange, units, setUnits, tempUnits, setTempUnits, mode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  units: SnowUnits;
  setUnits: (u: SnowUnits) => void;
  tempUnits: TempUnits;
  setTempUnits: (u: TempUnits) => void;
  mode: AlertsUiMode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md" data-testid="settings-sheet">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>
            {mode === 'preview'
              ? 'Preview — alerts on this device only. Nothing is emailed.'
              : mode === 'live'
                ? 'Enter your email and we’ll send a sign-in link.'
                : 'Alerts are paused. Sign-in is email only.'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-10">
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              variant="ghost"
              className="min-h-12 w-full justify-start text-base"
              data-testid="menu-account"
              onClick={() => { onOpenChange(false); location.assign(withAlerts('/manage')); }}
            >
              Manage account
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-12 w-full justify-start text-base"
              data-testid="menu-alerts"
              onClick={() => { onOpenChange(false); location.assign(withAlerts('/manage#alerts')); }}
            >
              My alerts
            </Button>
          </div>

          <Separator />

          <Field>
            <FieldLabel>Snow</FieldLabel>
            <ToggleGroup type="single" value={units} onValueChange={v => (v === 'in' || v === 'cm') && setUnits(v)} className="w-full">
              <ToggleGroupItem value="in" className="min-h-11 flex-1" data-testid="units-in">Inches</ToggleGroupItem>
              <ToggleGroupItem value="cm" className="min-h-11 flex-1" data-testid="units-cm">cm</ToggleGroupItem>
            </ToggleGroup>
          </Field>

          <Field>
            <FieldLabel>Temperature</FieldLabel>
            <ToggleGroup type="single" value={tempUnits} onValueChange={v => (v === 'F' || v === 'C') && setTempUnits(v)} className="w-full">
              <ToggleGroupItem value="F" className="min-h-11 flex-1" data-testid="temp-f">Fahrenheit</ToggleGroupItem>
              <ToggleGroupItem value="C" className="min-h-11 flex-1" data-testid="temp-c">Celsius</ToggleGroupItem>
            </ToggleGroup>
          </Field>
        </div>
      </SheetContent>
    </Sheet>
  );
}
