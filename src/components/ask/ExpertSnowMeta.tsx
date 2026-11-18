import { snowAmount, type SnowUnits } from '@/lib/format';

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="truncate font-medium">{v}</dd>
    </div>
  );
}

function mph(n: number | null | undefined) {
  return n == null || !Number.isFinite(n) ? '—' : `${Math.round(n)} mph`;
}

function ft(n: number | null | undefined) {
  return n == null || !Number.isFinite(n) ? '—' : `${Math.round(n).toLocaleString()} ft`;
}

function inch(n: number | null | undefined) {
  return n == null || !Number.isFinite(n) ? '—' : `${n >= 10 ? Math.round(n) : Math.round(n * 10) / 10}″`;
}

/** presenting-snow-conditions numbers strip: water, feel, wind, snow level, spread, powder grade. */
export function ExpertSnowMeta({ out, units }: { out: any; units: SnowUnits }) {
  const water = out?.water;
  const wind = out?.wind || out?.extras?.wind;
  const snowLevel = out?.snowLevel || out?.extras?.snowLevel;
  const spread = out?.spread || out?.extras?.spread;
  const call = out?.powderCall;
  const extras = out?.extras;
  if (!water && !wind && !snowLevel && !spread && !call && !extras) return null;

  const slr = water?.stormSlr ?? extras?.next7Slr ?? extras?.next3?.[0]?.slr;
  const liquid = water?.stormWaterIn ?? extras?.next7WaterIn;
  const feel = water?.feel ?? extras?.feel ?? extras?.next3?.[0]?.feel;
  const spreadLabel = spread?.snowCmMin != null && spread?.snowCmMax != null
    ? `${snowAmount(spread.snowCmMin, units)}–${snowAmount(spread.snowCmMax, units)} est.`
    : '—';

  return (
    <div className="mt-3 border-t border-foreground/8 pt-3" data-testid="ask-expert-meta">
      {call?.label ? (
        <p className="mb-2 text-[13px] font-medium" data-testid="ask-powder-grade">
          {call.label}
          {call.windHold ? ' · wind holds likely' : ''}
          {call.rainAtBase ? ' · rain at the base' : ''}
        </p>
      ) : null}
      {out?.snowClimate?.region ? (
        <p className="mb-2 text-[11px] text-muted-foreground" data-testid="ask-climate-region">
          Climate {out.snowClimate.region}{out.snowClimate.nearestFit ? ' · nearest fit' : ''}
        </p>
      ) : null}
      <dl className="grid grid-cols-2 gap-2 text-xs min-[480px]:grid-cols-4">
        <Cell k="Water (est.)" v={liquid != null ? `${inch(liquid)} SWE` : (water?.sweIn != null ? `${inch(water.sweIn)} pack SWE` : '—')} />
        <Cell k="SLR / feel" v={slr != null ? `${slr}:1${feel ? ` · ${feel}` : ''}` : (feel || '—')} />
        <Cell k="Wind (est.)" v={wind ? `${mph(wind.speedMph)}${wind.gustMph != null ? ` / gust ${mph(wind.gustMph)}` : ''}${wind.direction ? ` ${wind.direction}` : ''}` : '—'} />
        <Cell k="Snow level (est.)" v={snowLevel?.meanFt != null ? ft(snowLevel.meanFt) : '—'} />
        <Cell k="Model spread" v={spreadLabel} />
        <Cell k="Pillow SWE" v={water?.sweIn != null ? `${inch(water.sweIn)} (pack)` : '—'} />
      </dl>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Forecast water, SLR, wind, snow level, and spread are Open-Meteo model estimates. Pillow SWE is station pack water, not this storm. Last 72h is not recorded snowfall.
      </p>
    </div>
  );
}
