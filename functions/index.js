// firebase_cors_fix.js
const functions = require('firebase-functions');
const { onSchedule } = require('firebase-functions/v2/scheduler'); 
const admin = require('firebase-admin');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const axios = require('axios');
const cheerio = require('cheerio');

admin.initializeApp();
const client = new SecretManagerServiceClient();

let cachedOhgoApiKey = null;
let cachedAeroApiKey = null;
let cachedGoogleMapsApiKey = null;
let cachedOpenWeatherMapApiKey = null;
let cachedNdfdSnow = null;
let cachedDwmlForecast = null;

async function getSecret(secretName, cacheVar) {
  if (cacheVar.value) return cacheVar.value;
  const [version] = await client.accessSecretVersion({ name: secretName });
  cacheVar.value = version.payload.data.toString();
  return cacheVar.value;
}

function handleCors(req, res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }
  return false;
}

exports.getCameraDatav2 = functions.https.onRequest(async (req, res) => {
  if (handleCors(req, res)) return;
  try {
    const ohgoApiKey = await getSecret('projects/358874041676/secrets/ohgo-api/versions/latest', { value: cachedOhgoApiKey });
    const { latsw, lngsw, latne, lngne } = req.query;
    const API_URL = `https://publicapi.ohgo.com/api/v1/cameras?map-bounds-sw=${latsw},${lngsw}&map-bounds-ne=${latne},${lngne}`;
    const response = await axios.get(API_URL, { headers: { Authorization: `APIKEY ${ohgoApiKey}` } });
    res.set('Access-Control-Allow-Origin', '*');
    res.json(response.data);
  } catch (error) {
    console.error('Error in getCameraData:', error);
    res.status(500).json({ error: "Error retrieving data" });
  }
});

exports.getSensorDatav2 = functions.https.onRequest(async (req, res) => {
  if (handleCors(req, res)) return;
  try {
    const ohgoApiKey = await getSecret('projects/358874041676/secrets/ohgo-api/versions/latest', { value: cachedOhgoApiKey });
    const { latsw, lngsw, latne, lngne } = req.query;
    const API_URL = `https://publicapi.ohgo.com/api/v1/weather-sensor-sites?map-bounds-sw=${latsw},${lngsw}&map-bounds-ne=${latne},${lngne}`;
    const response = await axios.get(API_URL, { headers: { Authorization: `APIKEY ${ohgoApiKey}` } });
    res.set('Access-Control-Allow-Origin', '*');
    res.json(response.data);
  } catch (error) {
    console.error('Error in getSensorData:', error);
    res.status(500).json({ error: "Error retrieving data" });
  }
});

exports.getFlightDelaysv2 = functions.https.onRequest(async (req, res) => {
  if (handleCors(req, res)) return;
  try {
    const aeroApiKey = await getSecret('projects/358874041676/secrets/aeroapi/versions/latest', { value: cachedAeroApiKey });
    const { airportCode } = req.query;
    const apiUrl = `https://aeroapi.flightaware.com/aeroapi/airports/delays?airport_code=${airportCode}`;
    const response = await axios.get(apiUrl, { headers: { 'x-apikey': aeroApiKey } });
    const delays = (response.data.delays || []).filter(delay => delay.airport === airportCode);
    const delayReasons = delays.flatMap(delay => delay.reasons.map(r => r.reason));
    res.set('Access-Control-Allow-Origin', '*');
    res.status(200).send(delayReasons.join(" | "));
  } catch (error) {
    console.error('Error in getFlightDelays:', error);
    res.status(500).send("Error retrieving flight delays.");
  }
});

exports.getGroundStopInfov2 = functions.https.onRequest(async (req, res) => {
  if (handleCors(req, res)) return;
  try {
    const apiUrl = "https://soa.smext.faa.gov/asws/api/airport/status/cle";
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const response = await axios.get(apiUrl);
    const data = response.data;
    res.set('Access-Control-Allow-Origin', '*');
    if (!data.Delay && data.Status[0].Reason === "No known delays for this airport") {
      res.status(200).send("");
    } else {
      res.status(200).send(data.Status);
    }
  } catch (error) {
    console.error("Error in getGroundStopInfo:", error);
    res.status(500).send("Error fetching ground stop information");
  }
});

exports.getCityNamev2 = functions.https.onRequest(async (req, res) => {
  if (handleCors(req, res)) return;
  try {
    const googleMapsApiKey = await getSecret('projects/358874041676/secrets/google-maps-api/versions/latest', { value: cachedGoogleMapsApiKey });
    const { lat, lng } = req.query;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleMapsApiKey}`;
    const response = await axios.get(url);
    const data = response.data;
    if (data.results.length === 0) {
      res.status(404).json({ error: "No address found" });
      return;
    }
    const addressComponents = data.results[0].address_components;
    const formattedAddress = data.results[0].formatted_address;
    const premiseType = data.results[0].types[0];
    res.set('Access-Control-Allow-Origin', '*');
    res.json({ address: formattedAddress, premiseType, address_components: addressComponents });
  } catch (error) {
    console.error('Error in getCityName:', error);
    res.status(500).send('Error retrieving city name.');
  }
});

exports.getWeatherDatav2 = functions.https.onRequest(async (req, res) => {
  if (handleCors(req, res)) return;
  try {
    const openWeatherMapApiKey = await getSecret('projects/358874041676/secrets/openweathermap/versions/latest', { value: cachedOpenWeatherMapApiKey });
    const { lat, lng } = req.query;
    const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lng}&exclude=minutely&units=imperial&appid=${openWeatherMapApiKey}`;
    const response = await axios.get(url);
    res.set('Access-Control-Allow-Origin', '*');
    res.json(response.data);
  } catch (error) {
    console.error('Error in getWeatherData:', error);
    res.status(500).send('Error fetching weather data.');
  }
});

