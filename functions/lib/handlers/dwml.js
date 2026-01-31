const axios = require('axios');
const { handleCors } = require('../core');

let cachedNdfdSnow = null;
let cachedDwmlForecast = null;
let cachedTwilight = null;

async function getNdfdSnowv1(req, res) {
  if (handleCors(req, res)) return;
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      res.status(400).json({ error: 'lat and lng are required' });
      return;
    }
    const cacheKey = `${lat},${lng}`;
    const now = Date.now();
    const cacheTtlMs = 60 * 60 * 1000;

    if (
      cachedNdfdSnow &&
      cachedNdfdSnow.key === cacheKey &&
      now - cachedNdfdSnow.fetchedAt < cacheTtlMs
    ) {
      res.set('Access-Control-Allow-Origin', '*');
      res.status(200).send(cachedNdfdSnow.data);
      return;
    }

    const url = `https://digital.weather.gov/xml/sample_products/browser_interface/ndfdXMLclient.php?lat=${lat}&lon=${lng}&product=time-series&snow=1`;
    const response = await axios.get(url, { responseType: 'text' });
    cachedNdfdSnow = {
      key: cacheKey,
      fetchedAt: now,
      data: response.data,
    };
    res.set('Access-Control-Allow-Origin', '*');
    res.status(200).send(response.data);
  } catch (error) {
    console.error('Error in getNdfdSnowv1:', error);
    res.status(500).send('Error fetching NDFD snow data.');
  }
}

async function getDwmlForecastv1(req, res) {
  if (handleCors(req, res)) return;
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      res.status(400).json({ error: 'lat and lng are required' });
      return;
    }
    const cacheKey = `${lat},${lng}`;
    const now = Date.now();
    const url = `https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lng}&FcstType=digitalDWML`;
    const cached =
      cachedDwmlForecast && cachedDwmlForecast.key === cacheKey ? cachedDwmlForecast : null;
    const headers = {};
    if (cached && cached.etag) {
      headers['If-None-Match'] = cached.etag;
    }

    const response = await axios.get(url, {
      responseType: 'text',
      headers,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    if (response.status === 304 && cached) {
      res.set('Access-Control-Allow-Origin', '*');
      res.status(200).send(cached.data);
      return;
    }

    const etag = response.headers.etag || '';
    cachedDwmlForecast = {
      key: cacheKey,
      fetchedAt: now,
      data: response.data,
      etag,
    };
    res.set('Access-Control-Allow-Origin', '*');
    res.status(200).send(response.data);
  } catch (error) {
    console.error('Error in getDwmlForecastv1:', error);
    res.status(500).send('Error fetching DWML forecast data.');
  }
}

async function getTwilightTimesv1(req, res) {
  if (handleCors(req, res)) return;
  try {
    const { lat, lng } = req.query;
    const tz = req.query.tz || 'America/New_York';
    if (!lat || !lng) {
      res.status(400).json({ error: 'lat and lng are required' });
      return;
    }

    const cacheKey = `${lat},${lng},${tz}`;
    const now = Date.now();
    const cacheTtlMs = 6 * 60 * 60 * 1000;

    if (
      cachedTwilight &&
      cachedTwilight.key === cacheKey &&
      now - cachedTwilight.fetchedAt < cacheTtlMs
    ) {
      res.set('Access-Control-Allow-Origin', '*');
      res.status(200).json(cachedTwilight.data);
      return;
    }

    const apiUrl = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&formatted=0`;
    const response = await axios.get(apiUrl);
    const results = response.data && response.data.results ? response.data.results : null;
    if (!results) {
      throw new Error('Missing twilight results');
    }

    const dawnUtc = results.civil_twilight_begin;
    const duskUtc = results.civil_twilight_end;
    const sunriseUtc = results.sunrise;
    const sunsetUtc = results.sunset;
    const dawnDate = new Date(dawnUtc);
    const duskDate = new Date(duskUtc);
    const sunriseDate = sunriseUtc ? new Date(sunriseUtc) : null;
    const sunsetDate = sunsetUtc ? new Date(sunsetUtc) : null;

    const dawnLocal = dawnDate.toLocaleTimeString('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
    });
    const duskLocal = duskDate.toLocaleTimeString('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
    });
    const sunriseLocal = sunriseDate
      ? sunriseDate.toLocaleTimeString('en-US', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
    const sunsetLocal = sunsetDate
      ? sunsetDate.toLocaleTimeString('en-US', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
    const localDate = dawnDate.toLocaleDateString('en-CA', { timeZone: tz });

    const payload = {
      dawn: dawnLocal,
      dusk: duskLocal,
      sunrise: sunriseLocal,
      sunset: sunsetLocal,
      date: localDate,
      tz,
    };

    cachedTwilight = {
      key: cacheKey,
      fetchedAt: now,
      data: payload,
    };

    res.set('Access-Control-Allow-Origin', '*');
    res.status(200).json(payload);
  } catch (error) {
    console.error('Error in getTwilightTimesv1:', error);
    res.status(500).send('Error fetching twilight times.');
  }
}

module.exports = {
  getNdfdSnowv1,
  getDwmlForecastv1,
  getTwilightTimesv1,
};
