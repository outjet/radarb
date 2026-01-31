# Sun Track Line — Implementation Notes

This document explains how every segment of the sun‑track line is calculated, rendered, and updated.

## DOM Structure
Location: `public/index.html`

```
<div class="sun-track">
  <div class="sun-track-bar">
    <span class="sun-track-fill"></span>
    <span class="sun-track-tick sun-track-dawn" id="sun-track-dawn"></span>
    <span class="sun-track-tick sun-track-sunrise" id="sun-track-sunrise"></span>
    <span class="sun-track-tick sun-track-sunset" id="sun-track-sunset"></span>
    <span class="sun-track-tick sun-track-dusk" id="sun-track-dusk"></span>
    <span class="sun-track-dot" id="sun-track-dot"></span>
  </div>
  <div class="sun-track-labels">
    <span id="sunrise-label">Dawn --</span>
    <span id="sunset-label">Dusk --</span>
  </div>
</div>
```

## Data Sources
1) **Twilight times** (dawn, sunrise, sunset, dusk)
   - Function: `getTwilightTimesv1`
   - Client: `loadTwilightTimes()` → `applyTwilightTimes()`
   - Cached in `localStorage` for 6 hours.

2) **Cloud cover (hourly)** for sky color
   - From DWML hourly `cloud-amount` series.
   - Parsed in `renderDwmlParsed()` and passed to `updateSunTrackSky()`.

## Time Axis (the bar itself)
The sun‑track bar is a 24‑hour timeline:

- **Leftmost pixel = 00:00**
- **Rightmost pixel = 24:00**

All ticks and the current‑time dot are positioned as a ratio of the day:

```
ratio = (time - dayStart) / (dayEnd - dayStart)
```

## Ticks (Hatches)
Function: `updateSunTrack(dawn, dusk, sunrise, sunset)`

The bar includes four time markers:

- **Dawn** (civil dawn begins) → `#sun-track-dawn`
- **Sunrise** → `#sun-track-sunrise`
- **Sunset** → `#sun-track-sunset`
- **Dusk** (civil twilight ends) → `#sun-track-dusk`

Each tick is positioned by setting `left: <percent>%` on the element.

## Current Time Dot
Element: `#sun-track-dot`

- Position is computed with the same ratio logic.
- Opacity reduces if the time is outside `[00:00, 24:00]`.

## Sky Gradient (24 fixed segments)
Function: `updateSunTrackSky(cloudSeries)`

The line is divided into **24 equal segments** (one per hour). Each segment represents the sky state for that hour.

### Segment rule‑set
For each hour segment:

1) **Fully dark hours**
   - If the hour lies completely before **dawn** or completely after **dusk**, that segment is **dark night**.

2) **Dawn → Sunrise**
   - Segments that fall between **dawn** and **sunrise** use the **twilight palette** (purple → gray), cloud‑weighted.

3) **Sunrise → Sunset**
   - Segments during daylight use the **day palette** (blue → gray), cloud‑weighted.

4) **Sunset → Dusk**
   - Segments between **sunset** and **dusk** use the **twilight palette** (purple → gray), cloud‑weighted.

### Cloud‑aware color mixing
For any non‑night segment, the hour color is blended as:

```
mixColors(clearColor, cloudyColor, cloudinessRatio)
```

Where `cloudinessRatio` is 0–1 derived from the hour’s cloud cover %.

Palette:
- **Day**: blue → gray
- **Twilight (dawn/dusk)**: purple → gray
- **Night**: deep navy → slate

## CSS Overlay Fill
CSS adds a subtle highlight on top of the gradient:

```
.sun-track-fill { opacity: 0.35; }
```

This provides a soft sheen without changing the underlying sky color data.

## Summary of 24 segments
- The bar is always **24 discrete blocks** (hour 0 → hour 23).
- Hours fully outside civil twilight are **night‑dark**.
- Hours inside twilight or daylight are **color‑mixed per hour** based on cloud cover.

---

If you want nautical/astronomical twilight, add those times to `getTwilightTimesv1` and insert two additional tick/segment ranges before/after civil dawn/dusk.
