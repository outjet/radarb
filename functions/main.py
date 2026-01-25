import functions_framework
from flask import jsonify, request
import openmeteo_requests
import requests_cache
from retry_requests import retry
import pandas as pd
import numpy as np

# Set up caching and retry logic for Open-Meteo client
cache_session = requests_cache.CachedSession('.cache', expire_after=3600)
retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
openmeteo = openmeteo_requests.Client(session=retry_session)

# Helper function to fetch data from Open-Meteo with a given model
def fetch_forecast(lat, lng, model):
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lng,
        "daily": ["temperature_2m_max", "temperature_2m_min", "sunrise", "sunset"],
        "hourly": [
            "temperature_2m", "apparent_temperature", "precipitation", "precipitation_probability",
            "snowfall", "snow_depth", "rain", "showers", "weather_code", "cloud_cover",
            "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high",
            "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
            "thunderstorm_probability", "rain_probability", "snowfall_probability",
            "freezing_rain_probability", "ice_pellets_probability"
        ],
        "models": [model],
        "timezone": "America/New_York",
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",
        "temperature_unit": "fahrenheit"
    }
    return openmeteo.weather_api(url, params=params)[0]

# This is the Cloud Function handler
@functions_framework.http
def getMergedForecast(request):
    try:
        lat = float(request.args.get("lat"))
        lng = float(request.args.get("lng"))
    except (TypeError, ValueError):
        return jsonify({"error": "Missing or invalid lat/lng parameters"}), 400

    try:
        # First try HRRR
        response = fetch_forecast(lat, lng, "gfs_hrrr")
        if response.Model() != "gfs_hrrr":
            raise Exception("HRRR not available")
    except:
        # Fallback to GFS seamless
        response = fetch_forecast(lat, lng, "gfs_seamless")

    # Process hourly data
    hourly = response.Hourly()
    start = pd.to_datetime(hourly.Time(), unit="s", utc=True)
    end = pd.to_datetime(hourly.TimeEnd(), unit="s", utc=True)
    interval = pd.Timedelta(seconds=hourly.Interval())
    times = pd.date_range(start=start, end=end, freq=interval, inclusive="left")

    hourly_df = pd.DataFrame({
        "time": times,
        "temperature_2m": hourly.Variables(0).ValuesAsNumpy(),
        "apparent_temperature": hourly.Variables(1).ValuesAsNumpy(),
        "precipitation": hourly.Variables(2).ValuesAsNumpy(),
        "thunderstorm_probability": hourly.Variables(16).ValuesAsNumpy(),
        "cloud_cover": hourly.Variables(9).ValuesAsNumpy(),
        "wind_speed_10m": hourly.Variables(13).ValuesAsNumpy(),
        "wind_gusts_10m": hourly.Variables(15).ValuesAsNumpy(),
    })

    # Process daily data
    daily = response.Daily()
    dstart = pd.to_datetime(daily.Time(), unit="s", utc=True)
    dend = pd.to_datetime(daily.TimeEnd(), unit="s", utc=True)
    dinterval = pd.Timedelta(seconds=daily.Interval())
    dtimes = pd.date_range(start=dstart, end=dend, freq=dinterval, inclusive="left")

    daily_df = pd.DataFrame({
        "date": dtimes,
        "temp_max": daily.Variables(0).ValuesAsNumpy(),
        "temp_min": daily.Variables(1).ValuesAsNumpy(),
        "sunrise": pd.to_datetime(daily.Variables(2).ValuesInt64AsNumpy(), unit='s', utc=True),
        "sunset": pd.to_datetime(daily.Variables(3).ValuesInt64AsNumpy(), unit='s', utc=True)
    })

    result = {
        "model": response.Model(),
        "hourly": hourly_df.to_dict(orient="records"),
        "daily": daily_df.to_dict(orient="records")
    }

    return jsonify(result)
