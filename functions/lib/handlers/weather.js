const axios = require('axios');
const { getSecret, handleCors } = require('../core');

async function getWeatherDatav2(req, res) {
  if (handleCors(req, res)) return;
  try {
    const openWeatherMapApiKey = await getSecret(
      'projects/358874041676/secrets/openweathermap/versions/latest'
    );
    const { lat, lng } = req.query;
    const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lng}&exclude=minutely&units=imperial&appid=${openWeatherMapApiKey}`;
    const response = await axios.get(url);
    res.set('Access-Control-Allow-Origin', '*');
    res.json(response.data);
  } catch (error) {
    console.error('Error in getWeatherData:', error);
    res.status(500).send('Error fetching weather data.');
  }
}

async function getAmbientWeatherDatav2(req, res) {
  if (handleCors(req, res)) return;
  try {
    const applicationKey = await getSecret(
      'projects/358874041676/secrets/ambient-weather-application-key/versions/latest'
    );
    const apiKey = await getSecret(
      'projects/358874041676/secrets/ambient-weather-api-key/versions/latest'
    );
    const API_URL = `https://api.ambientweather.net/v1/devices?applicationKey=${applicationKey}&apiKey=${apiKey}`;
    const response = await axios.get(API_URL);
    res.set('Access-Control-Allow-Origin', '*');
    res.json(response.data);
  } catch (error) {
    console.error('Error in getAmbientWeatherData:', error);
    res.status(500).json({ error: 'Error retrieving Ambient Weather data' });
  }
}

module.exports = {
  getWeatherDatav2,
  getAmbientWeatherDatav2,
};
