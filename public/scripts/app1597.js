//app1597.js
// Configuration
const RADARB_CONFIG = window.RADARB_CONFIG;
if (!RADARB_CONFIG) {
  throw new Error('RADARB_CONFIG is missing. Ensure scripts/config.js loads first.');
}
const { userLat, userLng, endpoints } = RADARB_CONFIG;
const AMBIENT_WEATHER_API_URL = endpoints.ambientWeatherUrl;
let isFirstRefresh = true;
let sensorDataDisplayed = false;
let twilightTimes = null;
let currentAmbientSnapshot = null;

// Utility Functions
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d;
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', initializeApp);
window.addEventListener('loadCameraData', handleCameraData);
window.addEventListener('loadSensorData', handleSensorData);

// Initialization Function
function initializeApp() {
  const forecastContainer = document.querySelector('.forecast-container');
  forecastContainer.innerHTML = 'Loading forecast...';
  loadCachedForecast();

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
  loadTwilightTimes(lat, lng);

  // Display meteograms after a short delay
  setTimeout(loadMeteograms, 3000);

  setInterval(() => {
    if (twilightTimes) updateSunTrack(twilightTimes.dawn, twilightTimes.dusk);
  }, 60000);

  deferMediaLoad();

  loadClosings();
  loadIncidents(latne, lngne, latsw, lngsw);
}

function fetchData(latne, lngne, latsw, lngsw, lat, lng) {
  // Fetch camera and sensor data in parallel
  window.dispatchEvent(
    new CustomEvent('loadCameraData', {
      detail: { latne, lngne, latsw, lngsw, lat, lng },
    })
  );
  window.dispatchEvent(
    new CustomEvent('loadSensorData', {
      detail: { latne, lngne, latsw, lngsw, lat, lng },
    })
  );
}

async function handleCameraData(event) {
  const { latne, lngne, latsw, lngsw, lat, lng } = event.detail;
  try {
    const response = await fetch(
      `https://us-central1-radarb.cloudfunctions.net/getCameraDatav2?latne=${latne}&lngne=${lngne}&latsw=${latsw}&lngsw=${lngsw}`
    );
    const data = await response.json();
    displayCameraData(data, lat, lng);
  } catch (error) {
    console.error('Error fetching camera data:', error);
  }
}

