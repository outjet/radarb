const AMBIENT_WEATHER_API_URL = 'https://us-central1-radarb.cloudfunctions.net/getAmbientWeatherData';


// Format time as HH:MM:SS AM/PM
function formatTime(date) {
    return new Date().toLocaleString("en-US", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  }
  
  // Format day as full day name
  function formatDay(date) {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday"
    ];
    return days[date.getDay()];
  }
  
  // Update current time and day elements
  function updateCurrentTimeAndDay() {
    const currentTimeElement = document.querySelector("#current-time");
    const currentDayElement = document.querySelector("#current-day");
    
    currentTimeElement.innerHTML = formatTime(new Date());
    currentDayElement.innerHTML = formatDay(new Date());
  }
  
  // Call updateCurrentTimeAndDay initially
  updateCurrentTimeAndDay();
  
  // Function to fetch weather data from your weather station
  async function fetchWeatherDataFromStation() {
      try {
          const response = await fetch(AMBIENT_WEATHER_API_URL);
          if (!response.ok) {
              throw new Error('Network response was not ok');
          }
          const weatherData = await response.json();
          return weatherData[0].lastData;
      } catch (error) {
          console.error('Error fetching weather data from station:', error);
          throw error;
      }
  }
  
  // Function to update all weather fields on the webpage
  async function updateCurrentWeather() {
      try {
        const currentTemperatureElement = document.querySelector("#current-temperature");
        const currentFeelsLikeElement = document.querySelector("#feelslike-temperature");
          const currentDayElement = document.querySelector("#current-day");
          const currentTimeElement = document.querySelector("#current-time");
          const weatherTypeElement = document.querySelector("#weather-type");
          const humidityElement = document.querySelector("#humidity");
          const windElement = document.querySelector("#wind");
          const weatherDataFromStation = await fetchWeatherDataFromStation();
  
          currentTemperatureElement.innerHTML = `${weatherDataFromStation.tempf.toFixed(1)}°`;
          currentFeelsLikeElement.innerHTML = `${weatherDataFromStation.feelsLike.toFixed(1)}°`;
          weatherTypeElement.innerHTML = "Cloudy"; // You can update this based on your logic
          humidityElement.innerHTML = `${weatherDataFromStation.humidity}%`;
          windElement.innerHTML = `${Math.round(weatherDataFromStation.windspeedmph)}km/h`;
      } catch (error) {
          console.error('Error updating current weather:', error);
      }
  }
  
  // Call the updateCurrentWeather function to update all weather fields
  updateCurrentWeather();
  