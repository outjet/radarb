// firebase_cors_fix.js
const functions = require('firebase-functions');
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
let cachedTwilight = null;
let cachedOhgoIncidents = null;
let cachedClosings = null;
let cachedVertexApiKey = null;

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

exports.getOhgoIncidentsv1 = functions.https.onRequest(async (req, res) => {
  if (handleCors(req, res)) return;
  try {
    const ohgoApiKey = await getSecret('projects/358874041676/secrets/ohgo-api/versions/latest', { value: cachedOhgoApiKey });
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
    const response = await axios.get(API_URL, { headers: { Authorization: `APIKEY ${ohgoApiKey}` } });
    cachedOhgoIncidents = {
      key: cacheKey,
      fetchedAt: now,
      data: response.data
    };
    res.set('Access-Control-Allow-Origin', '*');
    res.json(response.data);
  } catch (error) {
    console.error('Error in getOhgoIncidentsv1:', error);
    res.status(500).json({ error: 'Error retrieving incidents' });
  }
});

exports.getSchoolClosingsv1 = functions.https.onRequest(async (req, res) => {
  if (handleCors(req, res)) return;
  try {
    const now = Date.now();
    const easternNow = new Date(
      new Date(now).toLocaleString('en-US', { timeZone: 'America/New_York' })
    );
    const month = easternNow.getMonth() + 1;
    const day = easternNow.getDate();
    const isBetweenApr15AndDec1 =
      (month > 4 || (month === 4 && day >= 15)) &&
      (month < 12 || (month === 12 && day <= 1));
    if (isBetweenApr15AndDec1) {
      res.status(204).send('');
      return;
    }

    const cacheKey = 'fox8-closings';
    const cacheTtlMs = 6 * 60 * 60 * 1000;

    if (cachedClosings && now - cachedClosings.fetchedAt < cacheTtlMs) {
      if (!cachedClosings.data || !cachedClosings.data.match) {
        res.status(204).send('');
        return;
      }
      res.set('Access-Control-Allow-Origin', '*');
      res.json(cachedClosings.data);
      return;
    }

    const targets = [
      'Lakewood City Schools',
      'Lakewood Public Schools',
      'Lakewood City School District'
    ];
    const normalizedTargets = targets.map(target => target.toLowerCase());
    const normalizeName = (name) => String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();

    let payload = null;

    try {
      const spectrumUrl = 'https://spectrumnews1.com/services/closings.5b68bed4850bba13eeb29507.json';
      const spectrumResponse = await axios.get(spectrumUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      const groups = Array.isArray(spectrumResponse.data) ? spectrumResponse.data : [];
      const k12Group = groups.find(group => String(group.orgType || '').toLowerCase().includes('school'));
      const closings = k12Group && Array.isArray(k12Group.closings) ? k12Group.closings : [];
      const matches = closings.filter(item => {
        const name = normalizeName(item.accountName);
        if (!name) return false;
        if (name.includes('catholic')) return false;
        return normalizedTargets.some(target => name.includes(target));
      });
      const exactMatch = matches.find(item => normalizeName(item.accountName) === 'lakewood city schools');
      const districtMatch = matches.find(item => normalizeName(item.accountName).includes('lakewood city school district'));
      const match = exactMatch || districtMatch || matches[0] || null;

      payload = {
        updatedAt: now,
        match: match
          ? {
              name: match.accountName,
              status: match.status || 'unknown',
              reason: 'Spectrum closings feed',
              source: 'spectrumnews1.com',
              confidence: 'high',
              expires: match.expires || ''
            }
          : null,
        sourceUrl: spectrumUrl,
        matches: req.query.debug === '1'
          ? matches.map(item => ({
              name: item.accountName,
              status: item.status || 'unknown',
              expires: item.expires || ''
            }))
          : undefined
      };
    } catch (error) {
      payload = null;
    }

    if (!payload) {
      const url = 'https://fox8.com/weather/closings/';
      const response = await axios.get(url, {
        responseType: 'text',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://fox8.com/weather/closings/',
          'Origin': 'https://fox8.com'
        }
      });
      const $ = cheerio.load(response.data);
      const candidateBlocks = [];
      $('.closing').each((_, el) => {
        const title = $(el).find('.closing__title').text().trim();
        if (!title) return;
        const normalized = title.toLowerCase();
        const isTarget = targets.some(target => normalized.includes(target.toLowerCase()));
        if (isTarget) {
          candidateBlocks.push({
            title,
            html: $(el).html() || '',
            text: $(el).text().trim().replace(/\s+/g, ' ')
          });
        }
      });

      const vertexApiKey = await getSecret('projects/358874041676/secrets/vertex/versions/1', { value: cachedVertexApiKey });
      const prompt = `
You are extracting a school closing status from a web page fragment.
Return JSON only with keys: name, status, reason, source, confidence.
Use "unknown" when not present. Status should be one of: open, closed, delay, remote, unknown.

We need the closing status for Lakewood City Schools (public school district), not other Lakewood organizations.
If multiple blocks mention Lakewood, pick the one that is a public school district and NOT a private school.
Ignore Lakewood Catholic Academy or other private entities.

Candidate blocks:
${candidateBlocks.map((block, idx) => `#${idx + 1}\nTITLE: ${block.title}\nHTML: ${block.html}\nTEXT: ${block.text}`).join('\n\n')}

If no matching district is found, return status "unknown".
`.trim();

      const vertexUrl = 'https://us-central1-aiplatform.googleapis.com/v1/projects/358874041676/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent';
      const vertexResponse = await axios.post(
        vertexUrl,
        {
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 200
          }
        },
        {
          headers: {
            'x-goog-api-key': vertexApiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      const responseText = vertexResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let parsed = null;
      try {
        parsed = JSON.parse(responseText);
      } catch (error) {
        parsed = {
          name: targets[0],
          status: 'unknown',
          reason: 'Unable to parse model response',
          source: 'fox8.com',
          confidence: 'low'
        };
      }

      payload = {
        updatedAt: now,
        match: parsed,
        sourceUrl: url
      };
    }

    cachedClosings = { fetchedAt: now, data: payload };
    if (!payload || !payload.match) {
      res.status(204).send('');
      return;
    }
    res.set('Access-Control-Allow-Origin', '*');
    res.json(payload);
  } catch (error) {
    console.error('Error in getSchoolClosingsv1:', error);
    res.status(204).send('');
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
    res.status(200).send(delayReasons.join("\n"));
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

exports.getTwilightTimesv1 = functions.https.onRequest(async (req, res) => {
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
      minute: '2-digit'
    });
    const duskLocal = duskDate.toLocaleTimeString('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit'
    });
    const sunriseLocal = sunriseDate
      ? sunriseDate.toLocaleTimeString('en-US', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit'
        })
      : '';
    const sunsetLocal = sunsetDate
      ? sunsetDate.toLocaleTimeString('en-US', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit'
        })
      : '';
    const localDate = dawnDate.toLocaleDateString('en-CA', { timeZone: tz });

    const payload = {
      dawn: dawnLocal,
      dusk: duskLocal,
      sunrise: sunriseLocal,
      sunset: sunsetLocal,
      date: localDate,
      tz
    };

    cachedTwilight = {
      key: cacheKey,
      fetchedAt: now,
      data: payload
    };

    res.set('Access-Control-Allow-Origin', '*');
    res.status(200).json(payload);
  } catch (error) {
    console.error('Error in getTwilightTimesv1:', error);
    res.status(500).send('Error fetching twilight times.');
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
