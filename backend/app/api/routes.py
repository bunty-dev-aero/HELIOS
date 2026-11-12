import math

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, desc, func

from app.db import get_db

from app.models import (
    Astronaut,
    Measurement,
    Alert,
    EnvironmentalMeasurement,
)

from app.schemas import (
    AstronautCreate,
    AstronautOut,
    MeasurementCreate,
    MeasurementOut,
    EnvironmentalMeasurementCreate,
    EnvironmentalMeasurementOut,
)

from app.services.risk_engine import (
    PLAUSIBILITY,
    validate_measurement,
    assess_measurement,
    calculate_personal_baseline,
    assess_deviation,
)

from app.services.alert_service import generate_alert


router = APIRouter()


# --------------------------------------------------
# ENVIRONMENTAL METRIC CONFIGURATION
# --------------------------------------------------

ENVIRONMENT_UNITS = {
    "cabin_temperature": "°C",
    "relative_humidity": "%",
    "oxygen_concentration": "%",
    "cabin_pressure": "kPa",
    "co2_concentration": "ppm",
    "radiation_dose_rate": "µSv/h",
}


ENVIRONMENT_LABELS = {
    "cabin_temperature": "Cabin Temperature",
    "relative_humidity": "Relative Humidity",
    "oxygen_concentration": "Oxygen Concentration",
    "cabin_pressure": "Cabin Pressure",
    "co2_concentration": "CO2 Concentration",
    "radiation_dose_rate": "Radiation Dose Rate",
}


# --------------------------------------------------
# HEALTH
# --------------------------------------------------

@router.get("/health")
def health():
    return {
        "status": "ok",
        "service": "HELIOS API",
        "mode": "prototype",
    }


# --------------------------------------------------
# ASTRONAUT ENDPOINTS
# --------------------------------------------------

@router.post(
    "/astronauts",
    response_model=AstronautOut,
    status_code=201,
)
def create_astronaut(
    payload: AstronautCreate,
    db: Session = Depends(get_db),
):
    if db.get(Astronaut, payload.id):
        raise HTTPException(409, "Astronaut ID already exists")

    obj = Astronaut(**payload.model_dump())

    db.add(obj)
    db.commit()
    db.refresh(obj)

    return obj


@router.get(
    "/astronauts",
    response_model=list[AstronautOut],
)
def list_astronauts(
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(Astronaut).order_by(Astronaut.id)
    ).all()


@router.get(
    "/astronauts/{astronaut_id}",
    response_model=AstronautOut,
)
def get_astronaut(
    astronaut_id: str,
    db: Session = Depends(get_db),
):
    obj = db.get(Astronaut, astronaut_id)

    if not obj:
        raise HTTPException(404, "Astronaut not found")

    return obj


# --------------------------------------------------
# PERSONAL BASELINE
# --------------------------------------------------

@router.get("/astronauts/{astronaut_id}/baseline")
def get_personal_baseline(
    astronaut_id: str,
    metric: str = Query(...),
    db: Session = Depends(get_db),
):
    astronaut = db.get(Astronaut, astronaut_id)

    if not astronaut:
        raise HTTPException(404, "Astronaut not found")

    if metric not in PLAUSIBILITY:
        raise HTTPException(
            422,
            f"Unsupported metric: {metric}",
        )

    historical_measurements = db.scalars(
        select(Measurement)
        .where(
            Measurement.astronaut_id == astronaut_id,
            Measurement.metric == metric,
        )
        .order_by(Measurement.measured_at.asc())
    ).all()

    baseline = calculate_personal_baseline(
        measurements=historical_measurements,
        astronaut_id=astronaut_id,
        metric=metric,
    )

    return {
        "astronaut": {
            "id": astronaut.id,
            "name": astronaut.name,
        },
        "baseline": baseline,
        "disclaimer": (
            "Descriptive software analysis using historical "
            "measurements. Not a diagnosis or clinical assessment."
        ),
    }


# --------------------------------------------------
# CREW MEASUREMENT ENDPOINTS
# --------------------------------------------------

