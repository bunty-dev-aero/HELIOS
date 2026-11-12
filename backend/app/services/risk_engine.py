from statistics import median

from app.models import Measurement


# --------------------------------------------------
# SOFTWARE PLAUSIBILITY BOUNDS
# These are NOT clinical thresholds.
# --------------------------------------------------

PLAUSIBILITY = {
    "heart_rate": (20, 250, "bpm"),
    "spo2": (50, 100, "%"),
    "temperature": (25, 45, "°C"),
    "systolic_bp": (40, 300, "mmHg"),
    "diastolic_bp": (20, 200, "mmHg"),
    "sleep_hours": (0, 24, "hours"),
    "mood_score": (0, 10, "score"),
    "activity_minutes": (0, 1440, "minutes"),
    "glucose": (1, 1000, "mg/dL"),
}


# --------------------------------------------------
# CONFIGURABLE STATISTICAL THRESHOLDS
# These are NOT clinical thresholds.
# --------------------------------------------------

MIN_BASELINE_SAMPLES = 5

WATCH_THRESHOLD = 2.0
REVIEW_THRESHOLD = 3.0


# --------------------------------------------------
# MEASUREMENT VALIDATION
# --------------------------------------------------

def validate_measurement(metric, value, unit):

    if metric not in PLAUSIBILITY:
        raise ValueError(f"Unsupported metric: {metric}")

    low, high, expected_unit = PLAUSIBILITY[metric]

    if unit != expected_unit:
        raise ValueError(
            f"Unit for {metric} must be {expected_unit}"
        )

    if not low <= value <= high:
        raise ValueError(
            f"Value outside software plausibility range "
            f"({low}–{high} {expected_unit}); "
            f"this is not a clinical threshold."
        )


# --------------------------------------------------
# PERSONAL BASELINE CALCULATION
# --------------------------------------------------

def calculate_personal_baseline(
    measurements,
    astronaut_id,
    metric,
    min_samples=MIN_BASELINE_SAMPLES,
):

    historical_values = []
    timestamps = []
    simulated_records = 0

    for measurement in measurements:

        if measurement.astronaut_id != astronaut_id:
            continue

        if measurement.metric != metric:
            continue

        if measurement.quality != "good":
            continue

        historical_values.append(float(measurement.value))
        timestamps.append(measurement.measured_at)

        if measurement.simulated:
            simulated_records += 1

    sample_count = len(historical_values)

    if sample_count < min_samples:

        return {
            "astronaut_id": astronaut_id,
            "metric": metric,
            "status": "insufficient_data",
            "sample_count": sample_count,
            "required_samples": min_samples,
            "baseline_median": None,
            "median_absolute_deviation": None,
            "robust_sigma": None,
            "is_simulated": simulated_records > 0,
            "message": (
                f"At least {min_samples} good-quality readings "
                f"are required to establish this baseline."
            ),
        }

    baseline_median = median(historical_values)

    absolute_deviations = [
        abs(value - baseline_median)
        for value in historical_values
    ]

    mad = median(absolute_deviations)

    # MAD-to-sigma conversion factor.
    robust_sigma = 1.4826 * mad

    latest_timestamp = max(timestamps)

    return {
        "astronaut_id": astronaut_id,
        "metric": metric,
        "status": "available",
        "sample_count": sample_count,
        "required_samples": min_samples,
        "baseline_median": round(baseline_median, 3),
        "median_absolute_deviation": round(mad, 3),
        "robust_sigma": round(robust_sigma, 3),
        "latest_baseline_reading": (
            latest_timestamp.isoformat()
            if latest_timestamp
            else None
        ),
        "is_simulated": simulated_records > 0,
        "simulated_sample_count": simulated_records,
        "message": (
            "Personal baseline calculated from historical "
            "good-quality measurements."
        ),
    }


# --------------------------------------------------
# PERSONAL BASELINE COMPARISON
# --------------------------------------------------

def compare_with_personal_baseline(
    current_value,
    baseline,
):

    if baseline["status"] != "available":

        return {
            "status": "baseline_unavailable",
            "difference": None,
            "robust_deviation": None,
            "message": (
                "Insufficient historical data for comparison."
            ),
        }

    baseline_median = baseline["baseline_median"]
    robust_sigma = baseline["robust_sigma"]

    difference = current_value - baseline_median

    if robust_sigma == 0:

        robust_deviation = None

        comparison_status = (
            "matches_baseline"
            if difference == 0
            else "zero_variability"
        )

    else:

        robust_deviation = difference / robust_sigma

        comparison_status = "matches_baseline"

    return {
        "status": comparison_status,
        "current_value": round(float(current_value), 3),
        "baseline_median": baseline_median,
        "difference": round(difference, 3),
        "robust_deviation": (
            round(robust_deviation, 3)
            if robust_deviation is not None
            else None
        ),
        "message": (
            "Descriptive comparison only; this is not a "
            "clinical assessment."
        ),
    }


