//app124.js
// Configuration
const userLat = 41.27;
const userLng = -81.82;

const AMBIENT_WEATHER_API_URL = 'https://us-central1-radarb.cloudfunctions.net/getAmbientWeatherDatav2';
const PIVOTAL_WEATHER_API_URL = 'https://us-central1-radarb.cloudfunctions.net/grabPivotalHRRR6hQPFv2';
let isFirstRefresh = true;
let sensorDataDisplayed = false;
let cityName = ""; // Declare globally

// Utility Functions
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d;
}

function toRadians(degrees) {
  return degrees * Math.PI / 180;
}

// Event Listeners
window.addEventListener("load", initializeApp);
window.addEventListener("loadCameraData", handleCameraData);
window.addEventListener("loadSensorData", handleSensorData);

// Initialization Function
function initializeApp() {
  const forecastContainer = document.querySelector('.forecast-container');
  forecastContainer.innerHTML = 'Loading forecast...';

  const lat = userLat;
  const lng = userLng;
  const boxsize = 12;
  const latne = lat + boxsize / 69;
  const lngne = lng + boxsize / 53;
  const latsw = lat - boxsize / 69;
  const lngsw = lng - boxsize / 53;

  // Dispatch events to load camera and sensor data
  fetchData(latne, lngne, latsw, lngsw, lat, lng);

  // Fetch weather forecast
  getWeatherForecast(lat, lng);

  // Display meteograms after a short delay
  setTimeout(loadMeteograms, 3000);
}

function fetchData(latne, lngne, latsw, lngsw, lat, lng) {
  // Fetch camera and sensor data in parallel
  window.dispatchEvent(new CustomEvent("loadCameraData", {
    detail: { latne, lngne, latsw, lngsw, lat, lng }
  }));
  window.dispatchEvent(new CustomEvent("loadSensorData", {
    detail: { latne, lngne, latsw, lngsw, lat, lng }
  }));
}

async function handleCameraData(event) {
  const { latne, lngne, latsw, lngsw, lat, lng } = event.detail;
  try {
    const response = await fetch(`https://us-central1-radarb.cloudfunctions.net/getCameraDatav2?latne=${latne}&lngne=${lngne}&latsw=${latsw}&lngsw=${lngsw}`);
    const data = await response.json();
    displayCameraData(data, lat, lng);
  } catch (error) {
    console.error('Error fetching camera data:', error);
  }
}

function displayCameraData(data, userLat, userLng) {
  const cameraDistances = data.results.map(camera => ({
    camera,
    distance: haversine(userLat, userLng, camera.latitude, camera.longitude)
  }));

  cameraDistances.sort((a, b) => a.distance - b.distance);

  const imageGrid = document.querySelector(".image-grid");
  imageGrid.innerHTML = ""; // Clear previous cameras

  cameraDistances.slice(0, 4).forEach(({ camera }) => {
    const div = document.createElement("div");
    const img = document.createElement("img");
    img.src = camera.cameraViews[0].smallUrl;
    img.alt = camera.description;
    img.loading = "lazy";

    const caption = document.createElement("div");
    caption.className = "caption";
    caption.textContent = camera.cameraViews[0].mainRoute.includes("Hilliard")
      ? 'I-90 between Hilliard/Mckinley'
      : camera.cameraViews[0].mainRoute;

    div.appendChild(img);
    div.appendChild(caption);
    imageGrid.appendChild(div);
  });
}

async function handleSensorData(event) {
  const { latne, lngne, latsw, lngsw, lat, lng } = event.detail;
  if (sensorDataDisplayed) return;
  try {
    const response = await fetch(`https://us-central1-radarb.cloudfunctions.net/getSensorDatav2?latne=${latne}&lngne=${lngne}&latsw=${latsw}&lngsw=${lngsw}`);
    const data = await response.json();
    sensorDataDisplayed = true;
    displaySensorData(data, lat, lng);
    updateTime(lat, lng);
  } catch (error) {
    console.error('Error fetching sensor data:', error);
  }
}

