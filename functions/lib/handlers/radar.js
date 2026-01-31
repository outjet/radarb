const axios = require('axios');
const { handleCors } = require('../core');
const { sanitizeRadarUrl, CACHE_SECONDS } = require('../radarProxy');

async function getRadarProxyv1(req, res) {
  if (handleCors(req, res)) return;
  try {
    const { ok, url: sanitizedUrl, error: sanitizeError } = sanitizeRadarUrl(req.query.url);
    if (!ok) {
      res.status(400).json({ error: sanitizeError });
      return;
    }

    const response = await axios.get(sanitizedUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const contentType = response.headers['content-type'] || 'image/gif';
    res.set('Content-Type', contentType);
    res.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('Error in getRadarProxyv1:', error);
    res.status(500).json({ error: 'Error retrieving radar image' });
  }
}

module.exports = { getRadarProxyv1 };
