const DEFAULT_HOSTS = ['sirocco.accuweather.com'];

const ALLOWED_HOSTS = new Set(
  (process.env.RADAR_PROXY_ALLOWED_HOSTS || DEFAULT_HOSTS.join(','))
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
);

const CACHE_SECONDS = Number.parseInt(process.env.RADAR_PROXY_CACHE_SECONDS || '180', 10);

function sanitizeRadarUrl(rawUrl) {
  if (!rawUrl) {
    return { ok: false, error: 'url is required' };
  }

  const decodedUrl = decodeURIComponent(rawUrl);
  const parsedUrl = new URL(decodedUrl);

  if (!ALLOWED_HOSTS.has(parsedUrl.hostname)) {
    return { ok: false, error: 'host not allowed' };
  }

  parsedUrl.searchParams.delete('t');

  return { ok: true, url: parsedUrl.toString() };
}

module.exports = { sanitizeRadarUrl, CACHE_SECONDS, ALLOWED_HOSTS };
