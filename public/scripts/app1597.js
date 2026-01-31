// app1597.js - coordinator
(function initRadarbApp() {
  const RADARB_CONFIG = window.RADARB_CONFIG;
  if (!RADARB_CONFIG) {
    throw new Error('RADARB_CONFIG is missing. Ensure scripts/config.js loads first.');
  }

  const { userLat, userLng, endpoints } = RADARB_CONFIG;
  const modules = window.RADARB?.modules || {};
  const {
    core,
    forecast,
    sunTrack,
    dwml,
    traffic,
    media,
    meteos,
    alerts,
    closings,
    time,
    weather,
  } = modules;

  if (!core || !forecast || !sunTrack || !dwml || !traffic || !media || !time || !weather) {
    console.warn('RadarB modules missing; check script load order.');
  }

  document.addEventListener('DOMContentLoaded', initializeApp);

  function initializeApp() {
    core?.cleanupLegacyForecastCache?.();

    const forecastContainer = document.querySelector('.forecast-container');
    if (forecastContainer) forecastContainer.textContent = 'Loading forecast...';
    forecast?.loadCachedForecast?.();

    const bounds = getBounds(userLat, userLng, 8);

    traffic?.configure?.({
      endpoints,
      onTimeUpdate: () => time?.initClock?.(),
    });
    alerts?.configure?.({ endpoints });
    closings?.configure?.({ endpoints });
    weather?.configure?.({ ambientWeatherUrl: endpoints.ambientWeatherUrl });

    // Camera and sensor data
    window.addEventListener('loadCameraData', traffic?.handleCameraData || (() => {}));
    window.addEventListener('loadSensorData', traffic?.handleSensorData || (() => {}));
    const cameraEvent = new CustomEvent('loadCameraData', {
      detail: { ...bounds, lat: userLat, lng: userLng },
    });
    const sensorEvent = new CustomEvent('loadSensorData', {
      detail: { ...bounds, lat: userLat, lng: userLng },
    });
    window.dispatchEvent(cameraEvent);
    window.dispatchEvent(sensorEvent);

    // Forecast + sun track
    dwml?.loadDwmlMeteogram?.(userLat, userLng);
    sunTrack?.loadTwilightTimes?.(userLat, userLng);
    meteos?.initMeteograms?.(userLat, userLng);
    setInterval(() => dwml?.loadDwmlMeteogram?.(userLat, userLng), 30 * 60 * 1000);

    // Sun track countdown and updates
    setInterval(() => {
      const times = sunTrack?.getTwilightTimes?.();
      if (times) {
        sunTrack?.updateSunTrack?.(times.dawn, times.dusk, times.sunrise, times.sunset);
        sunTrack?.updateSunPhaseCountdown?.();
      }
    }, 60000);
    setInterval(() => sunTrack?.updateSunPhaseCountdown?.(), 1000);

    // Media and alerts
    media?.initMediaRefreshers?.();

    traffic?.loadIncidents?.(bounds.latne, bounds.lngne, bounds.latsw, bounds.lngsw);
    setInterval(
      () => traffic?.loadIncidents?.(bounds.latne, bounds.lngne, bounds.latsw, bounds.lngsw),
      5 * 60 * 1000
    );

    closings?.loadClosings?.();
    setInterval(() => closings?.loadClosings?.(), 10 * 60 * 1000);

    alerts?.initFlightDelays?.('KCLE');
    setInterval(() => alerts?.checkFlightDelays?.('KCLE'), 15 * 60 * 1000);

    // Ambient weather + refresh timer
    time?.initRefreshTimer?.();
    weather?.initAmbientWeather?.();
  }

  function getBounds(lat, lng, boxsize) {
    const latne = lat + boxsize / 69;
    const lngne = lng + boxsize / 53;
    const latsw = lat - boxsize / 69;
    const lngsw = lng - boxsize / 53;
    return { latne, lngne, latsw, lngsw };
  }
})();
