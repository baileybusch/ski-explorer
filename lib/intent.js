/** Friendly one-line chip + CTA kind from a parse result. */

export function intentChip(parsed) {
  if (!parsed) return '';
  const where = parsed.resort?.name || parsed.region?.name;
  const metric = parsed.metric === 'past72' ? 'last 72h'
    : parsed.metric === 'next7' ? 'next 7 days'
      : parsed.metric === 'std' ? 'season-to-date'
        : parsed.metric === 'vsavg' ? 'vs average'
          : 'snow';
  if (parsed.type === 'trip' && parsed.resort) {
    return `${parsed.resort.name}${parsed.dateLabel ? `, ${parsed.dateLabel}` : ''}`;
  }
  if (parsed.type === 'resort' && parsed.resort) return parsed.resort.name;
  if (where) return `${where} resorts, ranked by ${metric}`;
  if (parsed.pass) return `${parsed.pass} resorts, ranked by ${metric}`;
  return parsed.q || 'Search';
}

export function ctaKind(parsed) {
  if (!parsed) return 'home';
  if (parsed.type === 'trip' || (parsed.resort && parsed.from)) return 'trip';
  if (parsed.region && !parsed.resort) return 'region';
  if (parsed.resort) return 'resort';
  return 'home';
}

export function ctaLabel(parsed) {
  const kind = ctaKind(parsed);
  if (kind === 'trip') return `Get alerts for your trip`;
  if (kind === 'region') return `Monitor the situation in ${parsed.region?.name || 'this region'}`;
  if (kind === 'resort') return `Alert me`;
  return 'Monitor your home resort';
}
