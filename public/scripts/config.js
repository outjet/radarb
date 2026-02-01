// Shared client config (single source of truth)
window.RADARB_CONFIG = Object.freeze({
  userLat: 41.48,
  userLng: -81.81,
  endpoints: Object.freeze({
    ambientWeatherUrl: 'https://us-central1-radarb.cloudfunctions.net/getAmbientWeatherDatav2',
    cameraUrl: 'https://us-central1-radarb.cloudfunctions.net/getCameraDatav2',
    sensorUrl: 'https://us-central1-radarb.cloudfunctions.net/getSensorDatav2',
    incidentsUrl: 'https://us-central1-radarb.cloudfunctions.net/getOhgoIncidentsv1',
    closingsUrl: 'https://us-central1-radarb.cloudfunctions.net/getSchoolClosingsv1',
    flightDelaysUrl: 'https://us-central1-radarb.cloudfunctions.net/getFlightDelaysv2',
    dwmlUrl: 'https://us-central1-radarb.cloudfunctions.net/getDwmlForecastv1',
    ndfdSnowUrl: 'https://us-central1-radarb.cloudfunctions.net/getNdfdSnowv1',
    twilightUrl: 'https://us-central1-radarb.cloudfunctions.net/getTwilightTimesv1',
    radarProxyUrl: 'https://us-central1-radarb.cloudfunctions.net/getRadarProxyv1',
    pivotalWeatherUrl: 'https://us-central1-radarb.cloudfunctions.net/grabPivotalHRRR6hQPFv2',
    snowTailUrl: 'https://storage.googleapis.com/radarb-forecast-358874041676/snow_tail.json',
  }),
});
