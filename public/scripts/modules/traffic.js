(function registerTrafficModule() {
  window.RADARB = window.RADARB || {};
  window.RADARB.modules = window.RADARB.modules || {};

  const core = window.RADARB.modules.core || {};
  const {
    fetchWithTimeout,
    clearElement,
    appendLine,
    appendLink,
    haversine,
    updateAlertsVisibility,
  } = core;

  let endpoints = null;
  let onTimeUpdate = null;
  let sensorDataDisplayed = false;

  function configure(options = {}) {
    endpoints = options.endpoints || endpoints;
    onTimeUpdate = options.onTimeUpdate || onTimeUpdate;
  }

  async function handleCameraData(event) {
    const { latne, lngne, latsw, lngsw, lat, lng } = event.detail;
    if (!endpoints || !fetchWithTimeout) return;
    try {
      const response = await fetchWithTimeout(
        `${endpoints.cameraUrl}?latne=${latne}&lngne=${lngne}&latsw=${latsw}&lngsw=${lngsw}`
      );
      const data = await response.json();
      displayCameraData(data, lat, lng);
    } catch (error) {
      console.error('Error fetching camera data:', error);
    }
  }

  function displayCameraData(data, userLat, userLng) {
    const cameraDistances = (data.results || []).map((camera) => ({
      camera,
      distance: haversine(userLat, userLng, camera.latitude, camera.longitude),
    }));

    cameraDistances.sort((a, b) => a.distance - b.distance);

    const imageGrid = document.querySelector('.image-grid');
    clearElement(imageGrid);

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

    if (imageGrid) {
      imageGrid.classList.remove('panel-loading');
    }
  }

  async function handleSensorData(event) {
    const { latne, lngne, latsw, lngsw, lat, lng } = event.detail;
    if (!endpoints || !fetchWithTimeout) return;
    if (sensorDataDisplayed) return;
    try {
      const response = await fetchWithTimeout(
        `${endpoints.sensorUrl}?latne=${latne}&lngne=${lngne}&latsw=${latsw}&lngsw=${lngsw}`
      );
      const data = await response.json();
      sensorDataDisplayed = true;
      displaySensorData(data, lat, lng);
      if (onTimeUpdate) onTimeUpdate(lat, lng);
    } catch (error) {
      console.error('Error fetching sensor data:', error);
    }
  }

  function displaySensorData(data, lat, lng) {
    const sensorContainer = document.querySelector('.sensor-container');
    clearElement(sensorContainer);

    const sensorDistances = (data.results || []).flatMap((result) =>
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
      appendLine(div, sensor.name.slice(0, -4));
      if (sensor.description) appendLine(div, `Description: ${sensor.description}`);
      if (sensor.condition) appendLine(div, `Condition: ${sensor.condition}`);
      appendLine(div, `Surface temp: ${sensor.surfaceTemperature}`);
      appendLine(div, `Status: ${sensor.status}`);
      sensorContainer.appendChild(div);
    });

    if (!sensorDistances.length) {
      const div = document.createElement('div');
      div.className = 'sensor-box';
      div.textContent = 'No sensor data returned from ODOT';
      sensorContainer.appendChild(div);
    }

    const forecastDiv = document.createElement('div');
    forecastDiv.className = 'sensor-box sensor-box--links';
    appendLink(
      forecastDiv,
      'Forecast discussion',
      'https://forecast.weather.gov/product.php?site=CLE&issuedby=CLE&product=AFD&format=CI&version=1&glossary=1&highlight=off'
    );
    forecastDiv.appendChild(document.createElement('br'));
    appendLink(forecastDiv, 'Icy Road Forecast', 'https://icyroadsafety.com/lcr/');
    sensorContainer.appendChild(forecastDiv);

    const clocksDiv = document.createElement('div');
    clocksDiv.className = 'sensor-box sensor-box--clock';
    clocksDiv.id = 'clocks';
    const timeRow = document.createElement('div');
    const timeSpan = document.createElement('span');
    timeSpan.id = 'local-time';
    timeSpan.textContent = '--:--:--';
    timeRow.appendChild(timeSpan);
    timeRow.appendChild(document.createTextNode(' ET'));
    clocksDiv.appendChild(timeRow);

    const refreshRow = document.createElement('div');
    refreshRow.appendChild(document.createTextNode('Last refresh '));
    const refreshSpan = document.createElement('span');
    refreshSpan.id = 'refresh-timer';
    refreshSpan.textContent = '0:00';
    refreshRow.appendChild(refreshSpan);
    clocksDiv.appendChild(refreshRow);

    const pausedRow = document.createElement('div');
    const pausedSpan = document.createElement('span');
    pausedSpan.id = 'refresh-paused';
    pausedSpan.style.display = 'none';
    pausedSpan.textContent = 'REFRESH PAUSED';
    pausedRow.appendChild(pausedSpan);
    clocksDiv.appendChild(pausedRow);
    sensorContainer.appendChild(clocksDiv);
    sensorContainer.classList.remove('panel-loading');

    clocksDiv.addEventListener('click', () => {
      const refreshPaused = document.getElementById('refresh-paused');
      if (refreshPaused) refreshPaused.style.display = 'none';
      const event = new Event('resumeImageRefresh');
      window.dispatchEvent(event);
    });
  }

  function loadIncidents(latne, lngne, latsw, lngsw) {
    const container = document.querySelector('.incidents-container');
    if (!container || !endpoints || !fetchWithTimeout) return;

    const cached = getCachedIncidents();
    if (cached) {
      renderIncidents(cached, container);
    }

    const url = `${endpoints.incidentsUrl}?latne=${latne}&lngne=${lngne}&latsw=${latsw}&lngsw=${lngsw}`;
    fetchWithTimeout(url, {}, 8000)
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
      clearElement(container);
      container.classList.remove('is-active');
      if (updateAlertsVisibility) updateAlertsVisibility();
      return;
    }

    const items = incidents.slice(0, 6);
    clearElement(container);
    const title = document.createElement('div');
    title.className = 'closure-title';
    title.textContent = 'Traffic Incidents';
    container.appendChild(title);
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
    if (updateAlertsVisibility) updateAlertsVisibility();
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

  window.RADARB.modules.traffic = {
    configure,
    handleCameraData,
    handleSensorData,
    loadIncidents,
  };
})();