function displayCameraData(data, userLat, userLng) {
  const cameraDistances = data.results.map((camera) => ({
    camera,
    distance: haversine(userLat, userLng, camera.latitude, camera.longitude),
  }));

  cameraDistances.sort((a, b) => a.distance - b.distance);

  const imageGrid = document.querySelector('.image-grid');
  imageGrid.innerHTML = ''; // Clear previous cameras

  cameraDistances.slice(0, 4).forEach(({ camera }) => {
    const div = document.createElement('div');
    const img = document.createElement('img');
    img.classList.add('camera-refresh');
    img.src = camera.cameraViews[0].smallUrl;
    img.alt = camera.description;
    img.loading = 'lazy';

    const caption = document.createElement('div');
    caption.className = 'caption';
    caption.textContent = camera.cameraViews[0].mainRoute.includes('Hilliard')
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
    const response = await fetch(
      `https://us-central1-radarb.cloudfunctions.net/getSensorDatav2?latne=${latne}&lngne=${lngne}&latsw=${latsw}&lngsw=${lngsw}`
    );
    const data = await response.json();
    sensorDataDisplayed = true;
    displaySensorData(data, lat, lng);
    updateTime(lat, lng);
  } catch (error) {
    console.error('Error fetching sensor data:', error);
  }
}

function displaySensorData(data, lat, lng) {
  const sensorContainer = document.querySelector('.sensor-container');
  sensorContainer.innerHTML = ''; // Clear previous sensors

  const sensorDistances = data.results.flatMap((result) =>
    result.surfaceSensors
      .filter((sensor) => sensor.surfaceTemperature !== -9999999.0)
      .map((sensor) => ({
        sensor,
        distance: haversine(lat, lng, sensor.latitude, sensor.longitude),
      }))
  );

  sensorDistances.sort((a, b) => a.distance - b.distance);

  sensorDistances.slice(0, 3).forEach(({ sensor }) => {
    const div = document.createElement('div');
    div.className = 'sensor-box' + (sensor.status === 'Ice Watch' ? ' IceWatch' : '');
    div.innerHTML = `${sensor.name.slice(0, -4)}<br>`;
    if (sensor.description) div.innerHTML += `Description: ${sensor.description}<br>`;
    if (sensor.condition) div.innerHTML += `Condition: ${sensor.condition}<br>`;
    div.innerHTML += `Surface temp: ${sensor.surfaceTemperature}<br>Status: ${sensor.status}`;
    sensorContainer.appendChild(div);
  });

  if (data.results.length === 0) {
    const div = document.createElement('div');
    div.className = 'sensor-box';
    div.textContent = 'No sensor data returned from ODOT';
    sensorContainer.appendChild(div);
  }

  const forecastDiv = document.createElement('div');
  forecastDiv.className = 'sensor-box sensor-box--links';
  forecastDiv.innerHTML = `
    <a href='https://forecast.weather.gov/product.php?site=CLE&issuedby=CLE&product=AFD&format=CI&version=1&glossary=1&highlight=off' target='_blank'>Forecast discussion</a><br>
    <a href='https://icyroadsafety.com/lcr/' target='_blank'>Icy Road Forecast</a><br>
    <a href='http://wxmaps.org/pix/clegfs.png' target='_blank'>GFS</a>
    <a href='http://wxmaps.org/pix/clegfsb.png' target='_blank'>GFSLR</a>
    <a href='http://wxmaps.org/pix/clenam.png' target='_blank'>NAM</a>
  `;
  sensorContainer.appendChild(forecastDiv);

  const clocksDiv = document.createElement('div');
  clocksDiv.className = 'sensor-box sensor-box--clock';
  clocksDiv.id = 'clocks';
  clocksDiv.innerHTML = `
    <div><span id='local-time'>--:--:--</span> ET</div>
    <div>Last refresh <span id="refresh-timer">0:00</span></div>
    <div><span id='refresh-paused' style='display:none;'>REFRESH PAUSED</span></div>
  `;
  sensorContainer.appendChild(clocksDiv);
  sensorContainer.classList.remove('panel-loading');

  // Event Listener to Resume Refresh
  clocksDiv.addEventListener('click', () => {
    const refreshPaused = document.getElementById('refresh-paused');
    refreshPaused.style.display = 'none';
    startImageRefreshers();
  });
}

function loadMeteograms() {
  const meteosDiv = document.querySelector('.meteos');
  const urlb =
    '&wfo=CLE&zcode=LEZ146&gset=20&gdiff=6&unit=0&tinfo=EY5&pcmd=10111110111110000000000000000000000000000000000000000000000&lg=en&indu=0!1!1!&dd=&bw=&hrspan=48&pqpfhr=6&psnwhr=6';
  const images = [
    {
      hour: 0,
      src: `https://marine.weather.gov/meteograms/Plotter.php?lat=${userLat}&lon=${userLng}&ahour=0${urlb}`,
    },
    {
      hour: 48,
      src: `https://marine.weather.gov/meteograms/Plotter.php?lat=${userLat}&lon=${userLng}&ahour=48${urlb}`,
    },
    {
      hour: 96,
      src: `https://marine.weather.gov/meteograms/Plotter.php?lat=${userLat}&lon=${userLng}&ahour=96${urlb}`,
    },
  ];

  images.forEach((image) => {
    const img = document.createElement('img');
    img.src = image.src;
    img.alt = `Meteogram for ${image.hour} hours`;
    img.loading = 'lazy';
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
      fetch(snowUrl).catch(() => null),
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

async function loadTwilightTimes(lat, lng) {
  const dawnEl = document.getElementById('dawn-time');
  const duskEl = document.getElementById('dusk-time');

  const cached = getCachedTwilightTimes();
  if (cached) {
    applyTwilightTimes(cached, dawnEl, duskEl);
    return;
  }

  try {
    const url = `https://us-central1-radarb.cloudfunctions.net/getTwilightTimesv1?lat=${lat}&lng=${lng}&tz=America/New_York`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch twilight times');
    const data = await response.json();
    cacheTwilightTimes(data);
    applyTwilightTimes(data, dawnEl, duskEl);
  } catch (error) {
    console.error('Error fetching twilight times:', error);
    dawnEl.textContent = 'Dawn unavailable';
    duskEl.textContent = 'Dusk unavailable';
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

  const sunriseLabel = document.getElementById('sunrise-label');
  const sunsetLabel = document.getElementById('sunset-label');
  if (sunriseLabel) sunriseLabel.textContent = `Dawn ${dawn}`;
  if (sunsetLabel) sunsetLabel.textContent = `Dusk ${dusk}`;
  updateSunTrack(dawn, dusk, sunrise, sunset);
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
  const sunriseRatio = sunriseDate ? (sunriseDate.getTime() - dayStart.getTime()) / dayTotal : null;
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
    ? getFirstDwmlSeries(snowDoc, ['precipitation[type="snow"]', 'snow-amount', 'snowfall-amount'])
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
    snowAccum: snowSeries ? buildSnowAccumulation(tempSeries.times, snowSeries) : [],
  });

  if (cloudSeries) {
    latestCloudSeries = cloudSeries;
    updateSunTrackSky(cloudSeries);
  }

  renderDailyForecastFromDwml(dailyMax, dailyMin, iconSeries, tempSeries);

  renderDwmlHazards(hazards);

  const start = tempSeries.times[0];
  const end = tempSeries.times[tempSeries.times.length - 1];
  statusEl.textContent = `${formatRangeLabel(start)} to ${formatRangeLabel(end)}`;
}

let latestCloudSeries = null;
const SUN_TRACK_MODE = 'discrete'; // 'discrete' | 'smooth'

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
        base = mixColors([6, 8, 12], [24, 28, 34], cloudiness * 0.4);
      } else if (dusk && hourStart.getTime() >= dusk.getTime()) {
        base = mixColors([6, 8, 12], [24, 28, 34], cloudiness * 0.4);
      } else if (dawn && sunrise && midpoint >= dawn && midpoint < sunrise) {
        base = mixColors([130, 88, 165], [120, 128, 140], cloudiness);
      } else if (sunrise && sunset && midpoint >= sunrise && midpoint <= sunset) {
        base = mixColors([92, 170, 255], [125, 136, 145], cloudiness);
      } else if (sunset && dusk && midpoint > sunset && midpoint <= dusk) {
        base = mixColors([122, 72, 150], [120, 128, 140], cloudiness);
      } else {
        base = mixColors([6, 8, 12], [24, 28, 34], cloudiness * 0.4);
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
  const nightEnd = Math.max(lastValid !== null ? lastValid : 0, duskRatio !== null ? duskRatio : 0);
  if (nightEnd < 1) {
    segments.push(`rgb(6, 8, 12) ${(nightEnd * 100).toFixed(2)}%`, `rgb(6, 8, 12) 100%`);
  }
  bar.style.backgroundImage = `linear-gradient(90deg, ${segments.join(', ')})`;
}

function mixColors(start, end, ratio) {
  return start.map((channel, index) => Math.round(channel + (end[index] - channel) * ratio));
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

  const types = ['snow', 'rain', 'thunder', 'sleet', 'freezing rain'];
  const series = Object.fromEntries(types.map((type) => [type, []]));

  for (let i = 0; i < length; i += 1) {
    const condition = conditions[i];
    if (!condition || condition.getAttribute('xsi:nil') === 'true') {
      types.forEach((type) => series[type].push(0));
      continue;
    }

    const values = Array.from(condition.querySelectorAll('value'));
    const entries = values.map((value) => ({
      type: normalizeWeatherType(value.getAttribute('weather-type') || ''),
      coverage: (value.getAttribute('coverage') || '').toLowerCase(),
    }));

    types.forEach((type) => {
      const match = entries.find((entry) => entry.type === type);
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

  hazardsContainer.innerHTML = '';

  if (!hazards || hazards.length === 0) {
    updateAlertsVisibility();
    return;
  }

  hazards.forEach((hazard) => {
    const title = `${hazard.phenomena} ${hazard.significance}`.trim();
    const hazardDiv = document.createElement('div');
    const significanceClass = hazard.significance
      ? `hazard-alert--${hazard.significance.toLowerCase()}`
      : '';
    hazardDiv.className = `hazard-alert ${significanceClass}`.trim();
    hazardDiv.innerHTML = `
      <strong>${title}</strong>
      ${hazard.hazardType ? `<div>${hazard.hazardType}</div>` : ''}
      ${hazard.url ? `<div><a href="${hazard.url}" target="_blank" rel="noopener">Advisory text</a></div>` : ''}
    `;
    hazardsContainer.appendChild(hazardDiv);
  });

  if (alertsContainer) alertsContainer.classList.add('is-active');
  updateAlertsVisibility();
}

function updateAlertsVisibility() {
  const alertsContainer = document.querySelector('.alerts-container');
  if (!alertsContainer) return;
  const hasDelay = Boolean(document.querySelector('.airportDelays')?.textContent.trim());
  const hasGround = Boolean(document.querySelector('.ground-stops')?.textContent.trim());
  const hasCrosswind = Boolean(document.querySelector('.crosswindAlert')?.textContent.trim());
  const hasHazards = Boolean(document.querySelector('.hazards-container')?.children.length);
  const hasClosings = Boolean(document.querySelector('.closures-container')?.textContent.trim());
  const hasIncidents = Boolean(document.querySelector('.incidents-container')?.textContent.trim());

  if (hasDelay || hasGround || hasCrosswind || hasHazards || hasClosings || hasIncidents) {
    alertsContainer.classList.add('is-active');
  } else {
    alertsContainer.classList.remove('is-active');
  }
}

function getFirstDwmlSeries(doc, selectors) {
  for (const selector of selectors) {
    const series = getDwmlSeries(doc, selector);
    if (series && series.values.some((value) => value !== null)) {
      return series;
    }
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

function renderDailyForecastFromDwml(dailyMax, dailyMin, iconSeries, hourlyTemp) {
  const forecastContainer = document.querySelector('.forecast-container');
  if (!forecastContainer) return;
  forecastContainer.innerHTML = '';

  const dailyPairs = buildDailyHighLow(dailyMax, dailyMin, hourlyTemp);
  if (!dailyPairs.length) {
    forecastContainer.textContent = 'Forecast unavailable.';
    cacheForecast('');
    return;
  }

  const currentCard = document.createElement('div');
  currentCard.className = 'forecast forecast-current';
  currentCard.innerHTML = `
    <div class="day">Today</div>
    <div class="forecast-current-temp" id="forecast-now-temp">--°</div>
    <div class="forecast-current-feels" id="forecast-now-feels">Feels --°</div>
    <div class="forecast-current-hilo" id="forecast-now-hilo">High -- / Low --</div>
    <div class="forecast-current-wind" id="forecast-now-wind">Wind -- • Gust -- • Max --</div>
  `;
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
    forecastDiv.innerHTML = `
      <div class="day">${dayName}</div>
      <div class="weather-icon-div">
        ${iconUrl ? `<img src="${iconUrl}" class="weather-icon" alt="Forecast icon">` : ''}
      </div>
      <div class="high-low">${high}/${low}</div>
    `;
    forecastContainer.appendChild(forecastDiv);
  }

  cacheForecast(forecastContainer.innerHTML);
  forecastContainer.classList.remove('panel-loading');
}

function cacheForecast(html) {
  try {
    localStorage.setItem('forecastHtml', html || '');
    localStorage.setItem('forecastHtmlTime', Date.now().toString());
  } catch (error) {
    console.warn('Forecast cache write failed:', error);
  }
}

function loadCachedForecast() {
  try {
    const cached = localStorage.getItem('forecastHtml');
    const container = document.querySelector('.forecast-container');
    if (!container || !cached) return;
    container.innerHTML = cached;
    container.classList.remove('panel-loading');
  } catch (error) {
    console.warn('Forecast cache read failed:', error);
  }
}

function deferMediaLoad() {
  const run = () => {
    const placeholders = document.querySelectorAll('.defer-media[data-src]');
    if (!placeholders.length) {
      startImageRefreshers();
      return;
    }
    placeholders.forEach((img) => {
      img.setAttribute('src', img.getAttribute('data-src'));
      img.removeAttribute('data-src');
      img.addEventListener(
        'load',
        () => {
          const panel = img.closest('.panel-loading');
          if (panel) {
            const pending = panel.querySelectorAll('.defer-media[data-src]').length;
            if (pending === 0) panel.classList.remove('panel-loading');
          }
        },
        { once: true }
      );
    });
    startImageRefreshers();
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(run, { timeout: 1500 });
  } else {
    setTimeout(run, 800);
  }
}

function loadClosings() {
  const container = document.querySelector('.closures-container');
  if (!container) return;

  if (!isClosingsSeason()) {
    container.classList.remove('is-active');
    updateAlertsVisibility();
    return;
  }

  const cached = getCachedClosings();
  if (cached) {
    renderClosings(cached, container);
  }

  fetch('https://us-central1-radarb.cloudfunctions.net/getSchoolClosingsv1')
    .then((response) => {
      if (response.status === 204) return null;
      return response.json();
    })
    .then((data) => {
      if (!data) return;
      cacheClosings(data);
      renderClosings(data, container);
    })
    .catch((error) => console.error('Error fetching closings:', error));
}

function renderClosings(data, container) {
  if (!data || !container || !data.match) {
    container.innerHTML = '';
    container.classList.remove('is-active');
    updateAlertsVisibility();
    return;
  }
  if (!isClosureStatus(data.match.status)) {
    container.innerHTML = '';
    container.classList.remove('is-active');
    updateAlertsVisibility();
    return;
  }
  container.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'closure-title';
  title.textContent = 'School Closings';
  container.appendChild(title);

  const status = document.createElement('div');
  status.className = 'closure-status';
  status.textContent = `${data.match.name}: ${data.match.status}`;
  container.appendChild(status);

  container.classList.add('is-active');
  updateAlertsVisibility();
}

function cacheClosings(data) {
  try {
    localStorage.setItem('closingsCache', JSON.stringify({ data, cachedAt: Date.now() }));
  } catch (error) {
    console.warn('Closings cache write failed:', error);
  }
}

function getCachedClosings() {
  try {
    const raw = localStorage.getItem('closingsCache');
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload || !payload.data) return null;
    if (Date.now() - payload.cachedAt > 10 * 60 * 1000) return null;
    return payload.data;
  } catch (error) {
    return null;
  }
}

function isClosureStatus(status) {
  const normalized = String(status || '').toLowerCase();
  return (
    normalized.includes('closed') || normalized.includes('virtual') || normalized.includes('remote')
  );
}

function isClosingsSeason() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const month = Number(parts.find((part) => part.type === 'month')?.value || 0);
  const day = Number(parts.find((part) => part.type === 'day')?.value || 0);
  const isBetweenApr15AndDec1 =
    (month > 4 || (month === 4 && day >= 15)) && (month < 12 || (month === 12 && day <= 1));
  return !isBetweenApr15AndDec1;
}

function loadIncidents(latne, lngne, latsw, lngsw) {
  const container = document.querySelector('.incidents-container');
  if (!container) return;

  const cached = getCachedIncidents();
  if (cached) {
    renderIncidents(cached, container);
  }

  const url = `https://us-central1-radarb.cloudfunctions.net/getOhgoIncidentsv1?latne=${latne}&lngne=${lngne}&latsw=${latsw}&lngsw=${lngsw}`;
  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      cacheIncidents(data);
      renderIncidents(data, container);
    })
    .catch((error) => console.error('Error fetching incidents:', error));
}

function renderIncidents(data, container) {
  if (!data || !container) return;
  const incidents = Array.isArray(data.results) ? data.results : data.incidents || [];
  if (!incidents.length) {
    container.innerHTML = '';
    container.classList.remove('is-active');
    updateAlertsVisibility();
    return;
  }

  const items = incidents.slice(0, 6);
  container.innerHTML = `<div class="closure-title">Traffic Incidents</div>`;
  items.forEach((item) => {
    const line = document.createElement('div');
    line.className = 'incident-item';
    const title = item.title || item.description || item.type || 'Incident';
    const roadway = item.roadway || item.route || '';
    const source = item.source || item.reportSource || '';
    line.textContent = [title, roadway, source].filter(Boolean).join(' • ');
    container.appendChild(line);
  });

  container.classList.add('is-active');
  updateAlertsVisibility();
}

function cacheIncidents(data) {
  try {
    localStorage.setItem('incidentsCache', JSON.stringify({ data, cachedAt: Date.now() }));
  } catch (error) {
    console.warn('Incidents cache write failed:', error);
  }
}

function getCachedIncidents() {
  try {
    const raw = localStorage.getItem('incidentsCache');
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload || !payload.data) return null;
    if (Date.now() - payload.cachedAt > 5 * 60 * 1000) return null;
    return payload.data;
  } catch (error) {
    return null;
  }
}

function buildDailyHighLow(dailyMax, dailyMin, hourlyTemp) {
  if (dailyMax && dailyMin && dailyMax.times.length && dailyMin.times.length) {
    const count = Math.min(dailyMax.times.length, dailyMin.times.length);
    return Array.from({ length: count }, (_, i) => ({
      dayDate: dailyMax.times[i],
      high: Math.round(dailyMax.values[i]),
      low: Math.round(dailyMin.values[i]),
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

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { left: 6, right: 6, top: 6, bottom: 10 },
    },
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false },
    },
    scales: {
      x: {
        ticks: {
          color: '#9fb0be',
          autoSkip: false,
          callback: function (value, index) {
            return index % 9 === 0 ? this.getLabelForValue(value) : '';
          },
        },
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      y: {
        ticks: { color: '#9fb0be' },
        grid: { color: 'rgba(255, 255, 255, 0.06)' },
      },
    },
  };

  const feelsMatchesWindChill = isSeriesSimilar(feels, windChill);
  const feelsMatchesHeatIndex = isSeriesSimilar(feels, heatIndex);
  const freezingLinePlugin = {
    id: 'freezingLine',
    afterDraw: (chart) => {
      const yScale = chart.scales.y;
      if (!yScale) return;
      const y = yScale.getPixelForValue(32);
      const { left, right } = chart.chartArea;
      const ctx = chart.ctx;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '11px sans-serif';
      ctx.fillText('32°F', left + 6, y - 6);
      ctx.restore();
    },
  };

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
          fill: true,
        },
        {
          data: feels,
          borderColor: '#ffd166',
          pointRadius: 0,
          tension: 0.3,
          borderWidth: 1.6,
        },
        {
          data: windChill,
          borderColor: '#7bdff2',
          pointRadius: 0,
          tension: 0.3,
          borderWidth: 1.3,
          hidden: !windChill.length || feelsMatchesWindChill,
        },
        {
          data: heatIndex,
          borderColor: '#ff6b6b',
          pointRadius: 0,
          tension: 0.3,
          borderWidth: 1.3,
          hidden: !heatIndex.length || feelsMatchesHeatIndex,
        },
      ],
    },
    options: baseOptions,
    plugins: [freezingLinePlugin],
  });

  dwmlCharts.wind = new Chart(windCanvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data: wind,
          borderColor: '#26d4a6',
          backgroundColor: 'rgba(38, 212, 166, 0.18)',
          pointRadius: 0,
          tension: 0.25,
          fill: true,
          borderWidth: 1.6,
        },
        {
          data: gust,
          borderColor: '#b8f2e6',
          pointRadius: 0,
          tension: 0.25,
          borderWidth: 1.2,
        },
      ],
    },
    options: baseOptions,
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
          yAxisID: 'y',
          order: 2,
        },
        {
          type: 'line',
          data: cloud,
          borderColor: '#a0b3c4',
          backgroundColor: 'rgba(160, 179, 196, 0.35)',
          pointRadius: 0,
          tension: 0.25,
          yAxisID: 'y',
          fill: true,
          order: 1,
        },
      ],
    },
    plugins: [
      {
        id: 'cloudCoverBackground',
        beforeDraw: (chart) => {
          const { ctx, chartArea } = chart;
          if (!chartArea) return;
          ctx.save();
          ctx.fillStyle = 'rgba(70, 120, 175, 0.15)';
          ctx.fillRect(
            chartArea.left,
            chartArea.top,
            chartArea.right - chartArea.left,
            chartArea.bottom - chartArea.top
          );
          ctx.restore();
        },
      },
    ],
    options: {
      ...baseOptions,
      scales: {
        x: baseOptions.scales.x,
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { color: '#9fb0be', callback: (value) => `${value}%` },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
        },
        y1: {
          display: false,
        },
      },
    },
  });

  const weatherLabels = labels;
  const weatherSeries = weather ? weather.series : null;

  dwmlCharts.weather = new Chart(weatherCanvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: weatherLabels,
      datasets: weatherSeries
        ? [
            {
              label: 'Snow',
              data: weatherSeries['snow'],
              backgroundColor: 'rgba(76, 201, 240, 0.55)',
            },
            {
              label: 'Rain',
              data: weatherSeries['rain'],
              backgroundColor: 'rgba(82, 183, 136, 0.5)',
            },
            {
              label: 'Thunder',
              data: weatherSeries['thunder'],
              backgroundColor: 'rgba(255, 209, 102, 0.6)',
            },
            {
              label: 'Sleet',
              data: weatherSeries['sleet'],
              backgroundColor: 'rgba(180, 162, 230, 0.6)',
            },
            {
              label: 'Freezing Rain',
              data: weatherSeries['freezing rain'],
              backgroundColor: 'rgba(255, 107, 107, 0.55)',
            },
          ]
        : [],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { left: 6, right: 6, top: 6, bottom: 10 },
      },
      plugins: {
        legend: { display: true, labels: { color: '#9fb0be', boxWidth: 10 } },
        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.parsed.y;
              const levels = ['None', 'Slight Chance', 'Chance', 'Likely', 'Occasional'];
              return `${context.dataset.label}: ${levels[value] || 'None'}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#9fb0be',
            autoSkip: false,
            callback: function (value, index) {
              return index % 9 === 0 ? this.getLabelForValue(value) : '';
            },
          },
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
        },
        y: {
          beginAtZero: true,
          max: 4,
          ticks: {
            color: '#9fb0be',
            callback: (value) => ['', 'Slt', 'Chc', 'Lkly', 'Occ'][value] || '',
          },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
        },
      },
    },
  });

  dwmlCharts.snow = new Chart(snowCanvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          data: snowAccum,
          borderColor: '#c6e7ff',
          backgroundColor: 'rgba(198, 231, 255, 0.2)',
          pointRadius: 0,
          tension: 0.2,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { left: 6, right: 6, top: 6, bottom: 10 },
      },
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        x: {
          ticks: {
            color: '#9fb0be',
            autoSkip: false,
            callback: function (value, index) {
              return index % 9 === 0 ? this.getLabelForValue(value) : '';
            },
          },
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#9fb0be' },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
        },
      },
    },
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

function refreshImagesWithClass(className) {
  const images = document.querySelectorAll(`img.${className}`);
  images.forEach((img) => {
    const currentSrc = img.getAttribute('src');
    const cleanedSrc = currentSrc
      ? currentSrc.replace(/([?&])t=\d+(&?)/, (match, sep, trailing) => (trailing ? sep : ''))
      : null;
    const baseSrc = img.dataset.baseSrc || cleanedSrc;
    if (!baseSrc) return;
    img.dataset.baseSrc = baseSrc;
    img.src = `${baseSrc}?t=${Date.now()}`;
  });
}

function refreshCameraImages() {
  refreshImagesWithClass('camera-refresh');
}

function refreshRadarImages() {
  refreshImagesWithClass('radar-refresh');
}

function refreshSlowImages() {
  refreshImagesWithClass('slow-refresh');
}

let cameraRefreshIntervalId = null;
let radarRefreshIntervalId = null;
let slowRefreshIntervalId = null;

function startImageRefreshers() {
  clearInterval(cameraRefreshIntervalId);
  clearInterval(radarRefreshIntervalId);
  clearInterval(slowRefreshIntervalId);

  if (document.hidden) return;

  refreshCameraImages();
  refreshRadarImages();
  refreshSlowImages();

  cameraRefreshIntervalId = setInterval(refreshCameraImages, 6000);
  radarRefreshIntervalId = setInterval(refreshRadarImages, 3 * 60 * 1000);
  slowRefreshIntervalId = setInterval(refreshSlowImages, 60 * 60 * 1000);
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
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInterval(cameraRefreshIntervalId);
    clearInterval(radarRefreshIntervalId);
    clearInterval(slowRefreshIntervalId);
    return;
  }
  startImageRefreshers();
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
  const { tempf, feelsLike, windspeedmph, windgustmph, maxdailygust } = data;

  currentAmbientSnapshot = {
    tempf,
    feelsLike,
    windspeedmph,
    windgustmph,
    maxdailygust,
  };

  const gustValue = Number.isFinite(maxdailygust)
    ? Math.round(maxdailygust)
    : Math.round(windgustmph);
  updateForecastCurrentCard(tempf, feelsLike, windspeedmph, windgustmph, gustValue);
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

document.querySelectorAll('div.last-refresh').forEach((div) => {
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
  const timerElement = document.getElementById('refresh-timer');
  const timerContainer = document.querySelector('.weather-refresh');

  if (timerElement) {
    if (isFirstRefresh) {
      isFirstRefresh = false;
      timerContainer.style.display = 'block';
    }

    timerElement.textContent = formatTime(elapsedSeconds);
  }
}

setInterval(updateRefreshTimer, 1000);

// Update Local Time and Fetch City Name
async function updateTime() {
  const localTime = new Date().toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  document.getElementById('local-time').textContent = localTime;

  setInterval(() => {
    const localTime = new Date().toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    document.getElementById('local-time').textContent = localTime;
  }, 1000);
}

window.dispatchEvent(new Event('updateTime'));

// Fetch Flight Delays and Ground Stops
window.addEventListener('load', () => {
  checkFlightDelays('KCLE');
  // Ground stops code is commented out as per original
});

function checkFlightDelays(airportCode) {
  fetch(
    `https://us-central1-radarb.cloudfunctions.net/getFlightDelaysv2?airportCode=${airportCode}`
  )
    .then((response) => response.text())
    .then((data) => {
      const airportDelays = document.querySelector('.airportDelays');
      const delaysContainer = document.querySelector('.delays-container');
      if (!airportDelays || !delaysContainer) return;
      const trimmed = (data || '').trim();
      if (!trimmed) {
        delaysContainer.style.display = 'none';
        updateAlertsVisibility();
        return;
      }
      airportDelays.textContent = `✈ ${trimmed}`;
      delaysContainer.style.display = 'block';
      updateAlertsVisibility();
    })
    .catch((error) => console.error('Error fetching flight delays:', error));
}