exports.getAmbientWeatherDatav2 = functions.https.onRequest(async (req, res) => {
  if (handleCors(req, res)) return;
  try {
    const applicationKey = '0acb5017ad334b908f7cf4c021d54ce4ef5d9cf6343b41a7bbdf82d1f3c5ed53';
    const apiKey = '965ff6ce58d444609421f58e0198de214d2985bef33844abaa2d89cd404cfb0c';
    const API_URL = `https://api.ambientweather.net/v1/devices?applicationKey=${applicationKey}&apiKey=${apiKey}`;
    const response = await axios.get(API_URL);
    res.set('Access-Control-Allow-Origin', '*');
    res.json(response.data);
  } catch (error) {
    console.error("Error in getAmbientWeatherData:", error);
    res.status(500).json({ error: "Error retrieving Ambient Weather data" });
  }
});

exports.getNdfdSnowv1 = functions.https.onRequest(async (req, res) => {
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
      data: response.data
    };
    res.set('Access-Control-Allow-Origin', '*');
    res.status(200).send(response.data);
  } catch (error) {
    console.error('Error in getNdfdSnowv1:', error);
    res.status(500).send('Error fetching NDFD snow data.');
  }
});

exports.getDwmlForecastv1 = functions.https.onRequest(async (req, res) => {
  if (handleCors(req, res)) return;
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      res.status(400).json({ error: 'lat and lng are required' });
      return;
    }
    const cacheKey = `${lat},${lng}`;
    const now = Date.now();
    const cacheTtlMs = 30 * 60 * 1000;

    const url = `https://forecast.weather.gov/MapClick.php?lat=${lat}&lon=${lng}&FcstType=digitalDWML`;
    const cached = cachedDwmlForecast && cachedDwmlForecast.key === cacheKey ? cachedDwmlForecast : null;
    const headers = {};
    if (cached && cached.etag) {
      headers['If-None-Match'] = cached.etag;
    }

    const response = await axios.get(url, {
      responseType: 'text',
      headers,
      validateStatus: status => status >= 200 && status < 400
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
      etag
    };
    res.set('Access-Control-Allow-Origin', '*');
    res.status(200).send(response.data);
  } catch (error) {
    console.error('Error in getDwmlForecastv1:', error);
    res.status(500).send('Error fetching DWML forecast data.');
  }
});

exports.grabPivotalHRRR6hQPFv2 = functions.https.onRequest(async (req, res) => {
  if (handleCors(req, res)) return;
  try {
    const pageUrl = 'https://www.pivotalweather.com/model.php?m=hrrr&p=qpf_006h-imp&fh=0&r=us_ma&dpdt=&mc=';
    const pageResponse = await axios.get(pageUrl);
    const $ = cheerio.load(pageResponse.data);
    const hrrr6hQPFimageUrl = $('#display_image').attr('src');
    res.set('Access-Control-Allow-Origin', '*');
    res.json({ imageUrl: hrrr6hQPFimageUrl });
  } catch (error) {
    console.error('Error in grabPivotalHRRR6hQPF:', error);
    res.status(500).send('Error fetching image URL');
  }
});

exports.getCivilDuskTime = functions.https.onRequest(async (req, res) => {
  if (handleCors(req, res)) return;
  try {
    const { lat = "41.48", lng = "-81.8" } = req.query;
    const apiUrl = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&formatted=0`;

    console.log("🔍 Fetching from:", apiUrl);
    const response = await axios.get(apiUrl);
    console.log("✅ API response:", response.data);

    const duskUTC = response.data.results.civil_twilight_end;
    const duskDate = new Date(duskUTC);
    console.log("🌇 Dusk UTC:", duskUTC);
    console.log("📅 Parsed Date:", duskDate);

    const duskLocal = duskDate.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const localDate = duskDate.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    console.log("🕖 Local dusk time:", duskLocal);
    console.log("📆 Local date:", localDate);

    await admin.firestore().collection('duskLog').doc(localDate).set({
      dusk: duskLocal,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.set('Access-Control-Allow-Origin', '*');
    res.status(200).json({ dusk: duskLocal, date: localDate });
  } catch (error) {
    console.error("💥 Error in getCivilDuskTime:", error);
    res.status(500).send("Failed to fetch or store dusk time.");
  }
});


exports.scheduledDuskLogger = onSchedule(
  {
    schedule: 'every day 00:05',
    timeZone: 'America/New_York',
  },
  async () => {
    const lat = 41.48;
    const lng = -81.8;
    const apiUrl = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&formatted=0`;

    try {
      const response = await axios.get(apiUrl);
      const duskUTC = response.data.results.civil_twilight_end;
      const duskDate = new Date(duskUTC);

      const duskLocal = duskDate.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const localDate = duskDate.toLocaleDateString('en-CA', {
        timeZone: 'America/New_York',
      });

      await admin.firestore().collection('duskLog').doc(localDate).set({
        dusk: duskLocal,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Logged dusk time: ${duskLocal} on ${localDate}`);
    } catch (error) {
      console.error('Scheduled dusk logger failed:', error);
    }
  }
);
