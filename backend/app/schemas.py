from datetime import datetime, date
from typing import Literal

from pydantic import (
    BaseModel,
    Field,
    ConfigDict,
    model_validator,
)


# --------------------------------------------------
# CREW HEALTH METRICS
# --------------------------------------------------

Metric = Literal[
    "heart_rate",
    "spo2",
    "temperature",
    "systolic_bp",
    "diastolic_bp",
    "sleep_hours",
    "mood_score",
    "activity_minutes",
    "glucose",
]


# --------------------------------------------------
# ASTRONAUT SCHEMAS
# --------------------------------------------------

class AstronautCreate(BaseModel):
    id: str = Field(min_length=1, max_length=36)
    name: str
    mission_role: str = "Crew member"
    mission_day: int = Field(default=1, ge=1)
    is_simulated: bool = True


class AstronautOut(AstronautCreate):
    model_config = ConfigDict(from_attributes=True)

    created_at: datetime


# --------------------------------------------------
# CREW MEASUREMENT SCHEMAS
# --------------------------------------------------

class MeasurementCreate(BaseModel):
    astronaut_id: str
    metric: Metric
    value: float
    unit: str
    measured_at: datetime | None = None

    source: Literal[
        "manual",
        "simulator",
        "wearable",
        "device",
    ] = "manual"

    simulated: bool = False

    quality: Literal[
        "good",
        "low",
        "unknown",
    ] = "unknown"

    metadata: dict = Field(default_factory=dict)


class MeasurementOut(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )

    id: int
    astronaut_id: str
    metric: str
    value: float
    unit: str
    measured_at: datetime
    source: str
    simulated: bool
    quality: str

    metadata: dict = Field(
        validation_alias="metadata_json",
    )


# --------------------------------------------------
# ENVIRONMENTAL METRICS
# --------------------------------------------------

EnvironmentalMetric = Literal[
    "cabin_temperature",
    "relative_humidity",
    "oxygen_concentration",
    "cabin_pressure",
    "co2_concentration",
    "radiation_dose_rate",
]


# --------------------------------------------------
# ENVIRONMENTAL MEASUREMENT CREATE
# --------------------------------------------------

class EnvironmentalMeasurementCreate(BaseModel):
    metric: EnvironmentalMetric
    value: float
    unit: str
    measured_at: datetime | None = None

    sensor_id: str | None = Field(
        default=None,
        max_length=80,
    )

    zone: str = Field(
        default="main_cabin",
        min_length=1,
        max_length=80,
    )

    source: Literal[
        "manual",
        "simulator",
        "device",
    ] = "simulator"

    simulated: bool = True

    quality: Literal[
        "good",
        "low",
        "unknown",
    ] = "unknown"

    metadata: dict = Field(default_factory=dict)


# --------------------------------------------------
# ENVIRONMENTAL MEASUREMENT RESPONSE
# --------------------------------------------------

class EnvironmentalMeasurementOut(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )

    id: int
    metric: str
    value: float
    unit: str
    measured_at: datetime
    sensor_id: str | None
    zone: str
    source: str
    simulated: bool
    quality: str

    metadata: dict = Field(
        validation_alias="metadata_json",
    )


# --------------------------------------------------
# GROUND CONTROL — COMMUNICATION SCHEMAS
# --------------------------------------------------

class CommunicationMessageCreate(BaseModel):
    sender: str = Field(
        default="Ground Control",
        min_length=1,
        max_length=100,
    )

    recipient: str = Field(
        default="Crew",
        min_length=1,
        max_length=100,
    )

    message: str = Field(
        min_length=1,
        max_length=5000,
    )

    direction: Literal[
        "crew_to_ground",
        "ground_to_crew",
    ]

    metadata: dict = Field(default_factory=dict)


class CommunicationMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    direction: str
    sender: str
    recipient: str
    message: str
    status: str
    created_at: datetime
    scheduled_delivery_at: datetime
    delivered_at: datetime | None
    delay_seconds: int
    simulated: bool

    metadata: dict = Field(
        validation_alias="metadata_json",
    )


class CommunicationLinkSettings(BaseModel):
    delay_seconds: int = Field(
        default=1200,
        ge=0,
        le=86400,
    )

    link_status: Literal[
        "online",
        "blackout",
    ] = "online"


class CommunicationLinkSettingsOut(CommunicationLinkSettings):
    updated_at: datetime


# ==================================================
# DAILY CHECK-IN SCHEMAS
# ==================================================

class DailyCheckInCreate(BaseModel):

    astronaut_id: str

    checkin_date: date = Field(
        default_factory=date.today,
    )

    mood_score: int = Field(
        ge=1,
        le=10,
    )

    stress_score: int = Field(
        ge=1,
        le=10,
    )

    fatigue_score: int = Field(
        ge=1,
        le=10,
    )

    sleep_quality_score: int = Field(
        ge=1,
        le=10,
    )

    notes: str | None = Field(
        default=None,
        max_length=2000,
    )

    simulated: bool = True

    metadata: dict = Field(
        default_factory=dict,
    )


class DailyCheckInOut(BaseModel):

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )

    id: int
    astronaut_id: str
    checkin_date: date

    mood_score: int
    stress_score: int
    fatigue_score: int
    sleep_quality_score: int

    notes: str | None
    simulated: bool
    created_at: datetime

    metadata: dict = Field(
        validation_alias="metadata_json",
    )


# ==================================================
# COGNITIVE ASSESSMENT SCHEMAS
# ==================================================

class CognitiveAssessmentCreate(BaseModel):

    astronaut_id: str

    duration_seconds: int = Field(
        default=180,
        ge=1,
        le=600,
    )

    stimuli_count: int = Field(
        ge=1,
        le=1000,
    )

    valid_responses: int = Field(
        ge=0,
        le=1000,
    )

    mean_reaction_ms: float = Field(
        gt=0,
        le=10000,
    )

    median_reaction_ms: float = Field(
        gt=0,
        le=10000,
    )

    lapses_count: int = Field(
        default=0,
        ge=0,
        le=1000,
    )

    simulated: bool = True

    metadata: dict = Field(
        default_factory=dict,
    )

    @model_validator(mode="after")
    def validate_response_counts(self):

        if self.valid_responses > self.stimuli_count:
            raise ValueError(
                "Valid responses cannot exceed stimuli count."
            )

        if self.lapses_count > self.stimuli_count:
            raise ValueError(
                "Lapses cannot exceed stimuli count."
            )

        return self


class CognitiveAssessmentOut(BaseModel):

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )

    id: int
    astronaut_id: str

    duration_seconds: int

    stimuli_count: int
    valid_responses: int

    mean_reaction_ms: float
    median_reaction_ms: float

    lapses_count: int

    completed_at: datetime

    simulated: bool

    metadata: dict = Field(
        validation_alias="metadata_json",
    )