const test = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeRadarUrl } = require('../lib/radarProxy');

test('sanitizeRadarUrl strips cache busters', () => {
  const input =
    'https://sirocco.accuweather.com/nx_mosaic_640x480_public/sir/inmsiroh_.gif?t=12345';
  const result = sanitizeRadarUrl(encodeURIComponent(input));
  assert.equal(result.ok, true);
  assert.equal(
    result.url,
    'https://sirocco.accuweather.com/nx_mosaic_640x480_public/sir/inmsiroh_.gif'
  );
});

test('sanitizeRadarUrl rejects unknown hosts', () => {
  const input = 'https://example.com/radar.gif';
  const result = sanitizeRadarUrl(encodeURIComponent(input));
  assert.equal(result.ok, false);
  assert.equal(result.error, 'host not allowed');
});
