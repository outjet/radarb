# RadarB

RadarB is a focused, scan‑friendly weather operations board for the Cleveland/Lake Erie corridor. It fuses live station data, ODOT sensors, camera feeds, radar tiles, and DWML/NDFD forecast grids into a single, modern dashboard optimized for quick decisions.

## Highlights
- Live station panel (temp, feels‑like, humidity, wind/gusts, UV) with refresh timer
- 5‑day forecast strip
- Hourly forecast strip (DWML):
  - Temperature + feels‑like (wind chill / heat index overlays when applicable)
  - Wind + gusts
  - Precip potential + sky cover
  - Weather type bands (chance/likely/occasional)
  - Accumulated snowfall line (NDFD time‑series)
- ODOT sensors and camera tiles
- Alerts + advisories panel (DWML hazards)

## Data Sources
- Ambient Weather (station data)
- NWS DWML (digital forecast grids)
- NDFD XML time‑series (snow accumulation)
- OHGO (ODOT cameras + sensors)
- OpenWeather (daily forecast)

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

## Notes
- The NDFD snow feed is proxied via `getNdfdSnowv1` to avoid browser CORS.
- DWML hazards are de‑duplicated and displayed as alert cards.

## TODO
- Add DWML hazard time‑layout parsing to display effective windows.