function displaySensorData(data, lat, lng) {
  const sensorContainer = document.querySelector(".sensor-container");
  sensorContainer.innerHTML = ""; // Clear previous sensors

  const sensorDistances = data.results.flatMap(result => 
    result.surfaceSensors
      .filter(sensor => sensor.surfaceTemperature !== -9999999.0)
      .map(sensor => ({
        sensor,
        distance: haversine(lat, lng, sensor.latitude, sensor.longitude)
      }))
  );

  sensorDistances.sort((a, b) => a.distance - b.distance);

  sensorDistances.slice(0, 3).forEach(({ sensor }) => {
    const div = document.createElement("div");
    div.className = "sensor-box" + (sensor.status === "Ice Watch" ? " IceWatch" : "");
    div.innerHTML = `${sensor.name.slice(0, -4)}<br>`;
    if (sensor.description) div.innerHTML += `Description: ${sensor.description}<br>`;
    if (sensor.condition) div.innerHTML += `Condition: ${sensor.condition}<br>`;
    div.innerHTML += `Surface temp: ${sensor.surfaceTemperature}<br>Status: ${sensor.status}`;
    sensorContainer.appendChild(div);
  });

  if (data.results.length === 0) {
    const div = document.createElement("div");
    div.className = "sensor-box";
    div.textContent = "No sensor data returned from ODOT";
    sensorContainer.appendChild(div);
  }

  const forecastDiv = document.createElement("div");
  forecastDiv.className = "sensor-box";
  forecastDiv.style.backgroundColor = "#DDD";
  forecastDiv.innerHTML = `
    <a href='https://forecast.weather.gov/product.php?site=CLE&issuedby=CLE&product=AFD&format=CI&version=1&glossary=1&highlight=off' target='_blank'>Forecast discussion</a><br>
    <a href='https://icyroadsafety.com/lcr/' target='_blank'>Icy Road Forecast</a><br>
    <a href='http://wxmaps.org/pix/clegfs.png' target='_blank'>GFS</a>
    <a href='http://wxmaps.org/pix/clegfsb.png' target='_blank'>GFSLR</a>
    <a href='http://wxmaps.org/pix/clenam.png' target='_blank'>NAM</a>
  `;
  sensorContainer.appendChild(forecastDiv);

  const clocksDiv = document.createElement("div");
  clocksDiv.className = "sensor-box";
  clocksDiv.id = "clocks";
  clocksDiv.style.backgroundColor = "#DDD";
  clocksDiv.innerHTML = `
    <div><span id='local-time'>--:--:--</span> ET</div>
    <div><span id='refresh-paused' style='display:none;'>REFRESH PAUSED</span></div>
  `;
  sensorContainer.appendChild(clocksDiv);

  // Event Listener to Resume Refresh
  clocksDiv.addEventListener("click", () => {
    const refreshPaused = document.getElementById("refresh-paused");
    refreshPaused.style.display = "none";
    restartImageRefresh();
  });
}

function loadMeteograms() {
  const meteosDiv = document.querySelector('.meteos');
  const urlb = '&wfo=CLE&zcode=LEZ146&gset=20&gdiff=6&unit=0&tinfo=EY5&pcmd=10111110111110000000000000000000000000000000000000000000000&lg=en&indu=0!1!1!&dd=&bw=&hrspan=48&pqpfhr=6&psnwhr=6';
  const images = [
    { hour: 0, src: `https://marine.weather.gov/meteograms/Plotter.php?lat=${userLat}&lon=${userLng}&ahour=0${urlb}` },
    { hour: 48, src: `https://marine.weather.gov/meteograms/Plotter.php?lat=${userLat}&lon=${userLng}&ahour=48${urlb}` },
    { hour: 96, src: `https://marine.weather.gov/meteograms/Plotter.php?lat=${userLat}&lon=${userLng}&ahour=96${urlb}` },
  ];

  images.forEach(image => {
    const img = document.createElement("img");
    img.src = image.src;
    img.alt = `Meteogram for ${image.hour} hours`;
    img.loading = "lazy";
    meteosDiv.appendChild(img);
  });
}

function restartImageRefresh() {
  clearInterval(refreshIntervalId);
  refreshIntervalId = setInterval(() => {
    const images = document.querySelectorAll(".image-grid img");
    images.forEach(img => {
      const currentSrc = img.getAttribute("src").split('?')[0];
      img.src = `${currentSrc}?t=${Date.now()}`;
    });
  }, 4250);
}

// Weather Forecast
async function getWeatherForecast(lat, lng) {
  const forecastContainer = document.querySelector('.forecast-container');
  try {
    let data = getCachedWeatherData();
    if (!data) {
      data = await fetchWeatherData(lat, lng);
      cacheWeatherData(data);
    }

    renderWeatherForecast(data);
  } catch (error) {
    forecastContainer.innerHTML = 'Error loading forecast.';
    console.error(error);
  }
}

function getCachedWeatherData() {
  const cachedData = localStorage.getItem('weatherData');
  const cachedDataTime = localStorage.getItem('weatherDataTime');
  const currentTime = Date.now();
  if (cachedData && cachedDataTime && ((currentTime - cachedDataTime) / 1000 / 60 < 1)) {
    return JSON.parse(cachedData);
  }
  localStorage.removeItem('weatherData');
  localStorage.removeItem('weatherDataTime');
  return null;
}

