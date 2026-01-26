//app1597.js
// Configuration
const userLat = 41.48;
const userLng = -81.81;
const AMBIENT_WEATHER_API_URL = 'https://us-central1-radarb.cloudfunctions.net/getAmbientWeatherDatav2';
const PIVOTAL_WEATHER_API_URL = 'https://us-central1-radarb.cloudfunctions.net/grabPivotalHRRR6hQPFv2';
let isFirstRefresh = true;
let sensorDataDisplayed = false;
let cityName = ""; // Declare globally

// Utility Functions
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d;
}

function toRadians(degrees) {
  return degrees * Math.PI / 180;
}

// Event Listeners
window.addEventListener("load", initializeApp);
window.addEventListener("loadCameraData", handleCameraData);
window.addEventListener("loadSensorData", handleSensorData);

// Initialization Function
function initializeApp() {
  const forecastContainer = document.querySelector('.forecast-container');
  forecastContainer.innerHTML = 'Loading forecast...';

  const lat = userLat;
  const lng = userLng;
  const boxsize = 8;
  const latne = lat + boxsize / 69;
  const lngne = lng + boxsize / 53;
  const latsw = lat - boxsize / 69;
  const lngsw = lng - boxsize / 53;

  // Dispatch events to load camera and sensor data
  fetchData(latne, lngne, latsw, lngsw, lat, lng);

  // Fetch DWML hourly meteogram data
  loadDwmlMeteogram(lat, lng);

  // Display meteograms after a short delay
  setTimeout(loadMeteograms, 3000);
}

function fetchData(latne, lngne, latsw, lngsw, lat, lng) {
  // Fetch camera and sensor data in parallel
  window.dispatchEvent(new CustomEvent("loadCameraData", {
    detail: { latne, lngne, latsw, lngsw, lat, lng }
  }));
  window.dispatchEvent(new CustomEvent("loadSensorData", {
    detail: { latne, lngne, latsw, lngsw, lat, lng }
  }));
}

async function handleCameraData(event) {
  const { latne, lngne, latsw, lngsw, lat, lng } = event.detail;
  try {
    const response = await fetch(`https://us-central1-radarb.cloudfunctions.net/getCameraDatav2?latne=${latne}&lngne=${lngne}&latsw=${latsw}&lngsw=${lngsw}`);
    const data = await response.json();
    displayCameraData(data, lat, lng);
  } catch (error) {
    console.error('Error fetching camera data:', error);
  }
}

function displayCameraData(data, userLat, userLng) {
  const cameraDistances = data.results.map(camera => ({
    camera,
    distance: haversine(userLat, userLng, camera.latitude, camera.longitude)
  }));

  cameraDistances.sort((a, b) => a.distance - b.distance);

  const imageGrid = document.querySelector(".image-grid");
  imageGrid.innerHTML = ""; // Clear previous cameras

  cameraDistances.slice(0, 4).forEach(({ camera }) => {
    const div = document.createElement("div");
    const img = document.createElement("img");
    img.src = camera.cameraViews[0].smallUrl;
    img.alt = camera.description;
    img.loading = "lazy";

    const caption = document.createElement("div");
    caption.className = "caption";
    caption.textContent = camera.cameraViews[0].mainRoute.includes("Hilliard")
      ? 'I-90 between Hilliard/Mckinley'
      : camera.cameraViews[0].mainRoute;

    div.appendChild(img);
    div.appendChild(caption);
    imageGrid.appendChild(div);
  });
}

async function handleSensorData(event) {
  const { latne, lngne, latsw, lngsw, lat, lng } = event.detail;
  if (sensorDataDisplayed) return;
  try {
    const response = await fetch(`https://us-central1-radarb.cloudfunctions.net/getSensorDatav2?latne=${latne}&lngne=${lngne}&latsw=${latsw}&lngsw=${lngsw}`);
    const data = await response.json();
    sensorDataDisplayed = true;
    displaySensorData(data, lat, lng);
    updateTime(lat, lng);
  } catch (error) {
    console.error('Error fetching sensor data:', error);
  }
}