@router.post(
    "/measurements",
    response_model=MeasurementOut,
    status_code=201,
)
def create_measurement(
    payload: MeasurementCreate,
    db: Session = Depends(get_db),
):
    if not db.get(Astronaut, payload.astronaut_id):
        raise HTTPException(404, "Astronaut not found")

    try:
        validate_measurement(
            payload.metric,
            payload.value,
            payload.unit,
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc))

    data = payload.model_dump(
        exclude={"measured_at", "metadata"}
    )

    obj = Measurement(
        **data,
        measured_at=(
            payload.measured_at
            or datetime.now(timezone.utc)
        ),
        metadata_json=payload.metadata,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    return obj


@router.get(
    "/measurements",
    response_model=list[MeasurementOut],
)
def list_measurements(
    astronaut_id: str | None = None,
    metric: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    query = (
        select(Measurement)
        .order_by(desc(Measurement.measured_at))
        .limit(limit)
    )

    if astronaut_id:
        query = query.where(
            Measurement.astronaut_id == astronaut_id
        )

    if metric:
        query = query.where(
            Measurement.metric == metric
        )

    return db.scalars(query).all()


# --------------------------------------------------
# MEASUREMENT DEVIATION
# --------------------------------------------------

@router.get("/measurements/{measurement_id}/deviation")
def measurement_deviation(
    measurement_id: int,
    db: Session = Depends(get_db),
):
    measurement = db.get(Measurement, measurement_id)

    if not measurement:
        raise HTTPException(404, "Measurement not found")

    astronaut = db.get(
        Astronaut,
        measurement.astronaut_id,
    )

    if not astronaut:
        raise HTTPException(404, "Astronaut not found")

    historical_measurements = db.scalars(
        select(Measurement)
        .where(
            Measurement.astronaut_id == measurement.astronaut_id,
            Measurement.metric == measurement.metric,
            Measurement.measured_at < measurement.measured_at,
        )
        .order_by(Measurement.measured_at.asc())
    ).all()

    baseline = calculate_personal_baseline(
        measurements=historical_measurements,
        astronaut_id=measurement.astronaut_id,
        metric=measurement.metric,
    )

    deviation = assess_deviation(
        measurement=measurement,
        baseline=baseline,
    )

    return {
        "measurement_id": measurement.id,
        "astronaut": {
            "id": astronaut.id,
            "name": astronaut.name,
        },
        "measurement": {
            "metric": measurement.metric,
            "value": measurement.value,
            "unit": measurement.unit,
            "measured_at": measurement.measured_at.isoformat(),
            "quality": measurement.quality,
            "simulated": measurement.simulated,
        },
        "baseline": baseline,
        "deviation": deviation,
        "disclaimer": (
            "Statistical software analysis only. "
            "Not a medical diagnosis or clinical alert."
        ),
    }


# --------------------------------------------------
# MEASUREMENT ASSESSMENT
# --------------------------------------------------

@router.get("/measurements/{measurement_id}/assessment")
def assessment(
    measurement_id: int,
    db: Session = Depends(get_db),
):
    obj = db.get(Measurement, measurement_id)

    if not obj:
        raise HTTPException(404, "Measurement not found")

    return {
        "measurement_id": obj.id,
        "alerts": assess_measurement(obj),
        "disclaimer": (
            "Prototype support only; "
            "not a diagnosis or clinical alert."
        ),
    }


# --------------------------------------------------
# ALERT GENERATION
# --------------------------------------------------

@router.post("/alerts/generate/{measurement_id}")
def create_alert(
    measurement_id: int,
    db: Session = Depends(get_db),
):
    try:
        return generate_alert(
            db=db,
            measurement_id=measurement_id,
        )

    except ValueError as exc:
        raise HTTPException(404, str(exc))


# --------------------------------------------------
# ALERT RETRIEVAL
# --------------------------------------------------

@router.get("/alerts")
def list_alerts(
    astronaut_id: str | None = None,
    level: str | None = None,
    status: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    query = select(Alert).order_by(
        desc(Alert.created_at)
    )

    if astronaut_id:
        query = query.where(
            Alert.astronaut_id == astronaut_id
        )

    if level:
        if level not in ("info", "watch", "review"):
            raise HTTPException(422, "Invalid alert level")

        query = query.where(Alert.level == level)

    if status:
        if status not in ("open", "acknowledged", "resolved"):
            raise HTTPException(422, "Invalid alert status")

        query = query.where(Alert.status == status)

    alerts = db.scalars(
        query.limit(limit)
    ).all()

    return {
        "total": len(alerts),
        "alerts": [
            {
                "id": alert.id,
                "astronaut_id": alert.astronaut_id,
                "measurement_id": alert.measurement_id,
                "level": alert.level,
                "status": alert.status,
                "metric": alert.metric,
                "observed_value": alert.observed_value,
                "unit": alert.unit,
                "baseline_median": alert.baseline_median,
                "robust_deviation": alert.robust_deviation,
                "message": alert.message,
                "reason": alert.reason,
                "recommended_action": alert.recommended_action,
                "simulated": alert.simulated,
                "created_at": alert.created_at.isoformat(),
            }
            for alert in alerts
        ],
        "disclaimer": (
            "Prototype statistical alerts only. "
            "Not a diagnosis or clinical alert."
        ),
    }


# --------------------------------------------------
# SINGLE ALERT DETAILS
# --------------------------------------------------

@router.get("/alerts/{alert_id}")
def get_alert(
    alert_id: int,
    db: Session = Depends(get_db),
):
    alert = db.get(Alert, alert_id)

    if not alert:
        raise HTTPException(404, "Alert not found")

    return {
        "id": alert.id,
        "astronaut_id": alert.astronaut_id,
        "measurement_id": alert.measurement_id,
        "level": alert.level,
        "status": alert.status,
        "metric": alert.metric,
        "observed_value": alert.observed_value,
        "unit": alert.unit,
        "baseline_median": alert.baseline_median,
        "median_absolute_deviation": alert.median_absolute_deviation,
        "robust_sigma": alert.robust_sigma,
        "robust_deviation": alert.robust_deviation,
        "direction": alert.direction,
        "message": alert.message,
        "reason": alert.reason,
        "recommended_action": alert.recommended_action,
        "simulated": alert.simulated,
        "baseline_snapshot": alert.baseline_snapshot,
        "detection_snapshot": alert.detection_snapshot,
        "created_at": alert.created_at.isoformat(),
        "acknowledged_at": (
            alert.acknowledged_at.isoformat()
            if alert.acknowledged_at else None
        ),
        "resolved_at": (
            alert.resolved_at.isoformat()
            if alert.resolved_at else None
        ),
        "disclaimer": (
            "Prototype statistical alert. "
            "Not a medical diagnosis or clinical alert."
        ),
    }


# --------------------------------------------------
# ACKNOWLEDGE ALERT
# --------------------------------------------------

@router.patch("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
):
    alert = db.get(Alert, alert_id)

    if not alert:
        raise HTTPException(404, "Alert not found")

    if alert.status != "open":
        raise HTTPException(
            409,
            f"Cannot acknowledge alert with status '{alert.status}'. "
            "Only open alerts can be acknowledged.",
        )

    alert.status = "acknowledged"
    alert.acknowledged_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(alert)

    return {
        "success": True,
        "alert_id": alert.id,
        "status": alert.status,
        "acknowledged_at": alert.acknowledged_at.isoformat(),
        "message": "Alert acknowledged successfully.",
    }


# --------------------------------------------------
# RESOLVE ALERT
# --------------------------------------------------

@router.patch("/alerts/{alert_id}/resolve")
def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db),
):
    alert = db.get(Alert, alert_id)

    if not alert:
        raise HTTPException(404, "Alert not found")

    if alert.status not in ("open", "acknowledged"):
        raise HTTPException(
            409,
            f"Cannot resolve alert with status '{alert.status}'.",
        )

    alert.status = "resolved"
    alert.resolved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(alert)

    return {
        "success": True,
        "alert_id": alert.id,
        "status": alert.status,
        "resolved_at": alert.resolved_at.isoformat(),
        "message": "Alert resolved successfully.",
    }


# ==================================================
# ENVIRONMENTAL MONITORING API
# ==================================================


# --------------------------------------------------
# CREATE ENVIRONMENTAL MEASUREMENT
# --------------------------------------------------

@router.post(
    "/environment",
    response_model=EnvironmentalMeasurementOut,
    status_code=201,
)
def create_environmental_measurement(
    payload: EnvironmentalMeasurementCreate,
    db: Session = Depends(get_db),
):

    expected_unit = ENVIRONMENT_UNITS.get(payload.metric)

    if expected_unit is None:
        raise HTTPException(
            422,
            "Unsupported environmental metric.",
        )

    if payload.unit != expected_unit:
        raise HTTPException(
            422,
            f"Invalid unit for {payload.metric}. "
            f"Expected '{expected_unit}'.",
        )

    if not math.isfinite(payload.value):
        raise HTTPException(
            422,
            "Measurement value must be finite.",
        )

    data = payload.model_dump(
        exclude={
            "measured_at",
            "metadata",
        }
    )

    obj = EnvironmentalMeasurement(
        **data,
        measured_at=(
            payload.measured_at
            or datetime.now(timezone.utc)
        ),
        metadata_json=payload.metadata,
    )

    try:
        db.add(obj)
        db.commit()
        db.refresh(obj)

    except Exception:
        db.rollback()
        raise

    return obj


# --------------------------------------------------
# LIST ENVIRONMENTAL MEASUREMENTS
# --------------------------------------------------

@router.get(
    "/environment",
    response_model=list[EnvironmentalMeasurementOut],
)
def list_environmental_measurements(
    metric: str | None = None,
    zone: str | None = None,
    source: str | None = None,
    quality: str | None = None,
    simulated: bool | None = None,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):

    query = select(
        EnvironmentalMeasurement
    ).order_by(
        desc(EnvironmentalMeasurement.measured_at)
    )

    if metric:
        if metric not in ENVIRONMENT_UNITS:
            raise HTTPException(
                422,
                "Invalid environmental metric.",
            )

        query = query.where(
            EnvironmentalMeasurement.metric == metric
        )

    if zone:
        query = query.where(
            EnvironmentalMeasurement.zone == zone
        )

    if source:
        query = query.where(
            EnvironmentalMeasurement.source == source
        )

    if quality:
        if quality not in ("good", "low", "unknown"):
            raise HTTPException(
                422,
                "Invalid quality value.",
            )

        query = query.where(
            EnvironmentalMeasurement.quality == quality
        )

    if simulated is not None:
        query = query.where(
            EnvironmentalMeasurement.simulated == simulated
        )

    query = query.limit(limit)

    return db.scalars(query).all()


# --------------------------------------------------
# LATEST ENVIRONMENTAL READING PER METRIC
# --------------------------------------------------

@router.get("/environment/latest")
def latest_environmental_measurements(
    zone: str | None = None,
    db: Session = Depends(get_db),
):

    query = select(
        EnvironmentalMeasurement
    ).order_by(
        desc(EnvironmentalMeasurement.measured_at)
    )

    if zone:
        query = query.where(
            EnvironmentalMeasurement.zone == zone
        )

    records = db.scalars(query).all()

    latest = {}

    for record in records:

        if record.metric not in latest:

            latest[record.metric] = {
                "id": record.id,
                "metric": record.metric,
                "label": ENVIRONMENT_LABELS.get(
                    record.metric,
                    record.metric,
                ),
                "value": record.value,
                "unit": record.unit,
                "zone": record.zone,
                "sensor_id": record.sensor_id,
                "measured_at": record.measured_at.isoformat(),
                "source": record.source,
                "simulated": record.simulated,
                "quality": record.quality,
            }

    return {
        "total_metrics": len(latest),
        "zone": zone or "all",
        "readings": list(latest.values()),
        "disclaimer": (
            "Environmental telemetry prototype. "
            "Values may be simulated and are not validated "
            "spacecraft safety limits."
        ),
    }


# --------------------------------------------------
# ENVIRONMENTAL SUMMARY
# --------------------------------------------------

@router.get("/environment/summary")
def environmental_summary(
    zone: str | None = None,
    db: Session = Depends(get_db),
):

    query = select(
        EnvironmentalMeasurement
    ).order_by(
        desc(EnvironmentalMeasurement.measured_at)
    )

    if zone:
        query = query.where(
            EnvironmentalMeasurement.zone == zone
        )

    records = db.scalars(query).all()

    latest = {}

    for record in records:

        if record.metric not in latest:
            latest[record.metric] = record

    simulated_count = sum(
        1 for record in records if record.simulated
    )

    quality_counts = {
        "good": 0,
        "low": 0,
        "unknown": 0,
    }

    for record in records:
        if record.quality in quality_counts:
            quality_counts[record.quality] += 1

    readings = []

    for metric, record in latest.items():

        readings.append({
            "metric": metric,
            "label": ENVIRONMENT_LABELS.get(
                metric,
                metric,
            ),
            "value": record.value,
            "unit": record.unit,
            "zone": record.zone,
            "quality": record.quality,
            "simulated": record.simulated,
            "measured_at": record.measured_at.isoformat(),
        })

    return {
        "zone": zone or "all",
        "total_records": len(records),
        "latest_metric_count": len(latest),
        "simulated_records": simulated_count,
        "recorded_records": len(records) - simulated_count,
        "quality_distribution": quality_counts,
        "latest_readings": readings,
        "disclaimer": (
            "Environmental software monitoring prototype. "
            "No readings represent validated spacecraft "
            "safety thresholds or medical assessments."
        ),
    }