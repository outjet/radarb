let userLat = 41.48;
let userLng = -81.81;
const AMBIENT_WEATHER_API_URL = 'https://us-central1-radarb.cloudfunctions.net/getAmbientWeatherData';
const PIVOTAL_WEATHER_API_URL = 'https://us-central1-radarb.cloudfunctions.net/getPivotalHRRR6hQPF';
let isFirstRefresh = true;

let sensorDataDisplayed = false;
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d;
}
function toRadians(degrees) {
  return degrees * Math.PI / 180;
}

window.addEventListener("load", () => {
  const forecastContainer = document.querySelector('.forecast-container');
  forecastContainer.innerHTML = 'Loading forecast... . .';
  console.log('Using fixed geolocation');

  const lat = userLat;
  const lng = userLng;
  const boxsize = 8;
  const latne = lat + boxsize / 69;
  const lngne = lng + boxsize / 53;
  const latsw = lat - boxsize / 69;
  const lngsw = lng - boxsize / 53;

  console.log('Latitude ', lat);
  console.log('Longitude ', lng);

  // Dispatch events to load camera and sensor data
  window.dispatchEvent(new CustomEvent("loadCameraData", {
    detail: { latne, lngne, latsw, lngsw, lat, lng }
  }));

  console.log(`About to call getWeatherForecast with ${lat}, ${lng}`);

  getWeatherForecast(lat, lng);

  window.dispatchEvent(new CustomEvent("loadSensorData", {
    detail: { latne, lngne, latsw, lngsw, lat, lng }
  }));

  // Display meteograms for the current location
  setTimeout(() => {
    const meteosDiv = document.querySelector('.meteos');
    const urlb = '&wfo=CLE&zcode=LEZ146&gset=20&gdiff=6&unit=0&tinfo=EY5&pcmd=10111110111110000000000000000000000000000000000000000000000&lg=en&indu=0!1!1!&dd=&bw=&hrspan=48&pqpfhr=6&psnwhr=6'
    const images = [
      {
        hour: 0,
        src: `https://marine.weather.gov/meteograms/Plotter.php?lat=${lat}&lon=${lng}&ahour=0${urlb}`,
      },
      {
        hour: 48,
        src: `https://marine.weather.gov/meteograms/Plotter.php?lat=${lat}&lon=${lng}&ahour=48${urlb}`,
      },
      {
        hour: 96,
        src: `https://marine.weather.gov/meteograms/Plotter.php?lat=${lat}&lon=${lng}&ahour=96${urlb}`,
      },
    ];

    // Create an <img> element for each meteogram and append it to the .meteos div
    for (const image of images) {
      const img = document.createElement('img');
      img.setAttribute('src', image.src);
      img.setAttribute('alt', `Meteogram for ${image.hour} hours`);
      meteosDiv.appendChild(img);
    }
  }, 3000);
});

// CAMERAS 

window.addEventListener("loadCameraData", (event) => {
  const { latne, lngne, latsw, lngsw, lat, lng } = event.detail;
  fetch(`https://us-central1-radarb.cloudfunctions.net/getCameraData?latne=${latne}&lngne=${lngne}&latsw=${latsw}&lngsw=${lngsw}`)
    .then(response => response.json())
    .then(data => {
      displayCameraData(data, lat, lng);
    })
    .catch(error => {
      console.error(error);
    });
});

const displayCameraData = (data, userLat, userLng) => {
  const cameraDistances = [];

  // Calculate the distance from the user's location to each camera
  data.results.forEach(camera => {
    const distance = haversine(userLat, userLng, camera.latitude, camera.longitude);
    cameraDistances.push({ camera, distance });
  });

  // Sort the cameras by their distance
  cameraDistances.sort((a, b) => a.distance - b.distance);

  // Display the closest four cameras
  const imageGrid = document.querySelector(".image-grid");
  imageGrid.innerHTML = ""; // clear previous cameras
  for (let i = 0; i < Math.min(4, cameraDistances.length); i++) {
    const camera = cameraDistances[i].camera;
    const div = document.createElement("div");
    const img = document.createElement("img");
    img.setAttribute("src", camera.cameraViews[0].smallUrl);
    img.setAttribute("alt", camera.description);
    const caption = document.createElement("div");
    caption.classList.add("caption");
    if (camera.cameraViews[0].mainRoute.includes("Hilliard")) {
      caption.textContent = 'I-90 between Hilliard/Mckinley';
    } else {
      caption.textContent = camera.cameraViews[0].mainRoute;
    }
    div.appendChild(img);
    div.appendChild(caption);
    imageGrid.appendChild(div);
  }
};

