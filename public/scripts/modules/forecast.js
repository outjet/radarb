(function registerForecast() {
  window.RADARB = window.RADARB || {};
  window.RADARB.modules = window.RADARB.modules || {};

  const core = window.RADARB.modules.core || {};
  const { clearElement, appendLine } = core;

  let currentAmbientSnapshot = null;

  function setAmbientSnapshot(snapshot) {
    currentAmbientSnapshot = snapshot;
  }

  function renderDailyForecastFromDwml(dailyMax, dailyMin, iconSeries, hourlyTemp) {
    const forecastContainer = document.querySelector('.forecast-container');
    if (!forecastContainer) return;
    clearElement(forecastContainer);

    const dailyPairs = buildDailyHighLow(dailyMax, dailyMin, hourlyTemp);
    if (!dailyPairs.length) {
      forecastContainer.textContent = 'Forecast unavailable.';
      cacheForecastData(null);
      return;
    }

    renderForecastCards(dailyPairs, iconSeries, forecastContainer);
    cacheForecastData({ dailyPairs, iconSeries });
    forecastContainer.classList.remove('panel-loading');
  }

  function renderForecastCards(dailyPairs, iconSeries, forecastContainer) {
    const container = forecastContainer || document.querySelector('.forecast-container');
    if (!container) return;
    clearElement(container);

    const currentCard = document.createElement('div');
    currentCard.className = 'forecast forecast-current';
    appendLine(currentCard, 'Today', 'day');
    appendLine(currentCard, '--°', 'forecast-current-temp').id = 'forecast-now-temp';
    appendLine(currentCard, 'Feels --°', 'forecast-current-feels').id = 'forecast-now-feels';
    appendLine(currentCard, 'High -- / Low --', 'forecast-current-hilo').id = 'forecast-now-hilo';
    appendLine(currentCard, 'Wind -- • Gust -- • Max --', 'forecast-current-wind').id =
      'forecast-now-wind';
    forecastContainer.appendChild(currentCard);

    const day0 = dailyPairs[0];
    if (day0) {
      const hilo = document.getElementById('forecast-now-hilo');
      if (hilo) hilo.textContent = `High ${day0.high} / Low ${day0.low}`;
    }
    if (currentAmbientSnapshot) {
      const maxGust = Number.isFinite(currentAmbientSnapshot.maxdailygust)
        ? Math.round(currentAmbientSnapshot.maxdailygust)
        : Math.round(currentAmbientSnapshot.windgustmph);
      updateForecastCurrentCard(
        currentAmbientSnapshot.tempf,
        currentAmbientSnapshot.feelsLike,
        currentAmbientSnapshot.windspeedmph,
        currentAmbientSnapshot.windgustmph,
        maxGust
      );
    }

    const days = Math.min(dailyPairs.length - 1, 4);
    for (let i = 1; i <= days; i += 1) {
      const { dayDate, high, low } = dailyPairs[i];
      const dayName = dayDate.toLocaleString('default', { weekday: 'short' });
      const iconUrl = pickIconForDay(dayDate, iconSeries);

      const forecastDiv = document.createElement('div');
      forecastDiv.className = 'forecast';
      appendLine(forecastDiv, dayName, 'day');

      const iconDiv = document.createElement('div');
      iconDiv.className = 'weather-icon-div';
      if (iconUrl) {
        const img = document.createElement('img');
        img.src = iconUrl;
        img.className = 'weather-icon';
        img.alt = 'Forecast icon';
        iconDiv.appendChild(img);
      }
      forecastDiv.appendChild(iconDiv);

      appendLine(forecastDiv, `${high}/${low}`, 'high-low');
      forecastContainer.appendChild(forecastDiv);
    }
  }

  function updateForecastCurrentCard(tempf, feelsLike, windspeedmph, windgustmph, maxGust) {
    const tempEl = document.getElementById('forecast-now-temp');
    const feelsEl = document.getElementById('forecast-now-feels');
    const windEl = document.getElementById('forecast-now-wind');
    if (tempEl) tempEl.textContent = `${tempf.toFixed(1)}°`;
    if (feelsEl) feelsEl.textContent = `Feels ${feelsLike.toFixed(1)}°`;
    if (windEl)
      windEl.textContent = `Wind ${Math.round(windspeedmph)} • Gust ${Math.round(windgustmph)} • Max ${maxGust}`;
  }

  function cacheForecastData(payload) {
    try {
      if (!payload || !payload.dailyPairs) {
        localStorage.removeItem('forecastData');
        localStorage.removeItem('forecastDataTime');
        return;
      }
      const serialized = {
        dailyPairs: payload.dailyPairs.map((entry) => ({
          dayDate: entry.dayDate.toISOString(),
          high: entry.high,
          low: entry.low,
        })),
        iconSeries: payload.iconSeries
          ? {
              times: payload.iconSeries.times.map((time) => time.toISOString()),
              values: payload.iconSeries.values,
            }
          : null,
      };
      localStorage.setItem('forecastData', JSON.stringify(serialized));
      localStorage.setItem('forecastDataTime', Date.now().toString());
    } catch (error) {
      console.warn('Forecast cache write failed:', error);
    }
  }

  function loadCachedForecast() {
    try {
      const raw = localStorage.getItem('forecastData');
      const container = document.querySelector('.forecast-container');
      if (!container || !raw) return;
      const payload = JSON.parse(raw);
      if (!payload || !payload.dailyPairs) return;
      const dailyPairs = payload.dailyPairs.map((entry) => ({
        dayDate: new Date(entry.dayDate),
        high: entry.high,
        low: entry.low,
      }));
      const iconSeries = payload.iconSeries
        ? {
            times: payload.iconSeries.times.map((time) => new Date(time)),
            values: payload.iconSeries.values,
          }
        : null;
      renderForecastCards(dailyPairs, iconSeries, container);
      container.classList.remove('panel-loading');
    } catch (error) {
      console.warn('Forecast cache read failed:', error);
    }
  }

  function buildDailyHighLow(dailyMax, dailyMin, hourlyTemp) {
    if (!dailyMax || !dailyMin) {
      return buildDailyHighLowFromHourly(hourlyTemp);
    }
    const maxTimes = dailyMax.times || [];
    const maxVals = dailyMax.values || [];
    const minTimes = dailyMin.times || [];
    const minVals = dailyMin.values || [];
    const length = Math.min(maxTimes.length, minTimes.length, maxVals.length, minVals.length);
    const pairs = [];

    for (let i = 0; i < length; i += 1) {
      const maxDate = maxTimes[i];
      const minDate = minTimes[i];
      if (!(maxDate instanceof Date) || !(minDate instanceof Date)) continue;
      const high = maxVals[i];
      const low = minVals[i];
      if (!Number.isFinite(high) || !Number.isFinite(low)) continue;
      pairs.push({ dayDate: maxDate, high: Math.round(high), low: Math.round(low) });
    }

    if (pairs.length && hourlyTemp && hourlyTemp.times && hourlyTemp.times.length) {
      const firstDay = hourlyTemp.times[0];
      const day0 = pairs[0];
      if (firstDay instanceof Date && day0) {
        day0.dayDate = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate());
      }
    }

    return pairs;
  }

  function buildDailyHighLowFromHourly(hourlyTemp) {
    if (!hourlyTemp || !Array.isArray(hourlyTemp.times)) return [];
    const times = hourlyTemp.times;
    const values = hourlyTemp.values || [];
    if (!times.length || !values.length) return [];

    const byDay = new Map();
    for (let i = 0; i < times.length; i += 1) {
      const time = times[i];
      const value = values[i];
      if (!(time instanceof Date) || !Number.isFinite(value)) continue;
      const key = new Date(time.getFullYear(), time.getMonth(), time.getDate()).getTime();
      const entry = byDay.get(key) || { dayDate: new Date(key), high: value, low: value };
      entry.high = Math.max(entry.high, value);
      entry.low = Math.min(entry.low, value);
      byDay.set(key, entry);
    }

    return Array.from(byDay.values())
      .sort((a, b) => a.dayDate - b.dayDate)
      .map((entry) => ({
        dayDate: entry.dayDate,
        high: Math.round(entry.high),
        low: Math.round(entry.low),
      }));
  }

  function pickIconForDay(dayDate, iconSeries) {
    if (!iconSeries || !Array.isArray(iconSeries.times)) return null;
    const targetDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
    for (let i = 0; i < iconSeries.times.length; i += 1) {
      const time = iconSeries.times[i];
      if (!(time instanceof Date)) continue;
      if (
        time.getFullYear() === targetDate.getFullYear() &&
        time.getMonth() === targetDate.getMonth() &&
        time.getDate() === targetDate.getDate()
      ) {
        return iconSeries.values[i];
      }
    }
    return null;
  }

  window.RADARB.modules.forecast = {
    setAmbientSnapshot,
    renderDailyForecastFromDwml,
    renderForecastCards,
    updateForecastCurrentCard,
    loadCachedForecast,
  };
})();
