import {
  SOURCES, RESORT_REPORTS_DEFAULT_CLEARED, sourceById, usedSources,
  noncommercialServices, unclearedResortReports, openMeteoBlocksCommercialLaunch,
} from '../lib/data/sources.js';

export function runSourceEvals() {
  let fail = 0;
  const lines = [];
  const check = (id, ok, detail = '') => {
    if (ok) lines.push(`ok    ${id}`);
    else { fail++; lines.push(`FAIL  ${id}${detail ? `  ${detail}` : ''}`); }
  };

  check('ids-unique', new Set(SOURCES.map(s => s.id)).size === SOURCES.length);
  check('data-license-vs-service-split', SOURCES.every(s => s.dataLicense && s.serviceTerms && 'commercial' in s.dataLicense && 'commercial' in s.serviceTerms));

  const om = sourceById('open-meteo-forecast');
  check('open-meteo-cc-by-data', om?.dataLicense.name.includes('CC BY') && om.dataLicense.commercial === 'yes');
  check('open-meteo-hosted-api-noncommercial', om?.serviceTerms.commercial === 'no' && /noncommercial/i.test(om.serviceTerms.note));
  check('open-meteo-terms-url', om?.serviceTerms.url === 'https://open-meteo.com/en/terms');
  check('open-meteo-blocks-sponsors', openMeteoBlocksCommercialLaunch() && (om.flagBefore || []).includes('sponsors'));

  const nrcs = sourceById('nrcs-snotel-awdb');
  check('nrcs-cite', nrcs?.citing.some(u => u.includes('citing-data-from-the')));
  check('nrcs-awdb-docs', nrcs?.citing.some(u => u.includes('awdbRestApi')));
  check('nrcs-snwd-is-depth', nrcs?.elements.SNWD.toLowerCase().includes('depth') && /not snowfall/i.test(nrcs.elements.SNWD));
  check('nrcs-wteq-is-swe', /water equivalent/i.test(nrcs?.elements.WTEQ || ''));

  check('resort-reports-default-not-cleared', RESORT_REPORTS_DEFAULT_CLEARED === false && sourceById('resort-reports')?.resortReportsCleared === false);
  const alta = sourceById('alta-com');
  check('alta-scraping-prohibited', alta?.resortReportsCleared === false && alta.scraping === 'prohibited-without-approval' && /alta.com\/mountain-policy/.test(alta.serviceTerms.url));
  const firecrawl = sourceById('firecrawl');
  check('firecrawl-grants-no-rights', firecrawl?.grantsContentRights === false && firecrawl.resortReportsCleared === false && firecrawl.usedInProduction === false);

  check('used-sources-exist', usedSources().length >= 5 && usedSources().every(s => s.usedInProduction));
  check('noncommercial-services-listed', noncommercialServices().some(s => s.id === 'open-meteo-forecast') && noncommercialServices().some(s => s.id === 'rainviewer'));
  check('uncleared-reports-include-alta', unclearedResortReports().some(s => s.id === 'alta-com'));
  check('no-crawler-in-production', !SOURCES.some(s => s.category === 'tool' && s.usedInProduction));

  return { fail, total: lines.length, lines };
}
