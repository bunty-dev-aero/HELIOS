from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Astronaut, Measurement, Alert

from app.services.risk_engine import (
    calculate_personal_baseline,
    assess_deviation,
)


# --------------------------------------------------
# ALERT GENERATION SERVICE
# --------------------------------------------------

def generate_alert(
    db: Session,
    measurement_id: int,
):
    """
    Generate and persist an alert for a measurement.

    Only WATCH and REVIEW classifications are persisted.

    INFO classifications are returned without creating
    a database alert.

    Historical measurements are restricted to readings
    taken before the selected measurement.
    """

    # --------------------------------------------------
    # 1. Retrieve measurement
    # --------------------------------------------------

    measurement = db.get(Measurement, measurement_id)

    if not measurement:
        raise ValueError("Measurement not found")

    # --------------------------------------------------
    # 2. Retrieve astronaut
    # --------------------------------------------------

    astronaut = db.get(
        Astronaut,
        measurement.astronaut_id,
    )

    if not astronaut:
        raise ValueError("Astronaut not found")

    # --------------------------------------------------
    # 3. Prevent duplicate alerts
    # --------------------------------------------------

    existing_alert = db.scalar(
        select(Alert).where(
            Alert.measurement_id == measurement.id
        )
    )

    if existing_alert:
        return {
            "created": False,
            "duplicate": True,
            "alert_id": existing_alert.id,
            "level": existing_alert.level,
            "status": existing_alert.status,
            "message": "An alert already exists for this measurement.",
        }

    # --------------------------------------------------
    # 4. Retrieve historical measurements
    # --------------------------------------------------

    historical_measurements = db.scalars(
        select(Measurement)
        .where(
            Measurement.astronaut_id == measurement.astronaut_id,
            Measurement.metric == measurement.metric,
            Measurement.measured_at < measurement.measured_at,
        )
        .order_by(Measurement.measured_at.asc())
    ).all()

    # --------------------------------------------------
    # 5. Calculate personal baseline
    # --------------------------------------------------

    baseline = calculate_personal_baseline(
        measurements=historical_measurements,
        astronaut_id=measurement.astronaut_id,
        metric=measurement.metric,
    )

    # --------------------------------------------------
    # 6. Assess deviation
    # --------------------------------------------------

    deviation = assess_deviation(
        measurement=measurement,
        baseline=baseline,
    )

    level = deviation.get("level", "info")

    # --------------------------------------------------
    # 7. Do not persist INFO classifications
    # --------------------------------------------------

    if level not in ("watch", "review"):

        return {
            "created": False,
            "duplicate": False,
            "level": level,
            "deviation": deviation,
            "message": (
                "No persistent alert generated. "
                "Only WATCH and REVIEW classifications "
                "are stored."
            ),
        }

    # --------------------------------------------------
    # 8. Capture historical evidence
    # --------------------------------------------------

    baseline_snapshot = dict(baseline)

    detection_snapshot = {
        "classification": level,
        "status": deviation.get("status"),
        "thresholds": deviation.get("thresholds", {}),
        "difference": deviation.get("difference"),
        "robust_deviation": deviation.get("robust_deviation"),
        "direction": deviation.get("direction"),
        "measurement_quality": measurement.quality,
        "simulated": measurement.simulated,
        "disclaimer": deviation.get("disclaimer"),
    }

    # --------------------------------------------------
    # 9. Recommended human-review action
    # --------------------------------------------------

    if level == "review":
        recommended_action = (
            "Review the measurement, sensor quality and "
            "historical trend. Refer to the mission's "
            "approved human review procedures."
        )
    else:
        recommended_action = (
            "Monitor subsequent measurements and review "
            "the trend if the deviation persists."
        )

    # --------------------------------------------------
    # 10. Create alert record
    # --------------------------------------------------

    alert = Alert(
        astronaut_id=measurement.astronaut_id,
        measurement_id=measurement.id,

        level=level,
        status="open",

        metric=measurement.metric,
        observed_value=float(measurement.value),
        unit=measurement.unit,

        baseline_median=baseline.get("baseline_median"),
        median_absolute_deviation=baseline.get(
            "median_absolute_deviation"
        ),
        robust_sigma=baseline.get("robust_sigma"),

        robust_deviation=deviation.get(
            "robust_deviation"
        ),

        direction=deviation.get("direction"),

        message=deviation.get(
            "message",
            "Statistical deviation detected.",
        ),

        reason=deviation.get(
            "reason",
            "Measurement differs from personal baseline.",
        ),

        recommended_action=recommended_action,

        simulated=measurement.simulated,

        baseline_snapshot=baseline_snapshot,
        detection_snapshot=detection_snapshot,
    )

    # --------------------------------------------------
    # 11. Save to database
    # --------------------------------------------------

    try:
        db.add(alert)
        db.commit()
        db.refresh(alert)

    except Exception:
        db.rollback()
        raise

    # --------------------------------------------------
    # 12. Return result
    # --------------------------------------------------

    return {
        "created": True,
        "duplicate": False,
        "alert_id": alert.id,
        "astronaut_id": alert.astronaut_id,
        "astronaut_name": astronaut.name,
        "measurement_id": alert.measurement_id,
        "level": alert.level,
        "status": alert.status,
        "metric": alert.metric,
        "observed_value": alert.observed_value,
        "baseline_median": alert.baseline_median,
        "robust_deviation": alert.robust_deviation,
        "simulated": alert.simulated,
        "message": alert.message,
        "recommended_action": alert.recommended_action,
        "created_at": alert.created_at.isoformat(),
    }