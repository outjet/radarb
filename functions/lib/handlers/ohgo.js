const axios = require('axios');
const { getSecret, handleCors } = require('../core');

let cachedOhgoIncidents = null;

async function getCameraDatav2(req, res) {
  if (handleCors(req, res)) return;
  try {
    const ohgoApiKey = await getSecret('projects/358874041676/secrets/ohgo-api/versions/latest');
    const { latsw, lngsw, latne, lngne } = req.query;
    const API_URL = `https://publicapi.ohgo.com/api/v1/cameras?map-bounds-sw=${latsw},${lngsw}&map-bounds-ne=${latne},${lngne}`;
    const response = await axios.get(API_URL, {
      headers: { Authorization: `APIKEY ${ohgoApiKey}` },
    });
    res.set('Access-Control-Allow-Origin', '*');
    res.json(response.data);
  } catch (error) {
    console.error('Error in getCameraData:', error);
    res.status(500).json({ error: 'Error retrieving data' });
  }
}

async function getSensorDatav2(req, res) {
  if (handleCors(req, res)) return;
  try {
    const ohgoApiKey = await getSecret('projects/358874041676/secrets/ohgo-api/versions/latest');
    const { latsw, lngsw, latne, lngne } = req.query;
    const API_URL = `https://publicapi.ohgo.com/api/v1/weather-sensor-sites?map-bounds-sw=${latsw},${lngsw}&map-bounds-ne=${latne},${lngne}`;
    const response = await axios.get(API_URL, {
      headers: { Authorization: `APIKEY ${ohgoApiKey}` },
    });
    res.set('Access-Control-Allow-Origin', '*');
    res.json(response.data);
  } catch (error) {
    console.error('Error in getSensorData:', error);
    res.status(500).json({ error: 'Error retrieving data' });
  }
}

async function getOhgoIncidentsv1(req, res) {
  if (handleCors(req, res)) return;
  try {
    const ohgoApiKey = await getSecret('projects/358874041676/secrets/ohgo-api/versions/latest');
    const { latsw, lngsw, latne, lngne } = req.query;
    if (!latsw || !lngsw || !latne || !lngne) {
      res.status(400).json({ error: 'map bounds are required' });
      return;
    }

    const cacheKey = `${latsw},${lngsw},${latne},${lngne}`;
    const now = Date.now();
    const cacheTtlMs = 5 * 60 * 1000;

    if (
      cachedOhgoIncidents &&
      cachedOhgoIncidents.key === cacheKey &&
      now - cachedOhgoIncidents.fetchedAt < cacheTtlMs
    ) {
      res.set('Access-Control-Allow-Origin', '*');
      res.json(cachedOhgoIncidents.data);
      return;
    }

    const API_URL = `https://publicapi.ohgo.com/api/v1/incidents?map-bounds-sw=${latsw},${lngsw}&map-bounds-ne=${latne},${lngne}`;
    const response = await axios.get(API_URL, {
      headers: { Authorization: `APIKEY ${ohgoApiKey}` },
    });
    cachedOhgoIncidents = {
      key: cacheKey,
      fetchedAt: now,
      data: response.data,
    };
    res.set('Access-Control-Allow-Origin', '*');
    res.json(response.data);
  } catch (error) {
    console.error('Error in getOhgoIncidentsv1:', error);
    res.status(500).json({ error: 'Error retrieving incidents' });
  }
}

module.exports = {
  getCameraDatav2,
  getSensorDatav2,
  getOhgoIncidentsv1,
};
