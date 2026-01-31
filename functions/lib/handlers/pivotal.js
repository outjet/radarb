const axios = require('axios');
const cheerio = require('cheerio');
const { handleCors } = require('../core');

async function grabPivotalHRRR6hQPFv2(req, res) {
  if (handleCors(req, res)) return;
  try {
    const pageUrl =
      'https://www.pivotalweather.com/model.php?m=hrrr&p=qpf_006h-imp&fh=0&r=us_ma&dpdt=&mc=';
    const pageResponse = await axios.get(pageUrl);
    const $ = cheerio.load(pageResponse.data);
    const hrrr6hQPFimageUrl = $('#display_image').attr('src');
    res.set('Access-Control-Allow-Origin', '*');
    res.json({ imageUrl: hrrr6hQPFimageUrl });
  } catch (error) {
    console.error('Error in grabPivotalHRRR6hQPF:', error);
    res.status(500).send('Error fetching image URL');
  }
}

module.exports = { grabPivotalHRRR6hQPFv2 };
