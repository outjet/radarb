# Drinks With Friends

Candid take after a first pass through the repo:

- This is a single‑page, static dashboard with a Firebase Functions backend. The split is clean: UI in `public/`, serverless proxies + secrets in `functions/`. That’s a pragmatic “ops board” shape and it shows in the code.
- The client is modular, but in a very old‑school way: global `window.RADARB.modules.*` registration with manual script ordering in `public/index.html`. It works, but it’s brittle (load order warnings are already in `app1597.js`).
- The caching story is surprisingly thoughtful. There’s server‑side in‑memory TTLs (e.g. DWML w/ ETag), client‑side `localStorage` caches, and image refresh cadences that avoid thrashing. The README documents all of it clearly, and the code backs it up (`functions/lib/handlers/dwml.js`, `public/scripts/modules/*`).
- There’s a very surgical use of AI: the school closings fallback uses Gemini to parse messy HTML when Spectrum’s JSON feed fails. That’s a real‑world, “ship it” move, and it’s guarded with seasonal gating to avoid useless calls (`functions/lib/handlers/closings.js`).
- A few “fossils” are lying around: `public/scripts/app15972.js` and `public/scripts/app15972.jsx` look like older prototypes; they reference old endpoints and aren’t wired into the page. That’s fine in a small repo, but it’s a signal of churn without cleanup.
- Some security/perf details are handled well (host allowlist for the radar proxy in `functions/lib/radarProxy.js`, timeouts for fetch/axios), but there are also open CORS policies everywhere (`handleCors` is `*`), which is typical for a read‑only dashboard but still worth calling out.

# What I Can’t Wait to Fix / Improve Next Week

Concrete, high‑leverage improvements based on what’s here:

1. **Clean up legacy client code and dead assets.**
   - Remove or archive `public/scripts/app15972.js` and `public/scripts/app15972.jsx` (and any unused HTML like `public/home2.html` if it’s not referenced). It reduces confusion and makes linting actionable.

2. **Tighten the client module system without “rewriting the app.”**
   - Keep the no‑build approach, but wrap modules in a simple loader that enforces dependencies and emits a single readiness event. That would remove brittle script ordering in `public/index.html` and eliminate the “modules missing” warning path in `public/scripts/app1597.js`.

3. **Normalize caching + refresh logic across modules.**
   - Several TTLs are hard‑coded in multiple places (e.g., incidents 5 min in both server and client; closings 6h server, 10m client). A shared config block in `public/scripts/config.js` plus an exported server TTL map would prevent drift.

4. **Reduce repeated DOM queries & event churn in hot paths.**
   - `sunTrack.updateSunPhaseCountdown` and the refresh timers run every second; they query the DOM each tick. Cache element references once in the module to cut layout work and GC pressure.

5. **Harden the radar proxy.**
   - `sanitizeRadarUrl` already strips cache‑buster query params and restricts hostnames. Add a strict path allowlist or file extension filter to avoid proxying arbitrary content from allowed hosts (small change, big safety win).

6. **Make the fallback closings parser more deterministic.**
   - The Gemini fallback is clever but could be wrapped with a minimal, local heuristic first (exact string match + status extraction) to reduce LLM calls and avoid JSON parse failures. Keep the LLM path as a last resort.

7. **Add a lightweight test target.**
   - There are already a couple of unit tests in `functions/test`. Extend coverage to `dwml` parsing and `closings` gating logic; these are the most logic‑heavy and brittle pieces.

Things I’d *leave alone for now*:

- The overall “single static page + serverless proxy” architecture. For a focused ops board, it’s a solid fit: low ops overhead, easy deployment, and performance‑friendly with the current caching strategy.
- The defer/lazy media loading and refresh cadence in `public/scripts/modules/media.js`. It’s a good tradeoff between freshness and bandwidth.