async function fetchWeatherData(lat, lng) {
  const response = await fetch(`https://us-central1-radarb.cloudfunctions.net/getWeatherDatav2?lat=${lat}&lng=${lng}`);
  if (!response.ok) throw new Error('Failed to fetch weather data');
  return await response.json();
}

function cacheWeatherData(data) {
  localStorage.setItem('weatherData', JSON.stringify(data));
  localStorage.setItem('weatherDataTime', Date.now());
}

function renderWeatherForecast(data) {
  const fiveDays = data.daily.slice(0, 5);
  const forecastContainer = document.querySelector('.forecast-container');
  forecastContainer.innerHTML = ''; // Clear loading message

  fiveDays.forEach(day => {
    const { dt, temp, weather } = day;
    const dayName = new Date(dt * 1000).toLocaleString('default', { weekday: 'short' });
    const high = temp.max.toFixed(0);
    const low = temp.min.toFixed(0);
    const iconCode = weather[0].icon;
    const iconUrl = `../images/${iconCode}.png`;

    const forecastDiv = document.createElement("div");
    forecastDiv.className = "forecast";
    forecastDiv.innerHTML = `
      <div class="day">${dayName}</div>
      <div class="weather-icon-div"><img src="${iconUrl}" class="weather-icon" alt="Weather icon"></div>
      <div class="high-low">${high}/${low}</div>
    `;
    forecastContainer.appendChild(forecastDiv);
  });
}

// Meteogram Animation (Optional and Suspended for now)
/* 
function animateDynamicImages() {
  const baseUrl = 'https://x-hv1.pivotalweather.com/maps/rtma_ru/latest/series_';
  const imageExtension = '.png';
  const numImages = 36;
  const animationContainer = document.getElementById('animationContainer');
  let currentIndex = 0;

  function updateAnimationContainer() {
    const imageUrl = `${baseUrl}${String(currentIndex).padStart(3, '0')}/sfct-imp.us_state_oh${imageExtension}`;
    animationContainer.style.backgroundImage = `url(${imageUrl})`;
    currentIndex = (currentIndex + 1) % numImages;
  }

  setInterval(updateAnimationContainer, 1000);
}
*/

// Image Refresh
let refreshIntervalId = setInterval(restartImageRefresh, 4250);

// Function to fetch and update current weather
async function fetchWeatherDataFromStation() {
  try {
    const response = await fetch(AMBIENT_WEATHER_API_URL);
    if (!response.ok) throw new Error('Network response was not ok');
    const weatherData = await response.json();
    return weatherData[0].lastData;
  } catch (error) {
    console.error('Error fetching weather data from station:', error);
    throw error;
  }
}

async function updateCurrentWeather() {
  try {
    const currentWeather = await fetchWeatherDataFromStation();
    updateWeatherElements(currentWeather);
    lastRefreshTimestamp = Date.now();
    updateRefreshTimer();
  } catch (error) {
    console.error('Error updating current weather:', error);
  }
}

function updateWeatherElements(data) {
  const elTemp = document.getElementById("current-temperature");
  if (elTemp) elTemp.textContent = `${tempf.toFixed(1)}°`;
  
  const elFeels = document.getElementById("feelslike-temperature");
  if (elFeels) elFeels.textContent = `Feels like ${feelsLike.toFixed(1)}°`;
  
  const elHumidity = document.getElementById("humidity");
  if (elHumidity) elHumidity.textContent = `${humidity}%`;
  
  const elWind = document.getElementById("wind");
  if (elWind) elWind.textContent = `${Math.round(windspeedmph)} mph`;
  
  const elGusts = document.getElementById("windgusts");
  if (elGusts) elGusts.textContent = `Gusts to ${Math.round(windgustmph)} mph`;
  
  const elUv = document.getElementById("uv");
  if (elUv) elUv.textContent = `${Math.round(uv)}`;
  const windArrow = document.getElementById('windArrow');
  if (windArrow) {
    windArrow.style.transform = `translateX(-50%) rotate(${winddir}deg)`;
  }
}

document.querySelectorAll('div.last-refresh').forEach(div => {
  div.addEventListener('click', updateCurrentWeather);
});

// Initial Weather Update
updateCurrentWeather();

// Refresh Timer
let lastRefreshTimestamp = Date.now();

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

function updateRefreshTimer() {
  const currentTime = Date.now();
  const elapsedSeconds = Math.floor((currentTime - lastRefreshTimestamp) / 1000);
  const timerElement = document.getElementById("refresh-timer");
  const timerContainer = document.querySelector(".weather-refresh");

  if (timerElement) {
    if (isFirstRefresh) {
      isFirstRefresh = false;
      timerContainer.style.display = "block";
    }

    timerElement.textContent = formatTime(elapsedSeconds);
  }
}

