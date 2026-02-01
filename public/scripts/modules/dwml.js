(function registerDwml() {
  window.RADARB = window.RADARB || {};
  window.RADARB.modules = window.RADARB.modules || {};

  const core = window.RADARB.modules.core || {};
  const forecast = window.RADARB.modules.forecast || {};
  const sunTrack = window.RADARB.modules.sunTrack || {};
  const { fetchWithTimeout, clearElement, appendLine, appendLink, updateAlertsVisibility } = core;
  const { endpoints } = window.RADARB_CONFIG || {};

  let dwmlCharts = {};

  async function loadDwmlMeteogram(lat, lng) {
    const statusEl = document.getElementById('dwml-status');
    if (!statusEl) return;

    statusEl.textContent = 'Loading...';

    const url = `${endpoints.dwmlUrl}?lat=${lat}&lng=${lng}`;
    const snowUrl = `${endpoints.ndfdSnowUrl}?lat=${lat}&lng=${lng}`;
    const cachedDwml = loadCachedDwml();

    try {
      if (cachedDwml) {
        renderDwmlPayload(cachedDwml, null);
      }

      const [response, snowResponse] = await Promise.all([
        fetchWithTimeout(url, {}, 12000),
        fetchWithTimeout(snowUrl, {}, 12000).catch(() => null),
      ]);
      if (!response.ok) throw new Error(`DWML fetch failed: ${response.status}`);

      const xmlText = await response.text();
      cacheDwml(xmlText);
      renderDwmlPayload(xmlText, snowResponse);
    } catch (error) {
      console.error('DWML error:', error);
      statusEl.textContent = 'Unavailable';
    }
  }

  function renderDwmlPayload(dwmlXmlText, snowResponse) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(dwmlXmlText, 'application/xml');

    if (snowResponse && snowResponse.ok) {
      snowResponse
        .text()
        .then((text) => {
          const snowDoc = parser.parseFromString(text, 'application/xml');
          renderDwmlParsed(doc, snowDoc);
        })
        .catch(() => renderDwmlParsed(doc, null));
      return;
    }

    renderDwmlParsed(doc, null);
  }

  function renderDwmlParsed(doc, snowDoc) {
    const statusEl = document.getElementById('dwml-status');
    if (!statusEl) return;

    const tempSeries = getDwmlSeries(doc, 'temperature[type="hourly"]');
    const feelsSeries = getFirstDwmlSeries(doc, [
      'temperature[type="apparent"]',
      'temperature[type="heat index"]',
      'temperature[type="wind chill"]',
    ]);
    const windChillSeries = getDwmlSeries(doc, 'temperature[type="wind chill"]');
    const heatIndexSeries = getDwmlSeries(doc, 'temperature[type="heat index"]');
    const popSeries = getDwmlSeries(doc, 'probability-of-precipitation');
    const cloudSeries = getDwmlSeries(doc, 'cloud-amount');
    const windSeries = getDwmlSeries(doc, 'wind-speed[type="sustained"]');
    const gustSeries = getDwmlSeries(doc, 'wind-speed[type="gust"]');
    const weatherSeries = getDwmlWeatherSeries(doc);
    const dailyMax = getDwmlSeries(doc, 'temperature[type="maximum"]');
    const dailyMin = getDwmlSeries(doc, 'temperature[type="minimum"]');
    const iconSeries = getDwmlIconSeries(doc);
    const snowSeries = snowDoc
      ? getFirstDwmlSeries(snowDoc, [
          'precipitation[type="snow"]',
          'snow-amount',
          'snowfall-amount',
        ])
      : null;
    const hazards = getDwmlHazards(doc);

    if (!snowSeries) {
      console.info('DWML snow: no series found');
    } else {
      console.info('DWML snow points:', snowSeries.values.filter((value) => value !== null).length);
    }

    if (!tempSeries || !tempSeries.times.length) {
      statusEl.textContent = 'No hourly data';
      return;
    }

    const feels = feelsSeries ? feelsSeries.values : tempSeries.values;
    const labels = tempSeries.times.map(formatHourLabel);

    console.info('DWML points:', tempSeries.values.length);

    const snowAccum = snowSeries ? buildSnowAccumulation(tempSeries.times, snowSeries) : [];
    renderDwmlCharts({
      labels,
      temp: tempSeries.values,
      feels,
      windChill: windChillSeries ? windChillSeries.values : [],
      heatIndex: heatIndexSeries ? heatIndexSeries.values : [],
      wind: windSeries ? windSeries.values : [],
      gust: gustSeries ? gustSeries.values : [],
      pop: popSeries ? popSeries.values : [],
      cloud: cloudSeries ? cloudSeries.values : [],
      weather: weatherSeries,
      snowAccum,
    });
    if (snowAccum.length && tempSeries.times.length) {
      maybeExtendSnowAccumulation(tempSeries.times, snowAccum, snowSeries);
    }

    if (cloudSeries) {
      sunTrack.setLatestCloudSeries(cloudSeries);
    }

    forecast.renderDailyForecastFromDwml(dailyMax, dailyMin, iconSeries, tempSeries);

    renderDwmlHazards(hazards);

    const start = tempSeries.times[0];
    const end = tempSeries.times[tempSeries.times.length - 1];
    statusEl.textContent = `${formatRangeLabel(start)} to ${formatRangeLabel(end)}`;
  }

  function loadCachedDwml() {
    try {
      return localStorage.getItem('dwmlForecast');
    } catch (error) {
      console.warn('DWML cache read failed:', error);
      return null;
    }
  }

  function cacheDwml(xmlText) {
    try {
      localStorage.setItem('dwmlForecast', xmlText);
    } catch (error) {
      console.warn('DWML cache write failed:', error);
    }
  }

  function buildSnowAccumulation(hourlyTimes, snowSeries) {
    const snowTimes = snowSeries.times || [];
    const snowValues = snowSeries.values || [];
    const accum = [];
    let total = 0;
    let snowIndex = 0;

    for (const hour of hourlyTimes) {
      while (snowIndex < snowTimes.length && snowTimes[snowIndex] <= hour) {
        const amount = snowValues[snowIndex];
        if (amount !== null && Number.isFinite(amount)) {
          total += amount;
        }
        snowIndex += 1;
      }
      accum.push(Number(total.toFixed(2)));
    }

    return accum;
  }

  function getDwmlSeries(doc, selector) {
    const node = doc.querySelector(selector);
    if (!node) return null;

    const layoutKey = node.getAttribute('time-layout');
    const units = node.getAttribute('units') || '';
    const times = getDwmlTimes(doc, layoutKey);
    const values = Array.from(node.querySelectorAll('value')).map((valueNode) => {
      const nil =
        valueNode.getAttribute('xsi:nil') ||
        valueNode.getAttributeNS('http://www.w3.org/2001/XMLSchema-instance', 'nil');
      if (nil === 'true') return null;
      const val = Number(valueNode.textContent);
      return Number.isFinite(val) ? val : null;
    });

    const length = Math.min(times.length, values.length);
    return {
      times: times.slice(0, length),
      values: values.slice(0, length),
      units,
    };
  }

  function getDwmlWeatherSeries(doc) {
    const weatherNode = doc.querySelector('weather');
    if (!weatherNode) return null;

    const layoutKey = weatherNode.getAttribute('time-layout');
    const times = getDwmlTimes(doc, layoutKey);

    const conditions = Array.from(weatherNode.querySelectorAll('weather-conditions'));
    const length = Math.min(times.length, conditions.length);
    const series = {
      snow: [],
      rain: [],
      thunder: [],
      sleet: [],
      'freezing rain': [],
    };
    for (let i = 0; i < length; i += 1) {
      const conditionNode = conditions[i];
      if (!conditionNode) {
        Object.keys(series).forEach((key) => series[key].push(null));
        continue;
      }
      const valueNode = conditionNode.querySelector('value');
      if (!valueNode) {
        Object.keys(series).forEach((key) => series[key].push(null));
        continue;
      }

      const coverage = (valueNode.getAttribute('coverage') || '').toLowerCase();
      const weatherType = (valueNode.getAttribute('weather-type') || '').toLowerCase();
      const coverageScore = coverageToScore(coverage);
      Object.keys(series).forEach((key) => {
        series[key].push(weatherType.includes(key) ? coverageScore : null);
      });
    }

    return {
      times: times.slice(0, length),
      series,
    };
  }

  function coverageToScore(coverage) {
    switch (coverage) {
      case 'slight chance':
        return 1;
      case 'chance':
        return 2;
      case 'likely':
        return 3;
      case 'occasional':
      case 'definitely':
        return 4;
      default:
        return 0;
    }
  }

  function getDwmlHazards(doc) {
    const hazardsNode = doc.querySelector('hazards');
    if (!hazardsNode) return [];

    const hazardNodes = Array.from(hazardsNode.querySelectorAll('hazard'));
    const seen = new Set();
    const hazards = [];

    hazardNodes.forEach((node) => {
      const hazardCode = node.getAttribute('hazardCode') || '';
      const phenomena = node.getAttribute('phenomena') || '';
      const significance = node.getAttribute('significance') || '';
      const hazardType = node.getAttribute('hazardType') || '';
      const urlNode = node.querySelector('hazardTextURL');
      const url = urlNode ? urlNode.textContent.trim() : '';

      const key = `${hazardCode}|${phenomena}|${significance}|${url}`;
      if (seen.has(key)) return;
      seen.add(key);

      hazards.push({
        hazardCode,
        phenomena,
        significance,
        hazardType,
        url,
      });
    });

    return hazards;
  }

  function renderDwmlHazards(hazards) {
    const hazardsContainer = document.querySelector('.hazards-container');
    const alertsContainer = document.querySelector('.alerts-container');
    if (!hazardsContainer) return;
    clearElement(hazardsContainer);
    if (!hazards || hazards.length === 0) {
      hazardsContainer.style.display = 'none';
      if (updateAlertsVisibility) updateAlertsVisibility();
      return;
    }

    hazards.forEach((hazard) => {
      const title = `${hazard.phenomena} ${hazard.significance}`.trim();
      const hazardDiv = document.createElement('div');
      const significanceClass = hazard.significance
        ? `hazard-alert--${hazard.significance.toLowerCase()}`
        : '';
      hazardDiv.className = `hazard-alert ${significanceClass}`.trim();
      const strong = document.createElement('strong');
      strong.textContent = title;
      hazardDiv.appendChild(strong);
      if (hazard.hazardType) {
        appendLine(hazardDiv, hazard.hazardType);
      }
      if (hazard.url) {
        const linkWrap = document.createElement('div');
        appendLink(linkWrap, 'Advisory text', hazard.url);
        hazardDiv.appendChild(linkWrap);
      }
      hazardsContainer.appendChild(hazardDiv);
    });

    hazardsContainer.style.display = 'block';
    if (alertsContainer) alertsContainer.classList.add('is-active');
    if (updateAlertsVisibility) updateAlertsVisibility();
  }

  function getFirstDwmlSeries(doc, selectors) {
    for (const selector of selectors) {
      const series = getDwmlSeries(doc, selector);
      if (series) return series;
    }
    return null;
  }

  function getDwmlTimes(doc, layoutKey) {
    const layouts = Array.from(doc.querySelectorAll('time-layout'));
    const layout = layouts.find((item) => {
      const keyNode = item.querySelector('layout-key');
      return keyNode && keyNode.textContent === layoutKey;
    });

    if (!layout) return [];

    return Array.from(layout.querySelectorAll('start-valid-time')).map(
      (node) => new Date(node.textContent)
    );
  }

  function getDwmlIconSeries(doc) {
    const iconNode = doc.querySelector('conditions-icon');
    if (!iconNode) return null;
    const layoutKey = iconNode.getAttribute('time-layout');
    const times = getDwmlTimes(doc, layoutKey);
    const icons = Array.from(iconNode.querySelectorAll('icon-link')).map((node) =>
      node.textContent.trim()
    );
    const length = Math.min(times.length, icons.length);
    return {
      times: times.slice(0, length),
      values: icons.slice(0, length),
    };
  }

  function formatHourLabel(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const hour = date.getHours();
    const meridiem = hour >= 12 ? 'pm' : 'am';
    const hour12 = ((hour + 11) % 12) + 1;
    const day = date.toLocaleDateString(undefined, { weekday: 'short' });
    return `${day} ${hour12}${meridiem}`;
  }

  function formatRangeLabel(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function renderDwmlCharts({
    labels,
    temp,
    feels,
    windChill,
    heatIndex,
    wind,
    gust,
    pop,
    cloud,
    weather,
    snowAccum,
  }) {
    const tempCanvas = document.getElementById('dwml-temp');
    const windCanvas = document.getElementById('dwml-wind');
    const precipCanvas = document.getElementById('dwml-precip');
    const weatherCanvas = document.getElementById('dwml-weather');
    const snowCanvas = document.getElementById('dwml-snow');

    if (!tempCanvas || !windCanvas || !precipCanvas || !weatherCanvas || !snowCanvas) return;

    Object.values(dwmlCharts).forEach((chart) => chart.destroy());
    dwmlCharts = {};

    dwmlCharts.temp = new Chart(tempCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Temperature',
            data: temp,
            borderColor: '#9cc3ff',
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
          },
          {
            label: 'Feels Like',
            data: feels,
            borderColor: '#ffd07a',
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
          },
          ...(windChill?.length
            ? [
                {
                  label: 'Wind Chill',
                  data: windChill,
                  borderColor: '#8de0f5',
                  borderWidth: 2,
                  tension: 0.35,
                  pointRadius: 0,
                },
              ]
            : []),
          ...(heatIndex?.length
            ? [
                {
                  label: 'Heat Index',
                  data: heatIndex,
                  borderColor: '#ff9a6b',
                  borderWidth: 2,
                  tension: 0.35,
                  pointRadius: 0,
                },
              ]
            : []),
        ],
      },
      options: sharedLineOptions({
        yLabel: '°F',
      }),
    });

    dwmlCharts.wind = new Chart(windCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Wind',
            data: wind,
            borderColor: '#6fe4c6',
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
          },
          {
            label: 'Gusts',
            data: gust,
            borderColor: '#58aef6',
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
          },
        ],
      },
      options: sharedLineOptions({
        yLabel: 'mph',
      }),
    });

    dwmlCharts.precip = new Chart(precipCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Precip Potential',
            data: pop,
            borderColor: '#7bb7ff',
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
          },
          {
            label: 'Cloud Cover',
            data: cloud,
            borderColor: '#c0c9d3',
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
          },
        ],
      },
      options: sharedLineOptions({
        yLabel: '%',
        yMax: 100,
      }),
    });

    const weatherSeries = weather ? weather.series : null;
    dwmlCharts.weather = new Chart(weatherCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: weatherSeries
          ? [
              {
                label: 'Snow',
                data: weatherSeries['snow'],
                backgroundColor: '#9ad4ff',
              },
              {
                label: 'Rain',
                data: weatherSeries['rain'],
                backgroundColor: '#6ea8ff',
              },
              {
                label: 'Thunder',
                data: weatherSeries['thunder'],
                backgroundColor: '#ffbd59',
              },
              {
                label: 'Sleet',
                data: weatherSeries['sleet'],
                backgroundColor: '#b0b7c2',
              },
              {
                label: 'Freezing Rain',
                data: weatherSeries['freezing rain'],
                backgroundColor: '#8c9bb3',
              },
            ]
          : [],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 4,
            ticks: { display: false },
            grid: { color: 'rgba(255,255,255,0.08)' },
          },
          x: {
            ticks: { color: '#9aa6b2', maxTicksLimit: 8 },
            grid: { color: 'rgba(255,255,255,0.08)' },
          },
        },
        plugins: { legend: { display: false } },
      },
    });

    dwmlCharts.snow = new Chart(snowCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Accumulated Snow',
            data: snowAccum,
            borderColor: '#b6d6ff',
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 0,
            fill: true,
            backgroundColor: 'rgba(122, 164, 240, 0.2)',
          },
        ],
      },
      options: sharedLineOptions({
        yLabel: 'in',
      }),
    });
  }

  function sharedLineOptions({ yLabel, yMax } = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: false,
          max: yMax,
          ticks: { color: '#9aa6b2' },
          grid: { color: 'rgba(255,255,255,0.08)' },
          title: yLabel ? { display: true, text: yLabel, color: '#9aa6b2' } : undefined,
        },
        x: {
          ticks: { color: '#9aa6b2', maxTicksLimit: 8 },
          grid: { color: 'rgba(255,255,255,0.08)' },
        },
      },
      plugins: { legend: { display: false } },
    };
  }

  async function maybeExtendSnowAccumulation(hourlyTimes, snowAccum, snowSeries) {
    if (!dwmlCharts.snow || !endpoints?.snowTailUrl) return;
    if (!hourlyTimes.length) return;

    const lastHourlyTime = hourlyTimes[hourlyTimes.length - 1];
    const lastSnowTime =
      snowSeries && Array.isArray(snowSeries.times) && snowSeries.times.length
        ? snowSeries.times[snowSeries.times.length - 1]
        : null;

    if (!lastSnowTime || !(lastSnowTime instanceof Date)) return;
    if (!(lastHourlyTime instanceof Date)) return;
    if (lastSnowTime.getTime() >= lastHourlyTime.getTime()) return;

    const tail = await fetchSnowTail();
    if (!tail || !Array.isArray(tail.hours) || !Array.isArray(tail.snow_accum_in)) return;

    const tailMap = new Map();
    for (let i = 0; i < tail.hours.length; i += 1) {
      const t = parseSnowTailTime(tail.hours[i]);
      if (!Number.isFinite(t.getTime())) continue;
      tailMap.set(normalizeHourKey(t), tail.snow_accum_in[i]);
    }

    // Determine the last known accumulation from NDFD/DWML
    let lastKnown = 0;
    for (let i = snowAccum.length - 1; i >= 0; i -= 1) {
      const val = snowAccum[i];
      if (Number.isFinite(val)) {
        lastKnown = val;
        break;
      }
    }

    const extended = [...snowAccum];
    const firstTailKey = normalizeHourKey(lastSnowTime);
    const tailBase = tailMap.has(firstTailKey) ? tailMap.get(firstTailKey) : 0;

    for (let i = 0; i < hourlyTimes.length; i += 1) {
      const time = hourlyTimes[i];
      if (!(time instanceof Date)) {
        extended[i] = extended[i] ?? lastKnown;
        continue;
      }
      const key = normalizeHourKey(time);
      if (time.getTime() <= lastSnowTime.getTime()) {
        extended[i] = extended[i] ?? lastKnown;
        continue;
      }
      if (tailMap.has(key)) {
        extended[i] = lastKnown + Math.max(0, tailMap.get(key) - tailBase);
      } else {
        extended[i] = extended[i - 1] ?? lastKnown;
      }
    }

    dwmlCharts.snow.data.datasets[0].data = extended;
    dwmlCharts.snow.update();
  }

  async function fetchSnowTail() {
    try {
      const cached = getCachedSnowTail();
      if (cached) return cached;
      const response = await fetchWithTimeout(endpoints.snowTailUrl, {}, 8000);
      if (!response.ok) return null;
      const data = await response.json();
      cacheSnowTail(data);
      return data;
    } catch (error) {
      console.warn('Snow tail fetch failed:', error);
      return null;
    }
  }

  function parseSnowTailTime(value) {
    if (!value) return new Date('invalid');
    const raw = String(value);
    const normalized = raw.endsWith('Z') || raw.includes('+') || raw.includes('-')
      ? raw
      : `${raw}Z`;
    return new Date(normalized);
  }

  function normalizeHourKey(date) {
    if (!(date instanceof Date)) return '';
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:00Z`;
  }

  function getCachedSnowTail() {
    try {
      const raw = localStorage.getItem('snowTailCache');
      if (!raw) return null;
      const payload = JSON.parse(raw);
      if (!payload || !payload.data || !payload.cachedAt) return null;
      if (Date.now() - payload.cachedAt > 30 * 60 * 1000) return null;
      return payload.data;
    } catch (error) {
      return null;
    }
  }

  function cacheSnowTail(data) {
    try {
      localStorage.setItem('snowTailCache', JSON.stringify({ data, cachedAt: Date.now() }));
    } catch (error) {
      console.warn('Snow tail cache write failed:', error);
    }
  }

  window.RADARB.modules.dwml = {
    loadDwmlMeteogram,
  };
})();
