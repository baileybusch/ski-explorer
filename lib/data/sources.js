/**
 * Source / rights registry.
 *
 * Data license and hosted-API/service terms are stored separately on purpose:
 * CC BY data can still sit behind a non-commercial free API.
 *
 * Resort reports default to NOT cleared. Firecrawl (or any crawler) does not
 * grant the mountain's rights. Do not scrape Alta without written approval.
 *
 * This module is the inspectable registry. It does not fetch, crawl, or write.
 */
export const RESORT_REPORTS_DEFAULT_CLEARED = false;

export const SOURCES = Object.freeze([
  Object.freeze({
    id: 'nrcs-snotel-awdb',
    name: 'NRCS SNOTEL / AWDB',
    usedInProduction: true,
    category: 'station',
    dataLicense: {
      name: 'US Government work / public domain',
      url: 'https://www.nrcs.usda.gov/programs-initiatives/sswsf-snow-survey-and-water-supply-forecasting-program/citing-data-from-the',
      commercial: 'yes',
    },
    serviceTerms: {
      commercial: 'yes',
      url: 'https://wcc.sc.egov.usda.gov/awdbRestApi/swagger-ui/index.html',
      note: 'Public REST. No key. Cite NRCS / NWCC. SNWD is snow depth; WTEQ is snow-water equivalent. A SNWD increase is not recorded snowfall.',
    },
    attribution: {
      required: true,
      text: 'Snow-depth and water-equivalent from USDA NRCS SNOTEL / AWDB.',
      url: 'https://www.nrcs.usda.gov/programs-initiatives/sswsf-snow-survey-and-water-supply-forecasting-program/citing-data-from-the',
    },
    citing: [
      'https://www.nrcs.usda.gov/programs-initiatives/sswsf-snow-survey-and-water-supply-forecasting-program/citing-data-from-the',
      'https://wcc.sc.egov.usda.gov/awdbRestApi/swagger-ui/index.html',
    ],
    resortReportsCleared: null,
    elements: {
      SNWD: 'Snow depth on the pillow, not snowfall',
      WTEQ: 'Snow water equivalent of the snowpack',
    },
  }),
  Object.freeze({
    id: 'open-meteo-forecast',
    name: 'Open-Meteo Forecast API (hosted)',
    usedInProduction: true,
    category: 'weather-api',
    dataLicense: {
      name: 'CC BY 4.0',
      url: 'https://open-meteo.com/en/license',
      commercial: 'yes',
    },
    serviceTerms: {
      commercial: 'no',
      url: 'https://open-meteo.com/en/terms',
      note: 'Free hosted API is NONCOMMERCIAL. Paid customer-api.open-meteo.com is required before sponsors, ads, or subscriptions go live. Do not purchase in this pass.',
    },
    attribution: {
      required: true,
      text: 'Weather data by Open-Meteo.com',
      url: 'https://open-meteo.com/',
    },
    citing: ['https://open-meteo.com/en/terms', 'https://open-meteo.com/en/license'],
    resortReportsCleared: null,
    flagBefore: ['sponsors', 'ads', 'subscriptions'],
  }),
  Object.freeze({
    id: 'open-meteo-archive',
    name: 'Open-Meteo Archive API (ERA5-class reanalysis)',
    usedInProduction: true,
    category: 'weather-api',
    dataLicense: {
      name: 'CC BY 4.0',
      url: 'https://open-meteo.com/en/license',
      commercial: 'yes',
    },
    serviceTerms: {
      commercial: 'no',
      url: 'https://open-meteo.com/en/terms',
      note: 'Same non-commercial free hosted API as forecast. Powers seasons/*.json, climatology.json, history.json.',
    },
    attribution: {
      required: true,
      text: 'Historical weather by Open-Meteo.com (ERA5-class reanalysis)',
      url: 'https://open-meteo.com/',
    },
    citing: ['https://open-meteo.com/en/terms', 'https://open-meteo.com/en/license'],
    resortReportsCleared: null,
    flagBefore: ['sponsors', 'ads', 'subscriptions'],
  }),
  Object.freeze({
    id: 'met-norway-locationforecast',
    name: 'MET Norway Locationforecast 2.0',
    usedInProduction: false,
    category: 'weather-api',
    dataLicense: {
      name: 'CC BY 4.0 (NLOD)',
      url: 'https://api.met.no/doc/TermsOfService',
      commercial: 'yes',
    },
    serviceTerms: {
      commercial: 'yes',
      url: 'https://api.met.no/doc/TermsOfService',
      note: 'Commercial-ok $0 path with identifying User-Agent. Wired in lib/weather; snapshots stay on Open-Meteo until a commercial cutover. Snow is precip × SLR, not a reported depth.',
    },
    attribution: {
      required: true,
      text: 'Weather from MET Norway',
      url: 'https://api.met.no/',
    },
    citing: ['https://api.met.no/doc/TermsOfService'],
    resortReportsCleared: null,
  }),
  Object.freeze({
    id: 'rainviewer',
    name: 'RainViewer radar / IR tiles',
    usedInProduction: true,
    category: 'tiles',
    dataLicense: {
      name: 'RainViewer API license',
      url: 'https://www.rainviewer.com/api.html',
      commercial: 'no',
    },
    serviceTerms: {
      commercial: 'no',
      url: 'https://www.rainviewer.com/api.html',
      note: 'Personal / educational API. Licensing to-do before a commercial radar product.',
    },
    attribution: {
      required: true,
      text: 'Radar © RainViewer',
      url: 'https://www.rainviewer.com/',
    },
    citing: ['https://www.rainviewer.com/api.html'],
    resortReportsCleared: null,
  }),
  Object.freeze({
    id: 'openfreemap',
    name: 'OpenFreeMap dark vector tiles',
    usedInProduction: true,
    category: 'tiles',
    dataLicense: {
      name: 'OpenStreetMap ODbL (via OpenMapTiles)',
      url: 'https://openfreemap.org/',
      commercial: 'yes',
    },
    serviceTerms: {
      commercial: 'yes',
      url: 'https://openfreemap.org/',
      note: 'Public instance is free including commercial. OSM attribution required.',
    },
    attribution: {
      required: true,
      text: '© OpenStreetMap contributors · OpenFreeMap / OpenMapTiles',
      url: 'https://www.openstreetmap.org/copyright',
    },
    citing: ['https://openfreemap.org/', 'https://www.openstreetmap.org/copyright'],
    resortReportsCleared: null,
  }),
  Object.freeze({
    id: 'osm-pistes',
    name: 'OpenSkiMap / OSM piste GeoJSON',
    usedInProduction: true,
    category: 'geodata',
    dataLicense: {
      name: 'ODbL',
      url: 'https://opendatacommons.org/licenses/odbl/',
      commercial: 'yes',
    },
    serviceTerms: {
      commercial: 'yes',
      url: 'https://openskimap.org/',
      note: 'Share-alike on extracted data. Local static files.',
    },
    attribution: {
      required: true,
      text: 'Piste data © OpenSkiMap / OpenStreetMap contributors',
      url: 'https://openskimap.org/',
    },
    citing: ['https://openskimap.org/', 'https://www.openstreetmap.org/copyright'],
    resortReportsCleared: null,
  }),
  Object.freeze({
    id: 'nws-alerts',
    name: 'NWS winter weather alerts',
    usedInProduction: true,
    category: 'alerts',
    dataLicense: {
      name: 'US Government work / public domain',
      url: 'https://www.weather.gov/documentation/services-web-api',
      commercial: 'yes',
    },
    serviceTerms: {
      commercial: 'yes',
      url: 'https://www.weather.gov/documentation/services-web-api',
      note: 'US only.',
    },
    attribution: {
      required: true,
      text: 'Alerts: NWS (US only)',
      url: 'https://www.weather.gov/',
    },
    citing: ['https://www.weather.gov/documentation/services-web-api'],
    resortReportsCleared: null,
  }),
  Object.freeze({
    id: 'resort-reports',
    name: 'Resort-published snow reports',
    usedInProduction: false,
    category: 'reports',
    dataLicense: {
      name: 'Not licensed to SkiScope',
      url: null,
      commercial: 'no',
    },
    serviceTerms: {
      commercial: 'no',
      url: null,
      note: 'Default: NOT cleared. Marketing-site HTML / widgets are not an open API. Do not ingest until a mountain grants written rights.',
    },
    attribution: { required: true, text: null, url: null },
    citing: [],
    resortReportsCleared: false,
  }),
  Object.freeze({
    id: 'alta-com',
    name: 'Alta Ski Area mountain policy / snow report',
    usedInProduction: false,
    category: 'reports',
    dataLicense: {
      name: 'Not licensed to SkiScope',
      url: 'https://www.alta.com/mountain-policy',
      commercial: 'no',
    },
    serviceTerms: {
      commercial: 'no',
      url: 'https://www.alta.com/mountain-policy',
      note: 'Alta explicitly prohibits unapproved automated scraping. HTML /weather is not a public JSON feed. /api/v1/weather 404s.',
    },
    attribution: { required: true, text: null, url: 'https://www.alta.com/mountain-policy' },
    citing: ['https://www.alta.com/mountain-policy'],
    resortReportsCleared: false,
    scraping: 'prohibited-without-approval',
  }),
  Object.freeze({
    id: 'firecrawl',
    name: 'Firecrawl',
    usedInProduction: false,
    category: 'tool',
    dataLicense: {
      name: 'Tool license ≠ content rights',
      url: 'https://www.firecrawl.dev/',
      commercial: 'no',
    },
    serviceTerms: {
      commercial: 'no',
      url: 'https://www.firecrawl.dev/',
      note: 'A crawler does not grant resort, OnTheSnow, or Vail rights. Using Firecrawl on a snow-report page does not clear republication.',
    },
    attribution: { required: false, text: null, url: null },
    citing: [],
    resortReportsCleared: false,
    grantsContentRights: false,
  }),
]);

export function sourceById(id) {
  return SOURCES.find(s => s.id === id) || null;
}

export function usedSources() {
  return SOURCES.filter(s => s.usedInProduction);
}

/** Hosted-API / service restrictions, independent of the underlying data license. */
export function noncommercialServices() {
  return SOURCES.filter(s => s.serviceTerms?.commercial === 'no');
}

export function unclearedResortReports() {
  return SOURCES.filter(s => s.category === 'reports' || s.category === 'tool')
    .filter(s => s.resortReportsCleared !== true);
}

export function openMeteoBlocksCommercialLaunch() {
  const forecast = sourceById('open-meteo-forecast');
  const archive = sourceById('open-meteo-archive');
  return forecast?.serviceTerms.commercial === 'no' && archive?.serviceTerms.commercial === 'no';
}