# --------------------------------------------------
# DEVIATION CLASSIFICATION ENGINE
# --------------------------------------------------

def assess_deviation(
    measurement,
    baseline,
    watch_threshold=WATCH_THRESHOLD,
    review_threshold=REVIEW_THRESHOLD,
):

    # Quality gate
    if measurement.quality != "good":

        return {
            "level": "watch",
            "status": "poor_data_quality",
            "metric": measurement.metric,
            "message": (
                "Deviation classification skipped because "
                "measurement quality is not marked good."
            ),
            "reason": (
                "Review sensor fit and measurement conditions. "
                "Repeat the measurement if appropriate."
            ),
            "simulated_data": measurement.simulated,
        }

    # Baseline availability gate
    if baseline["status"] != "available":

        return {
            "level": "info",
            "status": "baseline_unavailable",
            "metric": measurement.metric,
            "message": (
                "Personal baseline is not yet available."
            ),
            "reason": (
                "More good-quality historical measurements "
                "are needed."
            ),
            "simulated_data": measurement.simulated,
        }

    # Calculate statistical deviation
    comparison = compare_with_personal_baseline(
        current_value=float(measurement.value),
        baseline=baseline,
    )

    difference = comparison["difference"]
    robust_deviation = comparison["robust_deviation"]

    # Zero variability handling
    if comparison["status"] == "zero_variability":

        return {
            "level": "watch",
            "status": "zero_variability_difference",
            "metric": measurement.metric,
            "current_value": float(measurement.value),
            "baseline_median": baseline["baseline_median"],
            "difference": difference,
            "robust_deviation": None,
            "message": (
                "The current reading differs from a baseline "
                "with zero measured variability."
            ),
            "reason": (
                "The historical MAD is zero, so a standardized "
                "deviation cannot be calculated. Review the "
                "reading and collect additional measurements."
            ),
            "simulated_data": measurement.simulated,
        }

    absolute_deviation = abs(robust_deviation)

    # Classification
    if absolute_deviation >= review_threshold:

        level = "review"
        status = "significant_statistical_deviation"

        message = (
            "The measurement is at least "
            f"{review_threshold} robust deviations "
            "from the personal baseline."
        )

    elif absolute_deviation >= watch_threshold:

        level = "watch"
        status = "statistical_deviation"

        message = (
            "The measurement differs from the personal "
            "baseline by at least "
            f"{watch_threshold} robust deviations."
        )

    else:

        level = "info"
        status = "within_configured_range"

        message = (
            "The measurement is within the configured "
            "statistical deviation range."
        )

    direction = (
        "above_baseline"
        if difference > 0
        else "below_baseline"
        if difference < 0
        else "at_baseline"
    )

    return {
        "level": level,
        "status": status,
        "metric": measurement.metric,
        "current_value": float(measurement.value),
        "baseline_median": baseline["baseline_median"],
        "difference": difference,
        "direction": direction,
        "robust_deviation": round(robust_deviation, 3),
        "thresholds": {
            "watch": watch_threshold,
            "review": review_threshold,
        },
        "message": message,
        "reason": (
            f"Current measurement is {abs(difference):.3f} "
            f"{PLAUSIBILITY[measurement.metric][2]} "
            f"{direction.replace('_', ' ')}."
        ),
        "simulated_data": measurement.simulated,
        "disclaimer": (
            "Statistical software classification only. "
            "Not a medical diagnosis or clinical alert."
        ),
    }


# --------------------------------------------------
# EXISTING MEASUREMENT ASSESSMENT
# --------------------------------------------------

def assess_measurement(measurement):

    alerts = []

    if measurement.quality == "low":

        alerts.append({
            "level": "watch",
            "metric": measurement.metric,
            "message": "Measurement quality is marked low.",
            "reason": (
                "Review sensor fit and measurement conditions; "
                "repeat if appropriate."
            ),
            "simulated_data": measurement.simulated,
        })

    return alerts