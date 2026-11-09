import { LayersIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';

export type LayerStatus = {
  radar: 'loading' | 'ready' | 'error' | 'empty';
  radarCover?: 'unavailable' | 'error' | 'clear' | 'precip' | 'unknown';
  clouds: 'loading' | 'ready' | 'unavailable' | 'error';
  nws: 'off' | 'loading' | 'ready' | 'empty' | 'error';
  lodging: 'off' | 'loading' | 'ready' | 'empty' | 'error';
  stormRings?: number;
};

export function MapLayers({
  radarOn, setRadarOn, cloudsOn, setCloudsOn, stormsLayerOn, setStormsLayerOn,
  nwsOn, setNwsOn, lodgingOn, setLodgingOn, status, onRetryRadar,
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
  status?: LayerStatus;
  onRetryRadar?: () => void;
}) {
  const cloudsOk = status?.clouds === 'ready';
  const stormN = status?.stormRings ?? 0;
  const stormsOk = stormN > 0;
  const radarNote = status?.radar === 'error'
    ? 'RainViewer did not load. Retry, or the mosaic may be down. Personal/educational tiles, max zoom 7.'
    : status?.radar === 'empty'
      ? 'RainViewer returned no radar frames — mosaic unavailable, not a clear sky.'
      : status?.radar === 'loading'
        ? 'Loading RainViewer mosaic…'
        : status?.radarCover === 'clear'
          ? 'Mosaic is up. No echo in this tile (clear, or outside a dense radar network). Not snow totals. Max zoom 7.'
          : status?.radarCover === 'precip'
            ? 'RainViewer precipitation in this mosaic cell (max zoom 7). Coarsest outside N. America / Europe / Japan. Not snow totals. Personal/educational API.'
            : 'RainViewer precipitation mosaic. Global, coarsest outside N. America / Europe / Japan. Max zoom 7. Not snow totals.';
  const stormsNote = !stormsOk
    ? 'No resort in the snapshot has a 6″+ Open-Meteo forecast dump in any rolling 72h, so this toggle is off. Independent of radar.'
    : `Cyan rings on ${stormN} resort${stormN === 1 ? '' : 's'} with a 6″+ Open-Meteo forecast dump in any rolling 72h. Independent of radar — not a tropical track, not RainViewer.`;
  const cloudsNote = !cloudsOk
    ? 'RainViewer infrared satellite has no frames right now, so this toggle is off.'
    : 'RainViewer infrared satellite. Independent of radar.';
  const nwsNote = nwsOn && status?.nws === 'loading'
    ? 'Fetching NWS winter alerts…'
    : nwsOn && status?.nws === 'empty'
      ? 'No active NWS winter polygons for ski states.'
      : nwsOn && status?.nws === 'error'
        ? 'NWS alerts did not load.'
        : 'US only. Polygons from weather.gov.';
  const lodgeNote = lodgingOn && status?.lodging === 'loading'
    ? 'Asking Overpass for nearby lodging…'
    : lodgingOn && (status?.lodging === 'error' || status?.lodging === 'empty')
      ? 'Overpass did not return lodging pins. OSM hotels around the mountain, when it answers.'
      : 'OpenStreetMap lodging via Overpass. Often slow; off until you ask.';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11 min-w-11" aria-label="Layers" data-testid="layers-button">
          <LayersIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72" data-testid="layers-popover">
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="radar">Radar</FieldLabel>
            <Switch id="radar" checked={radarOn} onCheckedChange={setRadarOn} data-testid="layer-radar" />
          </Field>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="clouds">Clouds / IR</FieldLabel>
            <Switch
              id="clouds"
              checked={cloudsOn && cloudsOk}
              disabled={!cloudsOk}
              onCheckedChange={setCloudsOn}
              data-testid="layer-clouds"
            />
          </Field>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="storm-rings">Storm rings</FieldLabel>
            <Switch
              id="storm-rings"
              checked={stormsLayerOn && stormsOk}
              disabled={!stormsOk}
              onCheckedChange={setStormsLayerOn}
              data-testid="layer-storms"
              data-disabled={stormsOk ? undefined : '1'}
            />
          </Field>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="nws">NWS winter (US)</FieldLabel>
            <Switch id="nws" checked={nwsOn} onCheckedChange={setNwsOn} data-testid="layer-nws" />
          </Field>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="lodge">Lodging pins</FieldLabel>
            <Switch id="lodge" checked={lodgingOn} onCheckedChange={setLodgingOn} data-testid="layer-lodging" />
          </Field>
          <FieldDescription data-testid="layer-radar-note">{radarNote}</FieldDescription>
          <FieldDescription data-testid="layer-clouds-note">{cloudsNote}</FieldDescription>
          <FieldDescription data-testid="layer-storms-note">{stormsNote}</FieldDescription>
          <FieldDescription data-testid="layer-nws-note">{nwsNote}</FieldDescription>
          <FieldDescription data-testid="layer-lodging-note">{lodgeNote}</FieldDescription>
          {status?.radar === 'error' && onRetryRadar ? (
            <Button type="button" variant="outline" className="min-h-10" data-testid="radar-retry" onClick={onRetryRadar}>
              Retry radar
            </Button>
          ) : null}
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
}