function displaySensorData(data, lat, lng) {
  const sensorContainer = document.querySelector(".sensor-container");
  sensorContainer.innerHTML = ""; // Clear previous sensors

  const sensorDistances = data.results.flatMap(result => 
    result.surfaceSensors
      .filter(sensor => sensor.surfaceTemperature !== -9999999.0)
      .map(sensor => ({
        sensor,
        distance: haversine(lat, lng, sensor.latitude, sensor.longitude)
      }))
  );

  sensorDistances.sort((a, b) => a.distance - b.distance);

  sensorDistances.slice(0, 3).forEach(({ sensor }) => {
    const div = document.createElement("div");
    div.className = "sensor-box" + (sensor.status === "Ice Watch" ? " IceWatch" : "");
    div.innerHTML = `${sensor.name.slice(0, -4)}<br>`;
    if (sensor.description) div.innerHTML += `Description: ${sensor.description}<br>`;
    if (sensor.condition) div.innerHTML += `Condition: ${sensor.condition}<br>`;
    div.innerHTML += `Surface temp: ${sensor.surfaceTemperature}<br>Status: ${sensor.status}`;
    sensorContainer.appendChild(div);
  });

  if (data.results.length === 0) {
    const div = document.createElement("div");
    div.className = "sensor-box";
    div.textContent = "No sensor data returned from ODOT";
    sensorContainer.appendChild(div);
  }

  const forecastDiv = document.createElement("div");
  forecastDiv.className = "sensor-box sensor-box--links";
  forecastDiv.innerHTML = `
    <a href='https://forecast.weather.gov/product.php?site=CLE&issuedby=CLE&product=AFD&format=CI&version=1&glossary=1&highlight=off' target='_blank'>Forecast discussion</a><br>
    <a href='https://icyroadsafety.com/lcr/' target='_blank'>Icy Road Forecast</a><br>
    <a href='http://wxmaps.org/pix/clegfs.png' target='_blank'>GFS</a>
    <a href='http://wxmaps.org/pix/clegfsb.png' target='_blank'>GFSLR</a>
    <a href='http://wxmaps.org/pix/clenam.png' target='_blank'>NAM</a>
  `;
  sensorContainer.appendChild(forecastDiv);

  const clocksDiv = document.createElement("div");
  clocksDiv.className = "sensor-box sensor-box--clock";
  clocksDiv.id = "clocks";
  clocksDiv.innerHTML = `
    <div><span id='local-time'>--:--:--</span> ET</div>
    <div><span id='refresh-paused' style='display:none;'>REFRESH PAUSED</span></div>
  `;
  sensorContainer.appendChild(clocksDiv);

  // Event Listener to Resume Refresh
  clocksDiv.addEventListener("click", () => {
    const refreshPaused = document.getElementById("refresh-paused");
    refreshPaused.style.display = "none";
    restartImageRefresh();
  });
}

function loadMeteograms() {
  const meteosDiv = document.querySelector('.meteos');
  const urlb = '&wfo=CLE&zcode=LEZ146&gset=20&gdiff=6&unit=0&tinfo=EY5&pcmd=10111110111110000000000000000000000000000000000000000000000&lg=en&indu=0!1!1!&dd=&bw=&hrspan=48&pqpfhr=6&psnwhr=6';
  const images = [
    { hour: 0, src: `https://marine.weather.gov/meteograms/Plotter.php?lat=${userLat}&lon=${userLng}&ahour=0${urlb}` },
    { hour: 48, src: `https://marine.weather.gov/meteograms/Plotter.php?lat=${userLat}&lon=${userLng}&ahour=48${urlb}` },
    { hour: 96, src: `https://marine.weather.gov/meteograms/Plotter.php?lat=${userLat}&lon=${userLng}&ahour=96${urlb}` },
  ];

  images.forEach(image => {
    const img = document.createElement("img");
    img.src = image.src;
    img.alt = `Meteogram for ${image.hour} hours`;
    img.loading = "lazy";
    meteosDiv.appendChild(img);
  });
}

let dwmlCharts = {};

