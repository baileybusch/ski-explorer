/**
 * eve bundle only. The eve service is bundled into one chunk, so fs reads of
 * public/data/*.json and agent/skills/regional-snow-climates/regions/*.md resolve
 * to paths that do not exist at runtime (/var/agent/..., empty catalog).
 * Embed them with eve's ?raw asset imports and seed the shared caches.
 * Data refresh commits redeploy, so the embedded snapshot stays current.
 */
import resortsRaw from '../../public/data/resorts-index.json?raw';
import snowRaw from '../../public/data/snow.json?raw';
import observedRaw from '../../public/data/observed.json?raw';
import gazRaw from '../../public/data/gazetteer.json?raw';
import typicalRaw from '../../public/data/typical.json?raw';
import historyRaw from '../../public/data/history.json?raw';
import climatologyRaw from '../../public/data/climatology.json?raw';
import alaskaMd from '../../agent/skills/regional-snow-climates/regions/alaska.md?raw';
import alpsNorthMd from '../../agent/skills/regional-snow-climates/regions/alps-north.md?raw';
import alpsSouthDolomitesMd from '../../agent/skills/regional-snow-climates/regions/alps-south-dolomites.md?raw';
import coloradoCentralRockiesMd from '../../agent/skills/regional-snow-climates/regions/colorado-central-rockies.md?raw';
import interiorBcCanadianRockiesMd from '../../agent/skills/regional-snow-climates/regions/interior-bc-canadian-rockies.md?raw';
import japanMd from '../../agent/skills/regional-snow-climates/regions/japan.md?raw';
import northeastEasternCanadaMd from '../../agent/skills/regional-snow-climates/regions/northeast-eastern-canada.md?raw';
import pacificNorthwestBcCoastMd from '../../agent/skills/regional-snow-climates/regions/pacific-northwest-bc-coast.md?raw';
import pyreneesMd from '../../agent/skills/regional-snow-climates/regions/pyrenees.md?raw';
import sierraNevadaCaliforniaMd from '../../agent/skills/regional-snow-climates/regions/sierra-nevada-california.md?raw';
import southernHemisphereMd from '../../agent/skills/regional-snow-climates/regions/southern-hemisphere.md?raw';
import tetonsNorthernRockiesMd from '../../agent/skills/regional-snow-climates/regions/tetons-northern-rockies.md?raw';
import utahWasatchMd from '../../agent/skills/regional-snow-climates/regions/utah-wasatch.md?raw';
import { buildCatalog, setCatalog } from '../skiscope-tools/catalog.js';
import { setRegionGuides } from './climateRegions.js';
import { setBaseRaw } from './liveData.js';

const embeddedRaw = {
  resorts: JSON.parse(resortsRaw),
  snow: JSON.parse(snowRaw),
  observed: JSON.parse(observedRaw),
  gaz: JSON.parse(gazRaw),
  typical: JSON.parse(typicalRaw),
  history: JSON.parse(historyRaw),
  climatology: JSON.parse(climatologyRaw),
};
// Embedded snapshot = fallback; tools refresh observed rows live (lib/eve/liveData.js).
setBaseRaw(embeddedRaw);
setCatalog(buildCatalog({ ...embeddedRaw, snow: { ...embeddedRaw.snow } }));

setRegionGuides({
  'alaska': alaskaMd,
  'alps-north': alpsNorthMd,
  'alps-south-dolomites': alpsSouthDolomitesMd,
  'colorado-central-rockies': coloradoCentralRockiesMd,
  'interior-bc-canadian-rockies': interiorBcCanadianRockiesMd,
  'japan': japanMd,
  'northeast-eastern-canada': northeastEasternCanadaMd,
  'pacific-northwest-bc-coast': pacificNorthwestBcCoastMd,
  'pyrenees': pyreneesMd,
  'sierra-nevada-california': sierraNevadaCaliforniaMd,
  'southern-hemisphere': southernHemisphereMd,
  'tetons-northern-rockies': tetonsNorthernRockiesMd,
  'utah-wasatch': utahWasatchMd,
});
