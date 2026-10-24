import { LayersIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';

export function MapLayers({
  radarOn, setRadarOn, cloudsOn, setCloudsOn, stormsLayerOn, setStormsLayerOn,
  nwsOn, setNwsOn, lodgingOn, setLodgingOn,
}: {
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
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="secondary" className="min-h-11 min-w-11" aria-label="Layers" data-testid="layers-button">
          <LayersIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72" data-testid="layers-popover">
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="radar">Radar</FieldLabel>
            <Switch id="radar" checked={radarOn} onCheckedChange={setRadarOn} />
          </Field>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="clouds">Clouds / IR</FieldLabel>
            <Switch id="clouds" checked={cloudsOn} onCheckedChange={setCloudsOn} />
          </Field>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="storm-rings">Storm rings</FieldLabel>
            <Switch id="storm-rings" checked={stormsLayerOn} onCheckedChange={setStormsLayerOn} />
          </Field>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="nws">NWS winter (US)</FieldLabel>
            <Switch id="nws" checked={nwsOn} onCheckedChange={setNwsOn} />
          </Field>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="lodge">Lodging pins</FieldLabel>
            <Switch id="lodge" checked={lodgingOn} onCheckedChange={setLodgingOn} />
          </Field>
          <FieldDescription>RainViewer + NWS. No wind tiles. No tropical tracks.</FieldDescription>
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
}
