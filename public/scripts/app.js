let userLat;
let userLng;
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
  console.log('Starting to do geolocation');
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const boxsize = 8;
        const latne = lat + boxsize / 69;
        const lngne = lng + boxsize / 53;
        const latsw = lat - boxsize / 69;
        const lngsw = lng - boxsize / 53;

        console.log('Latitude ', position.coords.latitude);
        console.log('Longitude ', position.coords.longitude);

        // Dispatch events to load camera and sensor data
        window.dispatchEvent(new CustomEvent("loadCameraData", {
          detail: { latne, lngne, latsw, lngsw, lat, lng }
        }));

        console.log(`Yabout to call getWeatherForecast with ${lat}, ${lng}`);

        getWeatherForecast(lat, lng);

        window.dispatchEvent(new CustomEvent("loadSensorData", {
          detail: { latne, lngne, latsw, lngsw, lat, lng }
        }));

        // Display meteograms for the current location
        setTimeout(() => {
          const meteosDiv = document.querySelector('.meteos');
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
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
      },
      error => {
        console.error(error);
      },
      { timeout: 20000, maximumAge: 90000, enableHighAccuracy: false }
    );
  }
});


// CAMERAS 

window.addEventListener("loadCameraData", (event) => {
  const { latne, lngne, latsw, lngsw, lat, lng } = event.detail;
  fetch(`https://us-central1-radarb.cloudfunctions.net/getCameraData?latne=${latne}&lngne=${lngne}&latsw=${latsw}&lngsw=${lngsw}`)
    // fetch(`http://127.0.0.1:5005/radarb/us-central1/getCameraData?latne=${latne}&lngne=${lngne}&latsw=${latsw}&lngsw=${lngsw}`)
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
  const sensorDistances = [];

  // Calculate the distance from the user's location to each sensor
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
  const sensorContainer = document.querySelector(".sensor-container");
  for (let i = 0; i < Math.min(3, sensorDistances.length); i++) {
    const sensor = sensorDistances[i].sensor;
    const div = document.createElement("div");
    div.classList.add("sensor-box");
    if (sensor.status === "Ice Watch") {
      div.classList.add("IceWatch");
    }
    div.innerHTML = sensor.name.substring(0, sensor.name.length - 4);
    div.innerHTML += "<br>" + "Status: " + sensor.status;
    div.innerHTML += "<br>" + "Surface temp: " + sensor.surfaceTemperature;
    sensorContainer.appendChild(div);
  }

  // Check if sensor data is empty
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
  forecastDiv.innerHTML = "<a href='https://forecast.weather.gov/product.php?site=CLE&issuedby=CLE&product=AFD&format=CI&version=1&glossary=1&highlight=off' target='_blank'>Forecast discussion</a><br><a href='https://icyroadsafety.com/lcr/' target='_blank'>Icy Road Forecast</a>";
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
  if (sensorDataDisplayed) {
    return;
  }
  fetch(`https://us-central1-radarb.cloudfunctions.net/getSensorData?latne=${latne}&lngne=${lngne}&latsw=${latsw}&lngsw=${lngsw}`)
    // fetch(`http://127.0.0.1:5005/radarb/us-central1/getSensorData?latne=${latne}&lngne=${lngne}&latsw=${latsw}&lngsw=${lngsw}`)
    .then(response => response.json())
    .then(data => {
      sensorDataDisplayed = true;
      displaySensorData(data, lat, lng);
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
    const response = await cache.match(url) || await fetch(url);
    const data = await response.json();
    // const addressComponents = data.results[0].address_components;
    const formattedAddress = data.address;
    // const locationType = data.results[0].geometry.location_type;
    const premiseType = data.premiseType;
    youAreHereSpan.innerHTML += `Found you at: <A Href="https://ohgo.com/cleveland?lt=${lat}&ln=${lng}&z=13&ls=incident,incident-waze,dangerous-slowdown,camera,delay,weather,weather-roadsensors,sign" target="_blank">${formattedAddress}</A> - ${premiseType}<br><br>`;
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
      console.log(`fetching live onecall with lat: ${lat} and lng: ${lng}`);
      const response = await fetch(`https://us-central1-radarb.cloudfunctions.net/getWeatherData?lat=${lat}&lng=${lng}`);
      data = await response.json();
      localStorage.setItem('weatherData', JSON.stringify(data));
      localStorage.setItem('weatherDataTime', Date.now());
    }
    const fiveDays = data.daily.slice(0, 5);
    const hourlyForecast = data.hourly;

    const crosswindThreshold = 20; // mph
    let crosswindAlert = null;
    let crosswindSpeed = 0;
    let maxcrosswindSpeed = 0;
    let maxCrosswindTime = null;
    for (const hour of hourlyForecast) {
      const { dt, wind_speed, wind_deg } = hour;
      const crosswind = wind_speed * Math.sin(wind_deg * Math.PI / 180);
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
    console.log('Checking for crosswinds');

    if (crosswindAlert) {
      const alertDiv = document.createElement("div");
      alertDiv.classList.add("crosswind-alert");
      alertDiv.innerHTML = `CLE Runway Crosswind Alert starting ${new Date(crosswindAlert * 1000).toLocaleString()}`;

      // Find the hour with maximum crosswind
      const maxCrosswindHour = hourlyForecast.reduce((maxHour, hour) => {
        const { wind_speed, wind_deg } = hour;
        const crosswind = wind_speed * Math.sin(wind_deg * Math.PI / 180);
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
      const maxCrosswindOutput = ` - Max crosswind ${Math.abs(maxCrosswindHour.crosswind.toFixed(0))} MPH (${Math.abs(maxCrosswindHour.wind_speed.toFixed(0))} @ ${Math.abs(maxCrosswindHour.wind_deg.toFixed(0))}°) ${maxCrosswindDate}`;
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

          // Get the first 120 characters of the alert description
          const description = alert.description.substring(0, 90);

          // Create a span to hold the truncated description and a button to expand it
          const descriptionSpan = document.createElement("span");
          descriptionSpan.textContent = description;

          const readMoreButton = document.createElement("button");
          readMoreButton.textContent = "read more...";
          readMoreButton.classList.add("readmorebutton"); // Add the readmorebutton class

          readMoreButton.addEventListener("click", () => {
            descriptionSpan.textContent = alert.description;
            readMoreButton.style.display = "none";
          });


          // Add the truncated description and the "read more..." button to the alertDiv
          alertDiv.innerHTML = `Weather Alert: ${alert.event} - `;
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
      const iconUrl = `http://openweathermap.org/img/wn/${iconCode}@2x.png`;

      const forecastDiv = document.createElement("div");
      forecastDiv.classList.add("forecast");
      forecastDiv.innerHTML = `
    <div class="day">${dayName}</div>
    <img src="${iconUrl}" alt="weather icon" class="weather-icon">
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
  fetch("https://us-central1-radarb.cloudfunctions.net/getGroundStopInfo")
    // fetch("http://127.0.0.1:5005/radarb/us-central1/getGroundStopInfo")
    .then((response) => response.text())
    .then((data) => {
      if (data.length > 0) {
        // Append the ground stop data to the new container
        groundStopsContainer.textContent = data;
        groundStopsContainer.style.display = 'block';
      }
    })
    .catch((error) => console.error(error))
    ;

  console.log('Checking for KCLE delays');
  let airportCode = 'KCLE';
  // fetch(`http://127.0.0.1:5005/radarb/us-central1/getFlightDelays?airportCode=${airportCode}`)
  fetch(`https://us-central1-radarb.cloudfunctions.net/getFlightDelays?airportCode=${airportCode}`)
    .then(response => response.text())
    .then(data => {
      if (data.length > 0) {
        // Append the flight delay data to the existing container
        airportDelays.textContent += data;
        delaysContainer.style.display = 'block';
      }
    })
    .catch(error => console.error(error))
});


