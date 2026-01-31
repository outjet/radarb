# RadarB

RadarB is a focused, scan‑friendly weather operations board for the Cleveland/Lake Erie corridor. It fuses live station data, ODOT sensors, camera feeds, radar tiles, and DWML/NDFD forecast grids into a single, modern dashboard optimized for quick decisions.

## Highlights
- Current conditions + wind card (Ambient Weather: temp, feels‑like, wind/gust/max gust)
- Compact 5‑day strip with **Today** integrated (today high/low + current PWS data, days 1–4 to the right)
- Sun‑track bar (midnight → midnight) with dawn/dusk + sunrise/sunset hatches and cloud‑aware sky gradient
- Sun‑track countdown to the next light phase (dawn/sunrise/sunset/dusk)
- Hourly forecast strip (DWML):
  - Temperature + feels‑like (wind chill / heat index overlays when applicable)
  - Wind + gusts
  - Precip potential + sky cover
  - Weather type bands (chance/likely/occasional)
  - Accumulated snowfall line (NDFD time‑series)
- ODOT sensors and camera tiles (OHGO)
- Alerts + advisories panel (DWML hazards)
- School closings (Lakewood City Schools only; shown only when a closure exists)
- OHGO incidents (nearby traffic incidents; cached)
- Image grids: GOES16 satellite, NWS/WJW/CLE radar, AccuWeather mosaic (proxied), GLERL ice, NWS storm total snow, CPC 8–14 day outlooks, and Pivotal maps

## Data Sources
- Ambient Weather (station data)
- NWS DWML (digital forecast grids)
- NDFD XML time‑series (snow accumulation)
- OHGO (ODOT cameras + sensors)
- Sunrise‑Sunset API (civil twilight + sunrise/sunset)
- Spectrum News closings feed (school closings)
- CPC 8–14 day outlooks (temp/precip)
- AccuWeather mosaic (proxied via Cloud Function)

## Project Layout
- `public/` — frontend HTML/CSS/JS
- `functions/` — Firebase Cloud Functions (CORS proxies, secrets)

## Local Development
- Serve `public/` with Firebase hosting or any static server.
- Use Firebase emulators for Functions if you need local API testing.

## Deploy
- Hosting:
  - `firebase deploy --only hosting`
- Functions:
  - `firebase deploy --only functions`

## Runtime
- Cloud Functions (2nd gen) target **Node.js 24** via `functions/package.json`.

## Notes
- The NDFD snow feed is proxied via `getNdfdSnowv1` to avoid browser CORS.
- DWML hazards are de‑duplicated and displayed as alert cards.
- Closings are hidden unless Lakewood City Schools is explicitly listed as closed/remote/virtual.
- Closings lookups are skipped between April 15 and December 1 (seasonal gate).
- AccuWeather mosaic is served through `getRadarProxyv1` to avoid ORB/CORS issues.

## Understanding caching
RadarB uses layered caching to keep the dashboard fast without losing freshness. There are three levels:

1) **Server‑side (Cloud Functions, in‑memory)**
   - Caches reset on cold start or new instances.
   - Current TTLs:
     - `getDwmlForecastv1`: **30 min** + ETag revalidation
     - `getNdfdSnowv1`: **1 hour**
     - `getTwilightTimesv1`: **6 hours**
     - `getOhgoIncidentsv1`: **5 min** (per map bounds)
     - `getSchoolClosingsv1`: **6 hours**

2) **Client‑side (localStorage)**
   - `forecastData`: JSON snapshot for the 5‑day strip (used immediately on load)
   - Legacy cleanup: the old `forecastHtml`/`forecastHtmlTime` keys are removed on startup
   - `dwmlForecast`: raw DWML XML (used immediately on load)
   - `twilightTimes`: dawn/dusk/sunrise/sunset (**6 hours**)
   - `incidentsCache`: OHGO incidents (**5 min**)
   - `closingsCache`: school closings (**10 min**)

3) **Browser Cache Storage**
   - `getCityNamev2` is cached via the Cache API when used (currently disabled by default).

**Deferred media loading**
- Large image tiles (radar/satellite/Pivotal) are loaded after initial paint via `data-src` + `requestIdleCallback`.
- Panels use a `.panel-loading` skeleton and remove it after image load.

**Image refresh cadence**
- OHGO camera tiles: ~6s
- Radar tiles (CLE/WJW/AccuWeather): 3 minutes
- Slow tiles (GOES16, GLERL, storm total snow, CPC, Pivotal): 1 hour

**How to control caching**
- Server TTLs live in `functions/index.js` within each function.
- Client TTLs live in `public/scripts/app1597.js` in the `getCached*` helpers.
- To bypass caches during debugging, clear localStorage keys or add a cache‑busting query param to the function URL.

## TODO
- Add DWML hazard time‑layout parsing to display effective windows.
- Consider adding observed cloud cover (METAR/GOES) for earlier‑day sun‑track segments.
