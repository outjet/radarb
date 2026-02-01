import json
import os
from datetime import datetime, timezone

import requests
from google.cloud import storage

LAT = float(os.environ.get("LAT", "41.48"))
LON = float(os.environ.get("LON", "-81.81"))
BUCKET = os.environ.get("BUCKET", "")
OBJECT_NAME = os.environ.get("OBJECT_NAME", "snow_tail.json")
FORECAST_DAYS = int(os.environ.get("FORECAST_DAYS", "7"))
MODEL = os.environ.get("MODEL", "gfs")


def fetch_gfs_hourly_snowfall():
    params = {
        "latitude": LAT,
        "longitude": LON,
        "hourly": "snowfall",
        "timezone": "UTC",
        "forecast_days": FORECAST_DAYS,
    }
    resp = requests.get("https://api.open-meteo.com/v1/gfs", params=params, timeout=20)
    resp.raise_for_status()
    data = resp.json()

    hourly = data.get("hourly") or {}
    times = hourly.get("time") or []
    snowfall_cm = hourly.get("snowfall") or []

    if len(times) != len(snowfall_cm):
        raise ValueError("Open-Meteo response length mismatch")

    # Convert cm -> inches and accumulate
    acc = 0.0
    accum_in = []
    for cm in snowfall_cm:
        inches = (cm or 0.0) / 2.54
        acc += inches
        accum_in.append(round(acc, 3))

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "open-meteo",
        "model": MODEL,
        "lat": LAT,
        "lon": LON,
        "hours": [f"{t}Z" if isinstance(t, str) and not t.endswith("Z") else t for t in times],
        "snow_accum_in": accum_in,
    }


def upload_json(payload):
    if not BUCKET:
        raise RuntimeError("BUCKET env var is required")
    client = storage.Client()
    bucket = client.bucket(BUCKET)
    blob = bucket.blob(OBJECT_NAME)
    blob.cache_control = "public, max-age=1800"
    blob.upload_from_string(json.dumps(payload), content_type="application/json")


if __name__ == "__main__":
    try:
        data = fetch_gfs_hourly_snowfall()
        upload_json(data)
        print(f"Uploaded {OBJECT_NAME} to gs://{BUCKET}")
    except Exception as exc:
        print(f"Snow tail job failed: {exc}")
        raise