async function loadDwmlMeteogram(lat, lng) {
  const statusEl = document.getElementById('dwml-status');
  if (!statusEl) return;

  statusEl.textContent = 'Loading...';

  const url = `https://us-central1-radarb.cloudfunctions.net/getDwmlForecastv1?lat=${lat}&lng=${lng}`;
  const snowUrl = `https://us-central1-radarb.cloudfunctions.net/getNdfdSnowv1?lat=${lat}&lng=${lng}`;
  const cachedDwml = loadCachedDwml();

  try {
    if (cachedDwml) {
      renderDwmlPayload(cachedDwml, null);
    }

    const [response, snowResponse] = await Promise.all([
      fetch(url),
      fetch(snowUrl).catch(() => null)
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
    snowResponse.text()
      .then(text => {
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
    'temperature[type="wind chill"]'
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
  const snowSeries = snowDoc ? getFirstDwmlSeries(snowDoc, [
    'precipitation[type="snow"]',
    'snow-amount',
    'snowfall-amount'
  ]) : null;
  const hazards = getDwmlHazards(doc);

  if (!snowSeries) {
    console.info('DWML snow: no series found');
  } else {
    console.info('DWML snow points:', snowSeries.values.filter(value => value !== null).length);
  }

  if (!tempSeries || !tempSeries.times.length) {
    statusEl.textContent = 'No hourly data';
    return;
  }

  const feels = feelsSeries ? feelsSeries.values : tempSeries.values;
  const labels = tempSeries.times.map(formatHourLabel);

  console.info('DWML points:', tempSeries.values.length);

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
    snowAccum: snowSeries ? buildSnowAccumulation(tempSeries.times, snowSeries) : []
  });

  renderDailyForecastFromDwml(dailyMax, dailyMin, iconSeries, tempSeries);

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
  const times = getDwmlTimes(doc, layoutKey);
  const values = Array.from(node.querySelectorAll('value')).map(valueNode => {
    const nil = valueNode.getAttribute('xsi:nil') || valueNode.getAttributeNS('http://www.w3.org/2001/XMLSchema-instance', 'nil');
    if (nil === 'true') return null;
    const val = Number(valueNode.textContent);
    return Number.isFinite(val) ? val : null;
  });

  const length = Math.min(times.length, values.length);
  return {
    times: times.slice(0, length),
    values: values.slice(0, length)
  };
}

function getDwmlWeatherSeries(doc) {
  const weatherNode = doc.querySelector('weather');
  if (!weatherNode) return null;

  const layoutKey = weatherNode.getAttribute('time-layout');
  const times = getDwmlTimes(doc, layoutKey);

  const conditions = Array.from(weatherNode.querySelectorAll('weather-conditions'));
  const length = Math.min(times.length, conditions.length);

  const types = ['snow', 'rain', 'thunder', 'sleet', 'freezing rain'];
  const series = Object.fromEntries(types.map(type => [type, []]));

  for (let i = 0; i < length; i += 1) {
    const condition = conditions[i];
    if (!condition || condition.getAttribute('xsi:nil') === 'true') {
      types.forEach(type => series[type].push(0));
      continue;
    }

    const values = Array.from(condition.querySelectorAll('value'));
    const entries = values.map(value => ({
      type: normalizeWeatherType(value.getAttribute('weather-type') || ''),
      coverage: (value.getAttribute('coverage') || '').toLowerCase()
    }));

    types.forEach(type => {
      const match = entries.find(entry => entry.type === type);
      if (!match) {
        series[type].push(0);
        return;
      }
      series[type].push(coverageToLevel(match.coverage));
    });
  }

  return { times: times.slice(0, length), series };
}

function normalizeWeatherType(type) {
  const normalized = type.toLowerCase();
  if (normalized.includes('thunder')) return 'thunder';
  if (normalized.includes('freezing')) return 'freezing rain';
  return normalized;
}

function coverageToLevel(coverage) {
  if (!coverage) return 4;
  if (coverage.includes('slight')) return 1;
  if (coverage.includes('chance')) return 2;
  if (coverage.includes('likely')) return 3;
  if (coverage.includes('occasional')) return 4;
  return 4;
}

function getDwmlHazards(doc) {
  const hazardsNode = doc.querySelector('hazards');
  if (!hazardsNode) return [];

  const hazardNodes = Array.from(hazardsNode.querySelectorAll('hazard'));
  const seen = new Set();
  const hazards = [];

  hazardNodes.forEach(node => {
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
      url
    });
  });

  return hazards;
}

function renderDwmlHazards(hazards) {
  const hazardsContainer = document.querySelector('.hazards-container');
  const alertsContainer = document.querySelector('.alerts-container');
  if (!hazardsContainer) return;

  hazardsContainer.innerHTML = '';

  if (!hazards || hazards.length === 0) return;

  hazards.forEach(hazard => {
    const title = `${hazard.phenomena} ${hazard.significance}`.trim();
    const hazardDiv = document.createElement('div');
    const significanceClass = hazard.significance ? `hazard-alert--${hazard.significance.toLowerCase()}` : '';
    hazardDiv.className = `hazard-alert ${significanceClass}`.trim();
    hazardDiv.innerHTML = `
      <strong>${title}</strong>
      ${hazard.hazardType ? `<div>${hazard.hazardType}</div>` : ''}
      ${hazard.url ? `<div><a href="${hazard.url}" target="_blank" rel="noopener">Advisory text</a></div>` : ''}
    `;
    hazardsContainer.appendChild(hazardDiv);
  });

  if (alertsContainer) alertsContainer.classList.add('is-active');
}

function getFirstDwmlSeries(doc, selectors) {
  for (const selector of selectors) {
    const series = getDwmlSeries(doc, selector);
    if (series && series.values.some(value => value !== null)) {
      return series;
    }
  }
  return null;
}

function getDwmlTimes(doc, layoutKey) {
  const layouts = Array.from(doc.querySelectorAll('time-layout'));
  const layout = layouts.find(item => {
    const keyNode = item.querySelector('layout-key');
    return keyNode && keyNode.textContent === layoutKey;
  });

  if (!layout) return [];

  return Array.from(layout.querySelectorAll('start-valid-time')).map(node => new Date(node.textContent));
}

function getDwmlIconSeries(doc) {
  const iconNode = doc.querySelector('conditions-icon');
  if (!iconNode) return null;
  const layoutKey = iconNode.getAttribute('time-layout');
  const times = getDwmlTimes(doc, layoutKey);
  const icons = Array.from(iconNode.querySelectorAll('icon-link')).map(node => node.textContent.trim());
  const length = Math.min(times.length, icons.length);
  return {
    times: times.slice(0, length),
    values: icons.slice(0, length)
  };
}

function formatHourLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const hour = date.getHours();
  const meridiem = hour >= 12 ? 'p' : 'a';
  const hour12 = ((hour + 11) % 12) + 1;
  return `${hour12}${meridiem}`;
}

function formatRangeLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function renderDailyForecastFromDwml(dailyMax, dailyMin, iconSeries, hourlyTemp) {
  const forecastContainer = document.querySelector('.forecast-container');
  if (!forecastContainer) return;
  forecastContainer.innerHTML = '';

  const dailyPairs = buildDailyHighLow(dailyMax, dailyMin, hourlyTemp);
  if (!dailyPairs.length) {
    forecastContainer.textContent = 'Forecast unavailable.';
    return;
  }

  const days = Math.min(dailyPairs.length, 5);
  for (let i = 0; i < days; i += 1) {
    const { dayDate, high, low } = dailyPairs[i];
    const dayName = dayDate.toLocaleString('default', { weekday: 'short' });
    const iconUrl = pickIconForDay(dayDate, iconSeries);

    const forecastDiv = document.createElement('div');
    forecastDiv.className = 'forecast';
    forecastDiv.innerHTML = `
      <div class="day">${dayName}</div>
      <div class="weather-icon-div">
        ${iconUrl ? `<img src="${iconUrl}" class="weather-icon" alt="Forecast icon">` : ''}
      </div>
      <div class="high-low">${high}/${low}</div>
    `;
    forecastContainer.appendChild(forecastDiv);
  }
}

function buildDailyHighLow(dailyMax, dailyMin, hourlyTemp) {
  if (dailyMax && dailyMin && dailyMax.times.length && dailyMin.times.length) {
    const count = Math.min(dailyMax.times.length, dailyMin.times.length);
    return Array.from({ length: count }, (_, i) => ({
      dayDate: dailyMax.times[i],
      high: Math.round(dailyMax.values[i]),
      low: Math.round(dailyMin.values[i])
    }));
  }

  if (!hourlyTemp || !hourlyTemp.times || !hourlyTemp.values) return [];
  const daily = new Map();
  hourlyTemp.times.forEach((time, idx) => {
    const value = hourlyTemp.values[idx];
    if (value === null || !Number.isFinite(value)) return;
    const key = time.toDateString();
    if (!daily.has(key)) {
      daily.set(key, { dayDate: new Date(time), high: value, low: value });
      return;
    }
    const entry = daily.get(key);
    entry.high = Math.max(entry.high, value);
    entry.low = Math.min(entry.low, value);
  });

  return Array.from(daily.values());
}

