const userCoords = { lat: 41.48, lng: -81.81 };
const BOX_SIZE = 8;
const LAT_DEGREE_TO_MILES = 69;
const LNG_DEGREE_TO_MILES = 53;
const WEATHER_API_URL = 'https://us-central1-radarb.cloudfunctions.net/getWeatherData';
// const AMBIENT_WEATHER_API_URL = 'https://us-central1-radarb.cloudfunctions.net/getAmbientWeatherData';
const CROSSWIND_THRESHOLD = 20; // mph
const RUNWAY_DEG = 58.1; // KCLE Runway 06L/24R
const OPPOSITE_RUNWAY_DEG = (RUNWAY_DEG + 180) % 360;

async function fetchWeatherData(lat, lng) {
    try {
        const response = await fetch(`${WEATHER_API_URL}?lat=${lat}&lng=${lng}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching weather data:', error);
        throw error;
    }
}

async function fetchAmbientWeatherData() {
    try {
        const response = await fetch(AMBIENT_WEATHER_API_URL);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const weatherDataArray = await response.json();

        if (weatherDataArray.length > 0) {
            return weatherDataArray[0].lastData;
        }
    } catch (error) {
        console.error('Error fetching ambient weather data:', error);
        throw error;
    }
}

function calculateCrosswind(hour, runwayDeg, oppositeRunwayDeg) {
    const { dt, wind_speed, wind_deg } = hour;
    const runwayToUse = Math.abs(wind_deg - runwayDeg) <= Math.abs(wind_deg - oppositeRunwayDeg)
        ? runwayDeg
        : oppositeRunwayDeg;
    const crosswind = wind_speed * Math.sin((wind_deg - runwayToUse) * Math.PI / 180);
    return crosswind;
}

function findMaxCrosswindHour(hourlyForecast, runwayDeg, oppositeRunwayDeg) {
    let crosswindAlert = null;
    let crosswindSpeed = 0;
    let maxCrosswindSpeed = 0;
    let maxCrosswindTime = null;

    for (const hour of hourlyForecast) {
        const crosswind = calculateCrosswind(hour, runwayDeg, oppositeRunwayDeg);

        if (Math.abs(crosswind) >= CROSSWIND_THRESHOLD) {
            crosswindAlert = hour.dt;
            crosswindSpeed = crosswind;

            if (Math.abs(crosswind) > maxCrosswindSpeed) {
                maxCrosswindSpeed = Math.abs(crosswind);
                maxCrosswindTime = new Date(hour.dt * 1000);
            }
            break;
        } else if (Math.abs(crosswind) > maxCrosswindSpeed) {
            maxCrosswindSpeed = Math.abs(crosswind);
            maxCrosswindTime = new Date(hour.dt * 1000);
        }
    }

    return { crosswindAlert, crosswindSpeed, maxCrosswindTime };
}

async function displayWeatherAlerts(data) {
    const crosswindContainer = document.querySelector('.crosswind-container');
    crosswindContainer.innerHTML = '';

    try {
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
                readMoreButton.classList.add("readmorebutton");

                readMoreButton.addEventListener("click", () => {
                    descriptionSpan.textContent = alert.description;
                    readMoreButton.style.display = "none";
                });

                alertDiv.innerHTML = `Weather Alert: ${alert.event} - `;
                alertDiv.appendChild(descriptionSpan);
                alertDiv.appendChild(readMoreButton);

                crosswindContainer.appendChild(alertDiv);
            });
        }
    } catch (error) {
        console.error('Error displaying weather alerts:', error);
    }
}

function displayForecast(fiveDays) {
    const weekForecastContainer = document.querySelector('.week-forecast');
    weekForecastContainer.innerHTML = ''; // Clear previous data

    try {
        fiveDays.forEach(day => {
            const date = new Date(day.dt * 1000);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const temp = day.temp.day.toFixed(0);
            const weatherIconCode = day.weather[0].icon;

            // Map weather icons to icon URLs (you can add more mappings as needed)
            const weatherIconMappings = {
                '01d': 'https://img.icons8.com/color-glass/42/000000/sun.png',
                '02d': 'https://img.icons8.com/color-glass/42/000000/partly-cloudy-day.png',
                '03d': 'https://img.icons8.com/color-glass/42/000000/cloud.png',
                '04d': 'https://img.icons8.com/color-glass/42/000000/cloud.png',
                '09d': 'https://img.icons8.com/color-glass/42/000000/rain.png',
                '10d': 'https://img.icons8.com/color-glass/42/000000/rain.png',
                '11d': 'https://img.icons8.com/color-glass/42/000000/wind.png',
                '13d': 'https://img.icons8.com/color-glass/42/000000/snow.png',
                '50d': 'https://img.icons8.com/color-glass/42/000000/fog.png',
            };

            const weatherIconUrl = weatherIconMappings[weatherIconCode];
            const weatherDescription = day.weather[0].main;

            const forecastDiv = document.createElement("div");
            forecastDiv.classList.add("col");
            forecastDiv.innerHTML = `
                <h3>${dayName}</h3>
                <br><img src="${weatherIconUrl}" /><br>
                <p class="weather">${weatherDescription}</p>
                <span>${temp}°</span>
            `;

            weekForecastContainer.appendChild(forecastDiv);
        });
    } catch (error) {
        console.error('Error loading forecast:', error);
    }
}


async function updateUI() {
    try {
        const weatherData = await fetchWeatherData(userCoords.lat, userCoords.lng);
        const ambientWeatherData = await fetchAmbientWeatherData();

        const fiveDaysForecast = weatherData.daily.slice(0, 5);
        const hourlyForecast = weatherData.hourly;

        displayWeatherAlerts(weatherData);

        const { crosswindAlert, crosswindSpeed, maxCrosswindTime } = findMaxCrosswindHour(hourlyForecast, RUNWAY_DEG, OPPOSITE_RUNWAY_DEG);

        if (crosswindAlert) {
            const crosswindContainer = document.querySelector('.crosswind-container');
            const alertDiv = document.createElement("div");
            alertDiv.classList.add("crosswind-alert");
            alertDiv.innerHTML = `CLE Runway Crosswind Alert starting ${new Date(crosswindAlert * 1000).toLocaleString()}`;

            const maxCrosswindOutput = `<BR>Max crosswind ${Math.abs(crosswindSpeed.toFixed(0))} MPH ${maxCrosswindTime.toLocaleString()}`;
            alertDiv.innerHTML += maxCrosswindOutput;
            crosswindContainer.appendChild(alertDiv);
        }

        displayForecast(fiveDaysForecast);
    } catch (error) {
        console.error('Error updating UI:', error);
    }
}

// Call the updateUI function to update the UI
updateUI();
