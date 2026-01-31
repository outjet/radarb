// Shared client config (single source of truth)
window.RADARB_CONFIG = Object.freeze({
  userLat: 41.48,
  userLng: -81.81,
  endpoints: Object.freeze({
    ambientWeatherUrl: 'https://us-central1-radarb.cloudfunctions.net/getAmbientWeatherDatav2',
    pivotalWeatherUrl: 'https://us-central1-radarb.cloudfunctions.net/grabPivotalHRRR6hQPFv2',
  }),
});
