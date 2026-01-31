const axios = require('axios');
const cheerio = require('cheerio');
const { getSecret, handleCors } = require('../core');

let cachedClosings = null;

async function getSchoolClosingsv1(req, res) {
  if (handleCors(req, res)) return;
  try {
    const now = Date.now();
    const easternNow = new Date(
      new Date(now).toLocaleString('en-US', { timeZone: 'America/New_York' })
    );
    const month = easternNow.getMonth() + 1;
    const day = easternNow.getDate();
    const isBetweenApr15AndDec1 =
      (month > 4 || (month === 4 && day >= 15)) && (month < 12 || (month === 12 && day <= 1));
    if (isBetweenApr15AndDec1) {
      res.status(204).send('');
      return;
    }

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
      'Lakewood City School District',
    ];
    const normalizedTargets = targets.map((target) => target.toLowerCase());
    const normalizeName = (name) =>
      String(name || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    let payload = null;

    try {
      const spectrumUrl =
        'https://spectrumnews1.com/services/closings.5b68bed4850bba13eeb29507.json';
      const spectrumResponse = await axios.get(spectrumUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
      });
      const groups = Array.isArray(spectrumResponse.data) ? spectrumResponse.data : [];
      const k12Group = groups.find((group) =>
        String(group.orgType || '')
          .toLowerCase()
          .includes('school')
      );
      const closings = k12Group && Array.isArray(k12Group.closings) ? k12Group.closings : [];
      const matches = closings.filter((item) => {
        const name = normalizeName(item.accountName);
        if (!name) return false;
        if (name.includes('catholic')) return false;
        return normalizedTargets.some((target) => name.includes(target));
      });
      const exactMatch = matches.find(
        (item) => normalizeName(item.accountName) === 'lakewood city schools'
      );
      const districtMatch = matches.find((item) =>
        normalizeName(item.accountName).includes('lakewood city school district')
      );
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
              expires: match.expires || '',
            }
          : null,
        sourceUrl: spectrumUrl,
        matches:
          req.query.debug === '1'
            ? matches.map((item) => ({
                name: item.accountName,
                status: item.status || 'unknown',
                expires: item.expires || '',
              }))
            : undefined,
      };
    } catch (error) {
      payload = null;
    }

    if (!payload) {
      const url = 'https://fox8.com/weather/closings/';
      const response = await axios.get(url, {
        responseType: 'text',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://fox8.com/weather/closings/',
          Origin: 'https://fox8.com',
        },
      });
      const $ = cheerio.load(response.data);
      const candidateBlocks = [];
      $('.closing').each((_, el) => {
        const title = $(el).find('.closing__title').text().trim();
        if (!title) return;
        const normalized = title.toLowerCase();
        const isTarget = targets.some((target) => normalized.includes(target.toLowerCase()));
        if (isTarget) {
          candidateBlocks.push({
            title,
            html: $(el).html() || '',
            text: $(el).text().trim().replace(/\s+/g, ' '),
          });
        }
      });

      const vertexApiKey = await getSecret('projects/358874041676/secrets/vertex/versions/1');
      const prompt = `
You are extracting a school closing status from a web page fragment.
Return JSON only with keys: name, status, reason, source, confidence.
Use "unknown" when not present. Status should be one of: open, closed, delay, remote, unknown.

We need the closing status for Lakewood City Schools (public school district), not other Lakewood organizations.
If multiple blocks mention Lakewood, pick the one that is a public school district and NOT a private school.
Ignore Lakewood Catholic Academy or other private entities.

Candidate blocks:
${candidateBlocks
  .map(
    (block, idx) => `#${idx + 1}\nTITLE: ${block.title}\nHTML: ${block.html}\nTEXT: ${block.text}`
  )
  .join('\n\n')}

If no matching district is found, return status "unknown".
`.trim();

      const vertexUrl =
        'https://us-central1-aiplatform.googleapis.com/v1/projects/358874041676/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent';
      const vertexResponse = await axios.post(
        vertexUrl,
        {
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 200,
          },
        },
        {
          headers: {
            'x-goog-api-key': vertexApiKey,
            'Content-Type': 'application/json',
          },
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
          confidence: 'low',
        };
      }

      payload = {
        updatedAt: now,
        match: parsed,
        sourceUrl: url,
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
}

module.exports = { getSchoolClosingsv1 };