function pickIconForDay(dayDate, iconSeries) {
  if (!iconSeries || !iconSeries.times || !iconSeries.values) return '';
  const targetDate = dayDate.toDateString();
  for (let i = 0; i < iconSeries.times.length; i += 1) {
    const iconTime = iconSeries.times[i];
    if (iconTime.toDateString() === targetDate) {
      return iconSeries.values[i];
    }
  }
  return '';
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
  snowAccum
}) {
  const tempCanvas = document.getElementById('dwml-temp');
  const windCanvas = document.getElementById('dwml-wind');
  const precipCanvas = document.getElementById('dwml-precip');
  const weatherCanvas = document.getElementById('dwml-weather');
  const snowCanvas = document.getElementById('dwml-snow');

  if (!tempCanvas || !windCanvas || !precipCanvas || !weatherCanvas || !snowCanvas) return;

  Object.values(dwmlCharts).forEach(chart => chart.destroy());
  dwmlCharts = {};

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      x: {
        ticks: {
          color: '#9fb0be',
          autoSkip: false,
          callback: function(value, index) {
            return index % 9 === 0 ? this.getLabelForValue(value) : '';
          }
        },
        grid: { color: 'rgba(255, 255, 255, 0.04)' }
      },
      y: {
        ticks: { color: '#9fb0be' },
        grid: { color: 'rgba(255, 255, 255, 0.06)' }
      }
    }
  };

  const feelsMatchesWindChill = isSeriesSimilar(feels, windChill);
  const feelsMatchesHeatIndex = isSeriesSimilar(feels, heatIndex);

  dwmlCharts.temp = new Chart(tempCanvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data: temp,
          borderColor: '#9ad0ff',
          backgroundColor: 'rgba(154, 208, 255, 0.2)',
          pointRadius: 0,
          tension: 0.3,
          fill: true
        },
        {
          data: feels,
          borderColor: '#ffd166',
          pointRadius: 0,
          tension: 0.3,
          borderWidth: 1.6
        },
        {
          data: windChill,
          borderColor: '#7bdff2',
          pointRadius: 0,
          tension: 0.3,
          borderWidth: 1.3,
          hidden: !windChill.length || feelsMatchesWindChill
        },
        {
          data: heatIndex,
          borderColor: '#ff6b6b',
          pointRadius: 0,
          tension: 0.3,
          borderWidth: 1.3,
          hidden: !heatIndex.length || feelsMatchesHeatIndex
        }
      ]
    },
    options: baseOptions
  });

  dwmlCharts.wind = new Chart(windCanvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: wind,
        borderColor: '#26d4a6',
        backgroundColor: 'rgba(38, 212, 166, 0.18)',
        pointRadius: 0,
        tension: 0.25,
        fill: true,
        borderWidth: 1.6
      }, {
        data: gust,
        borderColor: '#b8f2e6',
        pointRadius: 0,
        tension: 0.25,
        borderWidth: 1.2
      }]
    },
    options: baseOptions
  });

  dwmlCharts.precip = new Chart(precipCanvas.getContext('2d'), {
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          data: pop,
          borderColor: '#4cc9f0',
          backgroundColor: 'rgba(76, 201, 240, 0.2)',
          pointRadius: 0,
          tension: 0.3,
          yAxisID: 'y'
        },
        {
          type: 'line',
          data: cloud,
          borderColor: '#a0b3c4',
          backgroundColor: 'rgba(160, 179, 196, 0.15)',
          pointRadius: 0,
          tension: 0.25,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      ...baseOptions,
      scales: {
        x: baseOptions.scales.x,
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { color: '#9fb0be', callback: value => `${value}%` },
          grid: { color: 'rgba(255, 255, 255, 0.06)' }
        },
        y1: {
          display: false
        }
      }
    }
  });

  const weatherLabels = labels;
  const weatherSeries = weather ? weather.series : null;

  dwmlCharts.weather = new Chart(weatherCanvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: weatherLabels,
      datasets: weatherSeries ? [
        {
          label: 'Snow',
          data: weatherSeries['snow'],
          backgroundColor: 'rgba(76, 201, 240, 0.55)'
        },
        {
          label: 'Rain',
          data: weatherSeries['rain'],
          backgroundColor: 'rgba(82, 183, 136, 0.5)'
        },
        {
          label: 'Thunder',
          data: weatherSeries['thunder'],
          backgroundColor: 'rgba(255, 209, 102, 0.6)'
        },
        {
          label: 'Sleet',
          data: weatherSeries['sleet'],
          backgroundColor: 'rgba(180, 162, 230, 0.6)'
        },
        {
          label: 'Freezing Rain',
          data: weatherSeries['freezing rain'],
          backgroundColor: 'rgba(255, 107, 107, 0.55)'
        }
      ] : []
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: '#9fb0be', boxWidth: 10 } },
        tooltip: {
          callbacks: {
            label: context => {
              const value = context.parsed.y;
              const levels = ['None', 'Slight Chance', 'Chance', 'Likely', 'Occasional'];
              return `${context.dataset.label}: ${levels[value] || 'None'}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#9fb0be',
            autoSkip: false,
            callback: function(value, index) {
              return index % 9 === 0 ? this.getLabelForValue(value) : '';
            }
          },
          grid: { color: 'rgba(255, 255, 255, 0.04)' }
        },
        y: {
          beginAtZero: true,
          max: 4,
          ticks: {
            color: '#9fb0be',
            callback: value => ['', 'Slt', 'Chc', 'Lkly', 'Occ'][value] || ''
          },
          grid: { color: 'rgba(255, 255, 255, 0.06)' }
        }
      }
    }
  });

  dwmlCharts.snow = new Chart(snowCanvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: snowAccum,
        borderColor: '#c6e7ff',
        backgroundColor: 'rgba(198, 231, 255, 0.2)',
        pointRadius: 0,
        tension: 0.2,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: {
          ticks: {
            color: '#9fb0be',
            autoSkip: false,
            callback: function(value, index) {
              return index % 9 === 0 ? this.getLabelForValue(value) : '';
            }
          },
          grid: { color: 'rgba(255, 255, 255, 0.04)' }
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#9fb0be' },
          grid: { color: 'rgba(255, 255, 255, 0.06)' }
        }
      }
    }
  });
}

function isSeriesSimilar(a, b) {
  if (!a || !b || !a.length || !b.length) return false;
  const length = Math.min(a.length, b.length);
  let matches = 0;
  let total = 0;
  for (let i = 0; i < length; i += 1) {
    const av = a[i];
    const bv = b[i];
    if (av === null || bv === null) continue;
    total += 1;
    if (Math.abs(av - bv) < 0.5) matches += 1;
  }
  return total > 0 && matches / total > 0.9;
}

function restartImageRefresh() {
  clearInterval(refreshIntervalId);
  refreshIntervalId = setInterval(() => {
    if (document.hidden) return;
    const images = document.querySelectorAll(".image-grid img");
    images.forEach(img => {
      const currentSrc = img.getAttribute("src").split('?')[0];
      img.src = `${currentSrc}?t=${Date.now()}`;
    });
  }, 4250);
}

// Weather Forecast
async function getWeatherForecast(lat, lng) {
  const forecastContainer = document.querySelector('.forecast-container');
  try {
    let data = getCachedWeatherData();
    if (!data) {
      data = await fetchWeatherData(lat, lng);
      cacheWeatherData(data);
    }

    renderWeatherForecast(data);
  } catch (error) {
    forecastContainer.innerHTML = 'Error loading forecast.';
    console.error(error);
  }
}

function getCachedWeatherData() {
  const cachedData = localStorage.getItem('weatherData');
  const cachedDataTime = localStorage.getItem('weatherDataTime');
  const currentTime = Date.now();
  if (cachedData && cachedDataTime && ((currentTime - cachedDataTime) / 1000 / 60 < 1)) {
    return JSON.parse(cachedData);
  }
  localStorage.removeItem('weatherData');
  localStorage.removeItem('weatherDataTime');
  return null;
}

async function fetchWeatherData(lat, lng) {
  const response = await fetch(`https://us-central1-radarb.cloudfunctions.net/getWeatherDatav2?lat=${lat}&lng=${lng}`);
  if (!response.ok) throw new Error('Failed to fetch weather data');
  return await response.json();
}

function cacheWeatherData(data) {
  localStorage.setItem('weatherData', JSON.stringify(data));
  localStorage.setItem('weatherDataTime', Date.now());
}

function renderWeatherForecast(data) {
  const fiveDays = data.daily.slice(0, 5);
  const forecastContainer = document.querySelector('.forecast-container');
  forecastContainer.innerHTML = ''; // Clear loading message

  fiveDays.forEach(day => {
    const { dt, temp, weather } = day;
    const dayName = new Date(dt * 1000).toLocaleString('default', { weekday: 'short' });
    const high = temp.max.toFixed(0);
    const low = temp.min.toFixed(0);
    const iconCode = weather[0].icon;
    const iconUrl = `images/${iconCode}.png`;

    const forecastDiv = document.createElement("div");
    forecastDiv.className = "forecast";
    forecastDiv.innerHTML = `
      <div class="day">${dayName}</div>
      <div class="weather-icon-div"><img src="${iconUrl}" class="weather-icon" alt="Weather icon"></div>
      <div class="high-low">${high}/${low}</div>
    `;
    forecastContainer.appendChild(forecastDiv);
  });
}

// Meteogram Animation (Optional and Suspended for now)
/* 
function animateDynamicImages() {
  const baseUrl = 'https://x-hv1.pivotalweather.com/maps/rtma_ru/latest/series_';
  const imageExtension = '.png';
  const numImages = 36;
  const animationContainer = document.getElementById('animationContainer');
  let currentIndex = 0;

  function updateAnimationContainer() {
    const imageUrl = `${baseUrl}${String(currentIndex).padStart(3, '0')}/sfct-imp.us_state_oh${imageExtension}`;
    animationContainer.style.backgroundImage = `url(${imageUrl})`;
    currentIndex = (currentIndex + 1) % numImages;
  }

  setInterval(updateAnimationContainer, 1000);
}
*/

// Image Refresh
let refreshIntervalId = setInterval(restartImageRefresh, 4250);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInterval(refreshIntervalId);
    return;
  }
  restartImageRefresh();
});

