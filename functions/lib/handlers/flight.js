const axios = require('axios');
const { getSecret, handleCors } = require('../core');

async function getFlightDelaysv2(req, res) {
  if (handleCors(req, res)) return;
  try {
    const aeroApiKey = await getSecret('projects/358874041676/secrets/aeroapi/versions/latest');
    const { airportCode } = req.query;
    const apiUrl = `https://aeroapi.flightaware.com/aeroapi/airports/delays?airport_code=${airportCode}`;
    const response = await axios.get(apiUrl, { headers: { 'x-apikey': aeroApiKey } });
    const delays = (response.data.delays || []).filter((delay) => delay.airport === airportCode);
    const delayReasons = delays.flatMap((delay) => delay.reasons.map((r) => r.reason));
    res.set('Access-Control-Allow-Origin', '*');
    res.status(200).send(delayReasons.join('\n'));
  } catch (error) {
    console.error('Error in getFlightDelays:', error);
    res.status(500).send('Error retrieving flight delays.');
  }
}

async function getGroundStopInfov2(req, res) {
  if (handleCors(req, res)) return;
  try {
    const apiUrl = 'https://soa.smext.faa.gov/asws/api/airport/status/cle';
    const response = await axios.get(apiUrl);
    const data = response.data;
    res.set('Access-Control-Allow-Origin', '*');
    if (!data.Delay && data.Status[0].Reason === 'No known delays for this airport') {
      res.status(200).send('');
    } else {
      res.status(200).send(data.Status);
    }
  } catch (error) {
    console.error('Error in getGroundStopInfo:', error);
    res.status(500).send('Error fetching ground stop information');
  }
}

async function getCityNamev2(req, res) {
  if (handleCors(req, res)) return;
  try {
    const googleMapsApiKey = await getSecret(
      'projects/358874041676/secrets/google-maps-api/versions/latest'
    );
    const { lat, lng } = req.query;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleMapsApiKey}`;
    const response = await axios.get(url);
    const data = response.data;
    if (data.results.length === 0) {
      res.status(404).json({ error: 'No address found' });
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
}

module.exports = {
  getFlightDelaysv2,
  getGroundStopInfov2,
  getCityNamev2,
};