window.addEventListener("load", () => {
  let refreshIntervalId = setInterval(() => {
    let images = document.querySelectorAll(".image-grid img");
    images.forEach(img => {
      let currentSrc = img.getAttribute("src");
      img.setAttribute("src", currentSrc + "?t=" + new Date().getTime());
    });
  }, 4250);

});

// SENSORS
const displaySensorData = (data, lat, lng) => {
  // Ensure sensorContainer is defined at the beginning of the function
  const sensorContainer = document.querySelector(".sensor-container");
  if (!sensorContainer) {
    console.error("Sensor container not found");
    return;
  }

  const sensorDistances = [];

  // Calculate the distance from the user's location to each sensor
  console.log(`Calculate the distance from the user's location to each sensor`);
  data.results.forEach(result => {
    result.surfaceSensors.forEach(sensor => {
      if (sensor.surfaceTemperature === -9999999.0) return;
      const distance = haversine(lat, lng, sensor.latitude, sensor.longitude);
      sensorDistances.push({ sensor, distance });
    });
  });

  // Sort the sensors by their distance
  sensorDistances.sort((a, b) => a.distance - b.distance);

  // Display the closest three sensors
  console.log(`Display the closest three sensors`);
  for (let i = 0; i < Math.min(3, sensorDistances.length); i++) {
    const sensor = sensorDistances[i].sensor;
    const div = document.createElement("div");
    div.classList.add("sensor-box");
    if (sensor.status === "Ice Watch") {
      div.classList.add("IceWatch");
    }

    let sensorDetails = "";
    div.innerHTML = sensor.name.substring(0, sensor.name.length - 4);
    if (sensor.description) {
      sensorDetails += "<br>" + "Description: " + sensor.description;
    }
    if (sensor.condition) {
      sensorDetails += "<br>" + "Condition: " + sensor.condition;
    }
    console.log(`Add sensor details to the DOM`);
    div.innerHTML += sensorDetails;
    div.innerHTML += "<br>" + "Surface temp: " + sensor.surfaceTemperature;
    div.innerHTML += "<br>" + "Status: " + sensor.status;
    sensorContainer.appendChild(div);
  }


  // Check if sensor data is empty
  console.log(`Check if sensor data is empty`);
  if (data.results.length === 0) {
    const sensorContainer = document.querySelector(".sensor-container");
    const div = document.createElement("div");
    div.classList.add("sensor-box");
    div.innerHTML = "No sensor data returned from ODOT";
    sensorContainer.appendChild(div);
  }

  const forecastDiv = document.createElement("div");
  forecastDiv.classList.add("sensor-box");
  forecastDiv.style.backgroundColor = "#DDD";
  forecastDiv.innerHTML = "<a href='https://forecast.weather.gov/product.php?site=CLE&issuedby=CLE&product=AFD&format=CI&version=1&glossary=1&highlight=off' target='_blank'>Forecast discussion</a><br><a href='https://icyroadsafety.com/lcr/' target='_blank'>Icy Road Forecast</a><br><a href='http://wxmaps.org/pix/clegfs.png' target='_blank'>GFS </A> <a href='http://wxmaps.org/pix/clegfsb.png' target='_blank'>GFSLR </a> <a href='http://wxmaps.org/pix/clenam.png' target='_blank'>NAM</a>";
  sensorContainer.appendChild(forecastDiv);

  const clocksDiv = document.createElement("div");
  clocksDiv.classList.add("sensor-box");
  clocksDiv.id = "clocks";
  clocksDiv.style.backgroundColor = "#DDD";
  clocksDiv.style.color = "#white";
  clocksDiv.innerHTML = "<div><span id='local-time'></span> ET</div><div><div><span id='refresh-paused' style='display:none;'>REFRESH PAUSED</span></div>";
  sensorContainer.appendChild(clocksDiv);

  document.getElementById("clocks").addEventListener("click", function () {
    let clocks = document.getElementById("clocks");
    clocks.style.backgroundColor = "#DDD";
    clocks.style.color = "white";
    document.getElementById("refresh-paused").style.display = "none";
    refreshIntervalId = setInterval(() => {
      let images = document.querySelectorAll(".image-grid img");
      images.forEach(img => {
        let currentSrc = img.getAttribute("src");
        img.setAttribute("src", currentSrc + "?t=" + new Date().getTime());
      });
    }, 4250);
  });
};


