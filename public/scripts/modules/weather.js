(function registerWeatherModule() {
  window.RADARB = window.RADARB || {};
  window.RADARB.modules = window.RADARB.modules || {};

  const core = window.RADARB.modules.core || {};
  const { fetchWithTimeout } = core;

  let ambientWeatherUrl = null;

  function configure(options = {}) {
    ambientWeatherUrl = options.ambientWeatherUrl || ambientWeatherUrl;
  }

  async function fetchWeatherDataFromStation() {
    if (!ambientWeatherUrl || !fetchWithTimeout) return null;
    try {
      const response = await fetchWithTimeout(ambientWeatherUrl, {}, 8000);
      if (!response.ok) throw new Error('Network response was not ok');
      const weatherData = await response.json();
      return weatherData[0].lastData;
    } catch (error) {
      console.error('Error fetching weather data from station:', error);
      throw error;
    }
  }

  function updateWeatherElements(data) {
    const forecast = window.RADARB.modules.forecast;
    if (!forecast) return;
    const { tempf, feelsLike, windspeedmph, windgustmph, maxdailygust } = data;

    forecast.setAmbientSnapshot({
      tempf,
      feelsLike,
      windspeedmph,
      windgustmph,
      maxdailygust,
    });

    const gustValue = Number.isFinite(maxdailygust)
      ? Math.round(maxdailygust)
      : Math.round(windgustmph);
    forecast.updateForecastCurrentCard(tempf, feelsLike, windspeedmph, windgustmph, gustValue);
  }

  async function updateCurrentWeather() {
    const time = window.RADARB.modules.time;
    try {
      const currentWeather = await fetchWeatherDataFromStation();
      if (!currentWeather) return;
      updateWeatherElements(currentWeather);
      if (time) time.markRefresh();
    } catch (error) {
      console.error('Error updating current weather:', error);
    }
  }

  function initAmbientWeather() {
    document.querySelectorAll('div.last-refresh').forEach((div) => {
      div.addEventListener('click', updateCurrentWeather);
    });
    updateCurrentWeather();
    setInterval(updateCurrentWeather, 5 * 60 * 1000);
  }

  window.RADARB.modules.weather = {
    configure,
    initAmbientWeather,
  };
})();