setInterval(updateRefreshTimer, 1000);

// Update Local Time and Fetch City Name
async function updateTime(lat, lng) {
  const localTime = new Date().toLocaleString("en-US", {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  document.getElementById("local-time").textContent = localTime;

  setInterval(() => {
    const localTime = new Date().toLocaleString("en-US", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    document.getElementById("local-time").textContent = localTime;
  }, 1000);

  // Fetch and display city name
  // if (!cityName) {
  //   try {
  //     const response = await fetchCityName(lat, lng);
  //     displayCityName(response, lat, lng);
  //   } catch (error) {
  //     console.error('Error fetching city name:', error);
  //   }
  // }
}

async function fetchCityName(lat, lng) {
  const url = `https://us-central1-radarb.cloudfunctions.net/getCityNamev2?lat=${lat}&lng=${lng}`;
  const cache = await caches.open("my-cache");
  const cachedResponse = await cache.match(url);
  if (cachedResponse) return await cachedResponse.json();
  
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch city name');
  return await response.json();
}

function displayCityName(data, lat, lng) {
  const youAreHereSpan = document.getElementById("you-are-here");
  const formattedAddress = data.address;
  const premiseType = data.premiseType;

  youAreHereSpan.innerHTML += `Found you at: <a href="https://ohgo.com/cleveland?lt=${lat}&ln=${lng}&z=13&ls=incident,incident-waze,dangerous-slowdown,camera,delay,weather,weather-roadsensors,sign" target="_blank">${formattedAddress}</a> - ${premiseType}<br><br>`;
}

window.dispatchEvent(new Event("updateTime"));

// Fetch Flight Delays and Ground Stops
window.addEventListener("load", () => {
  checkFlightDelays('KCLE');
  // Ground stops code is commented out as per original
});

function checkFlightDelays(airportCode) {
  fetch(`https://us-central1-radarb.cloudfunctions.net/getFlightDelaysv2?airportCode=${airportCode}`)
    .then(response => response.text())
    .then(data => {
      if (data.length > 0) {
        const airportDelays = document.querySelector(".airportDelays");
        const delaysContainer = document.querySelector('.delays-container');
        airportDelays.textContent += `✈ ${data}`;
        delaysContainer.style.display = 'block';
      }
    })
    .catch(error => console.error('Error fetching flight delays:', error));
}

let duskChart = null;

async function renderDuskChart() {
  const res = await fetch('https://firestore.googleapis.com/v1/projects/radarb/databases/(default)/documents/duskLog');
  const data = await res.json();

  if (!data.documents) return;

  const labels = [];
  const duskHours = [];

  data.documents.forEach(doc => {
    const date = doc.name.split('/').pop();
    const duskStr = doc.fields.dusk.stringValue;

    const [hour, minute] = duskStr.split(':').map(n => parseInt(n, 10));
    const decimalHour = hour + minute / 60;

    labels.push(date);
    duskHours.push(decimalHour);
  });
  renderDuskTable(labels, duskHours);

  const ctx = document.getElementById('duskChart').getContext('2d');

  if (duskChart) {
    duskChart.destroy();
  }

  duskChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Civil Twilight End',
        data: duskHours,
        fill: false,
        borderColor: '#4bc0c0',
        tension: 0.2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.parsed.y;
              const hours = Math.floor(val);
              const minutes = Math.round((val - hours) * 60);
              const labelTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
              return `Civil Twilight End: ${labelTime}`;
            }
          }
        },
        title: {
          display: true,
          text: 'Dusk Time Progression (EST)'
        }
      },
      scales: {
        y: {
          title: {
            display: true,
            text: 'Hour of Day'
          },
          min: 16,
          max: 22
        }
      }
    }
  });
}

// Auto-render once page loads
window.addEventListener('load', () => {
  setTimeout(() => {
    renderDuskChart();
  }, 100);
});

function renderDuskTable(dates, hours) {
  const container = document.getElementById('duskTableContainer');
  container.innerHTML = ''; // Clear previous content

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.fontSize = '0.9em';

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th style="text-align:left; padding: 6px; border-bottom: 1px solid #888;">Date</th>
      <th style="text-align:left; padding: 6px; border-bottom: 1px solid #888;">Dusk Time</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  for (let i = 0; i < dates.length; i++) {
    const decimal = hours[i];
    const h = Math.floor(decimal);
    const m = Math.round((decimal - h) * 60);
    const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding: 6px 8px; border-bottom: 1px solid #333;">${dates[i]}</td>
      <td style="padding: 6px 8px; border-bottom: 1px solid #333;">${time}</td>
    `;
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  container.appendChild(table);
}