window.addEventListener("loadSensorData", (event) => {
  const { latne, lngne, latsw, lngsw, lat, lng } = event.detail;
  console.log(`starting loadSensorData`);
  if (sensorDataDisplayed) {
    return;
  }
  console.log(`fetching getSensorData function`);
  fetch(`https://us-central1-radarb.cloudfunctions.net/getSensorData?latne=${latne}&lngne=${lngne}&latsw=${latsw}&lngsw=${lngsw}`)
    // fetch(`http://127.0.0.1:5005/radarb/us-central1/getSensorData?latne=${latne}&lngne=${lngne}&latsw=${latsw}&lngsw=${lngsw}`)
    .then(response => response.json())
    .then(data => {
      sensorDataDisplayed = true;
      console.log(`displaying SensorData`);
      displaySensorData(data, lat, lng);
      console.log(`updateTime starting`);
      updateTime(lat, lng);
      // setInterval(() => {
      //   updateTime(lat, lng);
      // }, 1000);
    })
    .catch(error => {
      console.error(error);
    });
});

let cityName = "";

window.addEventListener("load", () => {
  console.log(`dispatching updateTime`);
  window.dispatchEvent(new Event("updateTime"));
});

async function updateTime(lat, lng) {
  const localTime = new Date().toLocaleString("en-US", {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  document.getElementById("local-time").innerHTML = localTime;


  setInterval(() => {
    const localTime = new Date().toLocaleString("en-US", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    document.getElementById("local-time").innerHTML = localTime;
  }, 1000);

  const youAreHereSpan = document.getElementById("you-are-here");
  if (cityName) {
  } else {
    // Fetch the city name from the coordinates
    const cache = await caches.open("my-cache");
    const url = 'https://us-central1-radarb.cloudfunctions.net/getCityName?lat=' + lat + '&lng=' + lng;
    // const url = 'http://127.0.0.1:5005/radarb/us-central1/getCityName?lat=' + lat + '&lng=' + lng;    
    console.log(`about to await getCityName`);
    const response = await cache.match(url) || await fetch(url);
    const data = await response.json();
    console.log(`got the cityName`);
    // const addressComponents = data.results[0].address_components;
    // const formattedAddress = data.address;
    // const premiseType = data.premiseType;
    // youAreHereSpan.innerHTML += `Found you at: <A Href="https://ohgo.com/cleveland?lt=${lat}&ln=${lng}&z=13&ls=incident,incident-waze,dangerous-slowdown,camera,delay,weather,weather-roadsensors,sign" target="_blank">${formattedAddress}</A> - ${premiseType}<br><br>`;
  }
}

async function getWeatherForecast(lat, lng) {
  const forecastContainer = document.querySelector('.forecast-container');
  try {
    let data;
    const cachedData = localStorage.getItem('weatherData');
    if (cachedData) {
      const cachedDataTime = localStorage.getItem('weatherDataTime');
      const currentTime = Date.now();
      if ((currentTime - cachedDataTime) / 1000 / 60 < 1) {
        data = JSON.parse(cachedData);
        console.log(`using cached onecall`);
      } else {
        localStorage.removeItem('weatherData');
        localStorage.removeItem('weatherDataTime');
      }
    }
    if (!data) {
      console.log(`fetching live onecall getWeatherData with lat: ${lat} and lng: ${lng}`);
      const response = await fetch(`https://us-central1-radarb.cloudfunctions.net/getWeatherData?lat=${lat}&lng=${lng}`);
      data = await response.json();
      localStorage.setItem('weatherData', JSON.stringify(data));
      localStorage.setItem('weatherDataTime', Date.now());
    }
    const fiveDays = data.daily.slice(0, 5);
    const hourlyForecast = data.hourly;
    const runway_deg = 58.1; //KCLE Runway 06L/24R
    const opposite_runway_deg = (runway_deg + 180) % 360;
    const crosswindThreshold = 20; // mph
    let crosswindAlert = null;
    let crosswindSpeed = 0;
    let maxcrosswindSpeed = 0;
    let maxCrosswindTime = null;
    for (const hour of hourlyForecast) {
      const { dt, wind_speed, wind_deg } = hour;
      let crosswind;
      if (Math.abs(wind_deg - runway_deg) <= Math.abs(wind_deg - opposite_runway_deg)) {
        crosswind = wind_speed * Math.sin((wind_deg - runway_deg) * Math.PI / 180);
      } else {
        crosswind = wind_speed * Math.sin((wind_deg - opposite_runway_deg) * Math.PI / 180);
      }
      if (Math.abs(crosswind) >= crosswindThreshold) {
        crosswindAlert = dt;
        crosswindSpeed = crosswind;
        if (Math.abs(crosswind) > maxcrosswindSpeed) {
          maxcrosswindSpeed = Math.abs(crosswind);
          maxCrosswindTime = new Date(dt * 1000);
        }
        break;
      } else if (Math.abs(crosswind) > maxcrosswindSpeed) {
        maxcrosswindSpeed = Math.abs(crosswind);
        maxCrosswindTime = new Date(dt * 1000);
      }
    }

    const crosswindContainer = document.querySelector('.crosswind-container');
    crosswindContainer.innerHTML += '';
    console.log('Checking for 06L/24R crosswinds');

    if (crosswindAlert) {
      const alertDiv = document.createElement("div");
      alertDiv.classList.add("crosswind-alert");
      alertDiv.innerHTML = `CLE Runway Crosswind Alert starting ${new Date(crosswindAlert * 1000).toLocaleString()}`;

      // Find the hour with maximum crosswind
      const maxCrosswindHour = hourlyForecast.reduce((maxHour, hour) => {
        const { wind_speed, wind_deg } = hour;
        let crosswind;
        if (Math.abs(wind_deg - runway_deg) <= Math.abs(wind_deg - opposite_runway_deg)) {
          crosswind = wind_speed * Math.sin((wind_deg - runway_deg) * Math.PI / 180);
        } else {
          crosswind = wind_speed * Math.sin((wind_deg - opposite_runway_deg) * Math.PI / 180);
        }
        if (Math.abs(crosswind) > Math.abs(maxHour.crosswind)) {
          return {
            crosswind: crosswind,
            wind_speed: wind_speed,
            wind_deg: wind_deg,
            dt: hour.dt
          };
        } else {
          return maxHour;
        }
      }, { crosswind: 0, wind_speed: 0, wind_deg: 0, dt: 0 });

      // Format the output for the maximum crosswind
      const maxCrosswindDate = new Date(maxCrosswindHour.dt * 1000).toLocaleString();
      console.log('about to spit out the max crosswinds')
      const maxCrosswindOutput = `<BR>Max crosswind ${Math.abs(maxCrosswindHour.crosswind.toFixed(0))} MPH (${Math.abs(maxCrosswindHour.wind_speed.toFixed(0))} @ ${Math.abs(maxCrosswindHour.wind_deg.toFixed(0))}°) ${maxCrosswindDate}`;
      alertDiv.innerHTML += maxCrosswindOutput;
      crosswindContainer.appendChild(alertDiv);
    }


    setTimeout(() => {
      if (data.alerts) {
        data.alerts.forEach(alert => {
          if (alert.event.includes("Small Craft Advisory")) {
            return;
          }

          const alertDiv = document.createElement("div");
          alertDiv.classList.add("weather-alert");

        // Find the index of the first hyphen
        const firstHyphenIndex = alert.description.indexOf('-');

        // Get the substring before the first hyphen (up to 82 characters)
        const truncatedDescription = alert.description.substring(0, firstHyphenIndex > -1 ? firstHyphenIndex : 82);

          // Create a span to hold the truncated description and a button to expand it
          const descriptionSpan = document.createElement("span");
          descriptionSpan.textContent = truncatedDescription;

          const readMoreButton = document.createElement("button");
          readMoreButton.textContent = "read more...";
          readMoreButton.classList.add("readmorebutton"); // Add the readmorebutton class

          readMoreButton.addEventListener("click", () => {
            descriptionSpan.textContent = alert.description;
            readMoreButton.style.display = "none";
          });


          // Add the truncated description and the "read more..." button to the alertDiv
          alertDiv.innerHTML = `${alert.event} - `;
          alertDiv.appendChild(descriptionSpan);
          alertDiv.appendChild(readMoreButton);

          crosswindContainer.appendChild(alertDiv)
        });
      }
    }, 20); //delay loading weather alert section for 10 seconds. 


    const forecastContainer = document.querySelector('.forecast-container');
    forecastContainer.innerHTML = ''; // Clear loading message
    fiveDays.forEach(day => {
      const { dt, temp, weather } = day;
      const dayName = new Date(dt * 1000).toLocaleString('default', { weekday: 'short' });
      const high = temp.max.toFixed(0);
      const low = temp.min.toFixed(0);
      const iconCode = weather[0].icon;
      const iconUrl = `images/${iconCode}.png`;

      const forecastDiv = document.createElement("div");
      forecastDiv.classList.add("forecast");
      forecastDiv.innerHTML = `
    <div class="day">${dayName}</div>
    <div class="weather-icon-div"><img src="${iconUrl}" class="weather-icon"></div>
    <div class="high-low">${high}/${low}</div>
  `;
      forecastContainer.appendChild(forecastDiv);
    });
  } catch (error) {
    forecastContainer.innerHTML = 'Error loading forecast.';
    console.error(error);
  }
}

window.addEventListener("load", () => {
  // Select container for ground stops
  const groundStopsContainer = document.querySelector('.ground-stops');

  // Select the delays container
  const airportDelays = document.querySelector(".airportDelays");
  const delaysContainer = document.querySelector('.delays-container');

  console.log('Checking for ground stops');
  console.log('Just kidding, I have commented this code out');

  // fetch("https://us-central1-radarb.cloudfunctions.net/getGroundStopInfo")
  // fetch("http://127.0.0.1:5005/radarb/us-central1/getGroundStopInfo")
  // .then((response) => response.text())
  // .then((data) => {
  //   if (data.length > 0) {
  //     // Append the ground stop data to the new container
  //     groundStopsContainer.textContent = data;
  //     groundStopsContainer.style.display = 'block';
  //   }
  // })
  // .catch((error) => console.error(error))
  // ;

  console.log('Checking for KCLE delays');
  let airportCode = 'KCLE';
  // fetch(`http://127.0.0.1:5005/radarb/us-central1/getFlightDelays?airportCode=${airportCode}`)
  fetch(`https://us-central1-radarb.cloudfunctions.net/getFlightDelays?airportCode=${airportCode}`)
    .then(response => response.text())
    .then(data => {
      if (data.length > 0) {
        // Append the flight delay data to the existing container
        airportDelays.textContent += `✈ ` + data;
        delaysContainer.style.display = 'block';
      }
    })
    .catch(error => console.error(error))
});


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

    // Update the elements with the fetched data



    const currentTemperatureElement = document.querySelector("#current-temperature");
    const currentFeelsLikeElement = document.querySelector("#feelslike-temperature");
    const uvElement = document.querySelector("#uv");
    const currentTimeElement = document.querySelector("#current-time");
    const windGustsElement = document.querySelector("#windgusts");
    const weatherTypeElement = document.querySelector("#weather-type");
    const humidityElement = document.querySelector("#humidity");
    const windElement = document.querySelector("#wind");
    const weatherDataFromStation = await fetchWeatherDataFromStation();
    const windArrow = document.getElementById('windArrow');
    if (windArrow) {
      windArrow.style.transform = `translateX(-50%) rotate(${weatherDataFromStation.winddir}deg)`;
    }
    currentTemperatureElement.innerHTML = `${weatherDataFromStation.tempf.toFixed(1)}°`;
    currentFeelsLikeElement.innerHTML = `Feels like ${weatherDataFromStation.feelsLike.toFixed(1)}°`;
    humidityElement.innerHTML = `${weatherDataFromStation.humidity}%`;
    windElement.innerHTML = `${Math.round(weatherDataFromStation.windspeedmph)} mph`;
    windGustsElement.innerHTML = `Gusts to ${Math.round(weatherDataFromStation.windgustmph)} mph`;
    uvElement.innerHTML = `${Math.round(weatherDataFromStation.uv)}`;
    // Update the last refresh timestamp
    lastRefreshTimestamp = new Date().getTime();
    // Update the countdown timer immediately after refreshing
    updateRefreshTimer();
  } catch (error) {
    console.error('Error updating current weather:', error);
  }
}

document.querySelectorAll('div.last-refresh').forEach(function (div) {
  div.addEventListener('click', function () {
    updateCurrentWeather();
  });
});

// Call the updateCurrentWeather function to update all weather fields
updateCurrentWeather();
// Add this function to format seconds as "mm:ss"
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

// Add a variable to store the last refresh timestamp
let lastRefreshTimestamp = 0;

// Function to update the countdown timer
function updateRefreshTimer() {
  const currentTime = new Date().getTime();
  const elapsedSeconds = Math.floor((currentTime - lastRefreshTimestamp) / 1000);
  const timerElement = document.querySelector("#refresh-timer");
  const timerContainer = document.querySelector(".weather-refresh");

  if (timerElement) {
    if (isFirstRefresh) {
      isFirstRefresh = false;
      timerContainer.style.display = "block"; // Display the timer container on the first refresh
    }

    timerElement.textContent = formatTime(elapsedSeconds);
  }
}
// Call the updateRefreshTimer function initially to set the timer to 0:00
updateRefreshTimer();
// Add an interval to update the countdown timer every second
setInterval(updateRefreshTimer, 1000);

// JavaScript function to create an animation with dynamically generated image URLs
function animateDynamicImages() {
  const baseUrl = 'https://x-hv1.pivotalweather.com/maps/rtma_ru/latest/series_';
  const imageExtension = '.png';
  const numImages = 36; // Number of images to load
  const animationContainer = document.getElementById('animationContainer'); // Select the animation container
  let currentIndex = 0; // Initialize the current image index

  // Function to update the animation container with the next dynamically generated image URL
  function updateAnimationContainer() {
    const imageUrl = `${baseUrl}${currentIndex.toString().padStart(3, '0')}/sfct-imp.us_state_oh${imageExtension}`;
    animationContainer.style.backgroundImage = `url(${imageUrl})`;

    currentIndex = (currentIndex + 1) % numImages; // Loop forward to the next image
  }
  // Set an interval to change the animation at a specific time interval (e.g., every 1 second)
  setInterval(updateAnimationContainer, 1000); // Change animation every 1 second (adjust the interval as needed)
}

// Call the animateDynamicImages function to start the animation with dynamically generated URLs
// Currently Suspended because it takes a lot of data or at least a lot of time. 
// animateDynamicImages();