// Function to fetch and update current weather
async function fetchWeatherDataFromStation() {
  try {
    const response = await fetch(AMBIENT_WEATHER_API_URL);
    if (!response.ok) throw new Error('Network response was not ok');
    const weatherData = await response.json();
    return weatherData[0].lastData;
  } catch (error) {
    console.error('Error fetching weather data from station:', error);
    throw error;
  }
}

async function updateCurrentWeather() {
  try {
    const currentWeather = await fetchWeatherDataFromStation();
    updateWeatherElements(currentWeather);
    lastRefreshTimestamp = Date.now();
    updateRefreshTimer();
  } catch (error) {
    console.error('Error updating current weather:', error);
  }
}

function updateWeatherElements(data) {
  const {
    tempf,
    feelsLike,
    humidity,
    windspeedmph,
    windgustmph,
    uv,
    winddir
  } = data;

  document.getElementById("current-temperature").textContent = `${tempf.toFixed(1)}°`;
  document.getElementById("feelslike-temperature").textContent = `Feels like ${feelsLike.toFixed(1)}°`;
  document.getElementById("humidity").textContent = `${humidity}%`;
  document.getElementById("wind").textContent = `${Math.round(windspeedmph)} mph`;
  document.getElementById("windgusts").textContent = `Gusts to ${Math.round(windgustmph)} mph`;
  document.getElementById("uv").textContent = `${Math.round(uv)}`;

  const windArrow = document.getElementById('windArrow');
  if (windArrow) {
    windArrow.style.transform = `translateX(-50%) rotate(${winddir}deg)`;
  }
}

