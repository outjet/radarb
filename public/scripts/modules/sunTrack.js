(function registerSunTrack() {
  window.RADARB = window.RADARB || {};
  window.RADARB.modules = window.RADARB.modules || {};

  const { fetchWithTimeout } = window.RADARB.modules.core || {};
  const { endpoints } = window.RADARB_CONFIG || {};
  const twilightEndpoint = endpoints?.twilightUrl;

  let twilightTimes = null;
  let latestCloudSeries = null;
  const SUN_TRACK_MODE = 'discrete'; // 'discrete' | 'smooth'
  const cachedEls = {};

  function getEl(id) {
    if (!cachedEls[id]) {
      cachedEls[id] = document.getElementById(id);
    }
    return cachedEls[id];
  }

  async function loadTwilightTimes(lat, lng) {
    if (!twilightEndpoint) return;
    const dawnEl = getEl('sunrise-label');
    const duskEl = getEl('sunset-label');
    const cached = getCachedTwilightTimes();
    if (cached) {
      applyTwilightTimes(cached, dawnEl, duskEl);
      return;
    }

    try {
      const response = await fetchWithTimeout(
        `${twilightEndpoint}?lat=${lat}&lng=${lng}`,
        {},
        10000
      );
      if (!response.ok) throw new Error('Twilight response not ok');
      const data = await response.json();
      cacheTwilightTimes(data);
      applyTwilightTimes(data, dawnEl, duskEl);
    } catch (error) {
      console.error('Error fetching twilight times:', error);
      if (dawnEl) dawnEl.textContent = 'Dawn unavailable';
      if (duskEl) duskEl.textContent = 'Dusk unavailable';
    }
  }

  function applyTwilightTimes(data, dawnEl, duskEl) {
    const dawn = data && data.dawn ? data.dawn : '--';
    const dusk = data && data.dusk ? data.dusk : '--';
    const sunrise = data && data.sunrise ? data.sunrise : '--';
    const sunset = data && data.sunset ? data.sunset : '--';
    twilightTimes = { dawn, dusk, sunrise, sunset };
    if (dawnEl) dawnEl.textContent = dawn;
    if (duskEl) duskEl.textContent = dusk;

    const sunriseLabel = getEl('sunrise-label');
    const sunsetLabel = getEl('sunset-label');
    if (sunriseLabel) sunriseLabel.textContent = `Dawn ${dawn}`;
    if (sunsetLabel) sunsetLabel.textContent = `Dusk ${dusk}`;
    updateSunTrack(dawn, dusk, sunrise, sunset);
    updateSunPhaseCountdown();
  }

  function updateSunTrack(dawn, dusk, sunrise, sunset) {
    const dot = document.getElementById('sun-track-dot');
    const dawnTick = document.getElementById('sun-track-dawn');
    const sunriseTick = document.getElementById('sun-track-sunrise');
    const sunsetTick = document.getElementById('sun-track-sunset');
    const duskTick = document.getElementById('sun-track-dusk');
    if (!dot || dawn === '--' || dusk === '--') return;
    const dawnDate = parseLocalTimeToDate(dawn);
    const duskDate = parseLocalTimeToDate(dusk);
    const sunriseDate = sunrise && sunrise !== '--' ? parseLocalTimeToDate(sunrise) : null;
    const sunsetDate = sunset && sunset !== '--' ? parseLocalTimeToDate(sunset) : null;
    if (!dawnDate || !duskDate) return;
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 24, 0, 0, 0);
    const dayTotal = dayEnd.getTime() - dayStart.getTime();
    const dawnRatio = (dawnDate.getTime() - dayStart.getTime()) / dayTotal;
    const duskRatio = (duskDate.getTime() - dayStart.getTime()) / dayTotal;
    const nowRatio = (now.getTime() - dayStart.getTime()) / dayTotal;
    const sunriseRatio = sunriseDate
      ? (sunriseDate.getTime() - dayStart.getTime()) / dayTotal
      : null;
    const sunsetRatio = sunsetDate ? (sunsetDate.getTime() - dayStart.getTime()) / dayTotal : null;

    if (dawnTick) dawnTick.style.left = `${(dawnRatio * 100).toFixed(2)}%`;
    if (sunriseTick && sunriseRatio !== null) {
      sunriseTick.style.left = `${(sunriseRatio * 100).toFixed(2)}%`;
    }
    if (sunsetTick && sunsetRatio !== null) {
      sunsetTick.style.left = `${(sunsetRatio * 100).toFixed(2)}%`;
    }
    if (duskTick) duskTick.style.left = `${(duskRatio * 100).toFixed(2)}%`;
    dot.style.left = `${(Math.min(Math.max(nowRatio, 0), 1) * 100).toFixed(2)}%`;
    dot.style.opacity = nowRatio < 0 || nowRatio > 1 ? '0.3' : '1';

    const bar = dot.closest('.sun-track-bar');
    if (bar) {
      bar.style.setProperty('--dawn', `${(dawnRatio * 100).toFixed(2)}%`);
      bar.style.setProperty('--dusk', `${(duskRatio * 100).toFixed(2)}%`);
      if (sunriseRatio !== null) {
        bar.style.setProperty('--sunrise', `${(sunriseRatio * 100).toFixed(2)}%`);
      }
      if (sunsetRatio !== null) {
        bar.style.setProperty('--sunset', `${(sunsetRatio * 100).toFixed(2)}%`);
      }
    }

    if (latestCloudSeries) {
      updateSunTrackSky(latestCloudSeries);
    }
  }

  function updateSunPhaseCountdown() {
    const countdownEl = getEl('sun-phase-countdown');
    if (!countdownEl || !twilightTimes) return;
    const now = new Date();
    const dawn = twilightTimes.dawn ? parseLocalTimeToDate(twilightTimes.dawn) : null;
    const sunrise = twilightTimes.sunrise ? parseLocalTimeToDate(twilightTimes.sunrise) : null;
    const sunset = twilightTimes.sunset ? parseLocalTimeToDate(twilightTimes.sunset) : null;
    const dusk = twilightTimes.dusk ? parseLocalTimeToDate(twilightTimes.dusk) : null;

    let target = null;
    let label = '';

    if (dawn && now < dawn) {
      target = dawn;
      label = 'dawn';
    } else if (sunrise && now < sunrise) {
      target = sunrise;
      label = 'sunrise';
    } else if (sunset && now < sunset) {
      target = sunset;
      label = 'sunset';
    } else if (dusk && now < dusk) {
      target = dusk;
      label = 'dusk';
    } else if (dawn) {
      target = new Date(dawn.getTime());
      target.setDate(target.getDate() + 1);
      label = 'dawn';
    }

    if (!target) {
      countdownEl.textContent = '--';
      return;
    }

    const diffMs = Math.max(0, target.getTime() - now.getTime());
    const totalMinutes = Math.ceil(diffMs / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    countdownEl.textContent = `${hours}:${minutes.toString().padStart(2, '0')} until ${label}`;
  }

  function parseLocalTimeToDate(timeStr) {
    const match = String(timeStr).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return null;
    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  }

  function getCachedTwilightTimes() {
    const cached = localStorage.getItem('twilightTimes');
    const cachedTime = localStorage.getItem('twilightTimesTime');
    if (!cached || !cachedTime) return null;
    const age = Date.now() - Number(cachedTime);
    if (age < 6 * 60 * 60 * 1000) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        return null;
      }
    }
    return null;
  }

  function cacheTwilightTimes(data) {
    localStorage.setItem('twilightTimes', JSON.stringify(data));
    localStorage.setItem('twilightTimesTime', Date.now().toString());
  }

  function updateSunTrackSky(cloudSeries) {
    const bar = document.querySelector('.sun-track-bar');
    if (!bar || !cloudSeries || !Array.isArray(cloudSeries.values)) return;
    const values = cloudSeries.values;
    const times = cloudSeries.times || [];
    if (!times.length) return;

    const dawn = twilightTimes?.dawn ? parseLocalTimeToDate(twilightTimes.dawn) : null;
    const sunrise = twilightTimes?.sunrise ? parseLocalTimeToDate(twilightTimes.sunrise) : null;
    const sunset = twilightTimes?.sunset ? parseLocalTimeToDate(twilightTimes.sunset) : null;
    const dusk = twilightTimes?.dusk ? parseLocalTimeToDate(twilightTimes.dusk) : null;

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 24, 0, 0, 0);
    const dayTotal = dayEnd.getTime() - dayStart.getTime();

    const hourKey = (date) =>
      `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}`;
    const cloudByHour = new Map();
    for (let i = 0; i < times.length; i += 1) {
      const time = times[i];
      const value = values[i];
      if (!(time instanceof Date) || !Number.isFinite(value)) continue;
      cloudByHour.set(hourKey(time), value);
    }

    if (SUN_TRACK_MODE === 'discrete') {
      const segments = [];
      for (let hour = 0; hour < 24; hour += 1) {
        const hourStart = new Date(
          dayStart.getFullYear(),
          dayStart.getMonth(),
          dayStart.getDate(),
          hour,
          0,
          0,
          0
        );
        const hourEnd = new Date(
          dayStart.getFullYear(),
          dayStart.getMonth(),
          dayStart.getDate(),
          hour + 1,
          0,
          0,
          0
        );
        const midpoint = new Date((hourStart.getTime() + hourEnd.getTime()) / 2);
        const key = hourKey(hourStart);
        const cloudValue = cloudByHour.has(key) ? cloudByHour.get(key) : 0;
        const cloudiness = Math.min(Math.max(cloudValue || 0, 0), 100) / 100;

        let base;
        if (dawn && hourEnd.getTime() <= dawn.getTime()) {
          base = [6, 8, 12];
        } else if (dusk && hourStart.getTime() >= dusk.getTime()) {
          base = [6, 8, 12];
        } else if (dawn && sunrise && midpoint >= dawn && midpoint < sunrise) {
          base = mixColors([130, 88, 165], [120, 128, 140], cloudiness);
        } else if (sunrise && sunset && midpoint >= sunrise && midpoint <= sunset) {
          base = mixColors([92, 170, 255], [125, 136, 145], cloudiness);
        } else if (sunset && dusk && midpoint > sunset && midpoint <= dusk) {
          base = mixColors([122, 72, 150], [120, 128, 140], cloudiness);
        } else {
          base = [6, 8, 12];
        }

        const color = `rgb(${base.join(',')})`;
        const startPercent = (hour / 24) * 100;
        const endPercent = ((hour + 1) / 24) * 100;
        segments.push(`${color} ${startPercent.toFixed(2)}%`, `${color} ${endPercent.toFixed(2)}%`);
      }

      bar.style.backgroundImage = `linear-gradient(90deg, ${segments.join(', ')})`;
      return;
    }

    let firstValid = null;
    let lastValid = null;
    const segments = [];
    for (let i = 0; i < times.length; i += 1) {
      const time = times[i];
      const nextTime = times[i + 1];
      const value = values[i];
      if (!(time instanceof Date) || !Number.isFinite(value)) continue;
      const startRatio = (time.getTime() - dayStart.getTime()) / dayTotal;
      const endRatio =
        nextTime instanceof Date
          ? (nextTime.getTime() - dayStart.getTime()) / dayTotal
          : startRatio + 1 / 24;
      const clampedStart = Math.min(Math.max(startRatio, 0), 1);
      const clampedEnd = Math.min(Math.max(endRatio, 0), 1);
      if (clampedEnd <= 0 || clampedStart >= 1) continue;

      if (firstValid === null || clampedStart < firstValid) {
        firstValid = clampedStart;
      }
      if (lastValid === null || clampedEnd > lastValid) {
        lastValid = clampedEnd;
      }

      const cloudiness = Math.min(Math.max(value, 0), 100) / 100;
      const timeMs = time.getTime();
      let base;
      if (sunrise && sunset && timeMs >= sunrise.getTime() && timeMs <= sunset.getTime()) {
        base = mixColors([92, 170, 255], [125, 136, 145], cloudiness);
      } else if (dawn && sunrise && timeMs >= dawn.getTime() && timeMs < sunrise.getTime()) {
        base = mixColors([130, 88, 165], [120, 128, 140], cloudiness);
      } else if (sunset && dusk && timeMs > sunset.getTime() && timeMs <= dusk.getTime()) {
        base = mixColors([122, 72, 150], [120, 128, 140], cloudiness);
      } else {
        base = mixColors([6, 8, 12], [24, 28, 34], cloudiness * 0.4);
      }

      const color = `rgb(${base.join(',')})`;
      segments.push(
        `${color} ${(clampedStart * 100).toFixed(2)}%`,
        `${color} ${(clampedEnd * 100).toFixed(2)}%`
      );
    }

    if (!segments.length) return;
    const dawnRatio = dawn ? (dawn.getTime() - dayStart.getTime()) / dayTotal : null;
    const duskRatio = dusk ? (dusk.getTime() - dayStart.getTime()) / dayTotal : null;
    const nightStart = Math.min(
      firstValid !== null ? firstValid : 1,
      dawnRatio !== null ? dawnRatio : 1
    );
    if (nightStart > 0) {
      segments.unshift(`rgb(6, 8, 12) 0%`, `rgb(6, 8, 12) ${(nightStart * 100).toFixed(2)}%`);
    }
    const nightEnd = Math.max(
      lastValid !== null ? lastValid : 0,
      duskRatio !== null ? duskRatio : 0
    );
    if (nightEnd < 1) {
      segments.push(`rgb(6, 8, 12) ${(nightEnd * 100).toFixed(2)}%`, `rgb(6, 8, 12) 100%`);
    }
    bar.style.backgroundImage = `linear-gradient(90deg, ${segments.join(', ')})`;
  }

  function mixColors(start, end, ratio) {
    return start.map((channel, index) => Math.round(channel + (end[index] - channel) * ratio));
  }

  function setLatestCloudSeries(cloudSeries) {
    latestCloudSeries = cloudSeries;
    updateSunTrackSky(cloudSeries);
  }

  function getTwilightTimes() {
    return twilightTimes;
  }

  window.RADARB.modules.sunTrack = {
    loadTwilightTimes,
    applyTwilightTimes,
    updateSunTrack,
    updateSunPhaseCountdown,
    setLatestCloudSeries,
    getTwilightTimes,
    parseLocalTimeToDate,
  };
})();
