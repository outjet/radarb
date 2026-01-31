# Sun Track Line (24-Segment Mode)

The sun-track bar renders **24 discrete segments**, one for each hour of the local day (00:00–23:59). Each segment is a solid color for that hour. Hatches (dawn/sunrise/sunset/dusk) stay fixed at their calculated positions on the bar and do not affect segment boundaries.

## Segment Rules (per hour)
For each hour `H`:

1) **Determine the hour window**
   - `hourStart = HH:00:00`
   - `hourEnd = HH:59:59`
   - `midpoint = HH:30`

2) **Choose base color by light phase**
   - **Night (pre‑dawn)**: if `hourEnd <= dawn`
     - `base = rgb(6, 8, 12)` (dark)
   - **Dawn → Sunrise (civil dawn)**: if `midpoint >= dawn && midpoint < sunrise`
     - `base = mix(dusk-purple, overcast-gray, cloudiness)`
   - **Daylight (sunrise → sunset)**: if `midpoint >= sunrise && midpoint <= sunset`
     - `base = mix(day-blue, overcast-gray, cloudiness)`
   - **Sunset → Dusk (civil dusk)**: if `midpoint > sunset && midpoint <= dusk`
     - `base = mix(sunset-purple, overcast-gray, cloudiness)`
   - **Night (post‑dusk)**: if `hourStart >= dusk`
     - `base = rgb(6, 8, 12)` (dark)
   - **Fallback** (if any phase is missing):
     - `base = rgb(6, 8, 12)`

3) **Cloudiness**
   - Cloudiness is derived from the DWML hourly cloud cover for that hour (`0–100`).
   - `cloudinessRatio = clamp(cloudPct / 100, 0, 1)`
   - `mix(a, b, r)` linearly interpolates RGB between `a` and `b` using ratio `r`.

## Colors
- **Night:** `rgb(6, 8, 12)`
- **Dawn gradient:** from `rgb(130, 88, 165)` to overcast `rgb(120, 128, 140)`
- **Daylight gradient:** from `rgb(92, 170, 255)` to overcast `rgb(125, 136, 145)`
- **Sunset gradient:** from `rgb(122, 72, 150)` to overcast `rgb(120, 128, 140)`

## Hatches & Dot
- **Hatches:** Dawn, Sunrise, Sunset, Dusk are placed by converting their timestamps into a 0–100% ratio of the day.
- **Dot:** Current time position (also 0–100% of the day).

## Notes
- The bar currently runs in **discrete mode** for visibility; toggling to smooth mode uses the same phase rules but interpolates across time steps.