document.querySelectorAll('div.last-refresh').forEach(div => {
  div.addEventListener('click', updateCurrentWeather);
});

// Initial Weather Update
updateCurrentWeather();

// Periodic refreshes (avoid full page reloads)
setInterval(updateCurrentWeather, 5 * 60 * 1000);
setInterval(() => loadDwmlMeteogram(userLat, userLng), 30 * 60 * 1000);
setInterval(() => checkFlightDelays('KCLE'), 15 * 60 * 1000);

// Refresh Timer
let lastRefreshTimestamp = Date.now();

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

function updateRefreshTimer() {
  const currentTime = Date.now();
  const elapsedSeconds = Math.floor((currentTime - lastRefreshTimestamp) / 1000);
  const timerElement = document.getElementById("refresh-timer");
  const timerContainer = document.querySelector(".weather-refresh");

  if (timerElement) {
    if (isFirstRefresh) {
      isFirstRefresh = false;
      timerContainer.style.display = "block";
    }

    timerElement.textContent = formatTime(elapsedSeconds);
  }
}

setInterval(updateRefreshTimer, 1000);

// Update Local Time and Fetch City Name
async function updateTime(lat, lng) {
  const localTime = new Date().toLocaleString("en-US", {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  document.getElementById("local-time").textContent = localTime;

  setInterval(() => {
    const localTime = new Date().toLocaleString("en-US", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    document.getElementById("local-time").textContent = localTime;
  }, 1000);

  // Fetch and display city name
  // if (!cityName) {
  //   try {
  //     const response = await fetchCityName(lat, lng);
  //     displayCityName(response, lat, lng);
  //   } catch (error) {
  //     console.error('Error fetching city name:', error);
  //   }
  // }
}

async function fetchCityName(lat, lng) {
  const url = `https://us-central1-radarb.cloudfunctions.net/getCityNamev2?lat=${lat}&lng=${lng}`;
  const cache = await caches.open("my-cache");
  const cachedResponse = await cache.match(url);
  if (cachedResponse) return await cachedResponse.json();
  
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch city name');
  return await response.json();
}

function displayCityName(data, lat, lng) {
  const youAreHereSpan = document.getElementById("you-are-here");
  if (!youAreHereSpan) return;
  const formattedAddress = data.address;
  const premiseType = data.premiseType;

  youAreHereSpan.innerHTML += `Found you at: <a href="https://ohgo.com/cleveland?lt=${lat}&ln=${lng}&z=13&ls=incident,incident-waze,dangerous-slowdown,camera,delay,weather,weather-roadsensors,sign" target="_blank">${formattedAddress}</a> - ${premiseType}<br><br>`;
}

window.dispatchEvent(new Event("updateTime"));

// Fetch Flight Delays and Ground Stops
window.addEventListener("load", () => {
  checkFlightDelays('KCLE');
  // Ground stops code is commented out as per original
});

function checkFlightDelays(airportCode) {
  fetch(`https://us-central1-radarb.cloudfunctions.net/getFlightDelaysv2?airportCode=${airportCode}`)
    .then(response => response.text())
    .then(data => {
      if (data.length > 0) {
        const airportDelays = document.querySelector(".airportDelays");
        const delaysContainer = document.querySelector('.delays-container');
        const alertsContainer = document.querySelector('.alerts-container');
        airportDelays.textContent += `✈ ${data}`;
        delaysContainer.style.display = 'block';
        if (alertsContainer) alertsContainer.classList.add('is-active');
      }
    })
    .catch(error => console.error('Error fetching flight delays:', error));
}
let duskChart = null;

async function renderDuskChart() {
  const res = await fetch('https://firestore.googleapis.com/v1/projects/radarb/databases/(default)/documents/duskLog');
  const data = await res.json();

  if (!data.documents) return;

  const labels = [];
  const duskHours = [];

  data.documents.forEach(doc => {
    const date = doc.name.split('/').pop();
    const duskStr = doc.fields.dusk.stringValue;

    const [hour, minute] = duskStr.split(':').map(n => parseInt(n, 10));
    const decimalHour = hour + minute / 60;

    labels.push(date);
    duskHours.push(decimalHour);
  });

  const ctx = document.getElementById('duskChart').getContext('2d');

  if (duskChart) {
    duskChart.destroy();
  }

  duskChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Civil Twilight End',
        data: duskHours,
        fill: false,
        borderColor: '#4bc0c0',
        tension: 0.2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.parsed.y;
              const hours = Math.floor(val);
              const minutes = Math.round((val - hours) * 60);
              const labelTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
              return `Civil Twilight End: ${labelTime}`;
            }
          }
        },
        title: {
          display: true,
          text: 'Dusk Time Progression (EST)'
        }
      },
      scales: {
        y: {
          title: {
            display: true,
            text: 'Hour of Day'
          },
          min: 16,
          max: 22
        }
      }
    }
  });
}

// Auto-render once page loads
window.addEventListener('load', () => {
  setTimeout(() => {
    renderDuskChart();
  }, 100);
});
