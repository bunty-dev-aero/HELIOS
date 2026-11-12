import json
import random
import time
import urllib.request
import urllib.error

from datetime import datetime, timezone


# ==================================================
# HELIOS ENVIRONMENT SIMULATOR
# ==================================================

API_URL = "http://127.0.0.1:8000/api/v1/environment"

INTERVAL = 5

SIMULATOR_NAME = "HELIOS Environmental Simulator"


# --------------------------------------------------
# SPACECRAFT ZONES
# --------------------------------------------------

ZONES = {
    "main_cabin": {
        "prefix": "MC",
        "temperature": 22.5,
        "humidity": 45.0,
        "oxygen": 21.0,
        "pressure": 101.3,
        "co2": 900.0,
        "radiation": 0.15,
    },

    "crew_quarters": {
        "prefix": "CQ",
        "temperature": 21.5,
        "humidity": 48.0,
        "oxygen": 21.0,
        "pressure": 101.3,
        "co2": 850.0,
        "radiation": 0.14,
    },

    "laboratory": {
        "prefix": "LAB",
        "temperature": 23.0,
        "humidity": 42.0,
        "oxygen": 21.0,
        "pressure": 101.3,
        "co2": 950.0,
        "radiation": 0.18,
    },
}


# --------------------------------------------------
# METRIC CONFIGURATION
# --------------------------------------------------

METRICS = {
    "cabin_temperature": {
        "unit": "°C",
        "sensor": "TEMP",
        "variation": 0.25,
    },

    "relative_humidity": {
        "unit": "%",
        "sensor": "HUM",
        "variation": 1.0,
    },

    "oxygen_concentration": {
        "unit": "%",
        "sensor": "O2",
        "variation": 0.08,
    },

    "cabin_pressure": {
        "unit": "kPa",
        "sensor": "PRESS",
        "variation": 0.15,
    },

    "co2_concentration": {
        "unit": "ppm",
        "sensor": "CO2",
        "variation": 25.0,
    },

    "radiation_dose_rate": {
        "unit": "µSv/h",
        "sensor": "RAD",
        "variation": 0.015,
    },
}


# --------------------------------------------------
# SENSOR VALUE GENERATION
# --------------------------------------------------

def generate_value(metric, zone_data, tick):

    variation = METRICS[metric]["variation"]

    if metric == "cabin_temperature":
        value = random.gauss(
            zone_data["temperature"],
            variation,
        )

    elif metric == "relative_humidity":
        value = random.gauss(
            zone_data["humidity"],
            variation,
        )

    elif metric == "oxygen_concentration":
        value = random.gauss(
            zone_data["oxygen"],
            variation,
        )

    elif metric == "cabin_pressure":
        value = random.gauss(
            zone_data["pressure"],
            variation,
        )

    elif metric == "co2_concentration":
        value = random.gauss(
            zone_data["co2"],
            variation,
        )

    elif metric == "radiation_dose_rate":
        value = random.gauss(
            zone_data["radiation"],
            variation,
        )

    else:
        raise ValueError(f"Unknown metric: {metric}")

    # --------------------------------------------------
    # CONTROLLED DEMONSTRATION ANOMALIES
    # --------------------------------------------------

    # Every 12th cycle introduces a temporary
    # synthetic deviation in selected measurements.

    if tick > 0 and tick % 12 == 0:

        if metric == "co2_concentration":
            value += 250

        elif metric == "cabin_temperature":
            value += 2.0

        elif metric == "radiation_dose_rate":
            value += 0.12

    # Keep demonstration values physically non-negative.
    value = max(0.0, value)

    return round(value, 3)


# --------------------------------------------------
# CREATE SENSOR PAYLOAD
# --------------------------------------------------

def create_payload(metric, zone, zone_data, tick):

    config = METRICS[metric]

    value = generate_value(
        metric,
        zone_data,
        tick,
    )

    sensor_id = (
        f"{config['sensor']}-"
        f"{zone_data['prefix']}-001"
    )

    return {
        "metric": metric,
        "value": value,
        "unit": config["unit"],

        "measured_at": datetime.now(
            timezone.utc
        ).isoformat(),

        "sensor_id": sensor_id,

        "zone": zone,

        "source": "simulator",

        "simulated": True,

        "quality": "good",

        "metadata": {
            "generator": SIMULATOR_NAME,
            "data_type": "SIMULATED",
            "simulation_cycle": tick,
            "anomaly_injection": (
                tick > 0 and tick % 12 == 0
            ),
        },
    }


# --------------------------------------------------
# SEND READING TO HELIOS API
# --------------------------------------------------

def send_reading(payload):

    data = json.dumps(payload).encode("utf-8")

    request = urllib.request.Request(
        API_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:

        with urllib.request.urlopen(
            request,
            timeout=5,
        ) as response:

            result = json.loads(
                response.read().decode("utf-8")
            )

            print(
                f"[SAVED] "
                f"{result['zone']} | "
                f"{result['metric']} | "
                f"{result['value']} "
                f"{result['unit']} | "
                f"ID: {result['id']}"
            )

            return True

    except urllib.error.HTTPError as error:

        message = error.read().decode(
            "utf-8",
            errors="replace",
        )

        print(
            f"[API ERROR] HTTP {error.code}: "
            f"{message}"
        )

    except urllib.error.URLError as error:

        print(
            f"[CONNECTION ERROR] {error.reason}"
        )

    except TimeoutError:

        print("[TIMEOUT] API request timed out.")

    return False


# --------------------------------------------------
# SIMULATION LOOP
# --------------------------------------------------

def run_simulator():

    print("\n" + "=" * 60)
    print("       HELIOS ENVIRONMENT SIMULATOR")
    print("=" * 60)

    print(f"API: {API_URL}")

    print(f"Interval: {INTERVAL} seconds")

    print(f"Spacecraft zones: {len(ZONES)}")

    print(f"Environmental metrics: {len(METRICS)}")

    print("\nDATA MODE: SIMULATED")

    print("\nPress CTRL+C to stop.\n")

    tick = 0

    try:

        while True:

            print("\n" + "-" * 60)

            print(f"SIMULATION CYCLE: {tick + 1}")

            print("-" * 60)

            successful = 0

            failed = 0

            for zone, zone_data in ZONES.items():

                for metric in METRICS:

                    payload = create_payload(
                        metric,
                        zone,
                        zone_data,
                        tick,
                    )

                    if send_reading(payload):
                        successful += 1
                    else:
                        failed += 1

            print("\nCYCLE SUMMARY")

            print(f"Successful readings: {successful}")

            print(f"Failed readings: {failed}")

            print(
                f"Total readings: "
                f"{successful + failed}"
            )

            print(
                f"Next cycle in {INTERVAL} seconds..."
            )

            tick += 1

            time.sleep(INTERVAL)

    except KeyboardInterrupt:

        print("\n\nSimulator stopped.")

        print("HELIOS environmental stream terminated.")


# --------------------------------------------------
# ENTRY POINT
# --------------------------------------------------

if __name__ == "__main__":

    run_simulator()